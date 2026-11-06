# Overhead - privacy

What Overhead collects, why, who it reaches, and how long it is kept. This page is the basis for the App Store privacy label and the future privacy policy. Reviewed on 5 November 2026 against the GDPR checklist (data inventory, lawful basis, data subject rights, privacy by design, transfers, technical measures).

## What is collected

| Data | Where it comes from | Why | Stored |
|---|---|---|---|
| Rough location (rounded to about 100 m) | The phone's location, rounded on the phone before it is saved or sent | To find the planes that pass near you | Server user store; on the phone (rounded only) |
| Device ID (iOS identifierForVendor) | iOS | To match a phone to its cards; it is random and per developer, not an advertising ID | Server user store |
| Push tokens (start token, card tokens) | iOS | To start, update and end the Lock Screen card through Apple | Server user store |
| Settings (cards on or off, quiet hours, time zone offset) | The app | To respect them | Server user store |
| Last check-in time | Server clock | To forget silent phones after 30 days | Server user store |

Not collected: name, email, account, contacts, the exact location, advertising ID, analytics or tracking of any kind. There is no account to create, so there is no account to delete.

## Where it goes

- **The Overhead server** (Google Cloud, `us-central1`, United States) keeps the data above in a SQLite file readable only by the server process, on a disk Google encrypts at rest. Traffic arrives over HTTPS (Caddy) and is checked against an app key.
- **adsb.fi and adsb.lol** (flight position feeds) receive only the center of the roughly 10 km area around a phone, without any identifier, when the server asks which planes are near it.
- **IP addresses** reach the server with every request, as with any internet service. Neither the app server nor Caddy logs or stores them.
- **Apple Push Notification service** receives push tokens and the card's flight details.
- **Flightradar24** receives flight callsigns only, to look up routes. No user data.

## How long it is kept

- **User store:** a phone that hasn't checked in for 30 days is deleted automatically.
- **Ended card tokens:** only the last 20 per phone are remembered.
- **Server logs:** 14 days (journald). Logs name a phone by the first 8 characters of its device ID, plus flights and card events. They never contain locations or tokens.
- **On the phone:** the last rough location and the settings stay until the app is deleted.

## Lawful basis and rights

- **Basis:** consent. iOS asks before any location is shared, and the user can turn cards off in Settings or revoke location in iOS at any time.
- **Erasure:** turning cards off stops new cards. Deleting the app leaves the phone silent, and its server data is deleted within 30 days. There is no in-app "delete my data" yet (see open items).
- **Access and portability:** the only data is what is listed above; there is no profile to export.

## App Store privacy label

- **Data linked to you:** Coarse Location and Device ID, both for App Functionality.
- **Tracking:** none.
- `app.json` declares the same in its privacy manifest (`ios.privacyManifests`), plus the required-reason APIs React Native and Expo use: UserDefaults, file timestamps, system boot time and disk space.

## Open items before a public launch

- A public privacy policy page built from this file, linked in the App Store listing and in Settings.
- An in-app "Delete my data" that removes the phone from the server at once, instead of waiting 30 days.
- A note on the transfer to the United States for users in the EU, UK and Israel.
- Check that the widget extension needs no privacy manifest of its own once the iOS project is generated.
- The app key is embedded in the app, so it only keeps out casual callers. Rate limiting per device is not in place yet.
