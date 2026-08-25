from celery import shared_task


@shared_task
def generate_all_forecasts_task():
    print("Starting automatic forecast generation...")

    from analytics.models.fact_kpi_result import KPIResult
    from analytics.services.forecasting_service import generate_and_save_forecast

    kpi_ids = (
        KPIResult.objects
        .filter(kpi__isnull=False)
        .values_list("kpi_id", flat=True)
        .distinct()
    )

    print(f"Found {len(kpi_ids)} KPI(s) for forecasting")

    for kpi_id in kpi_ids:
        sample_result = KPIResult.objects.select_related("kpi").filter(kpi_id=kpi_id).first()

        if sample_result:
            print(f"Generating forecast for KPI: {sample_result.kpi.name}")
            generate_and_save_forecast(sample_result.kpi, periods=3, months=6)

    print("Forecast generation finished")
    return "Forecast generation completed"

@shared_task
def generate_ai_recommendations_task():
    from analytics.api.ai_support_views import (
        MAX_AI_CALLS,
        build_kpi_trend_context,
        generate_rule_based_recommendation,
        make_actionable_decision,
    )
    from analytics.models import AIRecommendation, KPIDefinition
    from analytics.models.dim_itsm import ITSMModule
    from analytics.services.decision_agent import generate_ai_recommendation

    active_kpis = KPIDefinition.objects.filter(is_active=True)

    created_count = 0
    errors = []
    ai_calls_used = 0

    for kpi in active_kpis:
        try:
            from analytics.models.fact_kpi_result import KPIResult

            latest_result = (
                KPIResult.objects
                .select_related("date_dim")
                .filter(kpi__kpi_definition=kpi)
                .order_by("-date_dim__date")
                .first()
            )

            if not latest_result:
                continue

            result = {
                "kpi_id": kpi.id,
                "kpi_name": kpi.name,
                "module_name": kpi.module.name,
                "value": latest_result.actual_value,
                "target_operator": kpi.target_operator,
                "target_value": latest_result.target_value,
                "status": latest_result.result_status,
                "date": latest_result.date_dim.date.isoformat() if latest_result.date_dim else None,
            }

            result_status = result.get("status")
            if result_status == "on_target":
                ai_output = generate_rule_based_recommendation(kpi, result)

            elif ai_calls_used < MAX_AI_CALLS:
                trend_context = build_kpi_trend_context(kpi)

                try:
                    ai_output = generate_ai_recommendation(kpi, result, trend_context)
                    ai_calls_used += 1
                except Exception as ai_error:
                    errors.append({
                        "kpi": kpi.name,
                        "step": "ai_generation",
                        "error": str(ai_error),
                    })
                    ai_output = generate_rule_based_recommendation(kpi, result)

            else:
                ai_output = generate_rule_based_recommendation(kpi, result)

            dim_module = ITSMModule.objects.get(name=kpi.module.name)

            AIRecommendation.objects.filter(
                kpi=kpi
            ).delete()

            ai_output["suggested_decision"] = make_actionable_decision(kpi, ai_output)

            AIRecommendation.objects.create(
                kpi=kpi,
                module=dim_module,
                kpi_result_snapshot=result,
                risk_level=ai_output.get("risk_level", "medium"),
                insight=ai_output.get("insight", "No insight generated."),
                probable_cause=ai_output.get("probable_cause", ""),
                suggested_decision=ai_output.get(
                    "suggested_decision",
                    "Review this KPI manually.",
                ),
                reasoning=ai_output.get("reasoning", ""),
                priority=ai_output.get("priority", "medium"),
                confidence=ai_output.get("confidence", 0.5),
                status="pending",
            )

            created_count += 1

        except Exception as e:
            errors.append({
                "kpi": getattr(kpi, "name", "Unknown KPI"),
                "step": "kpi_processing",
                "error": str(e),
            })

    return {
        "message": "AI recommendation generation completed.",
        "active_kpis": active_kpis.count(),
        "count": created_count,
        "ai_calls_used": ai_calls_used,
        "errors": errors,
    }

@shared_task
def run_pipeline_task(module_id=None):
    from etl.pipeline.run_pipeline import run_pipeline
    from analytics.tasks import generate_all_forecasts_task, generate_ai_recommendations_task

    print("Starting async ETL pipeline...")

    result = run_pipeline(module_id=module_id)

    generate_all_forecasts_task.delay()
    generate_ai_recommendations_task.delay()

    print("Async ETL pipeline completed.")

    return result    