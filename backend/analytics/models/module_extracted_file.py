from django.db import models
from analytics.models.itsm_module_config import ITSMModuleConfig


class ModuleExtractedFile(models.Model):
    module = models.ForeignKey(
        ITSMModuleConfig,
        on_delete=models.CASCADE,
        related_name="extracted_files"
    )

    file = models.FileField(upload_to="extracted_files/")

    extracted_at = models.DateTimeField(auto_now_add=True)

    is_latest = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.module.name} - {self.file.name}"