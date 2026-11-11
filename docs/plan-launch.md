# Launch plan: compliance, scaling and efficiency

One plan for the three pieces of work before the App Store submission, built from [legal-compliance.md](legal-compliance.md), [research/scalability.md](research/scalability.md) and the efficiency review (one snapshot per region, routes only for planes on a card, no watching of phones that cannot get a card). They are designed together because most changes serve more than one goal: replacing the data providers fixes the licence blockers and the scaling limits at once, and the shared snapshot saves calls and keeps user locations away from the feeds.

Principles for the code:

- New behaviour gets its own module with one job and a small interface, named after a [CONTEXT.md](../CONTEXT.md) term. No patches bolted onto old modules.
- Code that the new design replaces is deleted in the same change, with its tests and docs. Nothing dead is left behind.
- Cards stay the same: every step is checked by the real-world tests and by replays of real days (5 Nov over Ramat Gan, Leumi Park and Hounslow, 10 Nov evening).
- The live app keeps working at every step. One app build at the end.

## Target shape

How data will flow:

1. **Feeds** fetch raw aircraft positions for a box of sky. Two adapters behind one interface: FlyItalyADSB (main, paid) and adsb.lol (backup). Each knows its own URL, key, rate limit and licence credit.
2. **Sky snapshot** keeps the latest positions for every region where at least one phone is watched, refreshed once per tick. It takes a region from one feed at a time and never merges the two (their licences are incompatible), and it records which feed each region came from so the app can show the right credit.
3. **Passes** (today `sky.ts`) turn the snapshot into what one phone sees: planes near it, their stage (close pass or heard), sorted.
4. **Route directory** answers "where is this flight going" from the Virtual Radar Server standing data, downloaded once a day and held in memory. It is asked only when a plane goes on a card. Unknown callsigns return no route, as today.
5. **Policy** (unchanged, pure) decides start, update and end. **Watcher** runs the tick: refresh the snapshot once, then step each phone that can get a card.

Where it lives: the existing `server/src/flights/` folder, by rewriting three files in place. No new folders and no new files.

- `positions.ts` - rewritten: the two feed adapters (today's `FEEDS` list plus FlyItalyADSB), the shared readsb parser, the regions to fetch and the sky snapshot. Everything about where planes are stays in one file.
- `routes.ts` - rewritten: the route directory (daily download of the standing data, lookups from memory), replacing the Flightradar24 and adsbdb code.
- `sky.ts` - simplified: reads the snapshot instead of calling a feed, so it becomes synchronous.
- Everything else (`geometry.ts`, `noise.ts`, `airlines.ts`, `aircraft.ts`, `activity/`, `users.ts`, `api/`, `push/`) stays where it is, changed only as the phases below say.

Removed: per-area polling and its rate limiter, the Flightradar24 and adsbdb lookups, `FR24_TOKEN`, the adsb.fi URL, and every test and doc line about them.

New glossary terms in CONTEXT.md: **Feed**, **Region**, **Sky snapshot**, **Route directory**, **Credit** (the licence line a source requires).

## Phase 0 - founder actions (start now, in parallel)

- **Emails** (drafted by Claude, sent from eyalhe3@gmail.com):
  - FlyItalyADSB: what "for more than 25 aircraft, write to us" means for a region query, and confirm the Pro plan covers a free worldwide app.
  - Airlabs: confirm commercial display of route data to app users, for a later fallback.
- **FlyItalyADSB trial key** for the coverage test in Phase 1 (sign-up by you; paid plan only after the test).
- **Impressum address**: your home address, as decided.
- Nothing is cancelled yet. Flightradar24 stays until Phase 3 is live.

## Phase 1 - coverage test (no change to the live server)

Goal: decide the main feed with data, not hope.

- A small script on the VM records FlyItalyADSB and adsb.lol side by side for 48 hours over three regions: Tel Aviv, Berlin and one busy US city.
- Compare per region: aircraft seen, gaps, update rate, and how many of the planes that would have got a card each feed saw.
- **Decision for you:** FlyItalyADSB as main if it sees at least about 95 percent of the card planes adsb.lol sees; otherwise adsb.lol stays main and we look at ADS-B Exchange.
- Also measure what share of card flights the standing data has a route for, to decide whether a paid route fallback is needed at launch.

Done when: a short results note in `docs/research/` and your decision.

## Phase 2 - the new data path (behaviour unchanged)

Built in small, reviewed steps, each with its own tests:

1. **Feeds** in `positions.ts`: FlyItalyADSB joins the existing feed list, adsb.fi leaves it, and each feed carries the credit it requires (FlyItalyADSB: CC BY-SA 4.0 with link; adsb.lol: ODbL with link). Tests with captured responses, as today.
2. **Regions**: from the watched phones' locations, the boxes to fetch each tick, merged where they overlap, sized to what the main feed allows (from the Phase 0 answer). A pure function in `positions.ts`, unit-tested.
3. **Sky snapshot**, also in `positions.ts`: one fetch per region per tick, main feed first and the backup on failure, never mixed. Positions stay in memory only, never on disk or in the repo (CC BY-SA share-alike). Tests: fallback, no merging, credit per region, a failed region keeps its last snapshot for one tick.
4. **`sky.ts`** reads the snapshot instead of calling a feed. The existing feed and sky tests are updated, not duplicated.
5. **Route directory** in `routes.ts`: daily download of the standing data (CC0), parsed into a map, swapped at once, kept on failure. Asked only for planes on a card. Tests with a small fixture.
6. **Switch over** in `index.ts`, and delete the Flightradar24, adsbdb and per-area code and their tests in the same change.

Checks: all tests green, the 10 Nov evening test unchanged, a replay of 5 Nov showing the same cards and stages as today.

Done when: deployed, and a day of logs shows cards as before. Then cancel Flightradar24.

## Phase 3 - efficiency

- **Routes only on a card** (from step 5 above): about 8 times fewer lookups over Ramat Gan.
- **Watch only phones that can get a card:** a phone with no start token and no `/sky` request in the last minute is skipped by the watcher. Test: such a phone causes no region fetch.
- **Saves only on change** (already done) stays covered by a test.
- **Remove the 100-phone cap**; replace it with a per-device rate limit on `/register` and `/sky` (needed once the app is public, see legal-compliance.md).

Done when: a replay shows the same cards with fewer fetches and lookups, measured and noted in the PR.

## Phase 4 - compliance in the server

- **Delete my data:** `DELETE /me` removes the phone, its tokens and its card state at once, and ends any open card. Tests in `api.test.ts` and `privacy-and-security.test.ts`.
- **Credits in the API:** `/sky` returns the credit lines for the sources behind what the phone sees, so the app shows the right ones.
- **Logs:** keep the 14-day retention; add nothing new that names a location.
- **Record of processing:** `docs/record-of-processing.md` (GDPR Art. 30), short.

## Phase 5 - move the server to Frankfurt

1. New VM in `europe-west3` (Frankfurt), e2-small, with a reserved static IP, so its `sslip.io` address never changes.
2. `deploy.sh` takes the target VM as a setting instead of a fixed name.
3. Deploy there, copy the SQLite database and secrets, check `/health`.
4. Turn the US VM into a forwarder (Caddy `reverse_proxy` to Frankfurt), so today's app keeps working with no change for users.
5. After everyone has the new build (Phase 6), stop the US VM and release its address.

Done when: Frankfurt serves all phones, logs clean for a day.

## Phase 6 - app changes, then one build

- **Settings, new section "About":** privacy policy link, "Delete my data" (calls `DELETE /me`, ends Live Activities, clears local data, back to the welcome screen), and a Credits screen with the required licence lines (FlyItalyADSB, adsb.lol, OpenFlights, OurAirports, VRS standing data, EASA).
- **Disclaimer** on the Credits screen and in the App Store description: not for navigation or safety; loudness is an estimate.
- **Privacy manifest:** Precise Location instead of Coarse.
- **Server URL:** the Frankfurt address.
- Already merged and waiting for this build: the new contrail icon.
- Then one EAS production build to TestFlight, checked on your phone, including the Liquid Glass icon.

## Phase 7 - documents and policies

- PRIVACY.md and the public policy page: recipients now only Google (EU region) and Apple; feeds get no user data; routes are looked up by callsign only; lawful basis; the Berlin data protection authority; deletion in the app; California and Israel lines.
- Impressum page (your name, home address, email), linked from the app and used as the App Store support URL.
- README: data sources, limits, and the new architecture section.
- A licence note for `server/src/flights/airlines.json` in the README, so the airline data keeps its ODbL licence in the repo.

## Phase 8 - App Store submission (founder, guided)

- App Store Connect privacy label: Precise Location and Device ID, linked, for App Functionality; no tracking.
- EU Digital Services Act: non-trader while free.
- Age rating questionnaire; review notes and a short screen recording explaining "Always" location and Live Activities.
- Support URL (Impressum page) and privacy policy URL.
- Submit.

## Not in this plan

- Monetising (trader status, Gewerbe, FlightAware Premium or other paid terms, residence permit check): later, its own plan.
- A domain name (decided against).
- Learned flight paths and the other AI ideas.

## Risks

- FlyItalyADSB coverage outside Europe is unproven: Phase 1 decides before any code depends on it.
- The standing data misses some callsigns (private, cargo, charters): those cards show "Route unknown", as today, unless Airlabs is added.
- adsb.lol may start requiring a feeder key: it is the backup, so the impact is reduced reliability, not an outage.
- Moving the server: the forwarder keeps old builds working; the database copy is the one step to do carefully (copy after stopping the old service, check counts).

Not legal advice: the compliance steps follow legal-compliance.md, which ends with questions for a lawyer.
