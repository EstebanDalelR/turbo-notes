from rest_framework import serializers

from .models import Attachment, Category, Note


class CategorySerializer(serializers.ModelSerializer):
    note_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name", "color", "is_default", "created_at", "note_count"]
        read_only_fields = ["id", "is_default", "created_at", "note_count"]

    def get_note_count(self, obj):
        # Live (non-trashed) notes only.
        return obj.notes.filter(deleted_at__isnull=True).count()


class AttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = ["id", "note", "url", "original_name", "content_type", "size", "created_at"]
        read_only_fields = ["id", "url", "content_type", "size", "created_at"]

    def get_url(self, obj):
        if not obj.file:
            return None
        request = self.context.get("request")
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url


class NoteSerializer(serializers.ModelSerializer):
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Note
        fields = [
            "id",
            "title",
            "content",
            "category",
            "is_public",
            "public_id",
            "created_at",
            "updated_at",
            "client_updated_at",
            "deleted_at",
            "attachments",
        ]
        read_only_fields = ["id", "public_id", "created_at", "updated_at", "deleted_at"]

    def validate_category(self, category):
        # A note may only reference one of its owner's categories.
        if category is None:
            return category
        request = self.context.get("request")
        if request and category.user_id != request.user.id:
            raise serializers.ValidationError("Category does not belong to you.")
        return category


class PublicNoteSerializer(serializers.ModelSerializer):
    """Read-only payload served for shared (public) notes to anonymous viewers."""

    attachments = AttachmentSerializer(many=True, read_only=True)
    author = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Note
        fields = [
            "title",
            "content",
            "public_id",
            "author",
            "created_at",
            "updated_at",
            "attachments",
        ]
