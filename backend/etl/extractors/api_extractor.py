import requests
import pandas as pd

def extract_api(config):

    response = requests.get(
        config["url"],
        headers={"Authorization": f"Bearer {config['token']}"}
    )

    data = response.json()

    return pd.DataFrame(data)