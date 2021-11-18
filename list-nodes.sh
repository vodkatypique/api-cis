#! /bin/bash

# gcloud compute instances list --filter="metadata.app_role=worker" --format="get(networkInterfaces[].networkIP)"
CLUSTER=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/attributes/cluster" -H "Metadata-Flavor: Google")
REGION=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/zone" -H "Metadata-Flavor: Google" | cut -d '-' -f1-2 | cut -d '/' -f4)
gcloud compute instance-groups managed list-instances $CLUSTER --region $REGION --filter="instanceStatus=RUNNING" --uri | xargs -I '{}' gcloud compute instances describe '{}' --format="get(networkInterfaces[].networkIP)"
