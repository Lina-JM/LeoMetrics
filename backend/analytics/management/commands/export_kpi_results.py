import pandas as pd

from django.core.management.base import BaseCommand

from analytics.models.fact_kpi_result import KPIResult


class Command(BaseCommand):
    help = "Export KPIResult history for forecasting experiments"

    def handle(self, *args, **options):

        results = (
            KPIResult.objects
            .select_related("kpi", "module", "date_dim")
            .order_by("kpi__name", "module__name", "date_dim__date")
        )

        rows = []
        grouped_rows = []

        for result in results:
            if not result.date_dim:
                continue

            # Normal KPI row
            rows.append({
                "kpi_id": result.kpi.id,
                "kpi_name": result.kpi.name,
                "module_id": result.module.id if result.module else None,
                "module_name": result.module.name if result.module else None,
                "date": result.date_dim.date,
                "year": result.date_dim.year,
                "month": result.date_dim.month,
                "actual_value": result.actual_value,
                "target_value": result.target_value,
                "result_status": result.result_status,
                "calculated_at": result.calculated_at,
            })

            # Grouped KPI rows
            grouped_data = result.grouped_data or []

            if isinstance(grouped_data, list):
                for item in grouped_data:
                    grouped_rows.append({
                        "kpi_id": result.kpi.id,
                        "kpi_name": result.kpi.name,
                        "module_id": result.module.id if result.module else None,
                        "module_name": result.module.name if result.module else None,
                        "date": result.date_dim.date,
                        "year": result.date_dim.year,
                        "month": result.date_dim.month,
                        "group_name": "group",
                        "group_value": (
                            item.get("label")
                            or item.get("group")
                            or item.get("name")
                        ),
                        "actual_value": item.get("value"),
                        "target_value": result.target_value,
                        "result_status": result.result_status,
                        "calculated_at": result.calculated_at,
                    })

        df = pd.DataFrame(rows)
        df.to_csv("kpi_results_forecasting.csv", index=False)

        grouped_df = pd.DataFrame(grouped_rows)
        grouped_df.to_csv(
            "grouped_kpi_results_forecasting.csv",
            index=False
        )

        self.stdout.write(
            self.style.SUCCESS(
                "KPI forecasting files exported successfully"
            )
        )