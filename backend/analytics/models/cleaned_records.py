from django.db import models
from .dim_itsm import ITSMModule


class CleanedITSMRecord(models.Model):

    module = models.ForeignKey(
        ITSMModule,
        on_delete=models.CASCADE,
        related_name="records"
    )

    record_id = models.CharField(max_length=100)

    dynamic_data = models.JSONField()

    etl_processed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "cleaned_records"
    def __str__(self):
        return f"{self.module.name} - {self.record_id}"