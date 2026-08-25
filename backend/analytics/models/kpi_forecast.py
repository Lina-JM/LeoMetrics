from django.db import models

from analytics.models.dim_kpi import KPI
from analytics.models.dim_itsm import ITSMModule
from analytics.models.dim_date import DateDimension


class KPIForecast(models.Model):
    kpi = models.ForeignKey(
        KPI,
        on_delete=models.CASCADE,
        related_name="forecasts"
    )

    module = models.ForeignKey(
        ITSMModule,
        on_delete=models.CASCADE,
        related_name="kpi_forecasts",
        null=True,
        blank=True
    )

    date_dim = models.ForeignKey(
        DateDimension,
        on_delete=models.CASCADE,
        related_name="forecast_results"
    )

    actual_value = models.FloatField(null=True, blank=True)

    forecast_value = models.FloatField()

    variance = models.FloatField(null=True, blank=True)

    group_by_field = models.CharField(max_length=255, null=True, blank=True)
    group_by_value = models.CharField(max_length=255, null=True, blank=True)

    confidence_score = models.FloatField(
        null=True,
        blank=True
    )

    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date_dim__date"]

        unique_together = (
            "kpi",
            "module",
            "date_dim",
            "group_by_field",
            "group_by_value",
            
        )

    def __str__(self):
        return (
            f"{self.kpi.name} | "
            f"{self.date_dim.date} | "
            f"Forecast: {self.forecast_value}"
        )