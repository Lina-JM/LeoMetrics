from django.core.management.base import BaseCommand

from analytics.models.itsm_module_config import ITSMModuleConfig
from etl.pipeline.run_pipeline import run_pipeline


class Command(BaseCommand):
    help = "Run ETL pipeline for all active modules"

    def handle(self, *args, **kwargs):
        modules = ITSMModuleConfig.objects.filter(is_active=True)

        for module in modules:
            self.stdout.write(f"Running pipeline for {module.name}...")

            try:
                run_pipeline(module.id)

                self.stdout.write(
                    self.style.SUCCESS(
                        f"Pipeline completed for {module.name}"
                    )
                )

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f"Pipeline failed for {module.name}: {str(e)}"
                    )
                )