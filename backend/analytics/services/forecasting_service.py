import numpy as np
from dateutil.relativedelta import relativedelta
from sklearn.ensemble import RandomForestRegressor

from analytics.models.fact_kpi_result import KPIResult
from analytics.models.kpi_forecast import KPIForecast
from analytics.models.dim_date import DateDimension



def get_or_create_date_dim(date):
    date_dim, _ = DateDimension.objects.get_or_create(
        date=date,
        defaults={
            "year": date.year,
            "quarter": (date.month - 1) // 3 + 1,
            "month": date.month,
            "month_name": date.strftime("%B"),
            "week_of_year": date.isocalendar()[1],
            "day": date.day,
            "weekday": date.weekday(),
            "is_weekend": date.weekday() >= 5,
            "is_business_day": date.weekday() < 5,
        },
    )
    return date_dim


def random_forest_values_forecast(history, periods=3):
    if len(history) == 0:
        return []

    dates = [item["date"] for item in history]
    values = [float(item["value"]) for item in history]

    last_date = dates[-1]
    last_value = values[-1]

    # fallback when data is too small
    if len(history) < 3:
        return [
            {
                "date": last_date + relativedelta(months=i),
                "month": (last_date + relativedelta(months=i)).strftime("%Y-%m"),
                "value": round(max(float(last_value), 0), 2),
            }
            for i in range(1, periods + 1)
        ]


    X = np.array([
        [
            d.year,
            d.month,
            (d.month - 1) // 3 + 1,
        ]
        for d in dates
    ])

    y = np.array(values, dtype=float)

    model = RandomForestRegressor(
        n_estimators=100,
        random_state=42
    )

    model.fit(X, y)

    forecast = []

    for i in range(1, periods + 1):
        forecast_date = last_date + relativedelta(months=i)

        X_future = np.array([[
            forecast_date.year,
            forecast_date.month,
            (forecast_date.month - 1) // 3 + 1,
        ]])

        value = model.predict(X_future)[0]

        forecast.append({
            "date": forecast_date,
            "month": forecast_date.strftime("%Y-%m"),
            "value": round(max(float(value), 0), 2),
        })

    return forecast


def extract_grouped_items(grouped_results):
    if not grouped_results:
        return []

    if isinstance(grouped_results, list):
        return grouped_results

    if isinstance(grouped_results, dict):
        return [
            {"group": key, "value": value}
            for key, value in grouped_results.items()
        ]

    return []


def get_group_label(item):
    return (
        item.get("group")
        or item.get("label")
        or item.get("name")
        or item.get("group_value")
    )


def get_group_value(item):
    value = (
        item.get("value")
        or item.get("actual_value")
        or item.get("count")
        or item.get("total")
    )

    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def clean_actual_points(results):
    return [
        {
            "month": r.date_dim.date.strftime("%Y-%m"),
            "value": round(float(r.actual_value), 2),
        }
        for r in results
    ]


def calculate_confidence_score(last_actual_value, forecast_value):
    if last_actual_value == 0:
        return None

    variance_percent = abs(
        (forecast_value - last_actual_value) / last_actual_value * 100
    )

    return max(
        0,
        min(100, 100 - variance_percent)
    )


def generate_and_save_forecast(kpi, periods=3, months=12):
    results = list(
        KPIResult.objects
        .filter(
            kpi=kpi,
            date_dim__isnull=False,
            actual_value__isnull=False,
        )
        .select_related("date_dim", "module")
        .order_by("date_dim__date")
    )[-months:]

    actual_points = clean_actual_points(results)

    if len(results) == 0:
        return {
            "actual": [],
            "forecast": [],
            "groups": [],
        }

    module = results[-1].module

    KPIForecast.objects.filter(
        kpi=kpi,
        module=module,
    ).delete()

    # Global forecast
    global_history = [
        {
            "date": r.date_dim.date,
            "value": float(r.actual_value),
        }
        for r in results
    ]

    global_values = [item["value"] for item in global_history]

    global_forecast = random_forest_values_forecast(
        global_history,
        periods=periods,
    )

    for item in global_forecast:
        date_dim = get_or_create_date_dim(item["date"])

        last_actual_value = global_values[-1]
        forecast_value = item["value"]
        variance = forecast_value - last_actual_value

        confidence_score = calculate_confidence_score(
            last_actual_value,
            forecast_value,
        )

        KPIForecast.objects.update_or_create(
            kpi=kpi,
            module=module,
            date_dim=date_dim,
            group_by_field=None,
            group_by_value=None,
            defaults={
                "forecast_value": forecast_value,
                "actual_value": last_actual_value,
                "variance": variance,
                "confidence_score": confidence_score,
            },
        )

    # Grouped forecast
    grouped_forecasts = []

    kpi_definition = getattr(kpi, "kpi_definition", None)
    group_by_field = getattr(kpi_definition, "group_by", None)

    if group_by_field:
        grouped_history = {}

        for result in results:
            grouped_results = getattr(result, "grouped_data", None)
            grouped_items = extract_grouped_items(grouped_results)

            for item in grouped_items:
                label = get_group_label(item)
                value = get_group_value(item)

                if label is None or value is None:
                    continue

                grouped_history.setdefault(str(label), []).append({
                    "date": result.date_dim.date,
                    "month": result.date_dim.date.strftime("%Y-%m"),
                    "value": value,
                })

        for label, history in grouped_history.items():
            if len(history) == 0:
                continue

            values = [h["value"] for h in history]

            forecast = random_forest_values_forecast(
                history,
                periods=periods,
            )

            for item in forecast:
                date_dim = get_or_create_date_dim(item["date"])

                last_actual_value = values[-1]
                forecast_value = item["value"]
                variance = forecast_value - last_actual_value

                confidence_score = calculate_confidence_score(
                    last_actual_value,
                    forecast_value,
                )

                KPIForecast.objects.update_or_create(
                    kpi=kpi,
                    module=module,
                    date_dim=date_dim,
                    group_by_field=group_by_field.field_name,
                    group_by_value=str(label),
                    defaults={
                        "forecast_value": forecast_value,
                        "actual_value": last_actual_value,
                        "variance": variance,
                        "confidence_score": confidence_score,
                    },
                )

            grouped_forecasts.append({
                "group_by_field": str(group_by_field.field_name),
                "group_by_value": str(label),
                "actual": [
                    {
                        "month": h["month"],
                        "value": round(float(h["value"]), 2),
                    }
                    for h in history
                ],
                "forecast": [
                    {
                        "month": item["month"],
                        "value": item["value"],
                    }
                    for item in forecast
                ],
            })

    return {
        "actual": actual_points,
        "forecast": [
            {
                "month": item["month"],
                "value": item["value"],
            }
            for item in global_forecast
        ],
        "groups": grouped_forecasts,
    }


def read_saved_forecast(kpi):
    results = list(
        KPIResult.objects
        .filter(
            kpi=kpi,
            date_dim__isnull=False,
            actual_value__isnull=False,
        )
        .select_related("date_dim", "module")
        .order_by("date_dim__date")
    )[-12:]

    actual_points = clean_actual_points(results)

    if not results:
        return {
            "actual": [],
            "forecast": [],
            "groups": [],
        }

    module = results[-1].module
    grouped_actual_map = {}

    for result in results:
        grouped_items = extract_grouped_items(result.grouped_data or [])

        for item in grouped_items:
            label = get_group_label(item)
            value = get_group_value(item)

            if label is None or value is None:
                continue

            key = (str(result.kpi.group_by) if hasattr(result.kpi, "group_by") else "group", str(label))

            grouped_actual_map.setdefault(key, []).append({
                "month": result.date_dim.date.strftime("%Y-%m"),
                "value": round(float(value), 2),
            })
    forecasts = (
        KPIForecast.objects
        .filter(
            kpi=kpi,
            module=module,
            group_by_field__isnull=True,
            group_by_value__isnull=True,
        )
        .select_related("date_dim")
        .order_by("date_dim__date")
    )

    grouped_forecasts = []

    group_rows = (
        KPIForecast.objects
        .filter(
            kpi=kpi,
            module=module,
        )
        .exclude(group_by_field__isnull=True, group_by_value__isnull=True)
        .select_related("date_dim")
        .order_by("group_by_value", "date_dim__date")
    )

    grouped_map = {}

    for row in group_rows:
        key = (row.group_by_field, row.group_by_value)

        grouped_map.setdefault(key, []).append({
            "month": row.date_dim.date.strftime("%Y-%m"),
            "value": round(float(row.forecast_value), 2),
        })

    for (field, value), forecast_items in grouped_map.items():
        grouped_forecasts.append({
            "group_by_field": field,
            "group_by_value": value,
            "actual": [],
            "forecast": forecast_items,
        })

    return {
        "actual": actual_points,
        "forecast": [
            {
                "month": row.date_dim.date.strftime("%Y-%m"),
                "value": round(float(row.forecast_value), 2),
            }
            for row in forecasts
        ],
        "groups": grouped_forecasts,
    }