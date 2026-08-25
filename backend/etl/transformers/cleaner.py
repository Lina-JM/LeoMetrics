import pandas as pd
import numpy as np
from datetime import datetime

from analytics.models.etl_conflict_log import ETLConflictLog


def normalize_null(value):
    if pd.isna(value):
        return None

    raw = str(value).strip().lower()

    if raw in ["", "null", "none", "nan", "nat"]:
        return None

    return value


def clean_severity(value):
    if value is None:
        return None

    mapping = {
        "1": "Critical",
        "2": "High",
        "3": "Moderate",
        "4": "Low",
        "5": "Very Low",
    }

    value = str(value).strip()

    if "-" in value:
        code, label = value.split("-", 1)

        if label.strip():
            return label.strip().capitalize()

        return mapping.get(code.strip(), code.strip())

    return mapping.get(value, value.capitalize())


def parse_date(value):
    if value is None:
        return None

    if isinstance(value, (datetime, pd.Timestamp)):
        return value.date()

    value = str(value).strip()

    parsed = pd.to_datetime(value, errors="coerce", dayfirst=False)

    if pd.isna(parsed):
        return None

    return parsed.date()


def is_date_field(field_name):
    return any(
        keyword in field_name.lower()
        for keyword in [
            "date",
            "time",
            "created",
            "opened",
            "resolved",
            "closed",
            "updated",
        ]
    )


def remove_redundant_columns(df):
    df = df.copy()

    for col in list(df.columns):
        if "." in col:
            base = col.split(".")[0]

            if base in df.columns and df[col].equals(df[base]):
                df = df.drop(columns=[col])

    return df


def find_best_sort_date_field(df):
    date_fields = [col for col in df.columns if is_date_field(col)]

    preferred_keywords = [
        "updated",
        "resolved",
        "closed",
        "opened",
        "created",
        "date",
        "time",
    ]

    for keyword in preferred_keywords:
        for field in date_fields:
            if keyword in field.lower():
                return field

    return date_fields[0] if date_fields else None

def remove_duplicate_rows(df):
    before = len(df)

    df = df.drop_duplicates()

    after = len(df)

    print(f"Removed {before - after} duplicate rows")

    return df
def resolve_conflicts(df, module):
    if "number" not in df.columns:
        return df

    resolved_rows = []
    sort_date_field = find_best_sort_date_field(df)

    for number, group in df.groupby("number", dropna=False):
        if len(group) == 1:
            resolved_rows.append(group.iloc[0])
            continue

        original_group = group.copy()

        if sort_date_field and sort_date_field in group.columns:
            group = group.sort_values(
                by=sort_date_field,
                ascending=False,
                na_position="last",
            )

        merged = group.iloc[0].copy()

        for col in group.columns:
            non_null_values = group[col].dropna()

            if not non_null_values.empty:
                merged[col] = non_null_values.iloc[0]
            else:
                merged[col] = None

        if len(original_group.drop_duplicates()) > 1:
            details = f"""
Original rows:
{original_group.to_dict(orient="records")}

Sorted by:
{sort_date_field}

Final row:
{merged.to_dict()}
"""

            ETLConflictLog.objects.get_or_create(
                module=module,
                record_id=str(number),
                defaults={"details": details},
            )

        resolved_rows.append(merged)

    return pd.DataFrame(resolved_rows).reset_index(drop=True)


def clean_dataframe(df, module):
    df = df.copy()

    for col in df.columns:
        df[col] = df[col].apply(normalize_null)

    df = df.replace({np.nan: None})

    for field in ["priority", "urgency", "impact"]:
        if field in df.columns:
            df[field] = df[field].apply(clean_severity)

    for col in df.columns:
        if is_date_field(col):
            df[col] = df[col].apply(parse_date)

    df = remove_redundant_columns(df)

    # Remove exact duplicate rows
    df = remove_duplicate_rows(df)

    # Merge records having the same ticket number
    df = resolve_conflicts(df, module)

    df = df.astype(object).where(pd.notna(df), None)

    return df