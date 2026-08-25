from django.db import models
from django.contrib.auth.models import User


class AppPermission(models.Model):
    code = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["category", "name"]

    def __str__(self):
        return f"{self.category} - {self.name}"


class Role(models.Model):
    ROLE_CHOICES = (
        ("viewer", "Viewer"),
        ("contributor", "Contributor"),
        ("administrator", "Administrator"),
    )

    name = models.CharField(max_length=30, choices=ROLE_CHOICES, unique=True)
    app_permissions = models.ManyToManyField(
        AppPermission,
        blank=True,
        related_name="roles",
    )

    def __str__(self):
        return self.name


class EnterpriseUser(models.Model):
    employee_id = models.CharField(max_length=50, unique=True)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)

    region = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    site = models.CharField(max_length=100, blank=True, null=True)
    plant = models.CharField(max_length=100, blank=True, null=True)
    department = models.CharField(max_length=100, blank=True, null=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def __str__(self):
        return f"{self.full_name} - {self.email}"


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True)

    enterprise_user = models.ForeignKey(
        EnterpriseUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="profiles",
    )

    must_set_password = models.BooleanField(default=True)

    region = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    site = models.CharField(max_length=100, blank=True, null=True)
    plant = models.CharField(max_length=100, blank=True, null=True)
    department = models.CharField(max_length=100, blank=True, null=True)
    profile_photo = models.ImageField(
        upload_to="profile_photos/",
        null=True,
        blank=True
    )
    app_permissions = models.ManyToManyField(
        AppPermission,
        blank=True,
        related_name="user_profiles",
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_profiles",
    )
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_profiles",
    )
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def full_name(self):
        if self.enterprise_user:
            return self.enterprise_user.full_name
        return self.user.get_full_name() or self.user.username

    def __str__(self):
        return f"{self.full_name} - {self.role}"


class UserRequest(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    )

    email = models.EmailField()

    enterprise_user = models.ForeignKey(
        EnterpriseUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user_requests",
    )

    region = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    site = models.CharField(max_length=100, blank=True, null=True)
    plant = models.CharField(max_length=100, blank=True, null=True)
    department = models.CharField(max_length=100, blank=True, null=True)

    requested_role = models.ForeignKey(
        Role,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requested_user_requests",
    )

    requested_permissions = models.ManyToManyField(
        AppPermission,
        blank=True,
        related_name="requested_user_requests",
    )

    approved_permissions = models.ManyToManyField(
        AppPermission,
        blank=True,
        related_name="approved_user_requests",
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")

    requested_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submitted_user_requests",
    )

    processed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="processed_user_requests",
    )

    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def full_name(self):
        if self.enterprise_user:
            return self.enterprise_user.full_name
        return self.email

    def __str__(self):
        return f"{self.full_name} - {self.status}"


class RoleChangeHistory(models.Model):
    user_profile = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    old_role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, related_name="+")
    new_role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, related_name="+")
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user_profile.full_name}: {self.old_role} -> {self.new_role}"
    
class AppPermissionChangeHistory(models.Model):
    ACTION_CHOICES = (
        ("granted", "Granted"),
        ("revoked", "Revoked"),
    )

    SOURCE_CHOICES = (
        ("role_change", "Role Change"),
        ("manual_update", "Manual Update"),
        ("request_approval", "Request Approval"),
    )

    user_profile = models.ForeignKey(
        UserProfile,
        on_delete=models.CASCADE,
        related_name="permission_change_history",
    )

    permission = models.ForeignKey(
        AppPermission,
        on_delete=models.CASCADE,
        related_name="change_history",
    )

    action = models.CharField(max_length=20, choices=ACTION_CHOICES)

    source = models.CharField(
        max_length=30,
        choices=SOURCE_CHOICES,
        default="manual_update",
    )

    old_role = models.ForeignKey(
        Role,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    new_role = models.ForeignKey(
        Role,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    changed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="permission_changes_made",
    )

    changed_at = models.DateTimeField(auto_now_add=True)

    note = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["-changed_at"]

    def __str__(self):
        return f"{self.user_profile.full_name}: {self.permission.code} {self.action}"    