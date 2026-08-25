import os
import pandas as pd

from analytics.models.itsm_module_config import ITSMModuleConfig
from analytics.models.module_fields import ModuleField

from etl.extractors.extractor_factory import get_extractor
from etl.transformers.mapper import apply_mapping


def infer_field_type(series):
    if pd.api.types.is_bool_dtype(series):
        return "boolean"

    if pd.api.types.is_numeric_dtype(series):
        return "number"

    if pd.api.types.is_datetime64_any_dtype(series):
        return "date"

    cleaned = (
        series.astype(str)
        .str.replace(",", "", regex=False)
        .str.strip()
        .replace({"": None, "nan": None, "None": None})
    )

    numeric_try = pd.to_numeric(cleaned, errors="coerce")
    non_null_count = series.dropna().shape[0]

    if non_null_count > 0 and numeric_try.notna().sum() >= max(
        1, int(non_null_count * 0.7)
    ):
        return "number"

    datetime_try = pd.to_datetime(cleaned, errors="coerce")
    if non_null_count > 0 and datetime_try.notna().sum() >= max(
        1, int(non_null_count * 0.7)
    ):
        return "date"

    return "string"


def get_source_type(file_path):
    file_path = file_path.lower()

    if file_path.endswith(".csv"):
        return "csv"

    if file_path.endswith(".xlsx") or file_path.endswith(".xls"):
        return "excel"

    raise ValueError("Unsupported file format. Use CSV or Excel.")


def get_uploaded_file_path(module: ITSMModuleConfig):
    if not module.uploaded_file:
        raise ValueError(
            "This module has no uploaded file. Please upload an extracted file first."
        )

    file_path = module.uploaded_file.path

    if not file_path:
        raise ValueError("Uploaded file path is missing.")

    if not os.path.exists(file_path):
        raise ValueError(f"Uploaded file not found: {file_path}")

    return file_path


def extract_fields_for_module(module: ITSMModuleConfig):
    file_path = get_uploaded_file_path(module)

    source_type = get_source_type(file_path)
    extractor = get_extractor(source_type)

    if extractor is None:
        raise ValueError(f"No extractor found for source type: {source_type}")

    df = extractor({"file_path": file_path})

    # Normalize / map columns so ModuleField.field_name matches dynamic_data keys
    df = apply_mapping(df, module)

    created_fields = []

    for col in df.columns:
        field_type = infer_field_type(df[col])

        field, created = ModuleField.objects.update_or_create(
            module=module,
            field_name=col,
            defaults={
                "field_type": field_type,
                "is_filterable": True,
                "is_measure": field_type == "number",
            },
        )

        created_fields.append(field)

    return created_fields