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

# Common job configuration
JOB_FLAGS="--image gcr.io/$PROJECT_ID/$JOB_NAME \
  --tasks 1 \
  --memory 1024Mi \
  --cpu 1 \
  --max-retries 0 \
  --task-timeout 10800s \
  --region $REGION \
  --env-vars-file .env.yaml"

# Update existing job or create new one
gcloud run jobs update $JOB_NAME $JOB_FLAGS || \
gcloud run jobs create $JOB_NAME $JOB_FLAGS 