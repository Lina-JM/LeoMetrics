from etl.extractors.excel_extractor import extract_excel
from etl.extractors.csv_extractor import extract_csv
from etl.extractors.api_extractor import extract_api
from etl.extractors.db_extractor import extract_db


def get_extractor(source_type):

    extractors = {
        "excel": extract_excel,
        "csv": extract_csv,
        "api": extract_api,
        "database": extract_db
    }

    return extractors.get(source_type)