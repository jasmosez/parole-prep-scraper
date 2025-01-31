# parole-prep-scraper

This tool is used to sync Parole Prep's Airtable data with NYS DOCCS's database. 
It is deployed as a Google Cloud Function and triggered by a Google Cloud Scheduler. It stores the results of each sync in a Google Cloud Storage bucket.

See [flowchart here](https://www.figma.com/board/teQ2Bl50kHMZbZyWdZFG8F/Parole-Prep-Scraper?node-id=0-1&t=IyThlW2U0mUs4KDE-1) for a high-level overview of the process.

## Local Development

Local development makes use of the .env file to store environment variables.
If `ENV` is not set, the app will run in test mode.

Some helpful flags for development:
- `FEWER_RECORDS=true` will limit the number of records, which makes the script run faster.
- `RANDOM_RECORDS=true` will randomize the records, so you get a wider swath of cases while limiting the number of records.
- `ENABLE_UPDATE_RECORDS=false` will disable the update records step; this is functionally a dry run as the report will think it updated the records but it didn't.

### Prerequisites

- Node.js
- Airtable API key
- Airtable base ID
- Airtable table ID
- Airtable view ID
- Google Cloud Storage bucket -- assumes Application Default Credentials are set up  

## Publishing to Google Cloud

### Functions

We deploy to Google Cloud Functions using the `gcloud` CLI. See the script in `deploy/deploy.sh` for details. It makes use of the `env.yaml` file.

### Scheduler

We set the Cloud Trigger to run the function on a schedule. See the script in `deploy/set-trigger.sh` for details.

### Cloud Storage
The app writes two reports to Cloud Storage:
- A JSON report
- A text report

You may need to periodically re-authenticate with Google Cloud to use application default credentials to access the storage bucket.

```
gcloud auth application-default login
```

### Monitoring Logs, Alerts, and Notifications

We use Google Cloud Monitoring to track the function's performance and send alerts via email.
If any records have changes on fields where `causeAlert == true` (see `data-mapping.js`), the function will create the log entry we are looking for.

All this is set up in `deploy/monitoring-setup.sh`.

