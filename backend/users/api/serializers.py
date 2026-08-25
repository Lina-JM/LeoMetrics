from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import serializers

from users.models import (
    UserRequest,
    EnterpriseUser,
    Role,
    AppPermission,
    UserProfile,
    
)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        email = data.get("email")
        password = data.get("password")

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise serializers.ValidationError("Invalid email or password.")

        user = authenticate(username=user.username, password=password)

        if not user:
            raise serializers.ValidationError("Invalid email or password.")

        if not user.is_active:
            raise serializers.ValidationError("User account is disabled.")

        data["user"] = user
        return data


class AppPermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppPermission
        fields = [
            "id",
            "code",
            "name",
            "category",
            "is_active",
        ]


class RoleSerializer(serializers.ModelSerializer):
    app_permissions = AppPermissionSerializer(many=True, read_only=True)

    class Meta:
        model = Role
        fields = [
            "id",
            "name",
            "app_permissions",
        ]


class EnterpriseUserLookupSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = EnterpriseUser
        fields = [
            "id",
            "employee_id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "region",
            "country",
            "site",
            "plant",
            "department",
            "is_active",
        ]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()


class UserRequestSerializer(serializers.ModelSerializer):
    employee_id = serializers.CharField(
        source="enterprise_user.employee_id",
        read_only=True
    )

    first_name = serializers.CharField(
        source="enterprise_user.first_name",
        read_only=True
    )

    last_name = serializers.CharField(
        source="enterprise_user.last_name",
        read_only=True
    )

    full_name = serializers.SerializerMethodField()

    requested_role_name = serializers.CharField(
        source="requested_role.name",
        read_only=True
    )

    requested_by_full_name = serializers.SerializerMethodField()
    processed_by_full_name = serializers.SerializerMethodField()

    requested_permissions = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=AppPermission.objects.filter(is_active=True),
        required=False
    )

    approved_permissions = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=AppPermission.objects.filter(is_active=True),
        required=False
    )

    requested_permissions_details = AppPermissionSerializer(
        source="requested_permissions",
        many=True,
        read_only=True
    )

    approved_permissions_details = AppPermissionSerializer(
        source="approved_permissions",
        many=True,
        read_only=True
    )

    class Meta:
        model = UserRequest
        fields = [
            "id",
            "employee_id",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "enterprise_user",
            "region",
            "country",
            "site",
            "plant",
            "department",
            "requested_role",
            "requested_role_name",
            "requested_permissions",
            "requested_permissions_details",
            "approved_permissions",
            "approved_permissions_details",
            "status",
            "requested_by",
            "requested_by_full_name",
            "processed_by",
            "processed_by_full_name",
            "processed_at",
            "created_at",
        ]

        read_only_fields = [
            "employee_id",
            "first_name",
            "last_name",
            "full_name",
            "status",
            "requested_by",
            "requested_by_full_name",
            "processed_by",
            "processed_by_full_name",
            "processed_at",
            "created_at",
        ]

    def get_full_name(self, obj):
        if obj.enterprise_user:
            return f"{obj.enterprise_user.first_name} {obj.enterprise_user.last_name}".strip()
        return obj.email

    def get_requested_by_full_name(self, obj):
        if not obj.requested_by:
            return None

        profile = getattr(obj.requested_by, "userprofile", None)
        if profile:
            return profile.full_name

        return obj.requested_by.get_full_name() or obj.requested_by.email or obj.requested_by.username

    def get_processed_by_full_name(self, obj):
        if not obj.processed_by:
            return None

        profile = getattr(obj.processed_by, "userprofile", None)
        if profile:
            return profile.full_name

        return obj.processed_by.get_full_name() or obj.processed_by.email or obj.processed_by.username

    def validate_requested_role(self, value):
        request = self.context.get("request")
        user = request.user if request else None

        role_name = None
        if user and hasattr(user, "userprofile") and user.userprofile.role:
            role_name = user.userprofile.role.name

        if role_name == "contributor" and value.name not in ["viewer", "contributor"]:
            raise serializers.ValidationError(
                "Contributor can only request viewer or contributor users."
            )

        return value


class UserManagementSerializer(serializers.ModelSerializer):
    employee_id = serializers.CharField(
        source="userprofile.enterprise_user.employee_id",
        read_only=True
    )

    first_name = serializers.SerializerMethodField()
    last_name = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    role = serializers.CharField(
        source="userprofile.role.name",
        read_only=True
    )
    profile_photo = serializers.ImageField(
        source="userprofile.profile_photo",
        read_only=True
    )
    region = serializers.CharField(source="userprofile.region", read_only=True)
    country = serializers.CharField(source="userprofile.country", read_only=True)
    site = serializers.CharField(source="userprofile.site", read_only=True)
    plant = serializers.CharField(source="userprofile.plant", read_only=True)
    department = serializers.CharField(source="userprofile.department", read_only=True)

    updated_by = serializers.SerializerMethodField()

    app_permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "employee_id",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "is_active",
            "role",
            "profile_photo",
            "region",
            "country",
            "site",
            "plant",
            "department",
            "updated_by",
            "app_permissions",
        ]

    def get_first_name(self, obj):
        profile = getattr(obj, "userprofile", None)

        if profile and profile.enterprise_user:
            return profile.enterprise_user.first_name

        return obj.first_name

    def get_last_name(self, obj):
        profile = getattr(obj, "userprofile", None)

        if profile and profile.enterprise_user:
            return profile.enterprise_user.last_name

        return obj.last_name

    def get_full_name(self, obj):
        profile = getattr(obj, "userprofile", None)

        if profile:
            return profile.full_name

        return obj.get_full_name() or obj.email or obj.username

    def get_updated_by(self, obj):
        profile = getattr(obj, "userprofile", None)

        if not profile or not profile.updated_by:
            return None

        updated_by_profile = getattr(profile.updated_by, "userprofile", None)

        if updated_by_profile:
            return updated_by_profile.full_name

        return (
            profile.updated_by.get_full_name()
            or profile.updated_by.email
            or profile.updated_by.username
        )

    def get_app_permissions(self, obj):
        profile = getattr(obj, "userprofile", None)

        if not profile:
            return []

        return list(
            profile.app_permissions.filter(is_active=True).values(
                "id",
                "code",
                "name",
                "category",
            )
        )


class ProfileSettingsSerializer(serializers.ModelSerializer):
    employee_id = serializers.CharField(source="enterprise_user.employee_id", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.CharField(read_only=True)

    role = serializers.CharField(source="role.name", read_only=True)

    app_permissions = AppPermissionSerializer(many=True, read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            "id",
            "full_name",
            "email",
            "employee_id",
            "profile_photo",
            "role",
            "region",
            "country",
            "site",
            "plant",
            "department",
            "app_permissions",
        ]
        read_only_fields = [
            "id",
            "full_name",
            "email",
            "employee_id",
            "role",
            "region",
            "country",
            "site",
            "plant",
            "department",
            "app_permissions",
        ]

class UserRoleUpdateSerializer(serializers.Serializer):
    role_id = serializers.IntegerField()

    def validate_role_id(self, value):
        if not Role.objects.filter(id=value).exists():
            raise serializers.ValidationError("Invalid role ID.")
        return value


class UserActivationSerializer(serializers.Serializer):
    is_active = serializers.BooleanField()


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppPermission
        fields = [
            "id",
            "code",
            "name",
            "category",
            "is_active",
        ]


class SetPasswordSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=8)


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=8)