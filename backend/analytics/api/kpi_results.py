from datetime import date
from calendar import monthrange

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from analytics.models.kpi_definition import KPIDefinition
from analytics.models.fact_kpi_result import KPIResult
from users.api.permissions import HasAppPermission


class KPIResultListView(APIView):
    permission_classes = [IsAuthenticated, HasAppPermission]
    required_permission = "view_report"

    def get_date_range(self, request):
        start_date_param = request.GET.get("start_date")
        end_date_param = request.GET.get("end_date")

        if start_date_param and end_date_param:
            return (
                date.fromisoformat(start_date_param),
                date.fromisoformat(end_date_param),
            )

        months = int(request.GET.get("months", 12))
        today = date.today()

        start_month = today.month - months + 1
        start_year = today.year

        while start_month <= 0:
            start_month += 12
            start_year -= 1

        start_date = date(start_year, start_month, 1)
        end_date = date(
            today.year,
            today.month,
            monthrange(today.year, today.month)[1],
        )

        return start_date, end_date

    def get(self, request):
        start_date, end_date = self.get_date_range(request)

        kpis = KPIDefinition.objects.filter(is_active=True).select_related(
            "module",
            "field",
            "group_by",
            "reporting_date_field",
        )

        saved_results = (
            KPIResult.objects.filter(
                kpi__kpi_definition__in=kpis,
                date_dim__date__gte=start_date,
                date_dim__date__lte=end_date,
            )
            .select_related(
                "kpi",
                "kpi__kpi_definition",
                "module",
                "date_dim",
            )
            .order_by("date_dim__date")
        )

        results = []

        for result in saved_results:
            kpi_definition = result.kpi.kpi_definition

            if not kpi_definition:
                continue

            grouped_data = result.grouped_data or []

            results.append({
                "kpi_definition_id": kpi_definition.id,
                "kpi_name": kpi_definition.name,
                "module": kpi_definition.module.id,
                "module_name": kpi_definition.module.name,
                "date_value": result.date_dim.date.isoformat() if result.date_dim else None,
                "actual_value": result.actual_value,
                "target_value": result.target_value,
                "result_status": result.result_status,
                "grouped_data": grouped_data,
                "type": "grouped" if grouped_data else "single",
            })

        return Response(results)