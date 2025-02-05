#!/bin/bash

# Exit on error
set -e

# Configuration
PROJECT_ID=$(gcloud config get-value project)
REGION="us-east1"
JOB_NAME="doccs-sync"
SCHEDULER_NAME="nightly-doccs-sync"
SCHEDULE='0 0 * * *'  # Nightly at midnight
JOB_URI="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run"

# Create service account if it doesn't exist
SERVICE_ACCOUNT="doccs-sync-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT" &>/dev/null; then
    echo "Creating service account..."
    gcloud iam service-accounts create "doccs-sync-scheduler" \
        --display-name="Service Account for DOCCS Sync Scheduler"
fi

# Grant the service account permission to invoke the job
gcloud run jobs add-iam-policy-binding $JOB_NAME \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/run.invoker" \
  --region=$REGION

# Create or update Cloud Scheduler job
gcloud scheduler jobs create http $SCHEDULER_NAME \
  --schedule="$SCHEDULE" \
  --uri="$JOB_URI" \
  --http-method=POST \
  --oauth-service-account-email="$SERVICE_ACCOUNT" \
  --location=$REGION || \
gcloud scheduler jobs update http $SCHEDULER_NAME \
  --schedule="$SCHEDULE" \
  --uri="$JOB_URI" \
  --http-method=POST \
  --oauth-service-account-email="$SERVICE_ACCOUNT" \
  --location=$REGION

echo "Cloud Scheduler job '$SCHEDULER_NAME' has been created/updated"
echo "Schedule: $SCHEDULE"
