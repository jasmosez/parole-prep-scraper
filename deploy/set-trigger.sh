#!/bin/bash

# Exit on error
set -e

# Print commands
set -x

# Configuration
PROJECT_ID=$(gcloud config get-value project)
REGION="us-east1"
FUNCTION_NAME="doccs-sync"
JOB_NAME="weekly-doccs-sync"
SCHEDULE="*/3 * * * *"
SERVICE_ACCOUNT="doccs-sync-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"
echo "SERVICE_ACCOUNT: $SERVICE_ACCOUNT"

# Create service account if it doesn't exist
if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT" &>/dev/null; then
    echo "Creating service account..."
    gcloud iam service-accounts create "doccs-sync-scheduler" \
        --display-name="Service Account for DOCCS Sync Scheduler"

    # Grant the service account permission to invoke the function
    echo "Granting invoker role to service account..."
    gcloud functions add-invoker-policy-binding $FUNCTION_NAME \
        --region=$REGION \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --project=$PROJECT_ID
fi

# Get the function URL
FUNCTION_URL=$(gcloud functions describe $FUNCTION_NAME \
    --gen2 \
    --region=$REGION \
    --format='value(serviceConfig.uri)')

# Create or replace the scheduler job
gcloud scheduler jobs create http $JOB_NAME \
    --schedule="$SCHEDULE" \
    --location=$REGION \
    --uri="$FUNCTION_URL" \
    --http-method=POST \
    --oidc-service-account-email=$SERVICE_ACCOUNT \
    --oidc-token-audience="$FUNCTION_URL" \
    || gcloud scheduler jobs update http $JOB_NAME \
    --schedule="$SCHEDULE" \
    --location=$REGION \
    --uri="$FUNCTION_URL" \
    --http-method=POST \
    --oidc-service-account-email=$SERVICE_ACCOUNT \
    --oidc-token-audience="$FUNCTION_URL"

echo "Cloud Scheduler job '$JOB_NAME' has been created/updated"
echo "Schedule: $SCHEDULE"
echo "Function: $FUNCTION_URL"
