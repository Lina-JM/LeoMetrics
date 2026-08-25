from rest_framework import serializers
from analytics.models.module_fields import ModuleField


class ModuleFieldSerializer(serializers.ModelSerializer):

    class Meta:
        model = ModuleField
        fields = "__all__"
        read_only_fields = ["id"]