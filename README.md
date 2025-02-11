# parole-prep-scraper

This tool is used to sync Parole Prep's Airtable data with NYS DOCCS's database. 
It is deployed as a Google Cloud Run Job and triggered by a Google Cloud Scheduler. It stores the results of each sync in a Google Cloud Storage bucket both as raw JSON as a human-readable text file that highlights the changes. 

See [flowchart here](https://www.figma.com/board/teQ2Bl50kHMZbZyWdZFG8F/Parole-Prep-Scraper?node-id=0-1&t=IyThlW2U0mUs4KDE-1) for a high-level overview of the process.

## Prerequisites

- Node.js
- gcloud CLI (Google Cloud SDK)
- Airtable API key
- Airtable base ID
- Airtable table ID
- Airtable view ID
- Google Cloud Storage bucket -- assumes Application Default Credentials are set up to access the bucket

## Environment

The config file can handle field mappings for each of three environments: `test`, `staging`, and `production` and expects to find the environment in the `ENV` variable. If `ENV` is not set, the app will run in `test` mode.

**Local development** makes use of the `.env` file to store environment variables and authenticates Google Cloud using Application Default Credentials. You may need to periodically re-authenticate with Google Cloud to use application default credentials to access the storage bucket.

```
gcloud auth application-default login
```

**Google Cloud Deployments** get their environment variables from the `env.yaml` file and doesn't need to authenticate (or rather does it automatically).

### Development flags

Some helpful flags for development:
- `FEWER_RECORDS=500` will limit the number of records, which makes the script run faster.
- `RANDOM_RECORDS=true` will randomize the records, so you get a wider swath of cases while limiting the number of records.
- `ENABLE_UPDATE_RECORDS=true` will enable the update records step; turning it off is functionally a dry run as the report will think it updated the records but it didn't.
- `ENABLE_TYPECAST=true` will enable the script to add options for multiple choice fields on the fly.
- `BATCH_SIZE=100` will specify the number of records processed in each batch; this is useful for tweaking behavior at it pertains (the unknown DOCCS) API limits
- `BATCH_DELAY=1000` will specify the number of milliseconds to wait between batches; this is useful for tweaking behavior at it pertains (the unknown DOCCS) to API limits

You can also set `DEBUG=true` to get more verbose logging.

## Publishing to Google Cloud

`deploy/deploy.sh` will run the two deploy scripts in sequence.

### Cloud Run Jobs

The script in `deploy/create-or-update-job.sh` will create a new Cloud Run Job or update an existing one. It makes use of `env.yaml` and the `Dockerfile` to build the container image.

### Scheduler

The script in `deploy/set-trigger.sh` will create a new Cloud Scheduler job or update an existing one. The effective schedule is set in the script.

## Email Notifications

We use a nodemailer SMTP server to send the text report. The credentials and email details are stored in the `.env` file.