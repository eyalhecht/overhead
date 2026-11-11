#!/usr/bin/env bash
set -euo pipefail

PROJECT=overhead-eyal
ZONE=${ZONE:-us-central1-a}
VM=${VM:-overhead}
RELEASE=$(git rev-parse --short HEAD)
IP=$(gcloud compute instances describe "$VM" --project "$PROJECT" --zone "$ZONE" --format 'value(networkInterfaces[0].accessConfigs[0].natIP)')
SITE="${IP//./-}.sslip.io"
ARCHIVE=$(mktemp -t overhead-XXXX.tar.gz)

git archive --format=tar.gz -o "$ARCHIVE" HEAD
gcloud compute scp "$ARCHIVE" "$VM:/tmp/overhead.tar.gz" --project "$PROJECT" --zone "$ZONE" --quiet
rm -f "$ARCHIVE"

gcloud compute ssh "$VM" --project "$PROJECT" --zone "$ZONE" --quiet --command "
  set -euo pipefail
  command -v make >/dev/null || sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq build-essential
  sudo install -d -o overhead -g overhead -m 700 /opt/overhead/data
  sudo install -d /etc/systemd/journald.conf.d
  printf '[Journal]\nMaxRetentionSec=14day\n' | sudo tee /etc/systemd/journald.conf.d/overhead.conf >/dev/null
  sudo systemctl restart systemd-journald
  sudo rm -rf /opt/overhead/app.next
  sudo mkdir -p /opt/overhead/app.next
  sudo tar -xzf /tmp/overhead.tar.gz -C /opt/overhead/app.next
  sudo cp /opt/overhead/secrets/.env /opt/overhead/app.next/server/.env
  if [ ! -f /opt/overhead/anp/ANP2.3_NPD_data.csv ]; then
    curl -fsSL -o /tmp/anp.zip https://www.easa.europa.eu/en/downloads/138164/en
    sudo python3 -m zipfile -e /tmp/anp.zip /opt/overhead/anp
  fi
  sudo mkdir -p /opt/overhead/app.next/server/data
  sudo cp -r /opt/overhead/anp /opt/overhead/app.next/server/data/anp
  sudo chown -R overhead:overhead /opt/overhead/app.next
  cd /opt/overhead/app.next && sudo -u overhead npm ci --workspace server --workspace shared --no-audit --no-fund --loglevel=error
  sudo rm -rf /opt/overhead/app.previous
  [ -d /opt/overhead/app ] && sudo mv /opt/overhead/app /opt/overhead/app.previous
  sudo mv /opt/overhead/app.next /opt/overhead/app
  sudo cp /opt/overhead/app/deploy/overhead.service /etc/systemd/system/overhead.service
  sed 's/SITE_ADDRESS/$SITE/' /opt/overhead/app/deploy/Caddyfile | sudo tee /etc/caddy/Caddyfile >/dev/null
  sudo systemctl daemon-reload
  sudo systemctl enable --now overhead caddy
  sudo systemctl restart overhead
  for attempt in \$(seq 15); do curl -fsS http://127.0.0.1:8080/health && break; sleep 2; done
  curl -fsS http://127.0.0.1:8080/health || { sudo journalctl -u overhead -n 30 --no-pager; exit 1; }
  sudo systemctl reload caddy
"
echo "Deployed $RELEASE to https://$SITE"
