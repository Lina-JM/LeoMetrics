from datetime import date, timedelta

from django.core.management.base import BaseCommand

from analytics.models.dim_date import DateDimension


class Command(BaseCommand):
    help = "Populate or extend DateDimension table"

    def handle(self, *args, **kwargs):
        today = date.today()
        min_start_date = date(2015, 1, 1)
        extension_years = 10
        threshold_days = 365

        latest_date = (
            DateDimension.objects
            .order_by("-date")
            .values_list("date", flat=True)
            .first()
        )

        if latest_date and (latest_date - today).days > threshold_days:
            self.stdout.write(
                self.style.SUCCESS(
                    f"DateDimension already populated until {latest_date}."
                )
            )
            return

        start_date = min_start_date if not latest_date else latest_date + timedelta(days=1)
        end_date = date(today.year + extension_years, 12, 31)

        current = start_date
        created = 0

        while current <= end_date:
            _, was_created = DateDimension.objects.get_or_create(
                date=current,
                defaults={
                    "day": current.day,
                    "month": current.month,
                    "month_name": current.strftime("%B"),
                    "quarter": (current.month - 1) // 3 + 1,
                    "year": current.year,
                    "week_of_year": current.isocalendar().week,
                    "weekday": current.strftime("%A"),
                    "is_weekend": current.weekday() >= 5,
                    "is_business_day": current.weekday() < 5,
                },
            )

            if was_created:
                created += 1

            current += timedelta(days=1)

        self.stdout.write(
            self.style.SUCCESS(
                f"DateDimension extended until {end_date}. Created {created} records."
            )
        )