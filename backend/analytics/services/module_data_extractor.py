import os

from analytics.models.dim_itsm import ITSMModule
from analytics.models.cleaned_records import CleanedITSMRecord

from etl.extractors.extractor_factory import get_extractor
from etl.transformers.mapper import apply_mapping
from etl.transformers.cleaner import clean_dataframe, normalize_null


def get_source_type(file_path):
    file_path = file_path.lower()

    if file_path.endswith(".csv"):
        return "csv"

    if file_path.endswith(".xlsx") or file_path.endswith(".xls"):
        return "excel"

    raise ValueError("Unsupported file format. Use CSV or Excel.")


def get_uploaded_file_path(module_config):
    if not module_config.uploaded_file:
        raise ValueError(
            "This module has no uploaded file. Please upload a fallback extracted file."
        )

    file_path = module_config.uploaded_file.path

    if not file_path:
        raise ValueError("Uploaded file path is missing.")

    if not os.path.exists(file_path):
        raise ValueError(f"Uploaded file not found: {file_path}")

    return file_path


def extract_data_for_module(module_config):
    file_path = get_uploaded_file_path(module_config)

    source_type = get_source_type(file_path)
    extractor = get_extractor(source_type)

    if extractor is None:
        raise ValueError(f"No extractor found for source type: {source_type}")

    df = extractor({"file_path": file_path})

    df = apply_mapping(df, module_config)

    df = clean_dataframe(df, module_config)

    dim_module, _ = ITSMModule.objects.update_or_create(
        name=module_config.name,
        defaults={
            "code": module_config.name.upper().replace(" ", "_"),
            "description": module_config.description or "",
            "is_active": module_config.is_active,
        },
    )

    CleanedITSMRecord.objects.filter(module=dim_module).delete()

    created = 0

    for index, row in df.iterrows():
        dynamic_data = {}

        for col in df.columns:
            dynamic_data[col] = normalize_null(row[col])

        record_id = (
            dynamic_data.get("number")
            or dynamic_data.get("id")
            or dynamic_data.get("record_id")
            or f"{module_config.name}_{index + 1}"
        )

        CleanedITSMRecord.objects.create(
            module=dim_module,
            record_id=str(record_id),
            dynamic_data=dynamic_data,
        )

        created += 1

    return {
        "module_id": dim_module.id,
        "module_name": dim_module.name,
        "source_file": os.path.basename(file_path),
        "created_records": created,
    }