from django.db import models
from .itsm_module_config import ITSMModuleConfig


class ModuleField(models.Model):
    module = models.ForeignKey(
        ITSMModuleConfig,
        on_delete=models.CASCADE,
        related_name="fields"
    )

    field_name = models.CharField(max_length=150)

    field_type = models.CharField(
        max_length=50,
        choices=[
            ("string", "String"),
            ("number", "Number"),
            ("date", "Date"),
            ("boolean", "Boolean")
        ]
    )

    is_filterable = models.BooleanField(default=True)
    is_measure = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("module", "field_name")

    def __str__(self):
        return f"{self.module.name} - {self.field_name}"