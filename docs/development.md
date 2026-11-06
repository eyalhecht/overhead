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
