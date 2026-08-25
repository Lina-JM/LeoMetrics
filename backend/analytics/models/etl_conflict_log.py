from django.db import models
from .dim_itsm import ITSMModule

class ETLConflictLog(models.Model):

    module = models.ForeignKey(
        ITSMModule,
        on_delete=models.CASCADE,
        related_name="conflicts"
    )

    record_id = models.CharField(max_length=100)

    details = models.TextField()  # what happened

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.module.name} - {self.record_id}"