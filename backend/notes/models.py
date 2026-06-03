import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


# Preset sepia-friendly palette used for the default categories created per user.
DEFAULT_CATEGORIES = [
    ("Grocery list", "#7a8450"),     # olive
    ("Money ideas", "#8a6d3b"),      # bronze
    ("Random thoughts", "#9c6b4a"),  # terracotta
    ("Projects", "#5b6b7a"),         # slate
]


class Category(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="categories",
    )
    name = models.CharField(max_length=120)
    color = models.CharField(max_length=9, default="#8a6d3b")  # hex, e.g. #8a6d3b
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "name"], name="unique_category_name_per_user"
            )
        ]
        verbose_name_plural = "categories"

    def __str__(self):
        return f"{self.name} ({self.user})"


class NoteManager(models.Manager):
    """Default manager: only live (non-trashed) notes."""

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class Note(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notes",
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        related_name="notes",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=255, blank=True, default="")
    content = models.TextField(blank=True, default="")  # markdown source
    is_public = models.BooleanField(default=False)
    public_id = models.UUIDField(
        default=uuid.uuid4, unique=True, editable=False, db_index=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Client-supplied edit time, used for last-write-wins conflict resolution.
    client_updated_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = NoteManager()  # live notes only
    all_objects = models.Manager()  # includes trashed

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.title or f"Untitled note {self.pk}"

    @property
    def is_trashed(self):
        return self.deleted_at is not None

    def soft_delete(self):
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at", "updated_at"])

    def restore(self):
        self.deleted_at = None
        self.save(update_fields=["deleted_at", "updated_at"])


def attachment_upload_path(instance, filename):
    # media/attachments/<user_id>/<note_public_id>/<uuid>__<original-name>
    return (
        f"attachments/{instance.note.user_id}/{instance.note.public_id}/"
        f"{uuid.uuid4().hex}__{filename}"
    )


class Attachment(models.Model):
    note = models.ForeignKey(
        Note,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    file = models.FileField(upload_to=attachment_upload_path)
    original_name = models.CharField(max_length=255, blank=True, default="")
    content_type = models.CharField(max_length=120, blank=True, default="")
    size = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return self.original_name or self.file.name
