# Overhead - domain language

The words the code, tests and docs use for the domain. Keep new code to these names.

- **Card:** the Live Activity on the Lock Screen and Dynamic Island, and the same view in the app. There is at most one per phone.
- **Stage:** where a plane is in its pass over you.
  - **inbound:** predicted to pass within two minutes. It is watched, never shown.
  - **approaching:** about 45 seconds away.
  - **overhead:** passing now. Shown as "Above you now".
  - **passed:** gone, but the card lingers for about 20 seconds.
- **Card text:** the status, title and details a card shows, built once by `cardText` in shared/.
- **Start token:** the push token a phone gives so the server can start a card.
- **Card token:** the push token iOS gives one open card, so the server can update or end it.
- **Policy:** the pure rules that decide start, update or end, and track card tokens (`server/src/activity/policy.ts`).
- **Watcher:** the 5-second loop that asks the sky, steps the policy and sends pushes.
- **Sky snapshot:** the planes and the card from one watcher check, served to the app by `GET /sky`.
- **Check-in:** a phone telling the server its rough location, settings and tokens (`POST /register`).
- **Rough location:** a location rounded to about 100 m. It is the only location that leaves or is saved on the phone.
- **Quiet hours:** 22:00 to 07:00 by default, when no cards start.
- **User store:** the server's users, kept in SQLite when `DATABASE_PATH` is set. A phone silent for 30 days is forgotten.
