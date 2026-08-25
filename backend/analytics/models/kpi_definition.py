from django.db import models
from analytics.models.itsm_module_config import ITSMModuleConfig
from analytics.models.module_fields import ModuleField


TARGET_OPERATOR_CHOICES = [
    ("=", "Equal to"),
    (">=", "Greater than or equal to"),
    ("<=", "Less than or equal to"),
    (">", "Greater than"),
    ("<", "Less than"),
]

VALUE_TYPE_CHOICES = [
    ("number", "Number"),
    ("percentage", "Percentage"),
    ("duration", "Duration"),
]


class KPIDefinition(models.Model):

    # 🔗 Module (from config, NOT dim)
    module = models.ForeignKey(
        ITSMModuleConfig,
        on_delete=models.CASCADE
    )

    # 🏷️ KPI basic info
    name = models.CharField(max_length=200)

    aggregation = models.CharField(
        max_length=20,
        choices=[
            ("count", "Count"),
            ("sum", "Sum"),
            ("avg", "Average"),
            ("min", "Min"),
            ("max", "Max"),
            ("percentage", "Percentage"),
        ]
    )

    # 🎯 Measure field (optional depending on aggregation)
    field = models.ForeignKey(
        ModuleField,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kpi_fields"
    )
    filters = models.JSONField(default=list, blank=True)
    
    reporting_date_field = models.ForeignKey(
        ModuleField,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kpi_reporting_date_fields"
    )
    # 📊 Grouping
    group_by = models.ForeignKey(
        ModuleField,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kpi_group_by"
    )

    limit = models.IntegerField(
        null=True,
        blank=True
    )

    # 🎯 Target logic
    target_operator = models.CharField(
        max_length=2,
        choices=TARGET_OPERATOR_CHOICES,
        default="="
    )

    target_value = models.FloatField(
        null=True,
        blank=True
    )

    value_type = models.CharField(
        max_length=20,
        choices=VALUE_TYPE_CHOICES,
        default="number"
    )
   
    # 📝 Description
    description = models.TextField(blank=True)
    business_meaning = models.TextField(blank=True, null=True)
    # 🔐 Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_kpis_definitions"
    )

    updated_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="updated_kpis_definitions"
    )
    updated_at = models.DateTimeField(auto_now=True)

    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name