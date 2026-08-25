from datetime import date

from django.db import connection

from analytics.models.kpi_definition import KPIDefinition
from analytics.models.fact_kpi_result import KPIResult
from analytics.models.dim_date import DateDimension
from analytics.models.dim_kpi import KPI as DimKPI
from analytics.models.dim_itsm import ITSMModule as DimModule
from analytics.services.query_builder import build_query


def evaluate_target(actual, operator, target):
    if actual is None or operator is None or target is None:
        return "unknown"

    try:
        actual = float(actual)
        target = float(target)
    except Exception:
        return "unknown"

    if operator == "=":
        return "on_target" if actual == target else "off_target"
    if operator == ">=":
        return "on_target" if actual >= target else "off_target"
    if operator == "<=":
        return "on_target" if actual <= target else "off_target"
    if operator == ">":
        return "on_target" if actual > target else "off_target"
    if operator == "<":
        return "on_target" if actual < target else "off_target"

    return "unknown"


def sync_dim_module(module_config):
    dim_module, _ = DimModule.objects.update_or_create(
        name=module_config.name,
        defaults={
            "code": module_config.name.upper().replace(" ", "_"),
            "description": module_config.description or "",
            "is_active": module_config.is_active,
        },
    )
    return dim_module


def sync_dim_kpi(kpi_definition):
    dim_kpi, _ = DimKPI.objects.update_or_create(
        kpi_definition=kpi_definition,
        defaults={
            "name": kpi_definition.name,
            "description": kpi_definition.description or "",
            "is_active": kpi_definition.is_active,
        },
    )
    return dim_kpi


def get_or_create_date_dim(result_date):
    date_dim, _ = DateDimension.objects.get_or_create(
        date=result_date,
        defaults={
            "day": result_date.day,
            "month": result_date.month,
            "month_name": result_date.strftime("%B"),
            "quarter": (result_date.month - 1) // 3 + 1,
            "year": result_date.year,
            "week_of_year": result_date.isocalendar().week,
            "weekday": result_date.strftime("%A"),
            "is_weekend": result_date.weekday() >= 5,
            "is_business_day": result_date.weekday() < 5,
        },
    )

    return date_dim


def save_kpi_result(
    kpi,
    actual_value,
    result_status,
    grouped_data=None,
    result_date=None,
):
    result_date = result_date or date.today()

    date_dim = get_or_create_date_dim(result_date)
    dim_module = sync_dim_module(kpi.module)
    dim_kpi = sync_dim_kpi(kpi)

    saved_result, _ = KPIResult.objects.update_or_create(
        kpi=dim_kpi,
        module=dim_module,
        date_dim=date_dim,
        defaults={
            "actual_value": actual_value,
            "target_value": kpi.target_value,
            "result_status": result_status,
            "grouped_data": grouped_data or [],
        },
    )

    return saved_result


def compute_scalar_value(kpi, dashboard_filters=None):
    scalar_query, scalar_params = build_query(
        kpi,
        force_scalar=True,
        dashboard_filters=dashboard_filters or [],
    )

    print("SCALAR QUERY:", scalar_query)
    print("SCALAR PARAMS:", scalar_params)

    with connection.cursor() as cursor:
        cursor.execute(scalar_query, scalar_params)
        row = cursor.fetchone()

    return float(row[0]) if row and row[0] is not None else 0.0


def compute_kpi(
    kpi_definition_id,
    dashboard_filters=None,
    save_result=True,
    result_date=None,
):
    dashboard_filters = dashboard_filters or []

    kpi = KPIDefinition.objects.select_related(
        "module",
        "field",
        "group_by",
        "reporting_date_field",
        "created_by",
        "updated_by",
    ).get(id=kpi_definition_id)

    if kpi.aggregation == "percentage":
        numerator = compute_scalar_value(
            kpi,
            dashboard_filters=dashboard_filters,
        )

        denominator_query, denominator_params = build_query(
            kpi,
            force_scalar=True,
            dashboard_filters=dashboard_filters,
            ignore_kpi_filters=True,
        )

        with connection.cursor() as cursor:
            cursor.execute(denominator_query, denominator_params)
            row = cursor.fetchone()

        denominator = float(row[0]) if row and row[0] is not None else 0.0
        actual_value = numerator / denominator if denominator > 0 else 0.0

        result_status = evaluate_target(
            actual=actual_value,
            operator=kpi.target_operator,
            target=kpi.target_value,
        )

        saved_result = None

        if save_result:
            saved_result = save_kpi_result(
                kpi=kpi,
                actual_value=actual_value,
                result_status=result_status,
                grouped_data=[],
                result_date=result_date,
            )

        return {
            "type": "scalar",
            "kpi_id": kpi.id,
            "kpi_name": kpi.name,
            "module_name": kpi.module.name,
            "value": actual_value,
            "target_operator": kpi.target_operator,
            "target_value": kpi.target_value,
            "status": result_status,
            "saved_result_id": saved_result.id if saved_result else None,
        }
    
    query, params = build_query(
        kpi,
        dashboard_filters=dashboard_filters,
    )

    print("========== KPI DEBUG ==========")
    print("KPI:", kpi.name)
    print("MODULE:", kpi.module.name)
    print("AGGREGATION:", kpi.aggregation)
    print("FIELD:", kpi.field.field_name if kpi.field else None)
    print("GROUP BY:", kpi.group_by.field_name if kpi.group_by else None)
    print("FILTERS:", kpi.filters)
    print(
        "REPORTING DATE FIELD:",
        kpi.reporting_date_field.field_name if kpi.reporting_date_field else None,
    )
    print("DASHBOARD FILTERS:", dashboard_filters)
    print("RESULT DATE:", result_date)
    print("QUERY:", query)
    print("PARAMS:", params)
    print("================================")

    with connection.cursor() as cursor:
        cursor.execute(query, params)

        if kpi.group_by:
            rows = cursor.fetchall()

            grouped_data = [
                {
                    "label": str(row[0]) if row[0] is not None else "Unknown",
                    "value": float(row[1]) if row[1] is not None else 0,
                }
                for row in rows
            ]

            actual_value = compute_scalar_value(
                kpi,
                dashboard_filters=dashboard_filters,
            )

            result_status = evaluate_target(
                actual=actual_value,
                operator=kpi.target_operator,
                target=kpi.target_value,
            )

            saved_result = None

            if save_result:
                saved_result = save_kpi_result(
                    kpi=kpi,
                    actual_value=actual_value,
                    result_status=result_status,
                    grouped_data=grouped_data,
                    result_date=result_date,
                )

            return {
                "type": "grouped",
                "kpi_id": kpi.id,
                "kpi_name": kpi.name,
                "module_name": kpi.module.name,
                "value": actual_value,
                "data": grouped_data,
                "target_operator": kpi.target_operator,
                "target_value": kpi.target_value,
                "status": result_status,
                "saved_result_id": saved_result.id if saved_result else None,
            }

        row = cursor.fetchone()
        actual_value = float(row[0]) if row and row[0] is not None else 0.0

    result_status = evaluate_target(
        actual=actual_value,
        operator=kpi.target_operator,
        target=kpi.target_value,
    )

    saved_result = None

    if save_result:
        saved_result = save_kpi_result(
            kpi=kpi,
            actual_value=actual_value,
            result_status=result_status,
            grouped_data=[],
            result_date=result_date,
        )

    return {
        "type": "scalar",
        "kpi_id": kpi.id,
        "kpi_name": kpi.name,
        "module_name": kpi.module.name,
        "value": actual_value,
        "target_operator": kpi.target_operator,
        "target_value": kpi.target_value,
        "status": result_status,
        "saved_result_id": saved_result.id if saved_result else None,
    }


def compute_kpi_for_month(kpi, year, month):
    if not kpi.reporting_date_field:
        raise ValueError("KPI has no reporting date field.")

    start_date = date(year, month, 1)

    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)

    dashboard_filters = [
        {
            "field": kpi.reporting_date_field.field_name,
            "operator": ">=",
            "value": start_date.isoformat(),
            "logic": "AND",
        },
        {
            "field": kpi.reporting_date_field.field_name,
            "operator": "<",
            "value": end_date.isoformat(),
            "logic": "AND",
        },
    ]

    return compute_kpi(
        kpi.id,
        dashboard_filters=dashboard_filters,
        save_result=True,
        result_date=start_date,
    )

def compute_kpi_for_existing_months(kpi):
    if not kpi.reporting_date_field:
        raise ValueError("KPI has no reporting date field.")

    field_name = kpi.reporting_date_field.field_name
    dim_module = sync_dim_module(kpi.module)
    query = """
        SELECT DISTINCT
            DATE_TRUNC('month', (dynamic_data->>%s)::date)::date AS month_start
        FROM cleaned_records
        WHERE module_id = %s
          AND dynamic_data->>%s IS NOT NULL
          AND dynamic_data->>%s != ''
        ORDER BY month_start
    """

    params = [
        field_name,
        dim_module.id,
        field_name,
        field_name,
    ]

    with connection.cursor() as cursor:
        cursor.execute(query, params)
        months = cursor.fetchall()

    results = []

    for row in months:
        month_start = row[0]

        result = compute_kpi_for_month(
            kpi=kpi,
            year=month_start.year,
            month=month_start.month,
        )

        results.append(result)

    return results