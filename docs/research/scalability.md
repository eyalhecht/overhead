# Scalability: flight data, routes and server for a worldwide launch

Researched 2026-11-10 from provider pricing pages, API docs and terms, Apple developer docs and Google Cloud pricing. Every claim has its URL next to it. "Inference" marks my own reasoning or arithmetic. Nothing in the codebase was changed.

## Summary

1. The cost of flight data depends on how the server asks, not on how many users there are. Today it asks once per 0.1 degree cell per 5 s tick (`server/src/flights/positions.ts`). Paid per-call or per-plane APIs (Flightradar24, FlightAware) cost thousands of dollars a month for a single city at that cadence. The fix is one shared snapshot (a box per metro, a region, or the whole world) every 5 s, filtered on the server for each phone. Then data cost is flat.
2. Flightradar24 charges 6 to 8 credits per plane returned, so one busy metro polled every 5 s costs about $10,000 a month. Using FR24 for both positions and routes would fix the "supplement or backfill" clause, but it is not affordable.
3. The cheapest legally clean position sources for a public app: FlyItalyADSB (commercial use allowed on every plan, a global query on Pro for EUR 49 a month) and adsb.lol (ODbL, free, attribution). adsb.fi and OpenSky both need a written licence for this use.
4. Routes: the Virtual Radar Server standing data is CC0 (free, commercial use, updated daily), so most lookups can be a local table. Pay only for misses. The current fallback, adsbdb, has route data that "may not be copied, published, or incorporated" without permission.
5. Server: one e2-micro is enough for a few hundred users once polling is shared. The first things to break are the feed rate limit (about 5 areas per tick), the 100-phone cap, and one SQLite write per user per tick. An e2-small or e2-medium covers 1,000 to 10,000 users. At 100,000, split by region.
6. Budget: about $70 to $180 a month at launch, $250 to $350 at 1,000 users, and $600 to $800 at 10,000 users without a second paid feed. "A few hundred dollars" stops being enough at about 10,000 users, or sooner if you want a contracted, SLA-backed feed (ADS-B Exchange, OpenSky, Spire and Cirium all price by quote).

## How the cost model works

Inference throughout, based on the code.

- Today each phone's area is a 0.1 degree cell (about 11 x 8 km at mid latitudes), queried with a 14.5 nm radius (10 nm + 4.5 nm margin), one call per occupied cell per 5 s tick. Each feed gets at most 1 request a second, so about 5 cells fit in a tick (`README.md` Limits).
- The watcher checks every registered phone on every tick, except during quiet hours (`server/src/activity/watcher.ts`). So an occupied cell is polled about 15 hours a day: 10,800 calls a day, about 324,000 a month.
- Users cluster in cities, but in a big city one cell per user is close to the truth. Assumed occupied cells at once: 100 users about 50, 1,000 about 400, 10,000 about 2,500, 100,000 about 10,000.
- Metro boxes instead: one call per metro (about 60 x 60 nm) per 5 s. Assumed metros with users: 100 users about 15, 1,000 about 80, 10,000 about 300, 100,000 about 1,000. That grows much more slowly than users.
- One global (or 3 to 5 continental) snapshot every 5 s: 518,400 calls a month at most, the same for 10 users or 100,000. Only the snapshot size matters (about 10,000 to 15,000 airborne aircraft).
- A busy metro box holds about 15 to 40 aircraft. A 14.5 nm cell holds about 2 to 10.

## 1. Position providers

### adsb.fi
- Free. "Rate limited to 1 request per second". Radius queries up to 250 NM. https://github.com/adsbfi/opendata
- Licence: "for personal, non-commercial use only". Same URL. A public App Store app is not personal use, even if free, so it fails before launch (already in the compliance review).
- Cost: $0, but legally out. At 1 request a second it covers about 5 cells, or 5 metro boxes, per tick.

### adsb.lol
- Free, no key needed today. Data is "ODbL 1.0". Re-api (bulk/box queries) is for feeders only. https://www.adsb.lol/docs/open-data/api
- Rate limits "are dynamic based on the environment load". A key you get by feeding is planned. https://github.com/adsblol/api
- Licence: ODbL allows commercial use with attribution. Cards are "produced works", so the app needs a credit line. Inference: no SLA, so it is a good fallback but a risky only source.
- Cost: $0 at every scale while it lasts. Inference: polling one box per metro at about 1 request a second covers 5 metros per tick, which is enough for launch only.

### FlyItalyADSB
- Plans: Free EUR 0 (30 requests/min, 300,000/month, 500 km radius), Starter EUR 9 (60/min, 1M), Pro EUR 49 (300/min, 10M, global), Fleet EUR 149 (300/min, 10M, global). Prices exclude VAT. https://flyitalyadsb.com/data/api/
- Licence: "Commercial use is allowed on every plan within its limits, inside apps and devices you sell too", with attribution. Same URL.
- Coverage: about 3,200 receivers, "densest in North America and Europe". Positions refresh every 0.5 s. Same URL. Their comparison page says adsb.fi and airplanes.live cap radius at 250 nm, and that ADS-B Exchange sells global queries only on enterprise plans. https://flyitalyadsb.com/en/data/comparison/
- Cost: a global snapshot every 5 s is 518,400 calls a month, inside Pro's 10M cap, so EUR 49 + VAT (about $57 to $70) at every scale. Inference: the open questions are coverage per city compared with adsb.lol, and whether one small operator can carry 10,000 users. Both need a test before relying on it.

### ADS-B Exchange
- Community API: "built for non-commercial use". RapidAPI personal plan: $10/month, "10,000 requests". Commercial use, higher volume and gRPC streaming are on enterprise products, priced on request. https://www.adsbexchange.com/community/developer-hub/
- Inference: 10,000 requests is one cell for 14 hours, so only enterprise fits. It is the largest community network, so it is the obvious contracted feed at 10,000+ users.

### OpenSky Network
- Credits: anonymous 400 a day, registered 4,000 a day, feeders 8,000 a day, licensed 14,400 an hour. `/states/all` costs 1 credit up to 25 square degrees and 4 for global. Resolution is 5 s when signed in. No aircraft type (only a category) and no routes ("Routes, ADS-C and MLAT data are currently not available through the REST API"). https://openskynetwork.github.io/opensky-api/rest.html
- Licence: free use only for "non-profit research and non-profit education". Use "in any operational capacity, including ... integration into a live product" needs a written licence. https://opensky-network.org/about/terms-of-use
- Inference: a licence gives a global snapshot every second (14,400 / 4 credits an hour), which fits the shared-snapshot model. The price is by quote. Aircraft type would come from a separate database.

### Flightradar24 API
- Plans: Explorer $9 (30,000 credits, 10 requests/min, 20 items per response), Essential $90 (333,000, 30/min, 300 items), Advanced $900 (4,050,000, 200/min, unlimited items). All are marked commercial. Credits are doubled until 31 Dec 2026. https://fr24api.flightradar24.com/subscriptions-and-credits
- Cost per call: live positions full 8 credits "per returned flight", light 6. An empty response is 1 credit. Credit price is $0.0003 at the base rate, falling to about $0.00025 in bulk. https://fr24api.flightradar24.com/docs/credit-overview
- The FAQ confirms it: "The API charges per returned entity, not per call", for example 60 credits for 10 flights. Position data updates "approximately every 3 seconds per aircraft". https://fr24api.flightradar24.com/docs/faq
- Positions full include origin and destination, so FR24 alone would need no separate route lookup. Same URL.
- Terms: no use of the API "to supplement or backfill any other near-time or real-time flight data sourced from an alternative data provider". Also no "Developing competing services or products", and no storage past the documented limit. https://www.flightradar24.com/terms-of-service (section 6.3). Storage limit: "should not be stored for more than 30 days". https://fr24api.flightradar24.com/docs/storage-rules
- Inference: a metro box with 15 planes at 6 credits, every 5 s, is about 1.55M credits a day. That is about $10,000 a month per metro at Advanced pricing. Even one 14.5 nm cell with 3 planes is about $1,900 a month. Explorer's 10 requests a minute cannot keep up with a 5 s tick at all.
- So using FR24 for both positions and routes would fix the supplement clause, but it costs far too much at 5 s cadence. The "competing services" clause stays a risk for a flight app either way.

### FlightAware AeroAPI
- Personal: "personal or academic purposes only". Standard: $100/month minimum, "business or business-to-consumer purposes", 5 result sets a second. Premium: $1,000 minimum. https://www.flightaware.com/commercial/aeroapi/
- Prices: `/flights/search` and positions search $0.050 per result set, `/flights/{ident}` $0.005. A result set is 15 records. Same URL.
- Inference: a metro box every 5 s is about $26,000 a month. Unusable for positions. Their streaming product (Firehose) is enterprise only. It is fine for route lookups (section 2).

### Airlabs, aviationstack, Aviation Edge
- Airlabs: 10k requests $19, 100k $99, 1M $499. Supports a `bbox` query and returns dep/arr, type and vertical speed. Its site lists about 7,300 tracked flights and, in the summary I fetched, delays of about 5 to 10 minutes. https://airlabs.co/ and https://airlabs.co/docs/flights. I could not reach its terms page to check commercial display rights.
- aviationstack: $49.99 for 10,000 requests up to $499.99 for 250,000. Commercial use from Basic up. Data "delayed by as little as 30-60 seconds". https://aviationstack.com/pricing
- Aviation Edge: $7 to $39 introductory price for the first month, then $299 to $1,499 regular. Flight tracker updates "within short intervals of just a few minutes". https://aviation-edge.com/premium-api/
- Inference: all three are too slow for a 2-minute pass (Overhead needs data seconds old) and cover fewer flights. Fine for routes, not for positions.

### Cirium, Spire, Aireon
- Cirium: evaluation, commercial and contract plans. Premium APIs need a contract, priced by quote. https://developer.cirium.com/apis/cirium-sky-api/subscriptions
- Spire Aviation: Essential, Standard and Premium data plans, quote only, through sales. https://spire.com/aviation/aviation-data-plans/
- Aireon sells space-based ADS-B to air navigation service providers. Inference: none of these is sized or priced for a free consumer app. Revisit only with revenue.

### Airplanes.live
- Free API limited to non-commercial use at 1 request a second, and reported closed to non-feeders in 2026. https://github.com/airplanes-live/api-archive and https://forums.x-plane.org/forums/topic/350530-airplaneslive-inop-for-non-feeders-with-misleading-error-api-key-invalid/. Not an option.

### Monthly position cost, by approach

Inference. Users spread worldwide, 15 active hours a day, per-cell or per-metro polling every 5 s, or a global snapshot.

- adsb.lol, metro boxes: $0 at every scale, but about 5 metros per tick at 1 request a second, so only launch fits.
- FlyItalyADSB Pro, global snapshot: about $60 to $70 at 100, 1,000, 10,000 and 100,000 users alike. Coverage and capacity are untested.
- OpenSky licensed, global snapshot: flat, price by quote.
- ADS-B Exchange enterprise: flat, price by quote.
- Flightradar24, metro boxes (15 planes): about $150,000 at 100 users (15 metros), $800,000 at 1,000, $3M at 10,000. Out.
- FlightAware, metro boxes: about $390,000 at 100 users. Out.

## 2. Route data (origin and destination by callsign)

Cost depends on distinct flights near users per day, because `server/src/flights/routes.ts` caches each callsign for the UTC day and only planes in a pass stage are looked up (`server/src/flights/sky.ts`). Assumed distinct callsigns a day (inference): 100 users about 2,000, 1,000 about 10,000, 10,000 about 30,000, and 100,000 about 70,000 (near the worldwide daily total).

- VRS standing data: CSV dumps of routes, airlines, airports and aircraft, licensed CC0 1.0 and updated daily (last commit 2026-11-10). https://github.com/vradarserver/standing-data. Inference: load it into memory, refresh nightly. $0 at every scale. Community data, so expect some stale or missing callsigns. Measure the hit rate in each launch city.
- adsbdb: free and MIT-licensed code, but its route data comes from David Taylor and Jim Mason and "may not be copied, published, or incorporated into other databases without the explicit permission". https://github.com/mrjackwills/adsbdb. The current fallback in `routes.ts` publishes it on cards, so it needs that permission or must go.
- hexdb: `/api/v2/routes/{callsign}`. Credits the same Jim Mason source and states no terms. https://hexdb.io/. Avoid for the same reason.
- OpenSky: no route endpoint, and flights are only available the next day ("updated by a batch process at night"). https://openskynetwork.github.io/opensky-api/rest.html
- Flightradar24 flight summary: light 1 credit per live flight, full 2 (3 for flights up to 30 days old). Empty responses 1 credit. https://fr24api.flightradar24.com/docs/credit-overview. The current code calls `full` with a 20 h lookback, so a lookup costs about 2 to 6 credits. At the volumes above, about $20, $90, $270 and $600 a month. But it is legal only if positions also come from FR24 (section 1).
- FlightAware `/flights/{ident}`: $0.005 per lookup, on Standard ($100/month minimum, B2C allowed). https://www.flightaware.com/commercial/aeroapi/. At the volumes above: about $300, $1,500, $4,500 and $10,500 a month. As a fallback for the 10 to 20 percent that VRS misses (inference): about $100 (the minimum), $150 to $300, $450 to $900, and $1,000 to $2,000 a month.
- Airlabs: $19 per 10,000 or $99 per 100,000 requests. Cheaper than FlightAware for misses if its terms allow display (unchecked). https://airlabs.co/
- aviationstack: $49.99 per 10,000 requests, commercial. https://aviationstack.com/pricing
- Caching: FR24 allows up to 30 days. https://fr24api.flightradar24.com/docs/storage-rules. The current per-day cache is inside that. For FlightAware and Airlabs I did not verify the caching terms; check before relying on a daily cache.

## 3. Server and architecture

### What an e2-micro is
- e2-micro "sustains 2 vCPUs, each for 12.5% of CPU time totaling 25%", and bursts for about 30 s at full use. e2-small sustains 50 percent and e2-medium 100 percent. https://docs.cloud.google.com/compute/docs/general-purpose-machines
- Prices, on demand, per month (730 h): Iowa us-central1 - e2-micro $6.11, e2-small $12.23, e2-medium $24.46, e2-standard-2 $48.92, e2-standard-4 $97.84. Frankfurt europe-west3 - e2-micro $7.88, e2-small $15.76, e2-medium $31.51, e2-standard-2 $63.02. https://cloud.google.com/products/compute/pricing/general-purpose
- Free tier: one e2-micro a month in us-west1, us-central1 or us-east1, 30 GB standard disk, and 1 GB of outbound transfer. https://docs.cloud.google.com/free/docs/free-cloud-features
- Egress to users is $0.12 per GiB after the first GiB. Ingress (feed downloads) is free. https://cloud.google.com/vpc/network-pricing

### Where it breaks first (today's code)
Inference from the code.

1. Feed rate limit: about 5 areas per tick (1 request a second per feed, 5 s tick). Users in a sixth area get stale or late data. This breaks at roughly 20 to 50 real users.
2. The 100-phone cap in `server/src/users.ts`. A hard limit, set on purpose for the beta.
3. Tick length: each phone awaits its area fetch, 8 lanes at a time. Once areas queue behind the rate limit, a tick takes longer than 5 s and cards arrive late.
4. SQLite: `users.save(user)` runs once per user per tick, outside a transaction. That is 200 writes a second at 1,000 users and 2,000 at 10,000. Each autocommit write waits on a disk sync, and a standard persistent disk will not keep up at 10,000.
5. CPU: zod parsing of every aircraft, plus the noise model for each user-plane pair, on 0.25 of a vCPU. Fine at hundreds of users. A global snapshot (about 10,000 aircraft, several MB of JSON every 5 s) needs an e2-small or bigger.
6. APNs is not the bottleneck. Estimated load (inference): 10,000 users, 3 passes an hour, about 6 updates per pass plus a start, about 60 pushes a second. 100,000 users, about 600 a second. Apple: "When sending many remote notifications, you can establish multiple connections ... to improve performance", and "APNs allows multiple concurrent streams for each connection, but don't assume a specific number". https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns
7. Memory (1 GB) is fine: a user record is a few KB, so 100,000 users is a few hundred MB at most.

### Live Activity limits at scale
- Budgets are per device, so they do not tighten with more users. Priority 5 updates "don't count toward the budget". Push-to-start has a small fixed budget, about 10 "in a short time frame". https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications#Determine-the-update-frequency and https://developer.apple.com/forums/thread/799505 (details in `live-activities-busy-sky.md`).
- APNs publishes no per-provider rate limit. "If you stay within the 'budget' on the device for each user, you will not have any rate limitation issues". https://developer.apple.com/forums/thread/747624
- Broadcast channels (up to 10,000 per environment) send one push to many phones. https://developer.apple.com/documentation/usernotifications/sending-channel-management-requests-to-apns. Inference: they do not fit, because each phone's card has its own distance and direction.

### Smallest changes per stage
Inference.

- Before launch: replace per-cell calls with a shared snapshot (a metro box, or a global/continental query) refreshed every 5 s and held in memory. Each phone filters it locally. The `PositionSource` interface stays the same, and `aircraftNear` reads from the snapshot instead of fetching. Remove the 100 cap (keep a higher cap as a safety net), save a user only when their state changed, and write each tick in one transaction (SQLite in WAL mode does thousands of writes a second that way).
- At 1,000: e2-small or e2-medium. Keep SQLite. Consider moving to europe-west3. GDPR does not require an EU region (inference: US hosting is legal with Google's transfer terms), but most of the first users and the European feeds are in the EU, so it cuts latency and transfer questions. It costs about 30 percent more than Iowa and loses the free tier.
- At 10,000: e2-standard-2. Still one process and SQLite. Add a second position source so one outage does not blank every card. Add monitoring of tick duration and snapshot age.
- At 100,000: one VM per region (EU, Americas, Asia), each with its own snapshot, SQLite and APNs connections, with phones assigned to the nearest region. Postgres (Cloud SQL) only if the regions must share state. Several APNs connections per VM.

## 4. Cost per stage

Recommended stack (section 5): FlyItalyADSB Pro positions, adsb.lol as fallback, VRS routes with a paid fallback for misses. Apple Developer Program $99 a year (about $8 a month). Inference for all totals.

- Launch (100 users): data $60 to $70, routes $0 to $100, server $0 (free e2-micro) to $16 (e2-small Frankfurt), other $8. Total about $70 to $190 a month, about $0.70 to $1.90 per user.
- 1,000 users: data $60 to $70, routes $150 to $300, server $16 to $32, other $8. Total about $250 to $400 a month, about $0.25 to $0.40 per user.
- 10,000 users: data $60 to $70 (plus a quote-priced second feed if wanted), routes $450 to $900, server $63, other $10. Total about $600 to $1,050 a month without the second feed, about $0.06 to $0.10 per user.
- 100,000 users: data a contracted feed, probably four figures a month (quote, unverified), routes $1,000 to $2,000, server 3 regional VMs about $200, other $20. Total about $2,500 to $5,000 a month, about $0.03 to $0.05 per user.

On "is $200 a month for about 200 users reasonable": inference, yes for a launch. At this size, minimum fees dominate, so cost per user looks high ($1). What matters is that the total stays nearly flat up to a few thousand users. With a shared snapshot it does. With per-cell paid calls it would grow with every new area.

## 5. Recommendation

Inference, based on the sources above.

Combination:
- Positions: FlyItalyADSB Pro (EUR 49 + VAT a month). Commercial use in apps is allowed, it supports global queries, and 300 requests a minute is plenty for one global or a few continental snapshots every 5 s.
- Fallback: adsb.lol, metro boxes only, while the main feed is down. ODbL attribution in the app.
- Routes: VRS standing data (CC0) in memory. Misses go to Airlabs if its terms allow display, otherwise FlightAware AeroAPI Standard.
- Server: one VM, e2-small, with SQLite kept as is.
- Drop adsb.fi (non-commercial), adsbdb (route data needs permission) and the FR24 API (supplement clause, and too expensive for positions).

Before launch:
- Run FlyItalyADSB and adsb.lol side by side for a week in Tel Aviv, Berlin and one US city. Compare aircraft counts and the age of positions against what the beta sees today.
- Implement the shared snapshot, remove the per-cell fetch and the 100 cap, and save users only when changed.
- Swap the route source to VRS plus a paid fallback, and log the hit rate.
- Add the attribution lines (adsb.lol ODbL, FlyItalyADSB) to the app's About screen.
- Update the compliance review: these changes close the FR24 supplement issue and the adsb.fi non-commercial issue, and add a new adsbdb finding.

At 1,000 users: move to e2-small or e2-medium (Frankfurt if most users are in Europe), watch tick duration and snapshot age, and ask ADS-B Exchange and OpenSky for licence quotes so the next step has a price.

At 10,000 users: this is where a few hundred dollars stops being enough. Route fallback alone reaches $450 to $900, and a single EUR 49 feed from one small operator is too thin for that many people. Sign a contracted feed (ADS-B Exchange enterprise or an OpenSky licence) with the other kept as fallback, and budget about $1,000 a month or more.

Open risks:
- FlyItalyADSB coverage (3,200 receivers) may be thin outside Europe and North America. If it is, the plan moves to adsb.lol plus a quote-priced feed sooner.
- adsb.lol has no SLA and may require a feeder key.
- The VRS hit rate is unmeasured, and route costs scale with misses.
- User clustering and flights-per-day numbers are assumptions. Log real occupied areas and distinct callsigns in the beta to replace them.

## Sources

Position data
- https://github.com/adsbfi/opendata
- https://www.adsb.lol/docs/open-data/api
- https://github.com/adsblol/api
- https://flyitalyadsb.com/data/api/
- https://flyitalyadsb.com/en/data/comparison/
- https://www.adsbexchange.com/community/developer-hub/
- https://openskynetwork.github.io/opensky-api/rest.html
- https://opensky-network.org/about/terms-of-use
- https://fr24api.flightradar24.com/subscriptions-and-credits
- https://fr24api.flightradar24.com/docs/credit-overview
- https://fr24api.flightradar24.com/docs/faq
- https://fr24api.flightradar24.com/docs/storage-rules
- https://www.flightradar24.com/terms-of-service
- https://www.flightaware.com/commercial/aeroapi/
- https://airlabs.co/ and https://airlabs.co/docs/flights
- https://aviationstack.com/pricing
- https://aviation-edge.com/premium-api/
- https://developer.cirium.com/apis/cirium-sky-api/subscriptions
- https://spire.com/aviation/aviation-data-plans/
- https://github.com/airplanes-live/api-archive

Routes
- https://github.com/vradarserver/standing-data
- https://github.com/mrjackwills/adsbdb
- https://hexdb.io/

Server and Apple
- https://docs.cloud.google.com/compute/docs/general-purpose-machines
- https://cloud.google.com/products/compute/pricing/general-purpose
- https://docs.cloud.google.com/free/docs/free-cloud-features
- https://cloud.google.com/vpc/network-pricing
- https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns
- https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications
- https://developer.apple.com/documentation/usernotifications/sending-channel-management-requests-to-apns
- https://developer.apple.com/forums/thread/799505
- https://developer.apple.com/forums/thread/747624
