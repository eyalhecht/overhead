# Overhead - product definition

Agreed on 3 November 2026. This is how Overhead behaves; the limits of the current approach are under [Known limits](#known-limits).

## The idea

You hear a plane, glance at your phone, and know where it's going.

Overhead is for everyday curiosity, not for aviation experts. Every decision below serves that one glance.

## Direction and validation

Agreed on 5 November 2026 after a structured review: problem framing, assumptions, prioritization, a red team, positioning, an opportunity tree and an interview script. The idea holds; it needs tweaks, not a pivot.

### The problem

A curious person living or working under a flight path hears or sees a plane and wonders where it is going. By the time they could look it up, it is gone.

Flight trackers don't solve this because:

- **They are too slow.** You unlock the phone, open the app and find the right dot, and the plane has passed.
- **You have to ask.** Nothing tells you on its own; you must already be curious enough to act.
- **They aren't on the Lock Screen.** No tracker shows the plane above you where you already look.

How might we answer "where is that plane going?" in one glance, before it's gone, for curious people under flight paths, and also show what's special about it?

### Who it is for

- **First:** curious non-experts who live or work near an airport's approach or departure path. Tel Aviv, under the Ben Gurion approach, is the first place.
- **Second:** plane spotters. They get extras only where the extras add no noise for everyone else. When the two conflict, the curious person wins.
- **Left out so far:** people who find an unasked card intrusive. They need an easy way to turn cards off, which Settings already has.
- **People far from flight paths:** they rarely get a low plane. They should get a wider range so they still see some cards (planned, not built).

### Positioning

For curious people who live or work under flight paths, who wonder where a passing plane is going, Overhead is a live companion for the sky above you that tells them where it is going and where to look, in one glance on the Lock Screen, before it's gone.

Unlike looking up and wondering, or opening Flightradar24 too late, Overhead comes to you without asking, with a simple, modern design built only for the plane you can see.

Overhead's edge is the experience: only the plane above you, made simple and pleasant. Being a solo developer with modern tools and almost no costs is what lets it improve faster than the big trackers, but it is how Overhead is built, not what users choose it for.

### Goal right now

- **What it is for:** a portfolio piece with real users. There is no business pressure.
- **Money:** free. The founder pays the running costs, about $13 a month (Flightradar24 and the server).
- **Next users:** 5 to 10 friends, through TestFlight, for two weeks.
- **Not now:** a public launch, marketing, monetization or a roadmap.

### The beta

**Before inviting anyone:**

- **Restarts must not drop users.** Today a server restart forgets every phone until it reopens the app; it happened about six times in one week. Users must survive restarts and deploys.
- **Install through TestFlight.** This needs one Apple beta review, covering Always location and Live Activities started by push.

**During the two weeks:**

- **The founder checks the server logs every day** for missed cards, restarts and paused starts, and messages the tester when something broke. This is manual, with no code.
- **Testers are invited as they are.** Their home and work spots are not checked first, and the app does not explain why a card didn't come.

**Success:**

- At least **60%** of testers still have cards on at day 14, and they mention a real plane they saw. The server shows who still sends a start token.
- A tester needs about **3 or more cards a day** at home or work to judge the idea fairly. Fewer than that points to their location, not to the idea.

**At day 14:** a 10-minute interview with each tester, following The Mom Test. Ask what actually happened, never "would you use it". The questions:

- The last time a card showed up: where they were and what they did next.
- Whether they found the plane in the sky.
- Any plane that passed with no card.
- Any moment the card got in the way.
- Anything they changed in settings, and why.
- Whether they showed it to anyone.

### What has to be true

Tested in the beta, because the impact and the risk are both high:

1. **Planes pass often enough** where testers live and work (3 or more cards a day).
2. **People keep cards on after the novelty**, and the card doesn't feel intrusive (60% still on at day 14).
3. **People grant Always location** (70% or more). It shows as phones checking in from the background.

Treated as true:

- The card arrives in time. It was measured on real passes: WZZ314 showed Approaching for 21 s, Above you now for 58 s and Passed for 20 s.
- Location stays private. Every request is rounded to about 100 m.
- Route, airline and aircraft answer the curiosity in one glance.
- 10 card starts an hour are enough.

Waiting for a public launch, because they don't matter for this goal: running cost at scale, data licences (adsb.fi is non-commercial; Flightradar24's terms), server scale, a marketing channel, being copied by Flightradar24 or Flighty, and App Store review.

### Risks and kill criteria

| Risk | What would show it | Kill criterion |
|---|---|---|
| Server restarts drop testers | Restarts in the logs | Any restart that needs testers to act |
| Too few planes where testers are | Cards per tester per day | Under 3 a day for most testers |
| Unexplained misses break trust | Testers report a plane with no card | More than 1 per tester per week |
| TestFlight review blocks the start | Apple's review result | Rejected twice: switch to ad hoc builds with registered devices |
| iOS refuses starts on busy paths | "card never confirmed" pauses in the logs | More than 1 pause per tester per day |

### Known biases

- The founder lives and walks under the Ben Gurion approach, so he sees far more low planes than most people.
- It assumes an unasked card several times a day is welcome.

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

**Tapping the card** opens the app. There the same card shows an arrow that turns with your phone, goes green when you face the plane, and says how high to look.

## More than one plane

There is only ever one card. When the next plane approaches, the same card switches to it.

Under a busy approach path the card can stay up for a long time. After 20 minutes the server closes it and immediately starts a fresh one, because the app closes any card older than 30 minutes.

## The app and the card agree

The app always shows the same plane and status as the card, including "Passed". You should never see a card on your Lock Screen while the app says there are no planes.

## Quiet hours

There are no cards between **22:00 and 07:00**. This is on by default and can be turned off in Settings.

## Later

- **Collecting:** every plane that passes earns coins (or points, name to be decided), and enough of them unlock badges.

## Known limits

- The prediction assumes the plane flies straight. A departure still turning onto its course is recognized later, about 30 seconds before it is closest instead of 45 (seen with ISR053 over Ramat Gan).
- Planes predicted to pass within the next two minutes are watched too. They never appear on the card, but they keep a Passed card open so a busy sky stays on one card.
