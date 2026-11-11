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
2. **Regions**: fixed boxes, never built around a phone, so a feed never learns where users are. The main feed gets one global query if FlyItalyADSB confirms it (Phase 0); otherwise a fixed grid of large tiles, fetching only tiles that hold at least one watched phone. The adsb.lol backup uses the same fixed tiles. A pure function in `positions.ts`, unit-tested, including a test that no request depends on a phone's exact location.
3. **Sky snapshot**, also in `positions.ts`: one fetch per region per tick, main feed first and the backup on failure, never mixed. Positions stay in memory only, never on disk or in the repo (CC BY-SA share-alike). Tests: fallback, no merging, credit per region, a failed region keeps its last snapshot for one tick.
4. **`sky.ts`** reads the snapshot instead of calling a feed. The existing feed and sky tests are updated, not duplicated.
5. **Route directory** in `routes.ts`: daily download of the standing data (CC0), parsed into a map, swapped at once, kept on failure. Asked only for planes on a card. No paid fallback at launch: a miss shows "Route unknown". The server logs the daily hit rate. Tests with a small fixture.
6. **Switch over** in `index.ts`, and delete the Flightradar24, adsbdb and per-area code and their tests in the same change.

Checks: all tests green, the 10 Nov evening test unchanged, a replay of 5 Nov showing the same cards and stages as today.

Done when: deployed, and a day of logs shows cards as before. Then cancel Flightradar24.

## Phase 3 - efficiency

- **Routes only on a card** (from step 5 above): about 8 times fewer lookups over Ramat Gan.
- **Watch only phones that can get a card:** a phone with no start token and no `/sky` request in the last minute is skipped by the watcher. Test: such a phone causes no region fetch.
- **Saves only on change** (already done) stays covered by a test.
- **Remove the 100-phone cap**: keep a much higher cap as a safety net (say 20,000), and add a per-device rate limit on `/register` and `/sky`.
- **SQLite at scale:** WAL mode, and each tick's saves in one transaction.
- **Health numbers:** log tick duration, snapshot age per region and the route hit rate once a minute, so the 1,000-user decisions below are based on data.

Done when: a replay shows the same cards with fewer fetches and lookups, measured and noted in the PR.

## Phase 4 - compliance in the server

- **Delete my data:** `DELETE /me` removes the phone, its tokens and its card state at once, and ends any open card. Tests in `api.test.ts` and `privacy-and-security.test.ts`.
- **Credits in the API:** `/sky` returns the credit lines for the sources behind what the phone sees, so the app shows the right ones.
- **Logs:** keep the 14-day retention; add nothing new that names a location.
- **Record of processing** (GDPR Art. 30) and a short **DPIA note** (Art. 35): one short private file, outside the public repo.

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
- **Without location** (guideline 5.1.2): today a phone with location off sees only "Location is off". Add a short explanation and keep Settings reachable; a sky map for a chosen place is optional. Decide during this phase.
- **Privacy manifest:** Precise Location instead of Coarse.
- **Server URL:** the Frankfurt address.
- Already merged and waiting for this build: the new contrail icon.
- Then one EAS production build to TestFlight, checked on your phone, including the Liquid Glass icon.

## Phase 7 - documents and policies

- PRIVACY.md and the public policy page, everything in legal-compliance.md item 4 and its privacy section: recipients now only Google (Frankfurt) and Apple; feeds get no user data; routes come from a local copy (no lookups to anyone at launch); one lawful basis (consent or contract, decided with the lawyer question); transfer safeguard; rights and the complaint right (Berlin authority); deletion in the app; how changes are announced; phones that cannot get a card are not checked; the TDDDG line for the device ID; California and Israel lines.
- Impressum page (your name, home address, email), linked from the app and used as the App Store support URL.
- README: data sources, limits, and the new architecture section.
- LICENSE: carve out `server/src/flights/airlines.json` as ODbL (OpenFlights), as the compliance doc asks.
- Save dated PDFs of the FlyItalyADSB and VRS terms, to show Apple on request (guideline 5.2.2).

## Phase 8 - App Store submission (founder, guided)

- App Store Connect privacy label: Precise Location and Device ID, linked, for App Functionality; no tracking.
- EU Digital Services Act: non-trader while free.
- Age rating questionnaire; review notes and a short screen recording of a real pass explaining "Always" location and Live Activities; a test location under a flight path for the reviewer (the `DEMO_DEVICE` setting can move the reviewer's phone there).
- Support URL (Impressum page) and privacy policy URL.
- Submit.

## After launch: when to scale

- **About 1,000 users:** e2-medium if tick duration or CPU says so; ask ADS-B Exchange and OpenSky for licence quotes; decide on a paid route fallback (Airlabs, after its email) from the logged hit rate.
- **About 10,000 users:** the few-hundred-dollar budget ends here: a contracted feed with the other as backup (about $1,000 a month or more), e2-standard-2.
- **About 100,000 users:** one server per region (EU, Americas, Asia).

## Does the plan cover everything?

Each item in [legal-compliance.md](legal-compliance.md):

- 1 FlyItalyADSB credit and share-alike: Phase 2 (credits, memory only, never merged), Phase 6 (credits screen), Phase 0 (email).
- 2 Route fallback: Phase 2 (none at launch), Phase 0 (Airlabs email), after launch (decide from hit rate).
- 3 Precise Location label: Phase 6 (manifest), Phase 8 (App Store Connect).
- 4 Privacy policy and in-app link: Phase 7 (text), Phase 6 (link).
- 5 Deletion: Phase 4 (endpoint), Phase 6 (button).
- 6 Impressum: Phase 7, Phase 8 (support URL).
- 7 Licence notices and credits: Phase 4 (credits in the API), Phase 6 (screen), Phase 7 (LICENSE carve-out).
- 8 Disclaimer: Phase 6, App Store description.
- 9 Record of processing: Phase 4.
- 10 App Store Connect declarations and review notes: Phase 8.
- 11 Switch-over before submission: Phase 2 (old code and keys deleted, FR24 cancelled), and Phase 8 comes after it.
- Privacy section (feeds see no user-derived area, fewer phones watched): Phase 2 (fixed regions), Phase 3 (skip phones).
- Nice to have: EU region (Phase 5), DPIA note (Phase 4), adsb.lol key and VRS provenance (risks below), EASA confirmation and trademarks (before monetizing), without location (Phase 6).
- Before monetizing: deliberately out of scope.

Each recommendation in [research/scalability.md](research/scalability.md):

- Shared snapshot instead of per-cell calls: Phase 2.
- FlyItalyADSB Pro with adsb.lol fallback: Phase 1 (test), Phase 2 (build).
- VRS routes with the hit rate logged: Phase 2, Phase 3.
- Drop adsb.fi, adsbdb and FR24: Phase 2.
- Remove the 100 cap, save only on change, one transaction per tick: Phase 3.
- e2-small, Frankfurt: Phase 5.
- Attribution lines: Phase 6.
- Monitoring of tick duration and snapshot age: Phase 3.
- Steps at 1,000, 10,000 and 100,000 users: "After launch" above.
- Live Activity budgets: already handled (busy-sky linger, 10 Nov fix).

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
