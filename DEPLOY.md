# Deploying Turbo Notes

Production runs as a single Docker container, deployed with **Kamal 2** to your
DigitalOcean droplet (`134.199.180.115`) and fronted by **kamal-proxy** (the same
setup as your Rails apps). One container serves everything from one origin:

- Vite builds the React PWA → Django serves it via **gunicorn + WhiteNoise**
- `/api`, `/admin`, `/media`, and the SPA all live at `https://turbonotes.estebandalelr.co`
- **SQLite** (`db.sqlite3`) and **media uploads** live on a persistent Docker
  volume (`turbonotes_data` → `/data`), so they survive every deploy

Files involved: `Dockerfile`, `docker-entrypoint.sh`, `.dockerignore`,
`config/deploy.yml`, `.kamal/secrets`.

---

## 1. DNS (Cloudflare, DNS-only)

In Cloudflare for `estebandalelr.co`, add an **A record**:

| Type | Name         | Content           | Proxy status        |
| ---- | ------------ | ----------------- | ------------------- |
| A    | `turbonotes` | `134.199.180.115` | **DNS only** (grey) |

Grey cloud is required so kamal-proxy can complete the Let's Encrypt HTTP-01
challenge directly on port 80. Verify before deploying:

```bash
dig +short turbonotes.estebandalelr.co   # should print 134.199.180.115
```

## 2. Secrets

Edit `.kamal/secrets` (gitignored) or export these in your shell before deploying:

```bash
# Docker Hub access token for codetopusinc (Read/Write)
export KAMAL_REGISTRY_PASSWORD='dckr_pat_...'

# A fresh Django secret key
export DJANGO_SECRET_KEY="$(cd backend && .venv/bin/python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')"

# Optional — enables online voice dictation (Groq Whisper). Leave empty to use
# the on-device model only.
export GROQ_API_KEY=''
```

Log Docker into the registry locally (so Kamal can push the image):

```bash
docker login -u codetopusinc
```

## 3. First deploy

From the **repo root**:

```bash
kamal setup
```

`kamal setup` installs Docker on the server if needed, boots kamal-proxy,
provisions the `turbonotes_data` volume, builds + pushes the image, and starts
the app. On boot the container runs migrations and `collectstatic` automatically
(see `docker-entrypoint.sh`).

Then create your admin/login user:

```bash
kamal createsuperuser      # alias for: manage.py createsuperuser
```

Open **https://turbonotes.estebandalelr.co** — register/log in and you're live.
(The first request may take a few seconds while the TLS cert is issued.)

## 4. Subsequent deploys

After committing changes:

```bash
kamal deploy
```

Handy aliases (defined in `config/deploy.yml`):

```bash
kamal logs            # tail app logs
kamal console         # Django shell
kamal shell           # bash in the container
kamal migrate         # run migrations manually
kamal app exec --reuse "python manage.py check --deploy"   # prod settings audit
```

## 5. Backups (do this!)

All durable state is in the `turbonotes_data` volume (`db.sqlite3` + `media/`).
Back it up off-server periodically. On the droplet:

```bash
docker run --rm \
  -v turbonotes_data:/data:ro \
  -v "$PWD":/backup \
  alpine tar czf /backup/turbonotes-$(date +%F).tar.gz -C /data .
```

Then copy the tarball off the server (e.g. `scp` to your machine or push to
object storage). Restore by extracting back into the volume with the app stopped.

---

## Notes & troubleshooting

- **PWA / service worker** need HTTPS — satisfied by kamal-proxy's Let's Encrypt
  cert. The SW is served at the site root so it controls the whole origin.
- **Voice dictation:** with `GROQ_API_KEY` set, the server transcribes via Groq
  Whisper; without it, the browser falls back to the on-device model (a ~24 MB
  one-time download fetched from Hugging Face on first use).
- **Cert won't issue?** Confirm the A record is DNS-only (grey cloud) and
  port 80/443 reach the droplet. Watch `kamal proxy logs`.
- **413 on uploads:** the app caps uploads at 50 MB (`MAX_UPLOAD_BYTES`). Raise
  it by adding `MAX_UPLOAD_BYTES` to `env.clear` in `config/deploy.yml`.
- **Switching to Postgres later:** add a `postgres` accessory (like your
  codetopus `db`) and point `DATABASES` at it via env; media would then be the
  only thing needing the volume.
