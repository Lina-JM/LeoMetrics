from rest_framework import serializers


class ForecastPointSerializer(serializers.Serializer):
    month = serializers.CharField()
    value = serializers.FloatField()


class GroupForecastSerializer(serializers.Serializer):
    group_by_field = serializers.CharField()
    group_by_value = serializers.CharField()
    actual = ForecastPointSerializer(many=True)
    forecast = ForecastPointSerializer(many=True)


class KPIForecastSerializer(serializers.Serializer):
    kpi_id = serializers.IntegerField()
    kpi_name = serializers.CharField()
    module_name = serializers.CharField(required=False, allow_null=True)

    actual = ForecastPointSerializer(many=True)
    forecast = ForecastPointSerializer(many=True)
    groups = GroupForecastSerializer(many=True)
