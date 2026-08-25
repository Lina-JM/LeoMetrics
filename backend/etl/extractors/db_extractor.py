import pandas as pd
import psycopg2

def extract_db(config):

    conn = psycopg2.connect(config["connection"])

    query = f"SELECT * FROM {config['table']}"

    return pd.read_sql(query, conn)