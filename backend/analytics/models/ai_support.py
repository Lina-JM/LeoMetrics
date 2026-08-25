from django.db import models


class AIRecommendation(models.Model):
    kpi = models.ForeignKey(
        "analytics.KPIDefinition",
        on_delete=models.CASCADE,
        related_name="ai_recommendations",
    )

    module = models.ForeignKey(
        "analytics.ITSMModule",
        on_delete=models.CASCADE,
    )

    # 🔹 Context (VERY IMPORTANT)
    kpi_result_snapshot = models.JSONField(blank=True, null=True)

    # 🔹 AI Output
    risk_level = models.CharField(max_length=20)  # low / medium / high
    insight = models.TextField()
    probable_cause = models.TextField(blank=True)
    suggested_decision = models.TextField()

    # 🔹 Explainability
    reasoning = models.TextField(blank=True)

    # 🔹 Priority & confidence
    priority = models.CharField(max_length=20)  # low / medium / high
    confidence = models.FloatField(default=0)

    # 🔹 User interaction
    status = models.CharField(
        max_length=20,
        default="pending"
    )  # pending / accepted / rejected

    reviewed_by = models.ForeignKey(
        "auth.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    reviewed_at = models.DateTimeField(null=True, blank=True)

    # 🔹 Tracking
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.kpi.name} - {self.risk_level} ({self.status})"