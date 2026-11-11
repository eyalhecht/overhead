# Overhead - privacy

What Overhead collects, why, who it reaches, and how long it is kept. This page is the basis for the App Store privacy label and the public privacy policy. Reviewed on 5 November 2026 against the GDPR checklist, and updated on 11 November 2026 for the launch setup in [docs/legal-compliance.md](docs/legal-compliance.md).

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

- **The Overhead server** (Google Cloud, `europe-west3`, Frankfurt, Germany) keeps the data above in a SQLite file readable only by the server process, on a disk Google encrypts at rest. Traffic arrives over HTTPS (Caddy) and is checked against an app key and a per-device rate limit. Google is a processor under its data processing addendum.
- **Flight position feeds** (FlyItalyADSB, with adsb.lol as backup) receive no user data: the server asks for fixed 2-degree map tiles and matches planes to phones itself.
- **Routes** come from a copy of the Virtual Radar Server route list kept in memory on the server, so no route provider receives anything.
- **IP addresses** reach the server with every request, as with any internet service. Neither the app server nor Caddy logs or stores them.
- **Apple Push Notification service** receives push tokens and the card's flight details.
- **Transfers:** Google and Apple may process data outside the EU under the EU-US Data Privacy Framework and standard contractual clauses.

## How long it is kept

- **User store:** a phone that hasn't checked in for 30 days is deleted automatically.
- **Ended card tokens:** only the last 20 per phone are remembered.
- **Server logs:** 14 days (journald). Logs name a phone by the first 8 characters of its device ID, plus flights and card events. They never contain locations or tokens.
- **On the phone:** the last rough location and the settings stay until Delete my data or the app is deleted.
- **Phones that cannot get a card** (no start token, no card open, app closed) are not checked against flights; their row still goes after 30 days.

## Lawful basis and rights

- **Basis:** performance of the service the user asks for (GDPR Art. 6(1)(b)); iOS still asks before any location is shared, and the user can turn cards off or revoke location at any time. Consent (Art. 6(1)(a)) is the alternative; which one fits is a question for a lawyer.
- **Erasure:** Settings > Delete my data (`DELETE /me`) ends any open card and removes the phone's row at once; the app then clears its own storage. Deleting the app also works, within 30 days.
- **Access and portability:** the only data is what is listed above; there is no profile to export.

## App Store privacy label

- **Data linked to you:** Precise Location (about 100 m counts as precise in Apple's definition) and Device ID, both for App Functionality.
- **Tracking:** none.
- `app.json` declares the same in its privacy manifest (`ios.privacyManifests`), plus the required-reason APIs React Native and Expo use: UserDefaults, file timestamps, system boot time and disk space.

## Open items before a public launch

- Publish the updated policy and the legal notice (branch `launch` of the `overhead-privacy` repository) when the launch setup goes live.
- Record of processing (GDPR Art. 30) and a short DPIA note, kept privately.
- Check that the widget extension needs no privacy manifest of its own once the iOS project is generated.
- The app key is embedded in the app, so it only keeps out casual callers; per-device rate limits are in place, a per-install secret is the next step.
