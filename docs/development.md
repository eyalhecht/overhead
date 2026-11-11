# Development

Needs Node 22 ([.nvmrc](../.nvmrc)). Seeing a real card needs an iPhone on iOS 17.2 or later (push-to-start Live Activities), a development build of the app from EAS, and Apple Push credentials.

```bash
npm install
cp server/.env.example server/.env    # add tokens, or leave APNs empty for a dry run
npm start -w server                   # API + watcher on :8080
npm start -w app                      # Metro for the development build
```

The app reads `EXPO_PUBLIC_SERVER_URL` and `EXPO_PUBLIC_APP_KEY` from `app/.env`.

With `DEMO_LAT`/`DEMO_LON` set and no APNs config, the server runs a dry run at that spot and prints every card it would send.

Without EASA's noise data only planes passing close get cards. To hear planes locally, download the legacy ANP 2.3 tables from https://www.easa.europa.eu/en/downloads/138164/en and unzip them into `server/data/anp/`. They have no license to redistribute, so git ignores that folder and CI fails if they are committed.

## Moving the server to a new VM

The app has the server's address built in (`EXPO_PUBLIC_SERVER_URL` in `app/eas.json`), so a move goes together with an app build.

1. `VM=overhead-eu ZONE=europe-west3-a ./deploy/create-vm.sh` reserves a static IP, creates the VM and installs Node, Caddy and the `overhead` user. It prints the new `https://<ip>.sslip.io` address.
2. Copy the secrets from the old VM: `/opt/overhead/secrets/.env` and `apns.p8` into the same folder on the new VM, owned by `overhead`, mode 600.
3. `VM=overhead-eu ZONE=europe-west3-a ./deploy/deploy.sh` deploys and waits for `/health`.
4. Point `EXPO_PUBLIC_SERVER_URL` in `app/eas.json` at the new address, bump the version and build.
5. When the build is approved, stop the old service (`sudo systemctl stop overhead`), copy `/opt/overhead/data/overhead.db` (and its `-wal` and `-shm` files, if any) to the new VM, restart the new service, and tell testers to update.
6. Delete the old VM and release its static IP.
