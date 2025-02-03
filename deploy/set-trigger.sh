#!/bin/bash

# Exit on error
set -e

# Print commands
set -x

# Configuration
PROJECT_ID=$(gcloud config get-value project)
REGION="us-east1"
TOPIC_NAME="doccs-sync-trigger"
JOB_NAME="weekly-doccs-sync"
SCHEDULE="0 0 * * *"  # Weekly at midnight
SERVICE_ACCOUNT="doccs-sync-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"
echo "SERVICE_ACCOUNT: $SERVICE_ACCOUNT"

# Create service account if it doesn't exist
if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT" &>/dev/null; then
    echo "Creating service account..."
    gcloud iam service-accounts create "doccs-sync-scheduler" \
        --display-name="Service Account for DOCCS Sync Scheduler"
fi

# Grant publish permission to the service account
gcloud pubsub topics add-iam-policy-binding $TOPIC_NAME \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/pubsub.publisher"

# Create or update Cloud Scheduler job to publish to Pub/Sub
gcloud scheduler jobs create pubsub $JOB_NAME \
  --schedule="$SCHEDULE" \
  --topic="projects/$PROJECT_ID/topics/$TOPIC_NAME" \
  --message-body="Run DOCCS sync" \
  --location=$REGION || \
gcloud scheduler jobs update pubsub $JOB_NAME \
  --schedule="$SCHEDULE" \
  --topic="projects/$PROJECT_ID/topics/$TOPIC_NAME" \
  --message-body="Run DOCCS sync" \
  --location=$REGION

echo "Cloud Scheduler job '$JOB_NAME' has been created/updated"
echo "Schedule: $SCHEDULE"
