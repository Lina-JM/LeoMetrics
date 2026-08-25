from django.contrib import admin

from users.models import (
    AppPermission,
    Role,
    EnterpriseUser,
    UserProfile,
    UserRequest,
    RoleChangeHistory,
    AppPermissionChangeHistory,
)


admin.site.register(AppPermission)
admin.site.register(Role)
admin.site.register(EnterpriseUser)
admin.site.register(UserProfile)
admin.site.register(UserRequest)
admin.site.register(RoleChangeHistory)
admin.site.register(AppPermissionChangeHistory)
