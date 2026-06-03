from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import RetrieveAPIView
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Attachment, Category, Note
from .serializers import (
    AttachmentSerializer,
    CategorySerializer,
    NoteSerializer,
    PublicNoteSerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer

    def get_queryset(self):
        return Category.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        category = self.get_object()
        # Detach notes rather than deleting them; they fall back to "uncategorized".
        category.notes.update(category=None)
        category.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class NoteViewSet(viewsets.ModelViewSet):
    serializer_class = NoteSerializer

    def _wants_trashed(self):
        return self.request.query_params.get("trashed", "").lower() in ("1", "true", "yes")

    def get_queryset(self):
        # restore/purge operate on trashed notes, so they need the full manager.
        if self.action in ("restore", "purge"):
            return Note.all_objects.filter(user=self.request.user).prefetch_related(
                "attachments"
            )
        # Show trashed notes in listings only when explicitly requested.
        if self._wants_trashed():
            qs = Note.all_objects.filter(user=self.request.user, deleted_at__isnull=False)
        else:
            qs = Note.objects.filter(user=self.request.user)
        return qs.prefetch_related("attachments")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def update(self, request, *args, **kwargs):
        """Autosave-friendly update with last-write-wins on client_updated_at."""
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        incoming = request.data.get("client_updated_at")
        stored = instance.client_updated_at

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        # Reject stale writes: if the client's edit is older than what we already
        # have, keep the stored version (last-write-wins by timestamp).
        if incoming and stored is not None:
            incoming_dt = serializer.validated_data.get("client_updated_at")
            if incoming_dt is not None and incoming_dt < stored:
                return Response(self.get_serializer(instance).data)

        self.perform_update(serializer)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        """Soft delete: move the note to the trash."""
        note = self.get_object()
        note.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        note = self.get_object()
        note.restore()
        return Response(self.get_serializer(note).data)

    @action(detail=True, methods=["delete"])
    def purge(self, request, pk=None):
        """Permanently delete the note (and its attachments / files via cascade)."""
        note = self.get_object()
        note.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = AttachmentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        return Attachment.objects.filter(note__user=self.request.user)

    def perform_create(self, serializer):
        note = get_object_or_404(
            Note.objects, pk=self.request.data.get("note"), user=self.request.user
        )
        upload = self.request.data.get("file")
        if upload is None:
            from rest_framework import serializers as drf_serializers

            raise drf_serializers.ValidationError({"file": "This field is required."})
        serializer.save(
            note=note,
            file=upload,
            original_name=getattr(upload, "name", ""),
            content_type=getattr(upload, "content_type", ""),
            size=getattr(upload, "size", 0),
        )


class PublicNoteView(RetrieveAPIView):
    """Anonymous read-only access to a single public, non-trashed note."""

    serializer_class = PublicNoteSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    lookup_field = "public_id"

    def get_queryset(self):
        return Note.objects.filter(is_public=True).prefetch_related("attachments")
