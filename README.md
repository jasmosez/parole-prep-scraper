# parole-prep-scraper

This tool is used to sync Parole Prep's Airtable data with NYS DOCCS's database. 
It is deployed as a Google Cloud Function and triggered by a Google Cloud Scheduler. It stores the results of each sync in a Google Cloud Storage bucket.

## Google Cloud

### Storage
You need to authenticate with Google Cloud to use the storage bucket.

```
gcloud auth application-default login
```

### Functions

### Scheduler