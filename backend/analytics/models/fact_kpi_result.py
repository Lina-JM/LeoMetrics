from django.db import models
from .dim_kpi import KPI
from .dim_itsm import ITSMModule
from .dim_date import DateDimension

RESULT_STATUS_CHOICES = [
    ("on_target", "On Target"),
    ("off_target", "Off Target"),
    ("unknown", "Unknown"),
]


class KPIResult(models.Model):
    kpi = models.ForeignKey(
        KPI,
        on_delete=models.CASCADE
    )

    module = models.ForeignKey(
        ITSMModule,
        on_delete=models.CASCADE
    )

    date_dim = models.ForeignKey(
        DateDimension,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    actual_value = models.FloatField(null=True, blank=True)

    target_value = models.FloatField(null=True, blank=True)

    grouped_data = models.JSONField(default=list, blank=True)

    result_status = models.CharField(
        max_length=20,
        choices=RESULT_STATUS_CHOICES,
        default="unknown"
    )

    calculated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("kpi", "module", "date_dim")

    def __str__(self):
        return f"{self.kpi} - {self.module} - {self.date_dim}"