#!/bin/bash

# Exit on error
set -e

# Deploy the function
gcloud functions deploy doccs-sync \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-east1 \
  --source=. \
  --entry-point=doccsSync \
  --trigger-http \
  --memory=256MB \
  --timeout=540s \
  --env-vars-file=.env.yaml \
  --min-instances=0 \
  --max-instances=1 \
  --no-allow-unauthenticated
