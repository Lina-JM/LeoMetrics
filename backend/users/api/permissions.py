from rest_framework.permissions import BasePermission


def has_app_permission(user, permission_code):
    """
    Check if the authenticated user has a custom AppPermission.
    Administrator is allowed everything.
    """
    if not user or not user.is_authenticated:
        return False

    if not hasattr(user, "userprofile"):
        return False

    profile = user.userprofile

    if not profile.role:
        return False

    if profile.role.name == "administrator":
        return True

    return profile.app_permissions.filter(
        code=permission_code,
        is_active=True
    ).exists()


class IsAdmin(BasePermission):
    """
    Only administrator role.
    """
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "userprofile")
            and request.user.userprofile.role
            and request.user.userprofile.role.name == "administrator"
        )


class HasAppPermission(BasePermission):
    """
    Use this when a view needs one permission.

    Example:
        required_permission = "view_user_management"
        permission_classes = [HasAppPermission]
    """
    def has_permission(self, request, view):
        required_permission = getattr(view, "required_permission", None)

        if not required_permission:
            return request.user and request.user.is_authenticated

        return has_app_permission(request.user, required_permission)


class HasAppPermissionByAction(BasePermission):
    """
    Use this for ViewSets where each action has a different permission.

    Example:
        action_permissions = {
            "list": "view_kpi_management",
            "retrieve": "view_kpi_management",
            "create": "create_kpi",
            "update": "edit_kpi",
            "partial_update": "edit_kpi",
        }

        permission_classes = [HasAppPermissionByAction]
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        action = getattr(view, "action", None)
        action_permissions = getattr(view, "action_permissions", {})

        required_permission = action_permissions.get(action)

        if not required_permission:
            return True

        return has_app_permission(request.user, required_permission)