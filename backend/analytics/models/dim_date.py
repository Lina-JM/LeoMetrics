from django.db import models

class DateDimension(models.Model):

    date = models.DateField(unique=True)

    year = models.IntegerField()
    quarter = models.IntegerField()

    month = models.IntegerField()
    month_name = models.CharField(max_length=20)

    week_of_year = models.IntegerField()

    day = models.IntegerField()
    weekday = models.CharField(max_length=20)

    is_weekend = models.BooleanField()
    is_business_day = models.BooleanField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "dim_date"
        ordering = ["date"]

    def __str__(self):
        return str(self.date)