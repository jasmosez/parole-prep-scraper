#!/bin/bash

# Exit on error
set -e

# Configuration
PROJECT_ID=$(gcloud config get-value project)
REGION="us-east1"
JOB_NAME="doccs-sync"

# Build and push the container
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/$JOB_NAME

# Deploy as a Cloud Run Job
gcloud run jobs create $JOB_NAME \
  --image gcr.io/$PROJECT_ID/$JOB_NAME \
  --tasks 1 \
  --memory 1024Mi \
  --cpu 1 \
  --max-retries 0 \
  --task-timeout 10800s \
  --region $REGION \
  --env-vars-file .env.yaml 