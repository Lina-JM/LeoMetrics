from rest_framework import serializers
from analytics.models.fact_kpi_result import KPIResult


class KPIResultSerializer(serializers.ModelSerializer):
    kpi_name = serializers.CharField(source="kpi.name", read_only=True)
    module_name = serializers.CharField(source="module.name", read_only=True)
    date_value = serializers.DateField(source="date_dim.date", read_only=True)
    kpi_definition_id = serializers.IntegerField(
        source="kpi.kpi_definition.id",
        read_only=True
    )

    class Meta:
        model = KPIResult
        fields = [
            "id",
            "kpi",
            "kpi_definition_id",
            "kpi_name",
            "module",
            "module_name",
            "date_dim",
            "date_value",
            "actual_value",
            "target_value",
            "result_status",
            "calculated_at",
        ]
        read_only_fields = ["id", "calculated_at"]