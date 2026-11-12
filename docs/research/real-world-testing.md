# Real-world / readiness testing - insights

Run overnight 2026-11-11 on the developer PC. No code changed (app, server, and simulator source all untouched); no money spent (all local, Apple push and the flight feed counted but never called). Live servers were probed read-only only.

Covered:
1. Scale simulation at 100 / 500 / 1000 phones (real server code, replayed real traffic).
2. Benign health/auth probes of both live servers.
3. Read-through of the request- and feed-facing server code for resilience.
4. Adaptive-polling savings estimated from the real traffic data.

Raw numbers in `simulation-100.md`, `simulation-1000.md`.

## Verdict

The app works. At 100/500/1000 phones it showed a card for **99% of close passes** every time. The server has large headroom. It is also **resilient**: it survives a restart with cards intact, degrades without crashing when the feed is down or returns garbage, and cleans up dead push tokens. The one thing that does not scale is the **flight-feed plan**, and - new finding - the easy fix I expected (adaptive polling) barely helps in big cities, so that decision is really about plan size or cadence.

## What works well

- **Catches the planes that matter.** 99% of close passes shown at every scale. The ~1% missed are the known start-cap / quiet-hours cases, not a bug.
- **Server has huge headroom.** Compute per tick scaled linearly: 7.9 / 27.4 / 54.3 ms median at 100 / 500 / 1000 phones, against a 5000 ms budget. One small VM should hold several thousand phones.
- **No memory leak under load.** Peak heap plateaued (~1.5 GB at both 500 and 1000 phones); it is dominated by the fixed 628k-route list, not by user count.
- **Auth enforced in production.** Both servers 401 a missing or wrong app key on `/sky`; `/health` open by design; no `Server` / `x-powered-by` banner leaked.

## Resilience (code review + replayed data)

- **Feed failover is configured.** Production runs `[FlyItaly, adsb.lol]`; each tile tries the primary, then falls over to the backup on any error, non-200, or malformed body. Feeds are never merged (licence reasons).
- **Graceful degradation.** If every feed fails, the "see the sky" call is caught per phone and returns no planes that tick: cards simply pause, nothing crashes. A second try/catch guards each phone's whole update.
- **Bad data is survivable.** Each aircraft is validated individually and bad ones are dropped (ground planes, missing fields); malformed JSON is caught and triggers failover.
- **Restart-safe.** The full card state (showing card, card tokens, start token) is persisted to SQLite on every change and reloaded on boot, so cards resume after a restart. This also makes the US-to-Frankfurt DB copy (IDEA-71) safe.
- **Push-token hygiene.** Tokens Apple reports invalid/rejected, and ended cards, are removed; a dead start token is cleared. No pile-up.
- **Delete really deletes.** `DELETE /me` ends the card, then removes the row (`DELETE FROM users`) and the in-memory copy. The only stored PII (rough location) is gone. GDPR-wise this is clean.
- **Route directory reloads safely.** Daily refresh in a try/catch; a failed download keeps the copy already in memory.

## What does not scale / weak spots - ranked

1. **Flight-feed quota (the real blocker, and NOT about user count).**
   One request per 2-degree tile every 5 s, shared by everyone in it - so cost grows with *cities with users*, not users (why 100 and 1000 phones both hit the same 108 req/min). 6 cities = 9 tiles = ~108/min and **~4.7M/month**; Starter allows 60/min and **1M/month**. The monthly cap is binding: at 5 s it supports only ~2 tiles around the clock.
   - **Adaptive polling barely helps here.** Estimated from the real traffic, polling a tile fast only when a plane is low and near the users, backing off to 30 s otherwise, saved just **12-15%** in these six cities - they all sit by major airports, so a tile is almost always "hot". It would help much more in quiet suburbs, but you cannot count on it in cities.
   - **The reliable lever is cadence or plan.** At 9 tiles: 5 s = 4.7M/mo, 10 s = 2.3M, 15 s = 1.6M, ~25 s ≈ under 1M. A useful "look up now" cadence (5-10 s) across several cities simply needs a bigger plan than Starter.

2. **Tick budget vs real feed latency (the sim hides this).**
   The simulator measures compute only - its fake feed answers instantly (hence 8-54 ms). Real ticks include feed round-trips: the live box logged ~650 ms/tick with just 3 phones in one tile. Requests to one feed are serialised (FlyItaly 200 ms apart, adsb.lol 1000 ms), so refresh ≈ tiles x gap. During a **FlyItaly outage**, every tile fails over to adsb.lol at 1000 ms spacing plus up to 4 s timeouts, and the refresh can blow past the 5 s tick budget - ticks stall and overlap until the primary recovers. Cards stay correct (they just pause), but this is the one place an outage visibly hurts. Worth a real measurement before worldwide launch.

3. **SQLite write volume (scales with users, bites later).**
   ~200 writes/sec at 1000 phones (one per phone per tick). WAL copes here; a single-file DB on one VM becomes the ceiling somewhere in the few-thousand-to-10k range. Fine for launch, watch after.

## Recommendations (for the morning, in order)

1. **Decide the feed plan before any wider launch.** Adaptive polling is not the escape hatch in cities; for a multi-city launch at a useful cadence, budget for a tier above Starter, or accept a slower cadence in low-traffic areas only.
2. **Measure a real tick under load** (and simulate a FlyItaly outage) on the Frankfurt box, since the simulator can't - confirm refresh stays under 5 s with your real tile count, and that an outage recovers cleanly.
3. **Add a monthly feed-usage cap/alert** so a quiet overspend can't surprise you.
4. **Leave server CPU/memory alone** - not the constraint.
5. Optional hardening: HSTS in Caddy. Minor; API is not a browser surface.

## Honest limits of this test

- Simulated phones and replayed traffic, not real devices or live APNs - push *delivery* and iOS Live Activity rendering are not exercised (that is what the TestFlight friends cover).
- Sim tick times are compute only; see weak spot #2.
- Six cities, all airport-adjacent and a busy daytime window - a worst case for feed cost and a best case for how often tiles are "hot".
- Security here is a code read plus benign auth probes; no load or exploit testing was run against the live servers (would cost money and could disrupt the friends on it).
- The adaptive-polling figure is an estimate using city centres as the user cluster, not the simulator's exact phone positions.
