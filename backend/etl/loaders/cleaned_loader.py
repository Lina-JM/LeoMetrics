import pandas as pd

from analytics.models import CleanedITSMRecord
from analytics.models.dim_itsm import ITSMModule as DimModule


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


def load_records(df, module_config):
    dim_module = get_or_create_dim_module(module_config)

    created_count = 0
    updated_count = 0

    for index, row in df.iterrows():
        cleaned_dict = {
            key: (None if pd.isna(value) else value)
            for key, value in row.items()
        }

        # 🔑 Use stable unique ID (ServiceNow "number" is best)
        record_id = (
            row.get("number")
            or row.get("id")
            or row.get("record_id")
            or f"{module_config.name}_{index + 1}"
        )

        obj, created = CleanedITSMRecord.objects.update_or_create(
            module=dim_module,
            record_id=str(record_id),
            defaults={
                "dynamic_data": cleaned_dict,
            },
        )

        if created:
            created_count += 1
        else:
            updated_count += 1

    print(f"Created: {created_count}, Updated: {updated_count}")

    return {
        "module": dim_module.name,
        "created": created_count,
        "updated": updated_count,
    }

class Meta:
    db_table = "cleaned_records"
    unique_together = ("module", "record_id")