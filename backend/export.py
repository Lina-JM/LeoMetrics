import pandas as pd
from analytics.models.fact_kpi_result import KPIResult

qs = KPIResult.objects.select_related("kpi", "module", "date_dim").filter(
    date_dim__isnull=False,
    actual_value__isnull=False
).order_by("kpi_id", "module_id", "date_dim__date")

rows = []

for r in qs:
    rows.append({
        "forecast_type": "global",
        "kpi_id": r.kpi_id,
        "kpi_name": r.kpi.name,
        "module_id": r.module_id,
        "module_name": r.module.name,
        "date": r.date_dim.date,
        "year": r.date_dim.year,
        "quarter": r.date_dim.quarter,
        "month": r.date_dim.month,
        "month_name": r.date_dim.month_name,
        "week_of_year": r.date_dim.week_of_year,
        "actual_value": float(r.actual_value),
        "target_value": r.target_value,
        "result_status": r.result_status,
        "group_by_field": "",
        "group_by_value": "",
    })

    for item in r.grouped_data or []:
        group_value = item.get("group") or item.get("label") or item.get("name") or item.get("group_value")
        value = item.get("value") or item.get("actual_value") or item.get("count") or item.get("total")

        if group_value is None or value is None:
            continue

        rows.append({
            "forecast_type": "grouped",
            "kpi_id": r.kpi_id,
            "kpi_name": r.kpi.name,
            "module_id": r.module_id,
            "module_name": r.module.name,
            "date": r.date_dim.date,
            "year": r.date_dim.year,
            "quarter": r.date_dim.quarter,
            "month": r.date_dim.month,
            "month_name": r.date_dim.month_name,
            "week_of_year": r.date_dim.week_of_year,
            "actual_value": float(value),
            "target_value": r.target_value,
            "result_status": r.result_status,
            "group_by_field": str(getattr(r.kpi, "group_by", "")),
            "group_by_value": str(group_value),
        })

df = pd.DataFrame(rows)
df.to_csv("forecasting_dataset.csv", index=False)

print("KPIResult matched:", qs.count())
print("Rows exported:", len(df))
print("File created: forecasting_dataset.csv")