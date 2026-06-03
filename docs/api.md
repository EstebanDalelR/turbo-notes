# API reference

REST API served by Django REST Framework under `/api/`. All responses are JSON
unless noted. Auth is **session-cookie based** with CSRF protection on unsafe
methods — see [the auth flow](#auth--csrf) below.

- Base URL (dev): same-origin via the Vite proxy → `http://localhost:8000/api/`
- Auth: `SessionAuthentication`; all endpoints require login **except** the CSRF,
  register, login, and public-note endpoints.
- Permissions: every resource is scoped to the authenticated user.

## Auth & CSRF

| Method | Path | Auth | Body | Returns |
| --- | --- | --- | --- | --- |
| `GET` | `/api/auth/csrf/` | none | — | `{ csrfToken }` + sets `csrftoken` cookie |
| `POST` | `/api/auth/register/` | none | `{ username, email?, password }` | `201` user; logs in; seeds 4 categories |
| `POST` | `/api/auth/login/` | none | `{ username, password }` | `200` user, or `400` on bad creds |
| `POST` | `/api/auth/logout/` | required | — | `204` |
| `GET` | `/api/auth/me/` | required | — | current user, or `403` if anonymous |

**The flow:** call `GET /auth/csrf/` once to obtain the `csrftoken` cookie, then
send it back in the `X-CSRFToken` header on every `POST/PUT/PATCH/DELETE`. The
axios client does this automatically (`ensureCsrf()` +
`xsrfCookieName`/`xsrfHeaderName` in
[`api/client.ts`](../frontend/src/api/client.ts)). `password` must be ≥ 8 chars.

## Notes

Standard DRF router CRUD plus two custom actions. Queryset is the user's notes;
by default only **live** (non-trashed) notes.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/notes/` | list live notes; `?trashed=true` lists trashed instead |
| `POST` | `/api/notes/` | create |
| `GET` | `/api/notes/:id/` | retrieve |
| `PATCH` | `/api/notes/:id/` | **autosave update** — last-write-wins on `client_updated_at` |
| `DELETE` | `/api/notes/:id/` | **soft delete** → moves to trash (`204`) |
| `POST` | `/api/notes/:id/restore/` | un-trash; returns the note |
| `DELETE` | `/api/notes/:id/purge/` | permanent delete + attachments (`204`) |

**Note shape:**

```json
{
  "id": 42,
  "title": "Groceries",
  "content": "- milk\n- eggs",
  "category": 3,
  "is_public": false,
  "public_id": "b1c0…uuid",
  "created_at": "2026-05-30T12:00:00Z",
  "updated_at": "2026-05-30T12:01:00Z",
  "client_updated_at": "2026-05-30T12:01:00Z",
  "deleted_at": null,
  "attachments": [ /* AttachmentSerializer */ ]
}
```

`id`, `public_id`, `created_at`, `updated_at`, `deleted_at` are read-only.
On `PATCH`, send `client_updated_at`; if it predates the stored value the server
keeps the stored version and returns it unchanged (the write is dropped). See
[offline-sync.md](./offline-sync.md).

## Categories

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/categories/` | list (with live `note_count`) |
| `POST` | `/api/categories/` | create; `{ name, color }` |
| `PATCH` | `/api/categories/:id/` | rename / recolor |
| `DELETE` | `/api/categories/:id/` | delete; notes fall back to uncategorized (`204`) |

`name` is unique per user. `is_default`, `created_at`, `note_count` are
read-only.

## Attachments

Multipart upload, tied to a note you own.

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/attachments/` | multipart: `note=<id>` + `file=<binary>` |
| `DELETE` | `/api/attachments/:id/` | remove one attachment |

**Attachment shape:**

```json
{
  "id": 7,
  "note": 42,
  "url": "http://host/media/attachments/1/uuid/uuid__photo.png",
  "original_name": "photo.png",
  "content_type": "image/png",
  "size": 18234,
  "created_at": "2026-05-30T12:02:00Z"
}
```

Max upload size is `MAX_UPLOAD_BYTES` (default 50 MB). `url` is an absolute URI
built from the request.

## Public (anonymous)

| Method | Path | Auth | Returns |
| --- | --- | --- | --- |
| `GET` | `/api/public/notes/<uuid>/` | **none** | read-only note projection |

Serves only notes with `is_public=true` and not trashed. The payload
(`PublicNoteSerializer`) is a minimal subset — `title`, `content`, `author`,
timestamps, `attachments` — with no internal IDs or flags. Un-sharing or trashing
a note makes its link `404` immediately. This backs the `/n/<uuid>` share page.
