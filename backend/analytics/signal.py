from django.db.models.signals import post_save
from django.dispatch import receiver

from analytics.models.itsm_module_config import ITSMModuleConfig
from analytics.models.dim_itsm import ITSMModule


@receiver(post_save, sender=ITSMModuleConfig)
def sync_dim_module(sender, instance, created, **kwargs):
    ITSMModule.objects.update_or_create(
        name=instance.name,
        defaults={
            "code": instance.name.upper().replace(" ", "_"),
            "description": instance.description or "",
            "uploaded_file": instance.uploaded_file,
            "is_active": instance.is_active,
            "created_by": instance.created_by,
            "updated_by": instance.updated_by,
        },
    )