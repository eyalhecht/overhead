# Overhead - product definition

Agreed on 3 November 2026. This is how Overhead should behave. Where the code still does something else, see [Not built yet](#not-built-yet).

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

## Not built yet

These are where the code still differs from this definition:

1. **Approaching stage:** cards start only once a plane is already inside the 2.8 km circle. This needs a wider watch area (about 9 km) and a path prediction.
2. **Passed for 20 s:** the code waits up to 90 seconds before ending a card.
3. **Status instead of countdown:** the card still shows a countdown.
4. **Card content:** the card still shows a second-plane line, a "+N" count and the RARE label.
5. **Planes without a route:** these are skipped today.
6. **Hovering aircraft:** these are shown for 10 minutes before being hidden.
7. **App matches card:** the app shows only what is overhead right now, so it can disagree with a card that is still up.
8. **Tap target:** not yet checked that tapping the card opens the compass.
9. **10,000 ft ceiling:** merged into master, not deployed yet.
