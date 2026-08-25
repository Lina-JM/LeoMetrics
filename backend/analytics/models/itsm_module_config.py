from django.conf import settings
from django.db import models


class ITSMModuleConfig(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=50, unique=True, editable=False)
    description = models.TextField(blank=True)
    uploaded_file = models.FileField(upload_to="module_uploads/", null=True, blank=True)
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_module_configs",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_module_configs",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


    def save(self, *args, **kwargs):
        if not self.code:
            self.code = self.name.lower().replace(" ", "_")
        super().save(*args, **kwargs)
    def __str__(self):
        return self.name