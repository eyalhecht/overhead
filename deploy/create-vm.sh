#!/usr/bin/env bash
# One-time setup of a new server VM. Example: VM=overhead-eu ZONE=europe-west3-a ./deploy/create-vm.sh
set -euo pipefail

PROJECT=overhead-eyal
VM=${VM:?set VM}
ZONE=${ZONE:?set ZONE}
REGION=${ZONE%-*}
MACHINE=${MACHINE:-e2-small}

gcloud compute addresses create "$VM-ip" --project "$PROJECT" --region "$REGION"
IP=$(gcloud compute addresses describe "$VM-ip" --project "$PROJECT" --region "$REGION" --format 'value(address)')

gcloud compute instances create "$VM" --project "$PROJECT" --zone "$ZONE" --machine-type "$MACHINE" \
  --image-family debian-12 --image-project debian-cloud --boot-disk-size 30GB --boot-disk-type pd-balanced \
  --tags overhead-web --address "$IP"

until gcloud compute ssh "$VM" --project "$PROJECT" --zone "$ZONE" --quiet --command true 2>/dev/null; do sleep 5; done

gcloud compute ssh "$VM" --project "$PROJECT" --zone "$ZONE" --quiet --command "
  set -euo pipefail
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs build-essential debian-keyring debian-archive-keyring apt-transport-https gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq caddy
  sudo useradd --system --home-dir /opt/overhead --create-home --shell /usr/sbin/nologin overhead
  sudo install -d -o overhead -g overhead -m 700 /opt/overhead/secrets /opt/overhead/data
"

echo "Created $VM at https://${IP//./-}.sslip.io"
