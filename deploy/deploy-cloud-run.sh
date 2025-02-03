#!/bin/bash

# Exit on error
set -e

# Enable debug mode
set -x

# Configuration
PROJECT_ID=$(gcloud config get-value project)
REGION="us-east1"
SERVICE_NAME="doccs-sync"
TOPIC_NAME="doccs-sync-trigger"

# Create Pub/Sub topic if it doesn't exist
gcloud pubsub topics create $TOPIC_NAME || true

# Build and push the container
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --memory 1024Mi \
  --cpu 1 \
  --timeout 3600 \
  --min-instances 0 \
  --max-instances 1 \
  --env-vars-file .env.yaml \
  --no-allow-unauthenticated

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format='value(status.url)')

# Create service account for Pub/Sub if it doesn't exist
SA_EMAIL="doccs-sync-invoker@$PROJECT_ID.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "$SA_EMAIL" &>/dev/null; then
    gcloud iam service-accounts create "doccs-sync-invoker" \
        --display-name="Service Account for DOCCS Sync Pub/Sub Invoker"
fi

# Grant the service account permission to invoke Cloud Run
gcloud run services add-iam-policy-binding $SERVICE_NAME \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/run.invoker" \
  --region=$REGION

# Create Pub/Sub subscription to invoke Cloud Run
gcloud pubsub subscriptions create doccs-sync-subscription \
  --topic $TOPIC_NAME \
  --push-endpoint=$SERVICE_URL \
  --push-auth-service-account=$SA_EMAIL \
  --ack-deadline=600 || true  # 10 minute ack deadline 