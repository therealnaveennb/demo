 Retrieve a list of all available deal properties:
First, you can get a comprehensive list of all deal properties defined in your HubSpot account (both default and custom) using the Properties API:
Code

GET /crm/v3/properties/deals
This request will return a JSON object containing details about each deal property, including its internal name, label, type, and other attributes. You can then use the name field of each property in subsequent requests.
2. Retrieve deals with specified properties:
Once you have the internal names of the properties you want, you can include them in your request to retrieve deals. For example, using the Deals API:
Code

GET /crm/v3/objects/deals?properties=dealname,amount,dealstage,pipeline
In this example, dealname, amount, dealstage, and pipeline are the internal names of the properties you want to retrieve for each deal. You would replace these with the actual property names you gathered from the Properties API.   import os
import requests
import csv
import logging
from os.path import expanduser
from configparser import ConfigParser

# Constants
DEFAULT_CREDENTIALS_FILE = expanduser('~/.mitsogo/credentials')


FORMAT = "%(asctime)s - %(levelname)s - %(message)s"
logging.basicConfig(format=FORMAT, level=os.environ.get('LOGLEVEL', 'INFO'))
logger = logging.getLogger(__name__)

configParser = ConfigParser()

def getconfig(profile, variable):
    try:
        configParser.read(os.environ.get('SHARED_CREDENTIALS_FILE', DEFAULT_CREDENTIALS_FILE))
        value = configParser.get(profile, variable)
        return value
    except Exception as e:
        logger.error(f"Unable to find the profile '{profile}' or variable '{variable}' in credentials file. Error: {e}")
        return None

# Function to fetch deals from HubSpot
def fetch_deals(access_token):
    deals = []
    url = "https://api.hubapi.com/deals/v1/deal/paged"
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    params = {
        "limit": 100,
        "properties":['account', 'dealId', 'dealName', 'amount', 'dealStage']
    }
    has_more = True
    offset = 0

    while has_more:
        params['offset'] = offset
        response = requests.get(url, headers=headers, params=params,verify=False)
        if response.status_code != 200:
            logger.error(f"Failed to fetch deals: {response.status_code} - {response.text}")
            break
        data = response.json()
        deals.extend(data.get('deals', []))
        has_more = data.get('hasMore', False)
        offset = data.get('offset', 0)
    logger.info(f"deals {deals}")
    return deals
def main():
    account_profiles = ['hubspot-test']
    all_deals = {}

    for profile in account_profiles:
        access_token = getconfig(profile, 'access_token')
        if not access_token:
            logger.warning(f"No access token found for profile: {profile}")
            continue
        logger.info(f"Fetching deals for profile: {profile}")
        deals = fetch_deals(access_token)
        all_deals[profile] = deals
    # Write all deals to CSV
    with open('all_deals.csv', 'w', newline='') as csvfile:
        fieldnames = ['account', 'dealId', 'dealName', 'amount', 'dealStage']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()

        for account, deals in all_deals.items():
            for deal in deals:
                props = deal.get('properties', {})
                writer.writerow({
                    'account': account,
                    'dealId': deal.get('dealId'),
                    'dealName': props.get('dealname', {}).get('value', ''),
                    'amount': props.get('amount', {}).get('value', ''),
                    'dealStage': props.get('dealstage', {}).get('value', '')
                })

    logger.info("All deals have been written to all_deals.csv")

if __name__ == "__main__":
    main() update thecsv accordingly
