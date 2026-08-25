from django.contrib import admin
from .models.dim_date import DateDimension
from .models.dim_itsm import ITSMModule
from .models.dim_kpi import KPI
from .models.fact_kpi_result import KPIResult
from .models.cleaned_records import CleanedITSMRecord
from .models.module_fields import ModuleField
from .models.etl_warning import ETLWarning
from .models.etl_conflict_log import ETLConflictLog
from .models.ai_support import AIRecommendation
from .models.kpi_forecast import KPIForecast
from .models.itsm_module_config import ITSMModuleConfig
from .models.kpi_definition import KPIDefinition
from .models.module_extracted_file import ModuleExtractedFile
from .forms import KPIForm
admin.site.register(DateDimension)
admin.site.register(ITSMModule)
admin.site.register(KPIResult)
admin.site.register(KPIDefinition)
admin.site.register(ITSMModuleConfig) 
admin.site.register(AIRecommendation)
admin.site.register(ModuleExtractedFile)

@admin.register(CleanedITSMRecord)
class CleanedITSMRecordAdmin(admin.ModelAdmin):
    list_display = (
        "record_id",
        "module",
        "etl_processed_at"
    )
    list_filter = ("module",)
@admin.register(ModuleField)
class ModuleFieldAdmin(admin.ModelAdmin):
    list_display = ("module", "field_name", "field_type")
    list_filter = ("module",)
    search_fields = ("field_name",)

@admin.register(ETLWarning)
class ETLWarningAdmin(admin.ModelAdmin):
    list_display = ("module", "message", "created_at")

@admin.register(ETLConflictLog)
class ETLConflictLogAdmin(admin.ModelAdmin):
    list_display = ("module", "record_id", "created_at")
    list_filter = ("module",)
    search_fields = ("record_id",)
@admin.register(KPI)
class KPIAdmin(admin.ModelAdmin):
    form = KPIForm

    list_display = (
        "name",
        "description",
        "is_active",
    )

    list_filter = ("is_active",)
    search_fields = ("name",)


