"""Django settings — shares database.sqlite with FastAPI."""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

LUMINA_ENV = os.environ.get("LUMINA_ENV", "development").strip().lower()
IS_PRODUCTION = LUMINA_ENV in ("production", "prod")

_PLACEHOLDER_DJANGO_KEYS = {
    "",
    "lumina-django-dev-key-change-for-production",
    "change-me-in-production",
    "REPLACE_WITH_STRONG_DJANGO_SECRET",
}

_raw_secret = (os.environ.get("DJANGO_SECRET_KEY") or "").strip()
if IS_PRODUCTION:
    if _raw_secret in _PLACEHOLDER_DJANGO_KEYS:
        raise RuntimeError(
            "DJANGO_SECRET_KEY must be set to a strong non-placeholder value "
            "when LUMINA_ENV=production"
        )
    SECRET_KEY = _raw_secret
else:
    SECRET_KEY = _raw_secret or "lumina-django-dev-key-change-for-production"

DEBUG = os.environ.get("DJANGO_DEBUG", "0" if IS_PRODUCTION else "1") not in (
    "0",
    "false",
    "False",
)
if IS_PRODUCTION and DEBUG:
    raise RuntimeError("DJANGO_DEBUG must be disabled when LUMINA_ENV=production")

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get(
        "DJANGO_ALLOWED_HOSTS",
        "127.0.0.1,localhost",
    ).split(",")
    if h.strip()
]

# Same database.sqlite as FastAPI; allow POST from Vite (5173) / API (58888) if you cross-post to admin.
CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "DJANGO_CSRF_TRUSTED_ORIGINS",
        "http://127.0.0.1:5173,http://127.0.0.1:8001,http://127.0.0.1:58888",
    ).split(",")
    if o.strip()
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "lumina.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "lumina.wsgi.application"

_db_path = os.environ.get("DATABASE_PATH")
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": Path(_db_path).expanduser().resolve()
        if _db_path
        else BASE_DIR / "database.sqlite",
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
