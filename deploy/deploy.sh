#!/usr/bin/env bash
set -euo pipefail

PROJECT=overhead-eyal
ZONE=us-central1-a
VM=overhead
RELEASE=$(git rev-parse --short HEAD)
ARCHIVE=$(mktemp -t overhead-XXXX.tar.gz)

git archive --format=tar.gz -o "$ARCHIVE" HEAD
gcloud compute scp "$ARCHIVE" "$VM:/tmp/overhead.tar.gz" --project "$PROJECT" --zone "$ZONE" --quiet
rm -f "$ARCHIVE"

gcloud compute ssh "$VM" --project "$PROJECT" --zone "$ZONE" --quiet --command "
  set -euo pipefail
  sudo rm -rf /opt/overhead/app.next
  sudo mkdir -p /opt/overhead/app.next
  sudo tar -xzf /tmp/overhead.tar.gz -C /opt/overhead/app.next
  sudo cp /opt/overhead/secrets/.env /opt/overhead/app.next/server/.env
  sudo chown -R overhead:overhead /opt/overhead/app.next
  cd /opt/overhead/app.next && sudo -u overhead npm ci --workspace server --workspace shared --no-audit --no-fund --loglevel=error
  sudo rm -rf /opt/overhead/app.previous
  [ -d /opt/overhead/app ] && sudo mv /opt/overhead/app /opt/overhead/app.previous
  sudo mv /opt/overhead/app.next /opt/overhead/app
  sudo cp /opt/overhead/app/deploy/overhead.service /etc/systemd/system/overhead.service
  sudo cp /opt/overhead/app/deploy/Caddyfile /etc/caddy/Caddyfile
  sudo systemctl daemon-reload
  sudo systemctl enable --now overhead caddy
  sudo systemctl restart overhead
  sudo systemctl reload caddy
"
echo "Deployed $RELEASE"
