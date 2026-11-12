# Scale simulation: 500 phones

Run 2026-11-11 on the developer PC with `npm run simulate -w server` (seed 1).
Real server code (watcher, policy, SQLite store, HTTP API); replayed adsb.lol traffic of 5 Nov 2026, 14:00-16:59 UTC (3 h, 2160 ticks); Apple push counted, not sent. Hearing rule on.

## Setup

- Phones: 500 (Tel Aviv 139, London 119, New York 104, Berlin 43, Paris 48, Dubai 47), in 9 feed tiles; 70% with quiet hours; one commute and two app sessions of 2 minutes each per phone.

## Server

- Tick (5 s budget): median 27.4 ms, p95 37.1 ms, max 169.5 ms of wall time.
- CPU per tick: median 31 ms, p95 47 ms.
- Heap: up to 1507.4 MB (includes the replayed traffic and the 628,826-route list).
- Database writes: 1090314 (504.8 per tick).

## Feed

- Requests: 19440 (108.1 a minute on average, 108 at most). Starter allows 60 a minute.
- Month at this rate: about 4,667,761 requests; Starter allows 1,000,000.

## Cards and Apple push

- Pushes: 50427 (4157 starts, 42321 updates, 3949 ends); at most 75 in one tick.
- Starts per phone per hour: at most 8 (limit 10).
- Close passes (planes that reached Approaching or Above you) shown on a card: 11951 of 12117 (99%).
