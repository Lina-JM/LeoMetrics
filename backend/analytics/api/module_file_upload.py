# analytics/api/module_file_upload.py

from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from analytics.models.itsm_module_config import ITSMModuleConfig
from analytics.models.module_extracted_file import ModuleExtractedFile
from analytics.tasks import run_pipeline_task


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_extracted_file(request, module_id):
    try:
        module = ITSMModuleConfig.objects.get(id=module_id)
    except ITSMModuleConfig.DoesNotExist:
        return Response({"error": "Module not found."}, status=404)

    uploaded_file = request.FILES.get("file")

    if not uploaded_file:
        return Response({"error": "No file uploaded."}, status=400)

    if not uploaded_file.name.lower().endswith((".xlsx", ".xls", ".csv")):
        return Response(
            {"error": "Only Excel or CSV files are allowed."},
            status=400,
        )

    module.uploaded_file = uploaded_file
    module.save(update_fields=["uploaded_file"])

    ModuleExtractedFile.objects.filter(module=module).update(is_latest=False)

    new_file = ModuleExtractedFile.objects.create(
        module=module,
        file=uploaded_file,
        is_latest=True,
    )

    task = run_pipeline_task.delay(module.id)

    return Response(
        {
            "message": "File uploaded successfully. ETL pipeline started in background.",
            "file_id": new_file.id,
            "file_name": new_file.file.name,
            "task_id": task.id,
        },
        status=202,
    )