"""Read-only mapping to SQLite tables owned by FastAPI (managed = False)."""
from __future__ import annotations

from django.db import models


class LuminaUser(models.Model):
    id = models.AutoField(primary_key=True)
    email = models.TextField(unique=True)
    username = models.TextField(null=True, blank=True)
    password = models.TextField()
    name = models.TextField()

    class Meta:
        managed = False
        db_table = "users"
        verbose_name = "App user"
        verbose_name_plural = "App users"

    def __str__(self) -> str:
        return self.email or f"user-{self.pk}"


class Notebook(models.Model):
    id = models.TextField(primary_key=True)
    user_id = models.IntegerField(db_column="userId")
    name = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(db_column="createdAt", null=True, blank=True)

    class Meta:
        managed = False
        db_table = "notebooks"

    def __str__(self) -> str:
        return self.name or self.id


class Section(models.Model):
    id = models.TextField(primary_key=True)
    notebook_id = models.TextField(db_column="notebookId")
    name = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(db_column="createdAt", null=True, blank=True)

    class Meta:
        managed = False
        db_table = "sections"

    def __str__(self) -> str:
        return self.name or self.id


class Page(models.Model):
    id = models.TextField(primary_key=True)
    section_id = models.TextField(db_column="sectionId")
    title = models.TextField(null=True, blank=True)
    content = models.TextField(null=True, blank=True)
    updated_at = models.DateTimeField(db_column="updatedAt", null=True, blank=True)

    class Meta:
        managed = False
        db_table = "pages"

    def __str__(self) -> str:
        return self.title or self.id
