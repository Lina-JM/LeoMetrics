import pandas as pd

def extract_excel(config):

    if isinstance(config, str):
        file_path = config
    else:
        file_path = config.get("file_path")

    return pd.read_excel(file_path)