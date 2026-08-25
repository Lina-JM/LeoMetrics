from rest_framework import serializers
from analytics.models import KPIDefinition, KPIResult

def generate_business_meaning(kpi):
    module_name = kpi.module.name if kpi.module else "the selected module"
    kpi_name = kpi.name or "This KPI"

    if kpi.group_by:
        group_text = f" grouped by {kpi.group_by.field_name}"
    else:
        group_text = ""

    if kpi.aggregation == "count":
        metric_text = f"measures the number of records in {module_name}{group_text}"
    else:
        field_name = kpi.field.field_name if kpi.field else "the selected field"
        metric_text = f"measures the {kpi.aggregation} value of {field_name} in {module_name}{group_text}"

    target_text = ""
    if kpi.target_value is not None:
        target_text = (
            f" The target is {kpi.target_operator} {kpi.target_value}."
        )

    return (
        f"{kpi_name} {metric_text}. "
        f"This KPI helps decision-makers monitor performance, detect operational risks, "
        f"identify process bottlenecks, and prioritize corrective actions for {module_name}."
        f"{target_text}"
    )

class KPISerializer(serializers.ModelSerializer):
    module_name = serializers.CharField(source="module.name", read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    updated_by_username = serializers.CharField(source="updated_by.username", read_only=True)
    field_name = serializers.CharField(source="field.field_name", read_only=True)
    group_by_name = serializers.CharField(source="group_by.field_name", read_only=True)
    reporting_date_field_name = serializers.CharField(source="reporting_date_field.field_name", read_only=True)
    def create(self, validated_data):
        kpi = super().create(validated_data)

        if not kpi.business_meaning:
            kpi.business_meaning = generate_business_meaning(kpi)
            kpi.save(update_fields=["business_meaning"])

        return kpi


    def update(self, instance, validated_data):
        old_values = {
            "name": instance.name,
            "aggregation": instance.aggregation,
            "field": instance.field,
            "group_by": instance.group_by,
            "target_value": instance.target_value,
            "target_operator": instance.target_operator,
            "module": instance.module,
        }

        kpi = super().update(instance, validated_data)

        new_values = {
            "name": kpi.name,
            "aggregation": kpi.aggregation,
            "field": kpi.field,
            "group_by": kpi.group_by,
            "target_value": kpi.target_value,
            "target_operator": kpi.target_operator,
            "module": kpi.module,
        }

        #  regenerate only if important fields changed
        if old_values != new_values:
            kpi.business_meaning = generate_business_meaning(kpi)
            kpi.save(update_fields=["business_meaning"])

        return kpi
    
    class Meta:
        model = KPIDefinition
        fields = [
            "id",
            "module",
            "module_name",
            "name",
            "aggregation",
            "field",
            "filters",
            "group_by",
            "limit",
            "target_operator",
            "target_value",
            "value_type",
            "description",
            "business_meaning",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_username",
            "updated_by",
            "updated_by_username",
            "is_active",
            "field_name",
            "group_by_name",
            "reporting_date_field",
            "reporting_date_field_name",
        ]
        read_only_fields = [
            "created_at",
            "updated_at",
            "created_by",
            "created_by_username",
            "updated_by",
            "updated_by_username",
        ]
    def validate(self, data):
        reporting_date_field = data.get(
            "reporting_date_field",
            getattr(self.instance, "reporting_date_field", None)
        )

        if not reporting_date_field:
            raise serializers.ValidationError({
                "reporting_date_field": "This field is required."
            })

        return data

class KPIResultSerializer(serializers.ModelSerializer):
    kpi_name = serializers.CharField(source="kpi.name", read_only=True)
    module_name = serializers.CharField(source="module.name", read_only=True)
    date_value = serializers.DateField(source="date_dim.date", read_only=True)

    class Meta:
        model = KPIResult
        fields = [
            "id",
            "kpi",
            "kpi_name",
            "module",
            "module_name",
            "date_dim",
            "date_value",
            "actual_value",
            "target_value",
            "grouped_data",
            "result_status",
            "calculated_at",
        ]