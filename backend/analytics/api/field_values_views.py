from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from analytics.models.cleaned_records import CleanedITSMRecord
from analytics.models.itsm_module_config import ITSMModuleConfig
from analytics.models.dim_itsm import ITSMModule


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_field_values(request):
    module_config_id = request.GET.get("module_id")
    field_name = request.GET.get("field")
    search = request.GET.get("search", "").strip().lower()
    limit = int(request.GET.get("limit", 50))

    if not module_config_id or not field_name:
        return Response(
            {"error": "module_id and field are required."},
            status=400
        )

    try:
        module_config = ITSMModuleConfig.objects.get(id=module_config_id)
    except ITSMModuleConfig.DoesNotExist:
        return Response({"error": "Module config not found."}, status=404)

    try:
        dim_module = ITSMModule.objects.get(name=module_config.name)
    except ITSMModule.DoesNotExist:
        return Response({
            "values": [],
            "count": 0,
            "message": "No extracted data found for this module."
        })

    records = CleanedITSMRecord.objects.filter(module=dim_module)

    values = []

    for record in records:
        value = record.dynamic_data.get(field_name)

        if value is None or value == "":
            continue

        value = str(value).strip()

        if search and search not in value.lower():
            continue

        values.append(value)

    unique_values = sorted(set(values))[:limit]

    return Response({
        "values": unique_values,
        "count": len(unique_values),
    })