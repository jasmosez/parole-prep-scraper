# parole-prep-scraper

This tool is used to sync Parole Prep's Airtable data with NYS DOCCS's database. 
It is deployed as a Google Cloud Function and triggered by a Google Cloud Scheduler. It stores the results of each sync in a Google Cloud Storage bucket.

## Publishing
config.yaml is used to set `ENV` for the deployment: either `test`, `staging`, or `production`.

### Environment Variables
Local development makes use of the .env file to store environment variables.

Cloud Build is used to build and deploy the function and it reads the cloudbuild.yaml file, which in turn reads from config.yaml.

env.yaml was created when we were deploying directly to Google Cloud Functions via the gcloud CLI. It is no longer used.

### Prerequisites

- Node.js
- Airtable API key
- Airtable base ID
- Airtable table ID
- Airtable view ID
- Google Cloud Storage bucket -- assumes Application Default Credentials are set up

## Google Cloud

### Storage
You need to authenticate with Google Cloud to use the storage bucket.

```
gcloud auth application-default login
```

### Functions

### Scheduler