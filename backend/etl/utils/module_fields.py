from analytics.models import ModuleField, CleanedITSMRecord
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


def populate_module_fields(module_config):
    dim_module = get_or_create_dim_module(module_config)

    records = CleanedITSMRecord.objects.filter(module=dim_module)[:20]

    if not records.exists():
        return []

    detected_fields = {}

    for record in records:
        data = record.dynamic_data

        for field_name, value in data.items():
            if field_name not in detected_fields:
                if isinstance(value, bool):
                    field_type = "boolean"
                    is_measure = False

                elif isinstance(value, (int, float)):
                    field_type = "number"
                    is_measure = True

                elif any(
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
                ):
                    field_type = "date"
                    is_measure = False

                else:
                    field_type = "string"
                    is_measure = False

                detected_fields[field_name] = {
                    "field_type": field_type,
                    "is_measure": is_measure,
                }

    created_or_updated_fields = []

    for field_name, props in detected_fields.items():
        obj, created = ModuleField.objects.get_or_create(
            module=module_config,
            field_name=field_name,
            defaults={
                "field_type": props["field_type"],
                "is_filterable": True,
                "is_measure": props["is_measure"],
            },
        )

        if not created:
            updated = False

            if obj.field_type != props["field_type"]:
                obj.field_type = props["field_type"]
                updated = True

            if obj.is_measure != props["is_measure"]:
                obj.is_measure = props["is_measure"]
                updated = True

            if updated:
                obj.save()

        created_or_updated_fields.append(obj)

    return created_or_updated_fields