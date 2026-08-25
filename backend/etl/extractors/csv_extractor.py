import pandas as pd

def extract_csv(config):

    return pd.read_csv(config["file_path"])