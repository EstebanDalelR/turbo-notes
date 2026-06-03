from django.contrib import admin

from .models import Attachment, Category, Note


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "color", "is_default", "created_at")
    list_filter = ("is_default",)
    search_fields = ("name", "user__username")


class AttachmentInline(admin.TabularInline):
    model = Attachment
    extra = 0


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "category", "is_public", "updated_at", "deleted_at")
    list_filter = ("is_public",)
    search_fields = ("title", "content", "user__username")
    inlines = [AttachmentInline]

    def get_queryset(self, request):
        # Include trashed notes in the admin.
        return Note.all_objects.all()


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ("original_name", "note", "content_type", "size", "created_at")
