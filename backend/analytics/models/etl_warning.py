from django.db import models
from .dim_itsm import ITSMModule

class ETLWarning(models.Model):
    module = models.ForeignKey(ITSMModule, on_delete=models.CASCADE)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.module.name} - {self.message}"