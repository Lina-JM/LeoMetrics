from django.contrib.auth.models import User
from django.utils import timezone
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.db.models import Q
from django.core.mail import EmailMultiAlternatives

from rest_framework import status, serializers
from rest_framework.generics import ListCreateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.parsers import MultiPartParser, FormParser

from users.models import (
    UserRequest,
    EnterpriseUser,
    RoleChangeHistory,
    Role,
    UserProfile,
    AppPermission,
)

from .serializers import (
    LoginSerializer,
    UserRequestSerializer,
    EnterpriseUserLookupSerializer,
    UserManagementSerializer,
    ProfileSettingsSerializer,
    UserRoleUpdateSerializer,
    UserActivationSerializer,
    RoleSerializer,
    PermissionSerializer,
    SetPasswordSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
)

from .permissions import has_app_permission


# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------

def generate_username_from_full_name(first_name, last_name):
    base_username = f"{first_name}.{last_name}".strip().lower().replace(" ", "")

    if not base_username or base_username == ".":
        base_username = "user"

    username = base_username
    counter = 1

    while User.objects.filter(username=username).exists():
        username = f"{base_username}{counter}"
        counter += 1

    return username


def get_display_name(user):
    profile = getattr(user, "userprofile", None)

    if profile:
        return profile.full_name

    return user.get_full_name() or user.email or user.username


def build_setup_link(user, request):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    base_url = request.headers.get("Origin") or request.build_absolute_uri("/")[:-1]

    if not base_url:
        base_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")

    return f"{base_url}/set-password/{uid}/{token}"


def format_permissions_text(permissions):
    permissions = list(permissions)

    if not permissions:
        return "No specific permissions assigned."

    return "\n".join([f"- {permission.name}" for permission in permissions])


def format_permissions_html(permissions):
    permissions = list(permissions)

    if not permissions:
        return "<p style='margin:0; color:#64748b; font-size:14px;'>No specific permissions assigned.</p>"

    items = "".join(
        f"""
        <li style="margin-bottom:6px; color:#334155; font-size:14px;">
          {permission.name}
        </li>
        """
        for permission in permissions
    )

    return f"""
    <ul style="margin:8px 0 0; padding-left:20px;">
      {items}
    </ul>
    """


def send_setup_email(user, profile, setup_link, message_context, permissions=None):
    subject = "Set up your LeoMetrics account"
    role_name = profile.role.name if profile.role else "-"
    permissions = permissions or []
    display_name = get_display_name(user)

    permissions_text = format_permissions_text(permissions)
    permissions_html = format_permissions_html(permissions)

    text_message = (
        f"Hello {display_name},\n\n"
        f"{message_context}\n\n"
        f"Important: For the best experience, please complete your account setup using a desktop or laptop browser.\n\n"
        f"Assigned role: {role_name}\n\n"
        f"Assigned permissions:\n"
        f"{permissions_text}\n\n"
        f"Set your password here:\n"
        f"{setup_link}\n\n"
        f"This setup link is temporary. If it expires, request a new setup email.\n\n"
        f"If you were not expecting this email, please contact your administrator."
    )

    html_message = f"""
    <div style="margin:0; padding:0; background-color:#eef2f7; font-family:Arial, Helvetica, sans-serif;">
      <div style="max-width:680px; margin:0 auto; padding:36px 16px;">

        <table align="center" style="margin-bottom:20px;">
            <tr>
                <td style="vertical-align:middle; padding-right:8px;">
                    <img src="https://i.imgur.com/De5QYqc.png"
                        alt="LeoMetrics"
                        style="height:40px;" />
                </td>
                <td style="vertical-align:middle;">
                    <span style="color:#0b1739; font-size:22px; font-weight:700;">
                        LeoMetrics
                    </span>
                </td>
            </tr>
        </table>

        <p style="text-align:center; margin:8px 0 0; color:#64748b; font-size:13px;">
            ITSM KPI Management & Decision Support Platform
        </p>

        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:18px; overflow:hidden; box-shadow:0 8px 24px rgba(15,23,42,0.08);">

          <div style="background:linear-gradient(135deg,#0b1739,#1e3a8a); padding:30px;">
            <p style="margin:0 0 8px; color:#bfdbfe; font-size:13px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase;">
              Account setup required
            </p>
            <h1 style="margin:0; color:#ffffff; font-size:26px; line-height:1.3;">
              Welcome to LeoMetrics
            </h1>
            <p style="margin:10px 0 0; color:#dbeafe; font-size:15px; line-height:1.5;">
              Your account has been created. Please set your password to activate access.
            </p>
          </div>

          <div style="padding:32px 30px;">

            <p style="margin:0 0 18px; color:#334155; font-size:15px; line-height:1.6;">
              Hello <strong style="color:#0f172a;">{display_name}</strong>,
            </p>

            <p style="margin:0 0 22px; color:#334155; font-size:15px; line-height:1.7; white-space:pre-line;">
              {message_context}
            </p>

            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:18px; margin:22px 0;">
              <p style="margin:0 0 10px; color:#0f172a; font-size:15px; font-weight:700;">
                Account details
              </p>

              <p style="margin:0; color:#334155; font-size:14px;">
                <strong>Assigned role:</strong>
                <span style="display:inline-block; background:#dbeafe; color:#1e3a8a; padding:4px 10px; border-radius:999px; font-size:13px; font-weight:700;">
                  {role_name}
                </span>
              </p>
            </div>

            <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:14px; padding:18px; margin:22px 0;">
              <p style="margin:0; color:#0f172a; font-size:15px; font-weight:700;">
                Assigned permissions
              </p>
              {permissions_html}
            </div>

            <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:14px; padding:16px 18px; margin:24px 0;">
              <p style="margin:0; color:#9a3412; font-size:14px; line-height:1.6;">
                <strong>Important:</strong> For the best experience, please complete your account setup using a desktop or laptop browser.
              </p>
            </div>

            <div style="text-align:center; margin:32px 0 28px;">
              <a href="{setup_link}"
                 style="display:inline-block; background:#2563eb; color:#ffffff; text-decoration:none; padding:14px 30px; border-radius:12px; font-weight:700; font-size:15px;">
                Set Your Password
              </a>
            </div>

            <div style="background:#f1f5f9; border-radius:12px; padding:14px 16px; margin:22px 0;">
              <p style="margin:0; color:#475569; font-size:13px; line-height:1.5;">
                This setup link expires in 24 hours. If it expires, you can request a new setup email directly from the setup page.
              </p>
            </div>

            <p style="color:#64748b; font-size:13px; line-height:1.5;">
              If the button does not work, copy and paste this link into your browser:
            </p>

            <p style="word-break:break-all; color:#2563eb; font-size:13px; line-height:1.5;">
              {setup_link}
            </p>

            <hr style="border:none; border-top:1px solid #e5e7eb; margin:28px 0;" />

            <p style="margin:0; color:#94a3b8; font-size:12px; line-height:1.6;">
              If you were not expecting this email, please contact your administrator.
            </p>

          </div>
        </div>

        <p style="text-align:center; color:#94a3b8; font-size:12px; margin:18px 0 0;">
          © LeoMetrics — ITSM KPI Platform
        </p>

      </div>
    </div>
    """

    email = EmailMultiAlternatives(
        subject=subject,
        body=text_message,
        from_email=None,
        to=[user.email],
    )
    email.attach_alternative(html_message, "text/html")
    email.send()

def get_permissions_for_role(role, permission_ids=None):
    if role.name == "administrator":
        return AppPermission.objects.filter(is_active=True)

    if permission_ids:
        return AppPermission.objects.filter(
            id__in=permission_ids,
            is_active=True,
            roles=role,
        )

    return role.app_permissions.filter(is_active=True)

# -------------------------------------------------------------------
# Local serializer for direct creation
# -------------------------------------------------------------------

class DirectUserCreateSerializer(serializers.Serializer):
    enterprise_user_id = serializers.IntegerField()
    role_id = serializers.IntegerField()
    permission_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=[],
    )

    def validate_enterprise_user_id(self, value):
        if not EnterpriseUser.objects.filter(id=value, is_active=True).exists():
            raise serializers.ValidationError("Enterprise user not found.")
        return value

    def validate_role_id(self, value):
        try:
            role = Role.objects.get(id=value)
        except Role.DoesNotExist:
            raise serializers.ValidationError("Role not found.")

        if role.name not in ["viewer", "contributor", "administrator"]:
            raise serializers.ValidationError(
                "Invalid role."
            )

        return value

    def validate(self, attrs):
        role = Role.objects.get(id=attrs["role_id"])
        permission_ids = attrs.get("permission_ids", [])

        if permission_ids:
            selected_count = AppPermission.objects.filter(
                id__in=permission_ids,
                is_active=True,
                roles=role,
            ).count()

            if selected_count != len(permission_ids):
                raise serializers.ValidationError(
                    "One or more permissions are invalid or not allowed for this role."
                )

        return attrs


# -------------------------------------------------------------------
# Auth
# -------------------------------------------------------------------

class TestAuthView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "message": "You are authenticated",
            "user": get_display_name(request.user),
        })


class LoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)

        if serializer.is_valid():
            user = serializer.validated_data["user"]

            if hasattr(user, "userprofile") and user.userprofile.must_set_password:
                return Response(
                    {
                        "error": "You must set your password first. Please check your email."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            profile = getattr(user, "userprofile", None)
            refresh = RefreshToken.for_user(user)

            app_permissions = []
            if profile:
                app_permissions = list(
                    profile.app_permissions.filter(is_active=True).values(
                        "id",
                        "code",
                        "name",
                        "category",
                    )
                )

            return Response({
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "full_name": get_display_name(user),
                "email": user.email,
                "role": profile.role.name if profile and profile.role else None,
                "profile_photo": (
                    profile.profile_photo.url
                    if profile.profile_photo
                    else ""
                ),
                "app_permissions": app_permissions,
            })

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# -------------------------------------------------------------------
# Enterprise User Lookup/Search
# -------------------------------------------------------------------

class EnterpriseUserLookupView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        email = request.query_params.get("email", "").strip()

        if not email:
            return Response(
                {"error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            enterprise_user = EnterpriseUser.objects.get(
                email__iexact=email,
                is_active=True,
            )
            serializer = EnterpriseUserLookupSerializer(enterprise_user)
            return Response(serializer.data, status=status.HTTP_200_OK)

        except EnterpriseUser.DoesNotExist:
            return Response(
                {"error": "Enterprise user not found"},
                status=status.HTTP_404_NOT_FOUND,
            )


class EnterpriseUserSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip()

        if not query:
            return Response([], status=200)

        users = EnterpriseUser.objects.filter(
            is_active=True,
        ).filter(
            Q(email__icontains=query) |
            Q(employee_id__icontains=query) |
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query)
        ).order_by("email")[:10]

        serializer = EnterpriseUserLookupSerializer(users, many=True)
        return Response(serializer.data, status=200)


# -------------------------------------------------------------------
# User Requests
# -------------------------------------------------------------------

class UserRequestView(ListCreateAPIView):
    serializer_class = UserRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if has_app_permission(user, "view_request"):
            role_name = getattr(user.userprofile.role, "name", None)

            if role_name == "contributor":
                return UserRequest.objects.filter(
                    requested_by=user
                ).select_related(
                    "enterprise_user",
                    "requested_role",
                    "requested_by",
                    "processed_by",
                ).prefetch_related(
                    "requested_permissions",
                    "approved_permissions",
                ).order_by("-created_at")

            if role_name == "administrator":
                return UserRequest.objects.select_related(
                    "enterprise_user",
                    "requested_role",
                    "requested_by",
                    "processed_by",
                ).prefetch_related(
                    "requested_permissions",
                    "approved_permissions",
                ).order_by("-created_at")

        return UserRequest.objects.none()

    def create(self, request, *args, **kwargs):
        if not has_app_permission(request.user, "create_request"):
            return Response(
                {"error": "You do not have permission to create user requests."},
                status=403,
            )

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        enterprise_user = serializer.validated_data.get("enterprise_user")

        if not enterprise_user:
            raise serializers.ValidationError({"error": "Enterprise user is required."})

        if UserProfile.objects.filter(enterprise_user=enterprise_user).exists():
            raise serializers.ValidationError({
                "error": "This enterprise user already has an application account."
            })

        if UserRequest.objects.filter(
            enterprise_user=enterprise_user,
            status="pending",
        ).exists():
            raise serializers.ValidationError({
                "error": "A pending request already exists for this user."
            })

        serializer.save(requested_by=self.request.user)


class ApproveRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not has_app_permission(request.user, "approve_request"):
            return Response(
                {"error": "You do not have permission to approve user requests."},
                status=403,
            )

        try:
            req = UserRequest.objects.get(id=pk)

            if req.status != "pending":
                return Response({"error": "Already processed"}, status=400)

            if req.requested_by_id == request.user.id:
                return Response(
                    {"error": "You cannot approve your own request."},
                    status=403,
                )

            if UserProfile.objects.filter(enterprise_user=req.enterprise_user).exists():
                req.status = "rejected"
                req.processed_by = request.user
                req.processed_at = timezone.now()
                req.save()
                return Response({"error": "User already exists"}, status=400)

            if User.objects.filter(email__iexact=req.email).exists():
                return Response({"error": "This Email is already used"}, status=400)

            approved_role_id = request.data.get("approved_role")

            if approved_role_id:
                try:
                    approved_role = Role.objects.get(id=approved_role_id)
                except Role.DoesNotExist:
                    return Response(
                        {"error": "Selected role not found."},
                        status=404,
                    )
            else:
                approved_role = req.requested_role

            approved_permission_ids = request.data.get("approved_permissions", [])

            if not approved_permission_ids:
                return Response(
                    {"error": "Please select at least one permission before approving."},
                    status=400,
                )

            approved_permissions = AppPermission.objects.filter(
                id__in=approved_permission_ids,
                is_active=True,
                roles=approved_role,
            )

            if approved_permissions.count() != len(approved_permission_ids):
                return Response(
                    {"error": "One or more selected permissions are invalid or not allowed for this role."},
                    status=400,
                )

            enterprise_user = req.enterprise_user
            username = generate_username_from_full_name(
                enterprise_user.first_name,
                enterprise_user.last_name,
            )

            user = User.objects.create_user(
                username=username,
                email=req.email,
                password=None,
                first_name=enterprise_user.first_name,
                last_name=enterprise_user.last_name,
            )
            user.set_unusable_password()
            user.save()

            profile, created = UserProfile.objects.get_or_create(user=user)
            profile.role = approved_role
            profile.enterprise_user = enterprise_user
            profile.must_set_password = True
            profile.region = req.region
            profile.country = req.country
            profile.site = req.site
            profile.plant = req.plant
            profile.department = req.department
            profile.created_by = request.user
            profile.updated_by = request.user
            profile.save()
            profile.app_permissions.set(approved_permissions)

            req.approved_permissions.set(approved_permissions)
            req.status = "approved"
            req.processed_by = request.user
            req.processed_at = timezone.now()
            req.save()

            RoleChangeHistory.objects.create(
                user_profile=profile,
                old_role=None,
                new_role=profile.role,
                changed_by=request.user,
            )

            setup_link = build_setup_link(user, request)

            requested_by_name = get_display_name(req.requested_by) if req.requested_by else "Unknown"
            approved_by_name = get_display_name(request.user) if request.user else "Unknown"

            send_setup_email(
                user=user,
                profile=profile,
                setup_link=setup_link,
                permissions=approved_permissions,
                message_context=(
                    "Your LeoMetrics account has been created.\n\n"
                    f"Requested by: {requested_by_name}\n"
                    f"Approved by: {approved_by_name}"
                ),
            )

            return Response({
                "message": "User created successfully and setup email sent.",
                "full_name": get_display_name(user),
                "email": user.email,
                "role": approved_role.name,
            })

        except UserRequest.DoesNotExist:
            return Response({"error": "Request not found"}, status=404)

        except Exception as e:
            return Response({"error": str(e)}, status=500)


class RejectRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not has_app_permission(request.user, "reject_request"):
            return Response(
                {"error": "You do not have permission to reject user requests."},
                status=403,
            )

        try:
            req = UserRequest.objects.get(id=pk)

            if req.status != "pending":
                return Response({"error": "Already processed"}, status=400)

            if req.requested_by_id == request.user.id:
                return Response(
                    {"error": "You cannot reject your own request."},
                    status=403,
                )

            req.status = "rejected"
            req.processed_by = request.user
            req.processed_at = timezone.now()
            req.save()

            return Response({"message": "Request rejected successfully"})

        except UserRequest.DoesNotExist:
            return Response({"error": "Request not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)


# -------------------------------------------------------------------
# User Management
# -------------------------------------------------------------------

class UserManagementListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not has_app_permission(request.user, "view_module"):
            return Response(
                {"error": "You do not have permission to view user management."},
                status=403,
            )

        users = User.objects.select_related(
            "userprofile",
            "userprofile__role",
            "userprofile__enterprise_user",
        ).filter(
            userprofile__enterprise_user__isnull=False
        ).order_by("-is_active", "username")

        serializer = UserManagementSerializer(users, many=True)
        return Response(serializer.data)


class DirectUserCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not has_app_permission(request.user, "create_user"):
            return Response(
                {"error": "You do not have permission to create users."},
                status=403,
            )

        serializer = DirectUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        enterprise_user = EnterpriseUser.objects.get(
            id=serializer.validated_data["enterprise_user_id"],
            is_active=True,
        )
        role = Role.objects.get(id=serializer.validated_data["role_id"])
        permission_ids = serializer.validated_data.get("permission_ids", [])

        if UserProfile.objects.filter(enterprise_user=enterprise_user).exists():
            return Response(
                {"error": "This enterprise user already has an application account."},
                status=400,
            )

        if User.objects.filter(email__iexact=enterprise_user.email).exists():
            return Response(
                {"error": "This Email is already used"},
                status=400,
            )

        if UserRequest.objects.filter(
            enterprise_user=enterprise_user,
            status="pending",
        ).exists():
            return Response(
                {
                    "error": "This enterprise user already has a pending access request. Please approve or reject the request before adding the user directly."
                },
                status=400,
            )

        username = generate_username_from_full_name(
            enterprise_user.first_name,
            enterprise_user.last_name,
        )

        user = User.objects.create_user(
            username=username,
            email=enterprise_user.email,
            password=None,
            first_name=enterprise_user.first_name,
            last_name=enterprise_user.last_name,
        )
        user.set_unusable_password()
        user.save()

        profile, created = UserProfile.objects.get_or_create(user=user)
        profile.enterprise_user = enterprise_user
        profile.role = role
        profile.must_set_password = True
        profile.region = enterprise_user.region
        profile.country = enterprise_user.country
        profile.site = enterprise_user.site
        profile.plant = enterprise_user.plant
        profile.department = enterprise_user.department
        profile.created_by = request.user
        profile.updated_by = request.user
        profile.save()

        permissions = get_permissions_for_role(role, permission_ids)

        profile.app_permissions.set(permissions)

        RoleChangeHistory.objects.create(
            user_profile=profile,
            old_role=None,
            new_role=profile.role,
            changed_by=request.user,
        )

        setup_link = build_setup_link(user, request)

        send_setup_email(
            user=user,
            profile=profile,
            setup_link=setup_link,
            permissions=permissions,
            message_context=(
                "Your LeoMetrics account has been created directly by an administrator.\n\n"
                f"Added by: {get_display_name(request.user)}"
            ),
        )

        return Response({
            "message": "User added successfully and setup email sent.",
            "full_name": get_display_name(user),
            "email": user.email,
        }, status=201)


class UserRoleUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if not has_app_permission(request.user, "edit_user"):
            return Response(
                {"error": "You do not have permission to edit users."},
                status=403,
            )

        serializer = UserRoleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = User.objects.select_related(
                "userprofile",
                "userprofile__role",
            ).get(id=pk)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)


        target_role = user.userprofile.role

        if target_role and target_role.name == "administrator":
            return Response(
                {"error": "Administrator users cannot be modified."},
                status=403,
            )

        if request.user.id == user.id:
            return Response(
                {"error": "You cannot change your own role."},
                status=400,
            )

        try:
            new_role = Role.objects.get(id=serializer.validated_data["role_id"])
        except Role.DoesNotExist:
            return Response({"error": "Role not found"}, status=404)

        old_role = user.userprofile.role

        user.userprofile.role = new_role
        user.userprofile.updated_by = request.user
        user.userprofile.save()

        default_permissions = new_role.app_permissions.filter(is_active=True)
        user.userprofile.app_permissions.set(default_permissions)

        RoleChangeHistory.objects.create(
            user_profile=user.userprofile,
            old_role=old_role,
            new_role=new_role,
            changed_by=request.user,
        )

        return Response({
            "message": "User role updated successfully",
            "user_id": user.id,
            "new_role": new_role.name,
        })


class UserActivationUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if not has_app_permission(request.user, "activate_deactivate_user"):
            return Response(
                {"error": "You do not have permission to activate or deactivate users."},
                status=403,
            )

        serializer = UserActivationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = User.objects.select_related("userprofile").get(id=pk)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        if request.user.id == user.id:
            return Response(
                {"error": "You cannot change your own active status."},
                status=400,
            )

        user.is_active = serializer.validated_data["is_active"]
        user.save()

        if hasattr(user, "userprofile"):
            user.userprofile.updated_by = request.user
            user.userprofile.save()

        return Response({
            "message": "User activation updated successfully",
            "user_id": user.id,
            "is_active": user.is_active,
        })


class UserPermissionsUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if not has_app_permission(request.user, "edit_user"):
            return Response(
                {"error": "You do not have permission to edit user permissions."},
                status=403,
            )

        try:
            user = User.objects.select_related(
                "userprofile",
                "userprofile__role",
            ).get(id=pk)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        if request.user.id == user.id:
            return Response(
                {"error": "You cannot change your own permissions."},
                status=400,
            )
        target_role = user.userprofile.role

        if target_role and target_role.name == "administrator":
            return Response(
                {"error": "Administrator permissions cannot be modified."},
                status=403,
            )
        permission_ids = request.data.get("permission_ids", [])

        if not permission_ids:
            return Response(
                {"error": "Please select at least one permission."},
                status=400,
            )

        role = user.userprofile.role

        permissions = AppPermission.objects.filter(
            id__in=permission_ids,
            is_active=True,
            roles=role,
        )

        if permissions.count() != len(permission_ids):
            return Response(
                {"error": "One or more permissions are invalid or not allowed for this role."},
                status=400,
            )

        user.userprofile.app_permissions.set(permissions)
        user.userprofile.updated_by = request.user
        user.userprofile.save()

        return Response({"message": "Permissions updated successfully"})


class ProfileSettingsView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        serializer = ProfileSettingsSerializer(
            request.user.userprofile,
            context={"request": request},
        )
        return Response(serializer.data)

    def patch(self, request):
        profile = request.user.userprofile

        if "profile_photo" in request.FILES:
            profile.profile_photo = request.FILES["profile_photo"]
            profile.save(update_fields=["profile_photo"])

        serializer = ProfileSettingsSerializer(
            profile,
            context={"request": request},
        )
        return Response(serializer.data)

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_password = request.data.get("current_password")
        new_password = request.data.get("new_password")

        if not current_password or not new_password:
            return Response(
                {"error": "Current password and new password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not request.user.check_password(current_password):
            return Response(
                {"error": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {"error": "New password must contain at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(new_password)
        request.user.save()

        return Response({"message": "Password changed successfully."})

# -------------------------------------------------------------------
# Roles / Permissions
# -------------------------------------------------------------------

class RoleListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        roles = Role.objects.prefetch_related("app_permissions").all().order_by("id")
        serializer = RoleSerializer(roles, many=True)
        return Response(serializer.data)


class PermissionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        permissions = AppPermission.objects.filter(is_active=True).order_by("category", "name")
        serializer = PermissionSerializer(permissions, many=True)
        return Response(serializer.data)


class RolePermissionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, role_id):
        try:
            role = Role.objects.prefetch_related("app_permissions").get(id=role_id)
        except Role.DoesNotExist:
            return Response({"error": "Role not found"}, status=404)

        permissions = role.app_permissions.filter(is_active=True).order_by("category", "name")
        serializer = PermissionSerializer(permissions, many=True)

        return Response({
            "role_id": role.id,
            "role_name": role.name,
            "permissions": serializer.data,
        })


# -------------------------------------------------------------------
# Password setup/reset
# -------------------------------------------------------------------

class SetPasswordView(APIView):
    def post(self, request):
        serializer = SetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uid = serializer.validated_data["uid"]
        token = serializer.validated_data["token"]
        password = serializer.validated_data["password"]

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except Exception:
            return Response({"error": "Invalid link."}, status=400)

        if hasattr(user, "userprofile") and not user.userprofile.must_set_password:
            return Response({
                "error": "This setup link has already been used. Please login with your password.",
                "action": "go_login",
            }, status=400)

        if not default_token_generator.check_token(user, token):
            return Response({
                "error": "This setup has expired.",
                "email": user.email,
                "action": "resend_email",
            }, status=400)

        user.set_password(password)
        user.save()

        if hasattr(user, "userprofile"):
            user.userprofile.must_set_password = False
            user.userprofile.save()

        return Response({"message": "Password set successfully."}, status=200)


class ForgotPasswordView(APIView):
    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({
                "message": "If this email exists, a password reset link has been sent."
            }, status=200)

        if not user.is_active:
            return Response({
                "message": "If this email exists, a password reset link has been sent."
            }, status=200)

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        base_url = request.headers.get("Origin") or getattr(
            settings,
            "FRONTEND_URL",
            "http://localhost:5173",
        )

        reset_link = f"{base_url}/reset-password/{uid}/{token}"

        subject = "Reset your LeoMetrics password"
        display_name = get_display_name(user)

        text_message = (
            f"Hello {display_name},\n\n"
            f"We received a request to reset your LeoMetrics password.\n\n"
            f"Reset your password here:\n{reset_link}\n\n"
            f"If you did not request this, you can ignore this email."
        )

        html_message = f"""
        <div style="margin:0; padding:0; background-color:#eef2f7; font-family:Arial, Helvetica, sans-serif;">
          <div style="max-width:680px; margin:0 auto; padding:36px 16px;">
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:18px; overflow:hidden; box-shadow:0 8px 24px rgba(15,23,42,0.08);">
              <div style="background:linear-gradient(135deg,#0b1739,#1e3a8a); padding:30px;">
                <p style="margin:0 0 8px; color:#bfdbfe; font-size:13px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase;">
                  Password reset
                </p>
                <h1 style="margin:0; color:#ffffff; font-size:26px;">
                  Reset your password
                </h1>
                <p style="margin:10px 0 0; color:#dbeafe; font-size:15px;">
                  Use the secure link below to create a new password.
                </p>
              </div>

              <div style="padding:32px 30px;">
                <p style="color:#334155; font-size:15px; line-height:1.6;">
                  Hello <strong>{display_name}</strong>,
                </p>

                <p style="color:#334155; font-size:15px; line-height:1.6;">
                  We received a request to reset your LeoMetrics password.
                </p>

                <div style="text-align:center; margin:32px 0;">
                  <a href="{reset_link}"
                     style="display:inline-block; background:#2563eb; color:#ffffff; text-decoration:none; padding:14px 30px; border-radius:12px; font-weight:700; font-size:15px;">
                    Reset Password
                  </a>
                </div>

                <div style="background:#f1f5f9; border-radius:12px; padding:14px 16px; margin:22px 0;">
                  <p style="margin:0; color:#475569; font-size:13px; line-height:1.5;">
                    This reset link is temporary. If it expires, request a new reset email.
                  </p>
                </div>

                <p style="color:#64748b; font-size:13px;">
                  If the button does not work, copy and paste this link into your browser:
                </p>

                <p style="word-break:break-all; color:#2563eb; font-size:13px;">
                  {reset_link}
                </p>

                <hr style="border:none; border-top:1px solid #e5e7eb; margin:28px 0;" />

                <p style="margin:0; color:#94a3b8; font-size:12px; line-height:1.6;">
                  If you did not request this password reset, you can safely ignore this email.
                </p>
              </div>
            </div>
          </div>
        </div>
        """

        email_message = EmailMultiAlternatives(
            subject=subject,
            body=text_message,
            from_email=None,
            to=[user.email],
        )
        email_message.attach_alternative(html_message, "text/html")
        email_message.send()

        return Response({
            "message": "If this email exists, a password reset link has been sent."
        }, status=200)


class ResetPasswordView(APIView):
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uid = serializer.validated_data["uid"]
        token = serializer.validated_data["token"]
        password = serializer.validated_data["password"]

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except Exception:
            return Response({"error": "Invalid reset link."}, status=400)

        if not default_token_generator.check_token(user, token):
            return Response(
                {"error": "This reset link is invalid or expired."},
                status=400,
            )

        user.set_password(password)
        user.save()

        return Response({"message": "Password reset successfully."}, status=200)


# --------------------------------------------------
# RESEND SETUP EMAIL
# --------------------------------------------------

class ResendSetupEmailView(APIView):

    def post(self, request):
        email = request.data.get("email")

        if not email:
            return Response({"error": "Email is required"}, status=400)

        try:
            user = User.objects.get(email=email)

            if not hasattr(user, "userprofile"):
                return Response({"error": "User profile not found"}, status=404)

            if not user.userprofile.must_set_password:
                return Response(
                    {"error": "User already set password"},
                    status=400
                )

            setup_link = build_setup_link(user, request)

            send_setup_email(
                user=user,
                profile=user.userprofile,
                setup_link=setup_link,
                permissions=user.userprofile.app_permissions.filter(is_active=True),
                message_context="Here is your new setup link.",
            )

            return Response({"message": "Setup email sent successfully"})

        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)


# --------------------------------------------------
# UPDATE USER PERMISSIONS (APP PERMISSION VERSION)
# --------------------------------------------------

class UserPermissionsUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):

        if not has_app_permission(request.user, "edit_user"):
            return Response(
                {"error": "You do not have permission to edit user permissions."},
                status=403,
            )

        try:
            user = User.objects.select_related(
                "userprofile",
                "userprofile__role",
            ).get(id=pk)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        if request.user.id == user.id:
            return Response(
                {"error": "You cannot change your own permissions."},
                status=400,
            )

        permission_ids = request.data.get("permission_ids", [])

        if not permission_ids:
            return Response(
                {"error": "Please select at least one permission."},
                status=400,
            )

        role = user.userprofile.role

        permissions = AppPermission.objects.filter(
            id__in=permission_ids,
            is_active=True,
            roles=role
        )

        if permissions.count() != len(permission_ids):
            return Response(
                {"error": "One or more permissions are invalid or not allowed for this role."},
                status=400,
            )

        user.userprofile.app_permissions.set(permissions)
        user.userprofile.updated_by = request.user
        user.userprofile.save()

        return Response({"message": "Permissions updated successfully"})