from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Note

User = get_user_model()


class DefaultCategoriesTests(APITestCase):
    def test_new_user_gets_four_default_categories(self):
        user = User.objects.create_user(username="alice", password="pw-secret-123")
        names = set(user.categories.values_list("name", flat=True))
        self.assertEqual(
            names, {"Grocery list", "Money ideas", "Random thoughts", "Projects"}
        )
        self.assertTrue(all(c.is_default for c in user.categories.all()))


class NoteManagerTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="bob", password="pw-secret-123")

    def test_soft_delete_excludes_from_default_manager(self):
        note = Note.objects.create(user=self.user, title="hi")
        note.soft_delete()
        self.assertEqual(Note.objects.filter(pk=note.pk).count(), 0)
        self.assertEqual(Note.all_objects.filter(pk=note.pk).count(), 1)
        note.restore()
        self.assertEqual(Note.objects.filter(pk=note.pk).count(), 1)


class NoteAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="carol", password="pw-secret-123")
        self.client.force_authenticate(self.user)

    def test_create_and_autosave_note(self):
        resp = self.client.post(reverse("note-list"), {"title": "Draft"}, format="json")
        self.assertEqual(resp.status_code, 201)
        note_id = resp.data["id"]
        resp = self.client.patch(
            reverse("note-detail", args=[note_id]),
            {"content": "Hello", "client_updated_at": timezone.now().isoformat()},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["content"], "Hello")

    def test_last_write_wins_rejects_stale_update(self):
        now = timezone.now()
        note = Note.objects.create(
            user=self.user, content="fresh", client_updated_at=now
        )
        stale = (now - timedelta(minutes=5)).isoformat()
        resp = self.client.patch(
            reverse("note-detail", args=[note.id]),
            {"content": "stale overwrite", "client_updated_at": stale},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        note.refresh_from_db()
        self.assertEqual(note.content, "fresh")  # stale write ignored

    def test_destroy_is_soft_delete_and_restore(self):
        note = Note.objects.create(user=self.user, title="x")
        resp = self.client.delete(reverse("note-detail", args=[note.id]))
        self.assertEqual(resp.status_code, 204)
        # Not in the default list...
        self.assertEqual(self.client.get(reverse("note-list")).data, [])
        # ...but visible in the trash listing.
        trashed = self.client.get(reverse("note-list") + "?trashed=true").data
        self.assertEqual(len(trashed), 1)
        resp = self.client.post(reverse("note-restore", args=[note.id]))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(self.client.get(reverse("note-list")).data), 1)

    def test_cannot_use_another_users_category(self):
        other = User.objects.create_user(username="dave", password="pw-secret-123")
        their_cat = other.categories.first()
        resp = self.client.post(
            reverse("note-list"),
            {"title": "x", "category": their_cat.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)


class PublicNoteTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="erin", password="pw-secret-123")

    def test_private_note_404_for_anonymous(self):
        note = Note.objects.create(user=self.user, title="secret", is_public=False)
        url = reverse("public-note", args=[note.public_id])
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_public_note_readable_by_anonymous(self):
        note = Note.objects.create(user=self.user, title="shared", is_public=True)
        url = reverse("public-note", args=[note.public_id])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["title"], "shared")
        self.assertEqual(resp.data["author"], "erin")

    def test_trashed_public_note_404(self):
        note = Note.objects.create(user=self.user, title="shared", is_public=True)
        note.soft_delete()
        url = reverse("public-note", args=[note.public_id])
        self.assertEqual(self.client.get(url).status_code, 404)
