from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AttachmentViewSet,
    CategoryViewSet,
    NoteViewSet,
    PublicNoteView,
)

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("notes", NoteViewSet, basename="note")
router.register("attachments", AttachmentViewSet, basename="attachment")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "public/notes/<uuid:public_id>/",
        PublicNoteView.as_view(),
        name="public-note",
    ),
]
