from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from notes.models import DEFAULT_CATEGORIES, Category

User = get_user_model()


@receiver(post_save, sender=User)
def create_default_categories(sender, instance, created, **kwargs):
    """Give every new user the four default categories."""
    if not created:
        return
    Category.objects.bulk_create(
        [
            Category(user=instance, name=name, color=color, is_default=True)
            for name, color in DEFAULT_CATEGORIES
        ]
    )
