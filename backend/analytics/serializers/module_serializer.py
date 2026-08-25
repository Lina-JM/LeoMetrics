from rest_framework import serializers
from analytics.models.itsm_module_config import ITSMModuleConfig


class ModuleSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    updated_by_username = serializers.CharField(source="updated_by.username", read_only=True)

    class Meta:
        model = ITSMModuleConfig
        fields = [
            "id",
            "name",
            "code",
            "description",
            "uploaded_file",
            "is_active",
            "is_active",
            "created_by",
            "created_by_username",
            "updated_by",
            "updated_by_username",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "created_by",
            "created_by_username",
            "updated_by",
            "updated_by_username",
            "created_at",
            "updated_at",
        ]


class ModuleActivationSerializer(serializers.Serializer):
    is_active = serializers.BooleanField()