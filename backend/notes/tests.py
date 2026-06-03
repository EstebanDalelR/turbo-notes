from datetime import timedelta
from io import BytesIO
from unittest import mock

import requests
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Attachment, Note

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


class TranscribeTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="frank", password="pw-secret-123")
        self.client.force_authenticate(self.user)
        self.url = reverse("transcribe")

    def _audio(self):
        clip = BytesIO(b"fake-audio-bytes")
        clip.name = "clip.webm"
        return clip

    def test_requires_authentication(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(self.url).status_code, 403)

    @override_settings(GROQ_API_KEY="")
    def test_503_when_unconfigured(self):
        resp = self.client.post(self.url, {"audio": self._audio()}, format="multipart")
        self.assertEqual(resp.status_code, 503)

    @override_settings(GROQ_API_KEY="test-key")
    def test_400_without_audio(self):
        self.assertEqual(self.client.post(self.url).status_code, 400)

    @override_settings(GROQ_API_KEY="test-key", GROQ_MODEL="whisper-large-v3")
    @mock.patch("notes.views.requests.post")
    def test_proxies_to_groq_and_returns_text(self, mock_post):
        mock_post.return_value = mock.Mock(
            status_code=200, json=lambda: {"text": "hello world"}
        )
        resp = self.client.post(
            self.url,
            {"audio": self._audio(), "language": "en"},
            format="multipart",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["text"], "hello world")
        # The language hint is forwarded; 'auto' would be omitted instead.
        _, kwargs = mock_post.call_args
        self.assertEqual(kwargs["data"]["language"], "en")
        self.assertEqual(kwargs["data"]["model"], "whisper-large-v3")

    @override_settings(GROQ_API_KEY="test-key")
    @mock.patch("notes.views.requests.post")
    def test_auto_language_is_omitted(self, mock_post):
        mock_post.return_value = mock.Mock(status_code=200, json=lambda: {"text": "hi"})
        resp = self.client.post(
            self.url,
            {"audio": self._audio(), "language": "auto"},
            format="multipart",
        )
        self.assertEqual(resp.status_code, 200)
        _, kwargs = mock_post.call_args
        # 'auto' means "let Whisper detect" — no language key sent upstream.
        self.assertNotIn("language", kwargs["data"])

    @override_settings(GROQ_API_KEY="test-key")
    @mock.patch("notes.views.requests.post")
    def test_502_when_groq_unreachable(self, mock_post):
        mock_post.side_effect = requests.RequestException("boom")
        resp = self.client.post(self.url, {"audio": self._audio()}, format="multipart")
        self.assertEqual(resp.status_code, 502)

    @override_settings(GROQ_API_KEY="test-key")
    @mock.patch("notes.views.requests.post")
    def test_502_when_groq_returns_error(self, mock_post):
        mock_post.return_value = mock.Mock(status_code=400, text="bad request")
        resp = self.client.post(self.url, {"audio": self._audio()}, format="multipart")
        self.assertEqual(resp.status_code, 502)


class AttachmentTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="grace", password="pw-secret-123")
        self.client.force_authenticate(self.user)
        self.note = Note.objects.create(user=self.user, title="with files")

    def _upload(self, name="hello.txt", content=b"hello there", ctype="text/plain"):
        return SimpleUploadedFile(name, content, content_type=ctype)

    def test_upload_records_metadata(self):
        resp = self.client.post(
            reverse("attachment-list"),
            {"note": self.note.id, "file": self._upload()},
            format="multipart",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["original_name"], "hello.txt")
        self.assertEqual(resp.data["content_type"], "text/plain")
        self.assertEqual(resp.data["size"], len(b"hello there"))
        self.assertIsNotNone(resp.data["url"])

    def test_upload_requires_file(self):
        resp = self.client.post(
            reverse("attachment-list"), {"note": self.note.id}, format="multipart"
        )
        self.assertEqual(resp.status_code, 400)

    def test_cannot_attach_to_another_users_note(self):
        other = User.objects.create_user(username="heidi", password="pw-secret-123")
        their_note = Note.objects.create(user=other, title="theirs")
        resp = self.client.post(
            reverse("attachment-list"),
            {"note": their_note.id, "file": self._upload()},
            format="multipart",
        )
        self.assertEqual(resp.status_code, 404)

    def test_delete_removes_attachment(self):
        att = Attachment.objects.create(
            note=self.note, file=self._upload(), original_name="x.txt", size=3
        )
        resp = self.client.delete(reverse("attachment-detail", args=[att.id]))
        self.assertEqual(resp.status_code, 204)
        self.assertEqual(Attachment.objects.filter(pk=att.pk).count(), 0)

    def test_cannot_see_another_users_attachment(self):
        other = User.objects.create_user(username="ivan", password="pw-secret-123")
        their_note = Note.objects.create(user=other, title="theirs")
        att = Attachment.objects.create(
            note=their_note, file=self._upload(), original_name="x.txt", size=3
        )
        resp = self.client.get(reverse("attachment-detail", args=[att.id]))
        self.assertEqual(resp.status_code, 404)
