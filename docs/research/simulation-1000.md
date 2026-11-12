# Scale simulation: 1000 phones

Run 2026-11-11 on the developer PC with `npm run simulate -w server` (seed 1).
Real server code (watcher, policy, SQLite store, HTTP API); replayed adsb.lol traffic of 5 Nov 2026, 14:00-16:59 UTC (3 h, 2160 ticks); Apple push counted, not sent. Hearing rule on.

## Setup

- Phones: 1000 (Tel Aviv 287, London 221, New York 217, Berlin 93, Paris 97, Dubai 85), in 9 feed tiles; 70% with quiet hours; one commute and two app sessions of 2 minutes each per phone.

## Server

- Tick (5 s budget): median 54.3 ms, p95 68.6 ms, max 189.9 ms of wall time.
- CPU per tick: median 47 ms, p95 109 ms.
- Heap: up to 1520.4 MB (includes the replayed traffic and the 628,826-route list).
- Database writes: 2180364 (1009.4 per tick).

## Feed

- Requests: 19440 (108.1 a minute on average, 108 at most). Starter allows 60 a minute.
- Month at this rate: about 4,667,761 requests; Starter allows 1,000,000.

## Cards and Apple push

- Pushes: 101497 (8183 starts, 85519 updates, 7795 ends); at most 146 in one tick.
- Starts per phone per hour: at most 8 (limit 10).
- Close passes (planes that reached Approaching or Above you) shown on a card: 23958 of 24311 (99%).
