from analytics.models import CleanedITSMRecord
from analytics.models.dim_itsm import ITSMModule


def is_date_field(field_name):
    return any(
        keyword in field_name.lower()
        for keyword in ["date", "time","created", "opened", "resolved", "closed"]
    )


def numeric_json_expr():
    return """
        CASE
            WHEN NULLIF(dynamic_data->>%s, '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
            THEN (dynamic_data->>%s)::numeric
            ELSE NULL
        END
    """


def date_json_expr():
    return "(NULLIF(dynamic_data->>%s, '')::date)"


def build_filter_sql(filters):
    if not filters:
        return "", []

    sql_parts = []
    params = []
    valid_index = 0

    for filter_item in filters:
        field = filter_item.get("field")
        operator = filter_item.get("operator", "=")
        value = filter_item.get("value")
        logic = filter_item.get("logic", "AND").upper()

        if not field or value in [None, "", "all"]:
            continue

        if logic not in ["AND", "OR"]:
            logic = "AND"

        logic_sql = "" if valid_index == 0 else f" {logic} "

        if operator == "=":
            sql_parts.append(f"{logic_sql} dynamic_data->>%s = %s")
            params.extend([field, value])

        elif operator == "!=":
            sql_parts.append(f"{logic_sql} dynamic_data->>%s != %s")
            params.extend([field, value])

        elif operator == "contains":
            sql_parts.append(f"{logic_sql} dynamic_data->>%s ILIKE %s")
            params.extend([field, f"%{value}%"])

        elif operator == "starts_with":
            sql_parts.append(f"{logic_sql} dynamic_data->>%s ILIKE %s")
            params.extend([field, f"{value}%"])

        elif operator == "ends_with":
            sql_parts.append(f"{logic_sql} dynamic_data->>%s ILIKE %s")
            params.extend([field, f"%{value}"])

        elif operator in [">", "<", ">=", "<="]:
            if is_date_field(field):
                sql_parts.append(f"{logic_sql} {date_json_expr()} {operator} %s::date")
                params.extend([field, value])
            else:
                sql_parts.append(f"{logic_sql} {numeric_json_expr()} {operator} %s")
                params.extend([field, field, value])

        else:
            raise ValueError(f"Unsupported filter operator: {operator}")

        valid_index += 1

    if not sql_parts:
        return "", []

    return " AND (" + "".join(sql_parts) + ")", params


def get_kpi_filters(kpi):
    if hasattr(kpi, "filters") and kpi.filters:
        return kpi.filters

    return []


def build_query(kpi, force_scalar=False, dashboard_filters=None, ignore_kpi_filters=False):
    aggregation = kpi.aggregation
    field_name = kpi.field.field_name if kpi.field else None
    table_name = CleanedITSMRecord._meta.db_table

    dim_module = ITSMModule.objects.get(name=kpi.module.name)

    if aggregation == "count":
        select_part = "COUNT(*)"
        aggregation_params = []

    elif aggregation == "sum":
        select_part = f"SUM({numeric_json_expr()})"
        aggregation_params = [field_name, field_name]

    elif aggregation == "avg":
        select_part = f"AVG({numeric_json_expr()})"
        aggregation_params = [field_name, field_name]

    elif aggregation == "min":
        select_part = f"MIN({numeric_json_expr()})"
        aggregation_params = [field_name, field_name]

    elif aggregation == "max":
        select_part = f"MAX({numeric_json_expr()})"
        aggregation_params = [field_name, field_name]

    elif aggregation == "percentage":
        select_part = "COUNT(*)"
        aggregation_params = []
    else:
        raise ValueError(f"Unsupported aggregation: {aggregation}")

    saved_filters = [] if ignore_kpi_filters else get_kpi_filters(kpi)
    dashboard_filters = dashboard_filters or []

    combined_filters = saved_filters + dashboard_filters
    filter_sql, filter_params = build_filter_sql(combined_filters)

    if kpi.group_by and not force_scalar:
        group_field = kpi.group_by.field_name

        query = f"""
            SELECT
                COALESCE(NULLIF(dynamic_data->>%s, ''), 'Unknown') AS group_value,
                {select_part} AS result_value
            FROM {table_name}
            WHERE module_id = %s
        """

        params = [group_field]
        params.extend(aggregation_params)
        params.append(dim_module.id)

        query += filter_sql
        params.extend(filter_params)

        query += """
            GROUP BY COALESCE(NULLIF(dynamic_data->>%s, ''), 'Unknown')
            ORDER BY result_value DESC
        """

        params.append(group_field)

        if kpi.limit:
            query += " LIMIT %s"
            params.append(kpi.limit)

        return query, params

    query = f"""
        SELECT {select_part} AS result_value
        FROM {table_name}
        WHERE module_id = %s
    """

    params = []
    params.extend(aggregation_params)
    params.append(dim_module.id)

    query += filter_sql
    params.extend(filter_params)

    return query, params