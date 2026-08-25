from django.conf import settings
from django.db import models
from django.core.exceptions import ValidationError

from .kpi_definition import KPIDefinition
from .itsm_module_config import ITSMModuleConfig

class KPI(models.Model):
    kpi_definition = models.OneToOneField(
        KPIDefinition,
        on_delete=models.CASCADE,
        related_name="dim_kpi",
        null=True,
        blank=True
    )
    
    name = models.CharField(max_length=200)

    description = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name
