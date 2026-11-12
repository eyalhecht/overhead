# Scale simulation: 100 phones

Run 2026-11-11 on the developer PC with `npm run simulate -w server` (seed 1).
Real server code (watcher, policy, SQLite store, HTTP API); replayed adsb.lol traffic of 5 Nov 2026, 14:00-16:59 UTC (3 h, 2160 ticks); Apple push counted, not sent. Hearing rule on.

## Setup

- Phones: 100 (Tel Aviv 18, London 26, New York 26, Berlin 9, Paris 12, Dubai 9), in 9 feed tiles; 70% with quiet hours; one commute and two app sessions of 2 minutes each per phone.

## Server

- Tick (5 s budget): median 7.9 ms, p95 9.7 ms, max 25.5 ms of wall time.
- CPU per tick: median 15 ms, p95 16 ms.
- Heap: up to 870.5 MB (includes the replayed traffic and the 628,826-route list).
- Database writes: 218146 (101 per tick).

## Feed

- Requests: 19440 (108.1 a minute on average, 108 at most). Starter allows 60 a minute.
- Month at this rate: about 4,667,761 requests; Starter allows 1,000,000.

## Cards and Apple push

- Pushes: 9838 (873 starts, 8137 updates, 828 ends); at most 12 in one tick.
- Starts per phone per hour: at most 8 (limit 10).
- Close passes (planes that reached Approaching or Above you) shown on a card: 2356 of 2372 (99%).
