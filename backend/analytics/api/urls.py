from django.urls import path, include
from rest_framework.routers import DefaultRouter

from analytics.api.module_views import (
    ModuleListCreateView,
    ModuleDetailView,
    ModuleFieldsView,
    FilterValuesView,
    ModuleActivationUpdateView,
    ModuleUpdateView,
    ModuleFieldExtractionView,
    ModuleDataExtractionView,
    ModuleFieldValuesView,
)
from analytics.api.kpi_views import KPIViewSet, KPIByModuleView, KPIRunView, KPIHistoryView
from analytics.api.kpi_results import KPIResultListView
from analytics.api.field_values_views import get_field_values
from analytics.api.module_file_upload import upload_extracted_file
from analytics.api.ai_support_views import AnalyzeAIRecommendationsView, AIRecommendationListView, ReviewAIRecommendationView
from analytics.api.forecasting_views import KPIForecastAPIView
router = DefaultRouter()
router.register(r"kpis", KPIViewSet, basename="kpis")

urlpatterns = [
    path("", include(router.urls)),

    path("modules/", ModuleListCreateView.as_view(), name="module_list_create"),
    path("modules/<int:id>/", ModuleDetailView.as_view(), name="module_detail"),
    path("modules/<int:id>/update/", ModuleUpdateView.as_view(), name="module_update"),
    path("modules/<int:id>/activation/", ModuleActivationUpdateView.as_view(), name="module_activation_update"),
    path("modules/<int:module_id>/fields/", ModuleFieldsView.as_view(), name="module_fields"),
    path("modules/<int:id>/extract-fields/", ModuleFieldExtractionView.as_view(), name="module_extract_fields"),
    path("modules/<int:id>/extract-data/", ModuleDataExtractionView.as_view(), name="module_extract_data"),
    path("modules/<int:module_id>/field-values/", ModuleFieldValuesView.as_view(), name="module_field_values"),
    path("modules/<int:module_id>/kpis/", KPIByModuleView.as_view(), name="kpis_by_module"),
    path("kpi-results/", KPIResultListView.as_view(), name="kpi_results_list"),
    path("kpis/<int:kpi_id>/run/", KPIRunView.as_view(), name="kpi_run"),
    path("kpis/<int:kpi_id>/history/", KPIHistoryView.as_view(), name="kpi_history"),
    path("filter-values/", FilterValuesView.as_view(), name="filter_values"),
    path("field-values/", get_field_values, name="field_values"),
    path("modules/<int:module_id>/upload-file/", upload_extracted_file, name="upload_extracted_file"),
    path("ai-support/analyze/", AnalyzeAIRecommendationsView.as_view(), name="ai_analyze"),
    path("ai-support/recommendations/", AIRecommendationListView.as_view(), name="ai_recommendations"),
    path("ai-support/recommendations/<int:pk>/review/", ReviewAIRecommendationView.as_view(), name="ai_review"),
    path("ai-support/forecasting/", KPIForecastAPIView.as_view(), name="kpi_forecasting"),

]