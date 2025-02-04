#!/bin/bash

# Exit on error
set -e

# Print commands
set -x

# Configuration
PROJECT_ID=$(gcloud config get-value project)
REGION="us-east1"
FUNCTION_NAME="doccs-sync"  # Updated to match deployment
JOB_NAME="nightly-doccs-sync"
SCHEDULE="0 0 * * *"  # Nightly at midnight

# Create service account if it doesn't exist
SERVICE_ACCOUNT="doccs-sync-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT" &>/dev/null; then
    echo "Creating service account..."
    gcloud iam service-accounts create "doccs-sync-scheduler" \
        --display-name="Service Account for DOCCS Sync Scheduler"
fi

# Get the function URL
FUNCTION_URL=$(gcloud functions describe $FUNCTION_NAME \
  --gen2 \
  --region $REGION \
  --format='value(serviceConfig.uri)')

# Create or update Cloud Scheduler job to invoke the function
gcloud scheduler jobs create http $JOB_NAME \
  --schedule="$SCHEDULE" \
  --uri="$FUNCTION_URL" \
  --http-method=POST \
  --oidc-service-account-email="$SERVICE_ACCOUNT" \
  --location=$REGION || \
gcloud scheduler jobs update http $JOB_NAME \
  --schedule="$SCHEDULE" \
  --uri="$FUNCTION_URL" \
  --http-method=POST \
  --oidc-service-account-email="$SERVICE_ACCOUNT" \
  --location=$REGION

echo "Cloud Scheduler job '$JOB_NAME' has been created/updated"
echo "Schedule: $SCHEDULE"
