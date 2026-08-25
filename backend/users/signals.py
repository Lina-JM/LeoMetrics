from django.db.models.signals import post_save
from django.dispatch import receiver

from users.models import AppPermission, Role, UserProfile


@receiver(post_save, sender=AppPermission)
def assign_new_permission_to_admins(sender, instance, created, **kwargs):
    if not instance.is_active:
        return

    try:
        admin_role = Role.objects.get(name="administrator")
    except Role.DoesNotExist:
        return

    admin_role.app_permissions.add(instance)

    for profile in UserProfile.objects.filter(role=admin_role):
        profile.app_permissions.add(instance)