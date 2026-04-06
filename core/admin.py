from django.contrib import admin

from .models import LuminaUser, Notebook, Page, Section


@admin.register(LuminaUser)
class LuminaUserAdmin(admin.ModelAdmin):
    list_display = ("id", "email", "username", "name")
    search_fields = ("email", "username", "name")
    readonly_fields = ("id", "email", "username", "password", "name")
    ordering = ("id",)

    def has_add_permission(self, request):
        return False


@admin.register(Notebook)
class NotebookAdmin(admin.ModelAdmin):
    list_display = ("id", "user_id", "name", "created_at")
    list_filter = ("user_id",)
    search_fields = ("id", "name")
    readonly_fields = ("id", "user_id", "name", "created_at")
    ordering = ("-created_at",)

    def has_add_permission(self, request):
        return False


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ("id", "notebook_id", "name", "created_at")
    search_fields = ("id", "name", "notebook_id")
    readonly_fields = ("id", "notebook_id", "name", "created_at")
    ordering = ("-created_at",)

    def has_add_permission(self, request):
        return False


@admin.register(Page)
class PageAdmin(admin.ModelAdmin):
    list_display = ("id", "section_id", "title", "updated_at")
    search_fields = ("id", "title", "content", "section_id")
    readonly_fields = ("id", "section_id", "title", "content", "updated_at")
    ordering = ("-updated_at",)

    def has_add_permission(self, request):
        return False


admin.site.site_header = "Lumina Notes"
admin.site.site_title = "Lumina admin"
admin.site.index_title = "Data (SQLite shared with FastAPI)"
