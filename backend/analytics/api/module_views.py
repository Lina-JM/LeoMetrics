from django.db import connection
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from etl.pipeline.run_pipeline import run_pipeline

from analytics.services.kpi_engine import compute_kpi

from analytics.models import CleanedITSMRecord
from analytics.models.itsm_module_config import ITSMModuleConfig
from analytics.models.dim_itsm import ITSMModule as DimModule
from analytics.models.module_fields import ModuleField
from analytics.models.kpi_definition import KPIDefinition

from analytics.serializers.field_serializer import ModuleFieldSerializer
from analytics.serializers.module_serializer import (
    ModuleSerializer,
    ModuleActivationSerializer,
)

from users.api.permissions import HasAppPermission


def sync_dim_module(module):
    dim_module, _ = DimModule.objects.update_or_create(
        name=module.name,
        defaults={
            "code": module.name.upper().replace(" ", "_"),
            "description": module.description or "",
            "is_active": module.is_active,
        },
    )
    return dim_module


class ModuleListCreateView(generics.ListCreateAPIView):
    queryset = ITSMModuleConfig.objects.all().order_by("-is_active", "name")
    serializer_class = ModuleSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.request.method == "POST":
            self.required_permission = "create_module"
        else:
            self.required_permission = "view_dashboard"

        return [IsAuthenticated(), HasAppPermission()]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        module = serializer.save(
            created_by=request.user,
            updated_by=request.user,
        )

        sync_dim_module(module)

        return Response(
            self.get_serializer(module).data,
            status=status.HTTP_201_CREATED,
        )


class ModuleDetailView(generics.RetrieveAPIView):
    queryset = ITSMModuleConfig.objects.all()
    serializer_class = ModuleSerializer
    permission_classes = [IsAuthenticated, HasAppPermission]
    required_permission = "view_module"
    lookup_field = "id"


class ModuleUpdateView(generics.UpdateAPIView):
    queryset = ITSMModuleConfig.objects.all()
    serializer_class = ModuleSerializer
    permission_classes = [IsAuthenticated, HasAppPermission]
    required_permission = "edit_module"
    lookup_field = "id"

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        module = serializer.save(updated_by=request.user)

        sync_dim_module(module)

        return Response(
            self.get_serializer(module).data,
            status=status.HTTP_200_OK,
        )


class ModuleActivationUpdateView(APIView):
    permission_classes = [IsAuthenticated, HasAppPermission]
    required_permission = "activate_deactivate_module"

    def patch(self, request, id):
        serializer = ModuleActivationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            module = ITSMModuleConfig.objects.get(id=id)
        except ITSMModuleConfig.DoesNotExist:
            return Response(
                {"error": "Module not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        module.is_active = serializer.validated_data["is_active"]
        module.updated_by = request.user
        module.save()

        sync_dim_module(module)

        return Response({
            "message": "Module status updated successfully.",
            "module_id": module.id,
            "is_active": module.is_active,
        })


class ModuleFieldExtractionView(APIView):
    permission_classes = [IsAuthenticated, HasAppPermission]
    required_permission = "edit_module"

    def post(self, request, id):
        try:
            module = ITSMModuleConfig.objects.get(id=id)
        except ITSMModuleConfig.DoesNotExist:
            return Response(
                {"error": "Module not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            result = run_pipeline(module_id=module.id)

            fields = ModuleField.objects.filter(module=module)
            serializer = ModuleFieldSerializer(fields, many=True)

            return Response({
                "message": "Module fields extracted successfully.",
                "module_id": module.id,
                "module_name": module.name,
                "field_count": fields.count(),
                "fields": serializer.data,
                "pipeline": result,
            })

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ModuleFieldsView(APIView):
    permission_classes = [IsAuthenticated, HasAppPermission]
    required_permission = "view_module"

    def get(self, request, module_id):
        fields = ModuleField.objects.filter(module_id=module_id)
        serializer = ModuleFieldSerializer(fields, many=True)
        return Response(serializer.data)


class FilterValuesView(APIView):
    permission_classes = [IsAuthenticated, HasAppPermission]
    required_permission = "view_module"

    def get(self, request):
        module_id = request.GET.get("module_id")
        field = request.GET.get("field")

        if not module_id or not field:
            return Response(
                {"error": "module_id and field are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            module = ITSMModuleConfig.objects.get(id=module_id)
        except ITSMModuleConfig.DoesNotExist:
            return Response(
                {"error": "Module not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        dim_module = DimModule.objects.filter(name=module.name).first()

        if not dim_module:
            return Response({
                "values": [],
                "count": 0,
                "message": "No extracted data found for this module.",
            })

        table_name = CleanedITSMRecord._meta.db_table

        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT DISTINCT dynamic_data->>%s
                FROM {table_name}
                WHERE module_id = %s
                """,
                [field, dim_module.id],
            )

            values = sorted(set(row[0] for row in cursor.fetchall() if row[0]))

        return Response({
            "values": values,
            "count": len(values),
        })


class ModuleDataExtractionView(APIView):

    permission_classes = [IsAuthenticated, HasAppPermission]
    required_permission = "edit_module"

    def post(self, request, id):
        try:
            module = ITSMModuleConfig.objects.get(id=id)
        except ITSMModuleConfig.DoesNotExist:
            return Response(
                {"error": "Module not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            pipeline_result = run_pipeline(module_id=module.id)

            kpis = KPIDefinition.objects.filter(module=module, is_active=True)

            computed = []
            failed = []

            for kpi in kpis:
                try:
                    compute_kpi(kpi.id)
                    computed.append(kpi.name)
                except Exception as e:
                    failed.append({
                        "kpi": kpi.name,
                        "error": str(e),
                    })

            return Response({
                "message": "Data extracted and KPIs executed successfully.",
                "module_id": module.id,
                "module_name": module.name,
                "pipeline": pipeline_result,
                "computed_kpis": computed,
                "failed_kpis": failed,
            })

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        


class ModuleFieldValuesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, module_id):
        field = request.query_params.get("field")

        if not field:
            return Response({"values": []})

        records = CleanedITSMRecord.objects.filter(module_id=module_id)

        values = set()

        for record in records:
            value = record.dynamic_data.get(field)

            if value not in [None, "", "null"]:
                values.add(str(value))

        return Response({
            "values": sorted(values)
        })        