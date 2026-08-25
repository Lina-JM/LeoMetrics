import json
import re
import time as time_module
import requests
from django.conf import settings
from google import genai

AI_PROVIDER = getattr(settings, "AI_PROVIDER", "hybrid")

GEMINI_API_KEY = getattr(settings, "GEMINI_API_KEY", None)
GEMINI_MODEL = getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash")

GROQ_API_KEY = getattr(settings, "GROQ_API_KEY", None)
GROQ_MODEL = getattr(settings, "GROQ_MODEL", "llama-3.3-70b-versatile")


def build_prompt(kpi, result, trend_context=None):
    kpi_business_meaning = getattr(kpi, "business_meaning", "") or ""

    module_context = (
        getattr(kpi.module, "description", "")
        or f"Analyze this module '{kpi.module.name}' based on ITSM best practices."
    )

    return f"""
You are an ITSM KPI Decision Support Expert.

Your job is to analyze KPI performance and provide REAL operational decisions, not generic advice.

====================
KPI CONTEXT
====================
- KPI: {kpi.name}
- Module: {kpi.module.name}
- Aggregation: {kpi.aggregation}
- Target: {kpi.target_operator} {kpi.target_value}
- Result: {result}

KPI Business Meaning:
{kpi_business_meaning}

Module Context:
{module_context}

Trend context:
{trend_context}

====================
MANDATORY BUSINESS INTERPRETATION
====================
You MUST use the KPI Business Meaning.
- Explain WHAT the KPI measures
- Explain WHY it matters for business operations
- Identify WHAT is at risk if off target
- Link KPI → business impact → operational consequence

DO NOT ignore business meaning.
DO NOT give generic explanations.

====================
KPI-SPECIFIC INTELLIGENCE
====================
Adapt reasoning based on KPI nature:
- Approval KPIs: approval workflow, delays, approvers, automation
- Incident KPIs: incident inflow, service instability, support workload
- Change KPIs: change risk, failed changes, validation process
- Problem KPIs: root cause analysis, recurring issues, unresolved investigations
- Knowledge KPIs: knowledge gaps, article quality, documentation coverage

Each KPI must produce a specific decision.

====================
FORBIDDEN GENERIC PHRASES
====================
Do NOT use:
- corrective actions
- review KPI breakdown
- monitor progress
- investigate the issue
- identify responsible teams

====================
DECISION UNIQUENESS ENFORCEMENT
====================
Each KPI MUST produce a DIFFERENT type of action.
Choose ONE primary action only.
Make it specific and measurable.

Examples:
Knowledge KPI:
"Create 10 missing articles for top recurring incidents in Service Desk this month"

Approval KPI:
"Add 2 backup approvers for Service Requests during peak hours"

Problem KPI:
"Assign 3 engineers to resolve the top affected service backlog within 2 weeks"

Change KPI:
"Automate approval for low-risk infrastructure changes under predefined criteria"

====================
CRITICAL DECISION RULE
====================
The suggested_decision must be:
- ONLY ONE action
- Maximum 1 sentence
- Maximum 20 words
- Directly executable

Avoid combining multiple actions with "and".

====================
STRICT OUTPUT RULE
====================
Return ONLY a valid raw JSON object.
Do NOT include markdown.
Do NOT include ```json.
Do NOT include any text before or after JSON.

VALID EXAMPLE:
{{
  "risk_level": "high",
  "priority": "high",
  "confidence": 0.85,
  "insight": "The KPI shows a service delivery risk linked to approval delays.",
  "probable_cause": "The most likely cause is insufficient approvers during peak request periods.",
  "suggested_decision": "Add 2 backup approvers for Service Requests during peak hours.",
  "reasoning": "The decision targets approval delay impact on service delivery."
}}
"""


def extract_json_from_text(text):
    if not text:
        raise ValueError("Empty AI response.")

    text = text.strip()
    text = text.replace("```json", "").replace("```", "").strip()

    try:
        return json.loads(text)
    except Exception:
        pass

    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group())

    raise ValueError("No JSON object found in AI response.")


def normalize_output(parsed):
    parsed["risk_level"] = str(parsed.get("risk_level", "medium")).lower()
    parsed["priority"] = str(parsed.get("priority", parsed["risk_level"])).lower()

    parsed["insight"] = (
        parsed.get("insight")
        or parsed.get("analysis")
        or parsed.get("summary")
        or "No insight generated."
    )

    parsed["probable_cause"] = (
        parsed.get("probable_cause")
        or parsed.get("cause")
        or parsed.get("root_cause")
        or "No cause provided."
    )

    parsed["suggested_decision"] = (
        parsed.get("suggested_decision")
        or parsed.get("recommendation")
        or parsed.get("decision")
        or "Review this KPI manually."
    )

    parsed["reasoning"] = parsed.get("reasoning") or parsed.get("explanation") or ""

    try:
        conf = float(parsed.get("confidence", 0.5))
        parsed["confidence"] = max(0.0, min(1.0, conf))
    except Exception:
        parsed["confidence"] = 0.5

    return parsed


def call_gemini(prompt, retries=2):
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is missing.")

    client = genai.Client(api_key=GEMINI_API_KEY)
    last_error = None

    for attempt in range(retries):
        try:
            print(f"CALLING GEMINI attempt {attempt + 1}/{retries}")

            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )

            raw_text = (response.text or "").strip()
            print("RAW GEMINI RESPONSE:", raw_text)

            return extract_json_from_text(raw_text)

        except Exception as error:
            last_error = error
            print(f"Gemini attempt {attempt + 1} failed:", error)

            error_text = str(error)

            if "429" in error_text or "RESOURCE_EXHAUSTED" in error_text:
                raise error

            if "503" in error_text and attempt < retries - 1:
                time_module.sleep(2 * (attempt + 1))
                continue

            if attempt < retries - 1:
                time_module.sleep(1)
                continue

    raise last_error


def call_groq(prompt):
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is missing.")

    print("CALLING GROQ")

    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": GROQ_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
        },
        timeout=45,
    )

    response.raise_for_status()
    data = response.json()

    raw_text = data["choices"][0]["message"]["content"]
    print("RAW GROQ RESPONSE:", raw_text)

    return extract_json_from_text(raw_text)


def generate_ai_recommendation(kpi, result, trend_context=None):
    prompt = build_prompt(kpi, result, trend_context)

    print("AI_PROVIDER =", AI_PROVIDER)

    if AI_PROVIDER == "gemini":
        parsed = call_gemini(prompt)
        return normalize_output(parsed)

    if AI_PROVIDER == "groq":
        parsed = call_groq(prompt)
        return normalize_output(parsed)

    if AI_PROVIDER == "hybrid":
        try:
            parsed = call_gemini(prompt)
            return normalize_output(parsed)
        except Exception as gemini_error:
            print("Gemini failed, trying Groq:", gemini_error)

            parsed = call_groq(prompt)
            return normalize_output(parsed)

    raise ValueError(f"Unsupported AI_PROVIDER: {AI_PROVIDER}")