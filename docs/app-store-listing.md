# App Store listing and review notes (1.2.1)

Draft for App Store Connect. Field limits checked. Avoids pricing words such as "Free" (Guideline 2.3.7) and competitor or trademark names.

## Name and subtitle

- **Name:** Overhead
- **Subtitle (30 max), pick one:**
  - A. "Where that plane is going" (25). Recommended: it is the exact question people ask when a plane flies over.
  - B. "The plane above you, live" (25). Says what you see.
  - C. "Lock Screen flight spotter" (26). Says where it lives. Best for search, weakest hook.

## Promotional text (170 max)

Hear a plane overhead? A card on your Lock Screen shows where it came from, where it is going and which way to look up. No account, no ads.

## Description

A plane flies low over your home. Where is it going?

Overhead tells you before you even pick up your phone. When a plane passes close to you, or loud enough that you'd hear it, a card appears on your Lock Screen and in the Dynamic Island. It shows the flight, the airline, the aircraft, where it took off and where it's heading, and which way to look. When the plane is gone, so is the card.

Open the app for a live map of the planes around you.

How it works
- Cards only for the planes that matter: those passing close overhead or loud enough to hear, not every jet at cruising height.
- With location set to Always, cards arrive even when the app is closed and the phone is locked.
- Quiet hours keep your nights free of cards (on by default, 22:00 to 07:00).

Private by design
- No account, no ads, no tracking.
- Your phone rounds its location to about 100 metres before it leaves the device.
- Delete my data in Settings removes everything about you from our server at once.

Good to know
Flight data comes from volunteer receiver networks and public route lists. It can be late, missing or wrong, and must not be used for navigation or safety. Loudness is an estimate, not a measurement.

## Keywords (100 max, exactly 100)

plane,flight,tracker,airplane,aircraft,live activity,lock screen,airport,spotting,aviation,route,jet

## URLs and other fields

- **Privacy policy URL:** https://eyalhecht.github.io/overhead-privacy/
- **Support URL:** https://eyalhecht.github.io/overhead-privacy/impressum/
- **Marketing URL:** leave empty
- **Category:** Travel (primary), Utilities (secondary). Not Navigation, which conflicts with the "not for navigation" disclaimer.
- **Copyright:** 2026 Eyal Hecht
- **Price:** 0 (set under Pricing, never written in metadata)
- **EU Digital Services Act:** declare "not a trader" (an individual with a free app and no income from it). Becoming a trader shows your address and phone on the EU product page; revisit before monetizing (IDEA-77).
- **Age rating:** answer "None" or "No" to every content question. No unrestricted web access (links open in Safari). No user-generated content, messaging, ads, gambling, or medical content. Result: 4+.

## App Privacy (nutrition label)

Must match the privacy manifest in app.json.

- **Data used to track you:** none. Answer "No" to tracking.
- **Location > Precise Location:** collected; used for App Functionality only; linked to the user; not used for tracking. The ~100 m rounding still counts as precise under Apple's definition (3+ decimal places), so don't pick Coarse.
- **Identifiers > Device ID:** collected; App Functionality only; linked; not tracking.
- Nothing else (no contact info, usage data, diagnostics, or purchases).

## App Review notes (paste into App Review Information > Notes)

Overhead has no login or account.

What it does: when an aircraft passes low near the device (close overhead, or estimated loud enough to hear), the app starts a Live Activity on the Lock Screen and in the Dynamic Island. It shows the flight's route, airline, aircraft and the direction to look, and ends when the plane has passed.

How to see it:
1. On the first screen, tap "Show it on my Lock Screen" to see a sample Live Activity straight away. Lock the phone to view it; it disappears after 20 seconds.
2. Tap Continue and allow location. The home screen then shows a live map of real aircraft near you.
3. A real card appears only when a plane actually passes low near you, so it depends on location. Under an airport approach path this happens several times an hour; far from one it may not happen during review. The attached video shows a real pass.

Quiet hours (22:00 to 07:00 device local time) are on by default, and no cards start during them. If you test in that window, turn Quiet hours off in Settings.

Why location "Always": the core feature is a card that appears while the app is closed and the phone is locked, so the server needs the device's rough area to start the card when a plane approaches. The app uses low-accuracy location, reports only after the device moves about 500 m, and rounds the position to about 100 m before sending it. With "While Using" only, cards still work while the app is open.

Live Activities are started by push only for real nearby flights, at most 10 per hour, and can be turned off in Settings ("Show on Lock Screen"). The app sends no marketing messages and does not use regular notifications.

Data sources: aircraft positions from FlyItalyADSB and adsb.lol; routes from the Virtual Radar Server standing data. Listed in Settings > Credits and data sources.

Contact: Eyal Hecht, eyalhe3@gmail.com

## What only you can provide

- **Screenshots, "iPhone with Dynamic Island (medium display)" set**: this is the required set (checked 12 Nov 2026 on Apple's screenshot specifications page). The iPhone 17 Pro captures 1206 x 2622, an accepted size, so take them on the phone as they are; App Store Connect scales them for the other models. Suggested five:
  1. Lock Screen with a real card
  2. Dynamic Island with a card
  3. App home: card plus map
  4. App home: map of nearby planes
  5. Welcome screen with the sample card

  No price words inside the shots. Use plain screenshots (side button + volume up); don't crop or edit them, so they keep the 1206 x 2622 size.
- **Review video** (attach in the notes): a short screen recording of a real pass, showing the card appearing on the Lock Screen.
- **The final Submit for Review click** in App Store Connect.
