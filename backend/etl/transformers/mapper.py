from analytics.models.etl_warning import ETLWarning
from collections import Counter


def normalize(name):
    return name.strip().lower().replace(" ", "_")


def make_unique(columns):
    seen = {}
    new_cols = []

    for col in columns:
        if col not in seen:
            seen[col] = 0
            new_cols.append(col)
        else:
            seen[col] += 1
            new_cols.append(f"{col}_{seen[col]}")

    return new_cols


def detect_similar_fields(columns):
    base_names = [col.split(".")[0] for col in columns]
    counts = Counter(base_names)

    return [col for col, count in counts.items() if count > 1]


def apply_mapping(df, module):
    # 1️⃣ Normalize
    normalized_cols = [normalize(col) for col in df.columns]

    # 2️⃣ Detect duplicates
    duplicates = detect_similar_fields(normalized_cols)

    if duplicates:
        message = f"Duplicate-like fields detected: {sorted(set(duplicates))}"

        ETLWarning.objects.get_or_create(
            module=module,
            message=message
        )

    # 3️⃣ Make unique
    df.columns = make_unique(normalized_cols)

    return df