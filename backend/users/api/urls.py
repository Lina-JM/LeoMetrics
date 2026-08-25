from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from users.api.views import (
    TestAuthView,
    LoginView,
    UserRequestView,
    ApproveRequestView,
    RejectRequestView,
    EnterpriseUserLookupView,
    EnterpriseUserSearchView,
    UserManagementListView,
    DirectUserCreateView,
    UserRoleUpdateView,
    UserActivationUpdateView,
    RoleListView,
    PermissionListView,
    RolePermissionsView,
    SetPasswordView,
    ResendSetupEmailView,
    ForgotPasswordView,
    ResetPasswordView,
    UserPermissionsUpdateView,
    ProfileSettingsView,
    ChangePasswordView,
)

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("test-auth/", TestAuthView.as_view(), name="test_auth"),
    path("enterprise-lookup/", EnterpriseUserLookupView.as_view(), name="enterprise_lookup"),

    path("requests/", UserRequestView.as_view(), name="user_requests"),
    path("requests/<int:pk>/approve/", ApproveRequestView.as_view(), name="approve_request"),
    path("requests/<int:pk>/reject/", RejectRequestView.as_view(), name="reject_request"),

    path("manage/", UserManagementListView.as_view(), name="user_management_list"),
    path("manage/create/", DirectUserCreateView.as_view(), name="direct_user_create"),
    path("manage/<int:pk>/role/", UserRoleUpdateView.as_view(), name="user_role_update"),
    path("manage/<int:pk>/activation/", UserActivationUpdateView.as_view(), name="user_activation_update"),

    path("roles/", RoleListView.as_view(), name="role_list"),
    path("permissions/", PermissionListView.as_view(), name="permission_list"),
    path("roles/<int:role_id>/permissions/", RolePermissionsView.as_view(), name="role_permissions"),
    path("enterprise-search/", EnterpriseUserSearchView.as_view(), name="enterprise_search"),
    path("set-password/", SetPasswordView.as_view(), name="set_password"),
    path("resend-setup-email/", ResendSetupEmailView.as_view(), name="resend_setup_email"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot_password"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset_password"),
    path("manage/<int:pk>/permissions/", UserPermissionsUpdateView.as_view(), name="user_permissions_update"),
    path("profile/", ProfileSettingsView.as_view(), name="profile-settings"),
    path("profile/change-password/", ChangePasswordView.as_view(), name="change-password"),
]