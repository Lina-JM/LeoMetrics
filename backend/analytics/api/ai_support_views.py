from datetime import datetime
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from analytics.models import AIRecommendation, CleanedITSMRecord, KPIDefinition
from analytics.models.dim_itsm import ITSMModule
from analytics.serializers.ai_support_serializer import AIRecommendationSerializer
from analytics.tasks import generate_ai_recommendations_task
from analytics.services.kpi_engine import compute_kpi
from users.api.permissions import HasAppPermission


MAX_AI_CALLS = 2


def get_kpi_context_text(kpi):
    parts = [
        getattr(kpi, "business_meaning", "") or "",
        getattr(kpi, "description", "") or "",
        getattr(kpi.module, "description", "") or "",
    ]
    return " ".join(parts).lower()


def get_dynamic_action(kpi):
    module_name = getattr(kpi.module, "name", "this module")
    context = get_kpi_context_text(kpi)
    aggregation = (getattr(kpi, "aggregation", "") or "").lower()
    group_by = getattr(kpi.group_by, "field_name", "").replace("_", " ") if kpi.group_by else ""

    if "approval" in context:
        return (
            f"Add backup approvers for {module_name}, automate low-risk approvals, "
            "and define a maximum approval delay before escalation."
        )

    if "knowledge" in context or "article" in context or "documentation" in context:
        return (
            f"Assign article owners for {module_name}, create missing knowledge articles "
            "for recurring issues, and schedule monthly content reviews."
        )

    if "root cause" in context or "recurring" in context or "known error" in context:
        return (
            "Assign the problem management team to prioritize root cause analysis, "
            "document known errors, and define permanent fixes for recurring issues."
        )

    if "change" in context or "deployment" in context or "validation" in context:
        return (
            "Require the change manager to strengthen pre-implementation validation, "
            "review high-risk changes, and reduce emergency changes."
        )

    if "incident" in context or "service disruption" in context or "sla" in context:
        return (
            "Assign the service desk and support group to reduce recurring incidents, "
            "analyze top affected services, and improve first-response handling."
        )

    if aggregation in ["avg", "average"]:
        return (
            f"Reduce average processing time in {module_name} by removing manual delays, "
            "clarifying ownership, and enforcing SLA checkpoints."
        )

    if group_by:
        return (
            f"Focus on the highest-risk {group_by} in {module_name}, assign an owner to that segment, "
            "and implement a targeted improvement action."
        )

    return (
        f"Assign a clear owner for {module_name}, define one measurable improvement action, "
        "and review the KPI weekly."
    )


def get_dynamic_cause(kpi):
    module_name = getattr(kpi.module, "name", "this module")
    context = get_kpi_context_text(kpi)

    if "approval" in context:
        return (
            "The most likely cause is an approval workflow bottleneck, insufficient approvers, "
            "or delayed validation of pending requests."
        )

    if "knowledge" in context or "article" in context or "documentation" in context:
        return (
            "The most likely cause is missing knowledge coverage, outdated articles, "
            "or lack of ownership for documentation updates."
        )

    if "root cause" in context or "recurring" in context or "known error" in context:
        return (
            "The most likely cause is unresolved root cause analysis, recurring incidents, "
            "or delayed permanent fixes."
        )

    if "change" in context or "deployment" in context or "validation" in context:
        return (
            "The most likely cause is weak change validation, excessive high-risk changes, "
            "or poor pre-implementation planning."
        )

    if "incident" in context or "service disruption" in context or "sla" in context:
        return (
            "The most likely cause is recurring service disruption, high incident inflow, "
            "or insufficient support capacity."
        )

    return (
        f"The most likely cause is a process bottleneck, ownership gap, or delayed handling "
        f"within {module_name}."
    )


def generate_rule_based_recommendation(kpi, result):
    status_value = result.get("status")
    actual_value = result.get("value")
    target_value = result.get("target_value") or kpi.target_value
    module_name = getattr(kpi.module, "name", "this module")

    if status_value == "on_target":
        return {
            "risk_level": "low",
            "priority": "low",
            "confidence": 0.85,
            "insight": f"The KPI '{kpi.name}' is meeting its target for {module_name}.",
            "probable_cause": "Current process performance appears stable.",
            "suggested_decision": (
                f"Maintain current controls for {module_name}, keep the same ownership model, "
                "and track the KPI trend monthly."
            ),
            "reasoning": f"Actual value is {actual_value}, compared with target {target_value}.",
        }

    if status_value == "unknown":
        return {
            "risk_level": "medium",
            "priority": "medium",
            "confidence": 0.60,
            "insight": f"The KPI '{kpi.name}' could not be clearly evaluated for {module_name}.",
            "probable_cause": (
                "The KPI may have missing data, an invalid target, incomplete extraction, "
                "or a configuration issue."
            ),
            "suggested_decision": (
                f"Verify the KPI configuration for '{kpi.name}', check the reporting date field, "
                "and confirm that the extracted data contains the expected values."
            ),
            "reasoning": "The KPI engine returned an unknown status.",
        }

    return {
        "risk_level": "high",
        "priority": "high",
        "confidence": 0.75,
        "insight": f"The KPI '{kpi.name}' is not meeting its target for {module_name}.",
        "probable_cause": get_dynamic_cause(kpi),
        "suggested_decision": get_dynamic_action(kpi),
        "reasoning": f"Actual value is {actual_value}, compared with target {target_value}.",
    }


def parse_date_value(value):
    if not value:
        return None

    if hasattr(value, "date"):
        return value.date()

    value = str(value)[:10]

    for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"]:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            pass

    return None


def get_result_value(result):
    if not result:
        return None

    if result.get("type") == "grouped":
        return sum(item.get("value", 0) for item in result.get("data", []))

    return result.get("value")


def get_month_bounds(date_value):
    current_month_start = date_value.replace(day=1)

    if current_month_start.month == 12:
        next_month_start = current_month_start.replace(
            year=current_month_start.year + 1,
            month=1,
        )
    else:
        next_month_start = current_month_start.replace(
            month=current_month_start.month + 1,
        )

    if current_month_start.month == 1:
        previous_month_start = current_month_start.replace(
            year=current_month_start.year - 1,
            month=12,
        )
    else:
        previous_month_start = current_month_start.replace(
            month=current_month_start.month - 1,
        )

    return previous_month_start, current_month_start, next_month_start


def build_kpi_trend_context(kpi):
    if not kpi.reporting_date_field:
        return "No reporting date field configured."

    date_field = kpi.reporting_date_field.field_name

    try:
        dim_module = ITSMModule.objects.get(name=kpi.module.name)
    except ITSMModule.DoesNotExist:
        return "Module dimension not found."

    records = CleanedITSMRecord.objects.filter(module_id=dim_module.id)

    dates = []

    for record in records:
        date_value = parse_date_value(record.dynamic_data.get(date_field))
        if date_value:
            dates.append(date_value)

    if not dates:
        return "No historical dates found for this KPI."

    latest_date = max(dates)

    previous_month_start, current_month_start, next_month_start = get_month_bounds(latest_date)

    previous_result = compute_kpi(
        kpi.id,
        dashboard_filters=[
            {"field": date_field, "operator": ">=", "value": str(previous_month_start), "logic": "AND"},
            {"field": date_field, "operator": "<", "value": str(current_month_start), "logic": "AND"},
        ],
        save_result=False,
    )

    current_result = compute_kpi(
        kpi.id,
        dashboard_filters=[
            {"field": date_field, "operator": ">=", "value": str(current_month_start), "logic": "AND"},
            {"field": date_field, "operator": "<", "value": str(next_month_start), "logic": "AND"},
        ],
        save_result=False,
    )

    previous_value = get_result_value(previous_result) or 0
    current_value = get_result_value(current_result) or 0

    if previous_value == 0:
        change_percent = None
        trend = "new or no previous-month baseline"
    else:
        change_percent = round(((current_value - previous_value) / previous_value) * 100, 2)

        if change_percent > 10:
            trend = "increasing"
        elif change_percent < -10:
            trend = "decreasing"
        else:
            trend = "stable"

    return {
        "date_field": date_field,
        "previous_month": str(previous_month_start),
        "current_month": str(current_month_start),
        "previous_value": previous_value,
        "current_value": current_value,
        "change_percent": change_percent,
        "trend": trend,
    }


def make_actionable_decision(kpi, ai_output):
    decision = ai_output.get("suggested_decision", "") or ""
    decision_lower = decision.lower()

    generic_phrases = [
        "corrective actions",
        "review the kpi breakdown",
        "monitor progress",
        "investigate the issue",
        "identify responsible teams",
        "specific improvement action",
        "review the kpi weekly",
    ]

    is_generic = any(phrase in decision_lower for phrase in generic_phrases)

    if not is_generic:
        return decision

    return get_dynamic_action(kpi)


class AnalyzeAIRecommendationsView(APIView):
    permission_classes = [IsAuthenticated, HasAppPermission]
    required_permission = "view_ai_recommendations"

    def post(self, request):
        task = generate_ai_recommendations_task.delay()

        return Response(
            {
                "message": "AI recommendation generation started in background.",
                "task_id": task.id,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class AIRecommendationListView(APIView):
    permission_classes = [IsAuthenticated, HasAppPermission]
    required_permission = "view_ai_recommendations"

    def get(self, request):
        recommendations = AIRecommendation.objects.select_related(
            "kpi",
            "module",
            "reviewed_by",
        ).order_by("-created_at")

        serializer = AIRecommendationSerializer(recommendations, many=True)
        return Response(serializer.data)


class ReviewAIRecommendationView(APIView):
    permission_classes = [IsAuthenticated, HasAppPermission]
    required_permission = "review_ai_recommendations"

    def patch(self, request, pk):
        try:
            recommendation = AIRecommendation.objects.get(pk=pk)
        except AIRecommendation.DoesNotExist:
            return Response(
                {"error": "Recommendation not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        new_status = request.data.get("status")
        user_comment = request.data.get("user_comment", "")

        if new_status not in ["accepted", "rejected"]:
            return Response(
                {"error": "Status must be accepted or rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        recommendation.status = new_status
        recommendation.user_comment = user_comment
        recommendation.reviewed_by = request.user
        recommendation.reviewed_at = timezone.now()
        recommendation.save()

        serializer = AIRecommendationSerializer(recommendation)
        return Response(serializer.data)