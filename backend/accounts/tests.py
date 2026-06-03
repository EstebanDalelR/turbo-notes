from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

User = get_user_model()


class RegisterTests(APITestCase):
    def test_register_creates_user_and_seeds_categories(self):
        resp = self.client.post(
            reverse("register"),
            {"username": "newbie", "email": "n@example.com", "password": "pw-secret-123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["username"], "newbie")
        user = User.objects.get(username="newbie")
        # The post_save signal seeds the four default categories.
        self.assertEqual(user.categories.count(), 4)

    def test_register_logs_the_user_in(self):
        self.client.post(
            reverse("register"),
            {"username": "newbie", "password": "pw-secret-123"},
            format="json",
        )
        # Session cookie is set, so an authenticated endpoint succeeds.
        self.assertEqual(self.client.get(reverse("me")).status_code, 200)

    def test_register_rejects_short_password(self):
        resp = self.client.post(
            reverse("register"),
            {"username": "newbie", "password": "short"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("password", resp.data)

    def test_register_rejects_duplicate_username(self):
        User.objects.create_user(username="taken", password="pw-secret-123")
        resp = self.client.post(
            reverse("register"),
            {"username": "taken", "password": "pw-secret-123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)


class LoginTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="kate", password="pw-secret-123")

    def test_login_success(self):
        resp = self.client.post(
            reverse("login"),
            {"username": "kate", "password": "pw-secret-123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["username"], "kate")

    def test_login_rejects_bad_password(self):
        resp = self.client.post(
            reverse("login"),
            {"username": "kate", "password": "wrong"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)


class SessionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="leo", password="pw-secret-123")

    def test_me_requires_authentication(self):
        self.assertEqual(self.client.get(reverse("me")).status_code, 403)

    def test_me_returns_current_user(self):
        self.client.force_authenticate(self.user)
        resp = self.client.get(reverse("me"))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["username"], "leo")

    def test_logout_clears_session(self):
        self.client.force_login(self.user)
        self.assertEqual(self.client.post(reverse("logout")).status_code, 204)
        # Session is gone, so the authenticated endpoint now refuses.
        self.assertEqual(self.client.get(reverse("me")).status_code, 403)
