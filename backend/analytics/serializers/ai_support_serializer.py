from rest_framework import serializers
from analytics.models import AIRecommendation


class AIRecommendationSerializer(serializers.ModelSerializer):
    kpi_name = serializers.CharField(source="kpi.name", read_only=True)
    module_name = serializers.CharField(source="module.name", read_only=True)
    reviewed_by_username = serializers.CharField(
        source="reviewed_by.username",
        read_only=True
    )

    class Meta:
        model = AIRecommendation
        fields = "__all__"
        read_only_fields = [
            "created_at",
            "reviewed_by",
            "reviewed_at",
        ]