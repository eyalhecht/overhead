# Feed coverage: FlyItalyADSB, adsb.fi and adsb.lol

Measured on 11 November 2026 to choose the main position feed. Result: FlyItalyADSB, on the Starter plan, with adsb.lol as backup.

## Live, side by side

For 72 minutes, every 10 seconds, the same request to all three feeds: aircraft within 30 nm of Ramat Gan (32.064, 34.836) and of central Berlin (52.52, 13.4). Counted: aircraft each feed saw below 10,000 ft within 15 nm, the ones that can get a card.

- **Tel Aviv**, 23 low aircraft in total: adsb.fi 21, FlyItalyADSB 21, adsb.lol 20. adsb.fi missed CGF1906 and WUK582; FlyItalyADSB missed AIZ162 and SEY022.
- **Berlin**, 37 low aircraft: FlyItalyADSB 37, adsb.fi 35, adsb.lol 34.
- **Failed requests** (of about 428 each): FlyItalyADSB 0, adsb.fi 2, adsb.lol 150 to 166 (35 to 39 percent).
- **Position age** (median `seen_pos`): adsb.lol 0.1 s, adsb.fi 0.2 s, FlyItalyADSB 0.2 s in Berlin and 1.4 s in Tel Aviv. All far shorter than the 45 s a card is shown ahead.

## History, a full day

Every aircraft adsb.lol recorded below 10,000 ft within 12 nm of Ramat Gan on 5 November (from the adsb.lol daily archive), checked against FlyItalyADSB's own track for that day (`/v2/history/{icao}/{date}`): 207 of 207 were in FlyItalyADSB's track at that spot and height. This shows FlyItalyADSB misses nothing adsb.lol has; it cannot show what FlyItalyADSB has that adsb.lol misses.

## Decision

- **Main feed: FlyItalyADSB.** As good as adsb.fi over Israel, best in Berlin, no failed requests, and its terms allow commercial use in apps (adsb.fi's do not).
- **Backup: adsb.lol.** Free and openly licensed, but it failed more than a third of requests in this test, so it is a backup only.
- **Plan:** Starter (EUR 9 a month, 60 requests a minute, 1,000,000 a month). One fixed tile every 5 s is about 520,000 requests a month, so Starter covers about two tiles. A worldwide launch needs Pro (whole world in one request).
