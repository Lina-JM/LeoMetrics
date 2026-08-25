from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from analytics.models.fact_kpi_result import KPIResult
from analytics.serializers.forecast_serializer import KPIForecastSerializer
from analytics.services.forecasting_service import read_saved_forecast
from users.api.permissions import HasAppPermission


class KPIForecastAPIView(APIView):
    permission_classes = [IsAuthenticated, HasAppPermission]
    required_permission = "view_ai_forecasting"

    def get(self, request):
        kpis = (
            KPIResult.objects
            .select_related("kpi", "module")
            .filter(kpi__isnull=False)
            .values_list("kpi", flat=True)
            .distinct()
        )

        response = []

        for kpi_id in kpis:
            sample_result = (
                KPIResult.objects
                .select_related("kpi", "module")
                .filter(kpi_id=kpi_id)
                .first()
            )

            if not sample_result:
                continue

            kpi = sample_result.kpi
            data = read_saved_forecast(kpi)

            response.append({
                "kpi_id": kpi.id,
                "kpi_name": kpi.name,
                "module_name": sample_result.module.name if sample_result.module else None,
                "actual": data["actual"],
                "forecast": data["forecast"],
                "groups": data["groups"]
            })

        serializer = KPIForecastSerializer(response, many=True)
        return Response(serializer.data)