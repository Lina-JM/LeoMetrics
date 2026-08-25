from datetime import datetime, date
import json
import pandas as pd

from analytics.models import ModuleField
from analytics.models.itsm_module_config import ITSMModuleConfig
from analytics.models.dim_itsm import ITSMModule as DimModule
from analytics.models.module_extracted_file import ModuleExtractedFile
from analytics.models.kpi_definition import KPIDefinition

from etl.extractors.extractor_factory import get_extractor
from etl.transformers.mapper import apply_mapping
from etl.transformers.cleaner import clean_dataframe
from etl.loaders.cleaned_loader import load_records
from etl.utils.module_fields import populate_module_fields

from analytics.services.kpi_engine import compute_kpi_for_existing_months


def get_or_create_dim_module(module_config):
    dim_module, _ = DimModule.objects.update_or_create(
        name=module_config.name,
        defaults={
            "code": module_config.name.upper().replace(" ", "_"),
            "description": module_config.description or "",
            "uploaded_file": module_config.uploaded_file,
            "is_active": module_config.is_active,
            "created_by": module_config.created_by,
            "updated_by": module_config.updated_by,
        },
    )
    return dim_module


def make_json_serializable(value):
    if pd.isna(value):
        return None

    if isinstance(value, pd.Timestamp):
        return value.isoformat()

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    try:
        json.dumps(value)
        return value
    except TypeError:
        return str(value)


def detect_source_type(file_path):
    file_path = file_path.lower()

    if file_path.endswith(".csv"):
        return "csv"

    if file_path.endswith(".xlsx") or file_path.endswith(".xls"):
        return "excel"

    raise ValueError("Unsupported extracted file type. Use CSV or Excel.")


def get_latest_extracted_file(module_config):
    return (
        ModuleExtractedFile.objects
        .filter(module=module_config, is_latest=True)
        .order_by("-extracted_at")
        .first()
    )


def run_pipeline(module_id=None):
    if module_id:
        modules = ITSMModuleConfig.objects.filter(id=module_id, is_active=True)
    else:
        modules = ITSMModuleConfig.objects.filter(is_active=True)

    results = {
        "processed_modules": [],
        "skipped_modules": [],
        "failed_modules": [],
        "kpi_results": [],
    }

    print(f"Found {modules.count()} active module(s)")

    for module_config in modules:
        module_result = {
            "module_id": module_config.id,
            "module_name": module_config.name,
            "status": "pending",
            "extracted_rows": 0,
            "created_records": 0,
            "updated_records": 0,
            "message": "",
        }

        print("\n==============================")
        print(f"Processing module: {module_config.name}")
        print("==============================")

        try:
            dim_module = get_or_create_dim_module(module_config)

            latest_file = get_latest_extracted_file(module_config)

            if not latest_file:
                module_result["status"] = "skipped"
                module_result["message"] = "No extracted file found."
                results["skipped_modules"].append(module_result)
                print(f"No extracted file found for module: {module_config.name}")
                continue

            file_path = latest_file.file.path
            source_type = detect_source_type(file_path)
            extractor = get_extractor(source_type)

            if not extractor:
                module_result["status"] = "skipped"
                module_result["message"] = f"No extractor found for source type: {source_type}"
                results["skipped_modules"].append(module_result)
                continue

            df = extractor({"file_path": file_path})

            if df is None or df.empty:
                module_result["status"] = "skipped"
                module_result["message"] = "No data extracted."
                results["skipped_modules"].append(module_result)
                continue

            module_result["extracted_rows"] = len(df)
            print(f"Extracted {len(df)} rows from {latest_file.file.name}")

            df = apply_mapping(df, dim_module)
            print("Columns after mapping:", df.columns.tolist())

            df = clean_dataframe(df, dim_module)

            df = df.astype(object).where(pd.notna(df), None)
            df = df.apply(lambda col: col.map(make_json_serializable))

            populate_module_fields(module_config)

            load_result = load_records(df, module_config)

            module_result["created_records"] = load_result.get("created", 0)
            module_result["updated_records"] = load_result.get("updated", 0)
            module_result["status"] = "success"
            module_result["message"] = "Module processed successfully."

            results["processed_modules"].append(module_result)

            print(f"Loaded {len(df)} cleaned records for {module_config.name}")

        except Exception as e:
            module_result["status"] = "failed"
            module_result["message"] = str(e)
            results["failed_modules"].append(module_result)
            print(f"Transform/load failed for {module_config.name}: {e}")
            continue

    print("\nRunning KPIs...")
    results["kpi_results"] = run_all_kpis(module_id=module_id)

    try:
        from analytics.tasks import generate_all_forecasts_task

        generate_all_forecasts_task.delay()
        print("Forecast generation task started in background.")

    except Exception as e:
        print(f"Could not start forecast generation task: {e}")


    try:
        from analytics.tasks import generate_ai_recommendations_task

        generate_ai_recommendations_task.delay()
        print("AI recommendation task started in background.")

    except Exception as e:
        print(f"Could not start AI recommendation task: {e}")
        
    final_status = "success"

    if results["failed_modules"]:
        final_status = "partial_success"

    if not results["processed_modules"] and results["failed_modules"]:
        final_status = "failed"

    return {
        "status": final_status,
        "message": "ETL pipeline execution completed.",
        "summary": {
            "processed_count": len(results["processed_modules"]),
            "skipped_count": len(results["skipped_modules"]),
            "failed_count": len(results["failed_modules"]),
            "kpi_count": len(results["kpi_results"]),
        },
        "details": results,
    }


def run_all_kpis(module_id=None):
    if module_id:
        kpis = KPIDefinition.objects.filter(module_id=module_id, is_active=True)
    else:
        kpis = KPIDefinition.objects.filter(is_active=True)

    kpi_results = []

    print(f"Running {kpis.count()} KPI(s)")

    for kpi in kpis:
        result = {
            "kpi_id": kpi.id,
            "kpi_name": kpi.name,
            "status": "pending",
            "message": "",
        }

        try:
            print(f"Running KPI: {kpi.name}")
            compute_kpi_for_existing_months(kpi)

            result["status"] = "success"
            result["message"] = "KPI computed successfully."

        except Exception as e:
            result["status"] = "failed"
            result["message"] = str(e)

            print(f"Failed to run KPI {kpi.name}: {e}")

        kpi_results.append(result)

    return kpi_results