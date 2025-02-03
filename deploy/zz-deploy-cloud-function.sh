#!/bin/bash

# Exit on error
set -e

# Create a Pub/Sub topic if it doesn't exist
gcloud pubsub topics create doccs-sync-trigger || true

# Deploy the function
gcloud functions deploy doccs-sync \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-east1 \
  --source=. \
  --entry-point=doccsSync \
  --trigger-topic=doccs-sync-trigger \
  --memory=1024MB \
  --timeout=3600s \
  --env-vars-file=.env.yaml \
  --min-instances=0 \
  --max-instances=1 \
  --no-allow-unauthenticated
