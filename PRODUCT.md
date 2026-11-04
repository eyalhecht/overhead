# Overhead - product definition

Agreed on 3 November 2026. This is how Overhead behaves; the limits of the current approach are under [Known limits](#known-limits).

## The idea

You hear a plane, glance at your phone, and know where it's going.

Overhead is for everyday curiosity, not for aviation experts. Every decision below serves that one glance.

## Which planes get a card

A plane gets a card when it is predicted to pass within about **2.8 km** of you, below **10,000 ft**.

- We predict its closest point to you from its position, heading and speed.
- Planes on the ground are ignored.
- Hovering aircraft (for example a police helicopter circling) are never shown. Only aircraft passing through count.
- A plane we can't find a route for (private jet, military, helicopter) still gets a card, showing what we do know, such as "Private jet, Cessna Citation".

## When the card appears and disappears

1. **Approaching:** the card appears about **45 seconds before** the plane is closest to you, so you have time to look up.
2. **Above you now:** while the plane is passing over you.
3. **Passed:** after it has gone, the card stays about **20 seconds** saying "Passed", then closes.

If the plane turns and won't pass near you after all, the card ends quietly, with no "missed" message.

The card starts **silently**: the screen lights up, with no sound or vibration.

## What the card shows

- **Route:** "Tel Aviv → Eilat"
- **Airline and aircraft:** "Israir · A320"
- **Status:** "Approaching", "Above you now" or "Passed". There is no countdown.
- **A plane icon** on the right.

The tone is plain and warm. The look stays as it is today. There is no rare-aircraft label.

**Dynamic Island, compact:** "✈ TLV … ETM", with the origin code on the left and the destination code on the right.

**Tapping the card** opens the "Where to look" compass screen.

## More than one plane

There is only ever one card. When the next plane approaches, the same card switches to it.

Under a busy approach path the card can stay up for a long time. After 20 minutes the server closes it and immediately starts a fresh one, because the app closes any card older than 30 minutes.

## The app and the card agree

The app always shows the same plane and status as the card, including "Passed". You should never see a card on your Lock Screen while the app says there are no planes.

## Quiet hours

There are no cards between **22:00 and 07:00**. This is on by default and can be turned off in Settings.

## Later

- **Collecting:** every plane that passes earns coins (or points, name to be decided), and enough of them unlock badges.
- **New card designs:** the Wolt-style concepts are on the prototype canvas.

## Known limits

- The prediction assumes the plane flies straight. A departure still turning onto its course is recognized later, about 30 seconds before it is closest instead of 45 (seen with ISR053 over Ramat Gan).
- Planes predicted to pass within the next two minutes are watched too. They never appear on the card, but they keep a Passed card open so a busy sky stays on one card.
