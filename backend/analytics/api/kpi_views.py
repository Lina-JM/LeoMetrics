from rest_framework import status
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from analytics.models.kpi_definition import KPIDefinition
from analytics.serializers.kpi_serializer import KPISerializer
from analytics.services.kpi_engine import compute_kpi, compute_kpi_for_existing_months
from analytics.models.fact_kpi_result import KPIResult

from users.api.permissions import HasAppPermission, HasAppPermissionByAction


class KPIViewSet(ModelViewSet):
    queryset = KPIDefinition.objects.all()
    serializer_class = KPISerializer
    permission_classes = [IsAuthenticated, HasAppPermissionByAction]

    action_permissions = {
        "list": "view_kpi",
        "retrieve": "view_kpi",
        "create": "create_kpi",
        "update": "edit_kpi",
        "partial_update": "edit_kpi",
        "destroy": "activate_deactivate_kpi",
    }

    def partial_update(self, request, *args, **kwargs):
        if "is_active" in request.data:
            if not request.user.userprofile.app_permissions.filter(
                code="activate_deactivate_kpi",
                is_active=True,
            ).exists() and request.user.userprofile.role.name != "administrator":
                return Response(
                    {"error": "You do not have permission to activate or deactivate KPIs."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        return super().partial_update(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    def perform_update(self, serializer):
        old_is_active = serializer.instance.is_active

        kpi = serializer.save(updated_by=self.request.user)

        updated_fields = set(self.request.data.keys())

        # If only status changed, do not run pipeline
        if updated_fields == {"is_active"}:
            return

        try:
            from analytics.tasks import run_pipeline_task

            run_pipeline_task.delay(kpi.module.id)

        except Exception as e:
            print(f"Could not start pipeline task after KPI update: {e}")


class KPIByModuleView(ListAPIView):
    serializer_class = KPISerializer
    permission_classes = [IsAuthenticated, HasAppPermission]
    required_permission = "view_kpi"

    def get_queryset(self):
        module_id = self.kwargs["module_id"]

        return KPIDefinition.objects.filter(
            module_id=module_id,
            is_active=True,
        ).order_by("name")


class KPIRunView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, kpi_id):
        dashboard_filters = request.data.get("dashboard_filters", [])

        if dashboard_filters is None:
            dashboard_filters = []

        if not isinstance(dashboard_filters, list):
            return Response(
                {"error": "dashboard_filters must be a list."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            save_result = request.data.get("save_result", True)
            result = compute_kpi(
                kpi_definition_id=kpi_id,
                dashboard_filters=dashboard_filters,
                save_result=False,
            )

            return Response(result, status=status.HTTP_200_OK)

        except KPIDefinition.DoesNotExist:
            return Response(
                {"error": "KPI definition not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class KPIHistoryView(APIView):
    permission_classes = [IsAuthenticated, HasAppPermission]
    required_permission = "view_kpi"

    def get(self, request, kpi_id):
        level = request.GET.get("level", "month")

        if level not in ["year", "quarter", "month", "day"]:
            return Response(
                {"error": "Invalid level. Use year, quarter, month, or day."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            kpi_definition = KPIDefinition.objects.get(id=kpi_id)
        except KPIDefinition.DoesNotExist:
            return Response(
                {"error": "KPI definition not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            if kpi_definition.reporting_date_field:
                compute_kpi_for_existing_months(kpi_definition)
        except Exception as e:
            return Response(
                {"error": f"Failed to compute KPI history: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = (
            KPIResult.objects
            .filter(
                kpi__kpi_definition=kpi_definition,
                date_dim__isnull=False,
            )
            .select_related("date_dim")
            .order_by("date_dim__date")
        )

        grouped = {}

        for result in results:
            d = result.date_dim.date

            if level == "year":
                key = str(d.year)
                sort_key = (d.year,)

            elif level == "quarter":
                quarter = (d.month - 1) // 3 + 1
                key = f"{d.year} Q{quarter}"
                sort_key = (d.year, quarter)

            elif level == "month":
                key = d.strftime("%b-%y")
                sort_key = (d.year, d.month)

            else:  # day
                key = d.strftime("%d-%b-%y")
                sort_key = (d.year, d.month, d.day)

            if key not in grouped:
                grouped[key] = {
                    "label": key,
                    "value": 0,
                    "target": float(result.target_value) if result.target_value is not None else None,
                    "sort_key": sort_key,
                }

            grouped[key]["value"] += float(result.actual_value or 0)

        data = sorted(grouped.values(), key=lambda x: x["sort_key"])

        for item in data:
            item.pop("sort_key", None)

        return Response(data, status=status.HTTP_200_OK)
    
    def post(self, request, kpi_id):
        level = request.data.get("level", "month")
        dashboard_filters = request.data.get("dashboard_filters", [])

        if level not in ["year", "quarter", "month", "day"]:
            return Response(
                {"error": "Invalid level. Use year, quarter, month, or day."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if dashboard_filters is None:
            dashboard_filters = []

        if not isinstance(dashboard_filters, list):
            return Response(
                {"error": "dashboard_filters must be a list."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            kpi_definition = KPIDefinition.objects.get(id=kpi_id)
        except KPIDefinition.DoesNotExist:
            return Response(
                {"error": "KPI definition not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not kpi_definition.reporting_date_field:
            return Response(
                {"error": "This KPI has no reporting date field."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        date_field = kpi_definition.reporting_date_field.field_name

        existing_dates = (
            KPIResult.objects
            .filter(
                kpi__kpi_definition=kpi_definition,
                date_dim__isnull=False,
            )
            .select_related("date_dim")
            .order_by("date_dim__date")
            .values_list("date_dim__date", flat=True)
            .distinct()
        )

        grouped = {}
        series_keys = set()

        for result_date in existing_dates:
            start_date = result_date.replace(day=1)

            if start_date.month == 12:
                end_date = start_date.replace(
                    year=start_date.year + 1,
                    month=1,
                )
            else:
                end_date = start_date.replace(month=start_date.month + 1)

            monthly_filters = [
                {
                    "field": date_field,
                    "operator": ">=",
                    "value": str(start_date),
                    "logic": "AND",
                },
                {
                    "field": date_field,
                    "operator": "<",
                    "value": str(end_date),
                    "logic": "AND",
                },
                *dashboard_filters,
            ]

            result = compute_kpi(
                kpi_definition_id=kpi_id,
                dashboard_filters=monthly_filters,
                save_result=False,
            )

            d = start_date

            if level == "year":
                key = str(d.year)
                sort_key = (d.year,)
            elif level == "quarter":
                quarter = (d.month - 1) // 3 + 1
                key = f"{d.year} Q{quarter}"
                sort_key = (d.year, quarter)
            elif level == "month":
                key = d.strftime("%b-%y")
                sort_key = (d.year, d.month)
            else:
                key = d.strftime("%d-%b-%y")
                sort_key = (d.year, d.month, d.day)

            if key not in grouped:
                grouped[key] = {
                    "label": key,
                    "value": 0,
                    "target": float(kpi_definition.target_value or 0),
                    "sort_key": sort_key,
                }

            if result.get("type") == "grouped":
                for item in result.get("data", []):
                    group_label = str(
                        item.get("label")
                        or item.get("group")
                        or item.get("group_value")
                        or "Unknown"
                    )

                    group_value = float(item.get("value") or 0)

                    grouped[key][group_label] = grouped[key].get(group_label, 0) + group_value
                    grouped[key]["value"] += group_value
                    series_keys.add(group_label)

            else:
                value = float(result.get("value") or 0)
                grouped[key]["value"] += value

        data = sorted(grouped.values(), key=lambda x: x["sort_key"])

        for item in data:
            item.pop("sort_key", None)

        return Response(
            {
                "data": data,
                "series": sorted(series_keys),
                "is_grouped": bool(series_keys),
            },
            status=status.HTTP_200_OK,
        )   