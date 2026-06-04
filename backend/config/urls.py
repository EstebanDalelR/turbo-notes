"""URL configuration for the Turbo backend."""
import os

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import FileResponse, HttpResponse, HttpResponseNotFound
from django.urls import include, path, re_path
from django.views.static import serve as static_serve


def health(_request):
    """Liveness endpoint for kamal-proxy / uptime checks."""
    return HttpResponse("OK", content_type="text/plain")


def spa_index(_request, *_args, **_kwargs):
    """Serve the built PWA's index.html for client-side routes (deep links like
    /note/<id> or /n/<uuid>). Real static files are served by WhiteNoise before
    a request ever reaches here; this is only the navigation fallback."""
    pwa_root = getattr(settings, "WHITENOISE_ROOT", "")
    index_path = os.path.join(pwa_root, "index.html") if pwa_root else ""
    if index_path and os.path.exists(index_path):
        return FileResponse(open(index_path, "rb"), content_type="text/html")
    # No built frontend present (e.g. running the API standalone in dev).
    return HttpResponseNotFound("Frontend build not found.")


urlpatterns = [
    path("up/", health),
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("notes.urls")),
]

if settings.DEBUG:
    # Dev: Django serves uploads; the Vite dev server serves the SPA.
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # Production: serve user uploads, then fall back to the SPA shell for any
    # path that isn't the API, admin, media, or a static asset.
    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            static_serve,
            {"document_root": settings.MEDIA_ROOT},
        ),
        re_path(r"^(?!api/|admin/|media/|static/).*$", spa_index),
    ]
