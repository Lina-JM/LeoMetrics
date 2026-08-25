from django import forms
from django.db import connection
from .models import  ModuleField, ITSMModule, KPI
from analytics.models import CleanedITSMRecord


# ----------------------------
# KPI Form
# ----------------------------
class KPIForm(forms.ModelForm):
    class Meta:
        model = KPI
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        module = None

        # ----------------------------
        # 1️⃣ Get module
        # ----------------------------
        if self.instance and self.instance.pk:
            module = self.instance.module

        elif self.data.get("module"):
            try:
                module = ITSMModule.objects.get(id=self.data.get("module"))
            except ITSMModule.DoesNotExist:
                pass

        # ----------------------------
        # 2️⃣ Filter fields
        # ----------------------------
        if module:
            fields = ModuleField.objects.filter(module=module)
        else:
            fields = ModuleField.objects.all()

        self.fields["field"].queryset = fields
        self.fields["filter_field"].queryset = fields
        self.fields["group_by"].queryset = fields

        # ----------------------------
        # 3️⃣ Get filter_field ID safely
        # ----------------------------
        filter_field_id = (
            self.data.get("filter_field")
            or (self.instance.filter_field.id if self.instance and self.instance.filter_field else None)
        )

        # ----------------------------
        # 4️⃣ Build filter_value dropdown
        # ----------------------------
        if module and filter_field_id:
            try:
                filter_field = ModuleField.objects.get(id=filter_field_id)
                field_name = filter_field.field_name

                table_name = CleanedITSMRecord._meta.db_table

                with connection.cursor() as cursor:
                    cursor.execute(f"""
                        SELECT DISTINCT dynamic_data->>%s
                        FROM {table_name}
                        WHERE module_id = %s
                    """, [field_name, module.id])

                    values = [row[0] for row in cursor.fetchall() if row[0]]

                choices = [("all", "All")] + [(v, v) for v in values]

                self.fields["filter_value"].widget = forms.Select(choices=choices)

            except ModuleField.DoesNotExist:
                pass

    # ----------------------------
    # 5️⃣ Validation
    # ----------------------------
    def clean(self):
        cleaned_data = super().clean()

        aggregation = cleaned_data.get("aggregation")
        field = cleaned_data.get("field")
        group_by = cleaned_data.get("group_by")

        if aggregation in ["sum", "avg", "min", "max"] and not field:
            self.add_error("field", f"{aggregation} requires a field")

        if group_by and not aggregation:
            self.add_error("group_by", "Grouped KPI requires aggregation")

        return cleaned_data