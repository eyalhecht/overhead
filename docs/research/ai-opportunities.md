# AI and ML for Overhead: what could actually help, and what is a gimmick

Researched 2026-11-06 from primary sources: Apple developer documentation, WWDC sessions, the App Review Guidelines, Anthropic's API documentation and pricing, peer-reviewed papers and first-party datasets. Every claim has its URL next to it. "Inference" marks my own reasoning or arithmetic. Nothing was added to the codebase.

The goal this is measured against: when you hear or see a plane, the answer to "where is it going?" is already on your Lock Screen, for every plane you notice and none you don't, at the right moment, plus something delightful about it.

## Summary

1. The two biggest gaps against the goal are timing on turning departures (cards about 30 s early instead of 45, see PRODUCT.md "Known limits") and the guess at what each person notices (one 48 dBA threshold for everyone). Both are better served by small, classical models trained on public ADS-B history or on-device signals than by an LLM.
2. On-device sound detection cannot run in the background for this. iOS documents background audio as for apps that play audible content, App Review 2.5.4 limits background services to their intended purposes, and starting a recording from the background fails. It is useful only as an opt-in, foreground calibration session.
3. Apple's built-in sound classifier does have aircraft classes (airplane, aircraft, helicopter), and the AudioSet ontology it resembles has them too. But planes the hearing rule targets sit near 0 dB over ambient, which is the hardest case for any detector.
4. The "something special" line is the best place for an LLM, and it is cheap: grounded on a registry row and route facts, generated server-side with Claude Haiku 5.5 at $0.10 / $0.50 per million tokens, cached per airframe. Estimate: under $2 a month at 100 users. No user data goes to the model, so it is not "personal data shared with third-party AI" under 5.1.2(i) (inference).
5. Apple's on-device model (Foundation Models) does not fit the Lock Screen path: the card is drawn from server pushes, the model needs an Apple Intelligence iPhone (15 Pro or later), and background generation is rate limited. It fits only in-app.
6. Camera identification of a plane at 3 km is a gimmick. The plane is a few dozen pixels (inference), and the app already knows which plane is where from geometry.
7. Runway-flow prediction is mature research (NASA challenge, MIT papers), but its horizon is hours. For a 45 s card, reading the current flow from live tracks is enough, with no ML.
8. The strongest portfolio signal is an evaluation harness that replays a real day of adsb.lol traffic through the existing policy and scores every card. It is also the prerequisite for ideas 1, 3 and 4.

## 1. Learn each person's noticing threshold from implicit signals

### What it does for the user

Over a few weeks the card stops showing planes this person never looks at, and starts showing the slightly quieter ones they do. It replaces the single 48 dBA rule with "48 dBA plus your offset", and maybe a lead-time offset too ("I need more warning").

### How it would work

- On-device only. The phone keeps a small log of its own cards: predicted heardDb minus the hourly ambient, distance, hour, and what happened next.
- Signals:
  - Positive: the person tapped the card. Apple: "People tap your Live Activity to launch your app. Use deep links to take them to the scene in your app that matches the activity's information." https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities
  - Positive: the app was opened while that plane's card was up.
  - Negative: the person removed the card. "A person can remove your Live Activity from their Lock Screen at any time", and "When a person or the system removes a Live Activity, its ActivityState changes to dismissed." Same URL. The `dismissed` case is defined as "ended and is no longer visible because a person or the system removed it". https://developer.apple.com/documentation/activitykit/activitystate
  - No interaction: ambiguous. Most Lock Screen glances leave no trace (inference).
- Model (inference): a one-parameter Bayesian update, or a two-feature logistic regression, with the hearing model as the prior. It nudges the margin M (see hearing-planes.md, section 3) by at most ±5 dB, the same range as the planned manual sensitivity setting.
- Only the resulting offset leaves the phone, inside the existing check-in settings. The event log never does.

### Evidence it is feasible

- ActivityKit exposes the dismissed state, and taps arrive as deep links (URLs above). Note "a person or the system", so dismissal is a noisy signal: the system also removes cards (inference: for example at the 8 hour limit, see live-activities-busy-sky.md).
- The app only observes state while it runs (inference from how ActivityKit delivers state to the app process). It would record the outcome on the next background wake from location or the next launch.

### Constraints

- Privacy: Apple defines "collect" as "transmitting data off the device in a way that allows you and/or your third-party partners to access it for a period longer than what is necessary". Taps are "Product Interaction" data. https://developer.apple.com/app-store/app-privacy-details/. Inference: keeping the log on the phone avoids collecting it at all. The offset is closer to a setting than to interaction data, but say so in PRIVACY.md.
- Data volume (inference): at the beta's 3 cards a day, two weeks gives about 40 cards and perhaps 5 to 10 taps per tester. That is too few to fit anything but one slow-moving offset. This is mostly a post-beta idea.
- No analytics creep: no server-side event store, no per-card upload.

### How to evaluate

- In the beta, count taps and app opens per card before and after the offset is on (on-device counters, read out with the tester's consent in the day-14 interview).
- Day-14 interview questions already cover "any plane that passed with no card" and "any moment the card got in the way" (PRODUCT.md).

### Effort and risk

S to M. Risk: the signal is weak and confounded (a tap means curiosity, not hearing). Ship the manual sensitivity setting first; learn later.

## 2. On-device sound detection to confirm a plane is audible

### What it does for the user

In principle: a card only when the phone actually hears the plane. In practice (see below), this is only possible while the app is open, so it becomes an opt-in "calibrate my spot" session: leave the app open on the balcony for an hour, and it learns how loud planes have to be to stand out at your home.

### How it would work

- Apple's SoundAnalysis built-in classifier, `SNClassifySoundRequest(classifierIdentifier: .version1)`, on the live microphone. WWDC21: "over 300 categories" including vehicles, "all of the computations ... are done locally on-device ... audio is never sent to the Cloud", window durations "between 1/2 second and 15 seconds". https://developer.apple.com/videos/play/wwdc2021/10036/
- The label list comes from `knownClassifications`, "every prediction label in the request's underlying sound classifier model". https://developer.apple.com/documentation/soundanalysis/snclassifysoundrequest/knownclassifications
- During the session, match each classifier "airplane" or "aircraft" detection to the plane the server predicted. Fit the offset between predicted LAmax and "heard". Upload nothing but that offset.
- Optional: a custom Create ML sound classifier trained on our own balcony recordings with a background class. WWDC19 advises "Include background/silence class" and "Match real-world conditions". https://developer.apple.com/videos/play/wwdc2019/425/

### Evidence on aircraft classes

- A published dump of `knownClassifications` (not an Apple page, so verify by printing the list on a device) lists `airplane`, `aircraft` and `helicopter` among about 303 labels, alongside `traffic_noise`, `wind` and `wind_noise_microphone`. https://note.com/shu223/n/n397ea22f62ef
- The categories match the Google AudioSet ontology: "Aircraft" with children "Aircraft engine", "Helicopter" and "Fixed-wing aircraft, airplane" (2,985 annotations). https://research.google.com/audioset/ontology/aircraft_1.html
- Aircraft-vs-other classification near airports works well when the plane is loud: a CNN reached "an accuracy of 0.970 when trained on 900 manually labeled noise events" (Heller et al., arXiv preprint, 2018). https://arxiv.org/abs/1806.04779
- Inference: those are threshold-triggered monitor events, well above ambient. The hearing rule's planes are at about 0 dB SNR over L90, where humans need focus to detect them (hearing-planes.md, section 2). Expect the built-in classifier to miss most of them. That is itself a useful calibration result.

### What iOS allows in the background (exact)

- The audio background mode is described as "The app plays audible content in the background." https://developer.apple.com/documentation/xcode/configuring-background-execution-modes
- App Review 2.5.4: "Multitasking apps may only use background services for their intended purposes: VoIP, audio playback, location, task completion, local notifications, etc." https://developer.apple.com/app-store/review/guidelines/
- Starting a recording from the background fails: `cannotStartRecording` "usually occurs when an app starts a mixable recording from the background". https://developer.apple.com/documentation/coreaudiotypes/avaudiosession/errorcode/cannotstartrecording
- App Review 2.5.14: "Apps must request explicit user consent and provide a clear visual and/or audible indication when recording ... This includes any use of the device camera, microphone". Same guidelines URL. iOS shows an orange indicator "whenever an app uses the microphone without the camera". https://support.apple.com/en-us/108331
- App Review 2.4.2: apps "should not rapidly drain battery". Same guidelines URL.
- Inference: an app woken by a location update cannot open the mic to listen for a plane. Keeping a recording alive all day (started in the foreground) would show an orange dot all day, fall outside the intended purpose of the mode, drain the battery, and very likely be rejected. Foreground-only is the honest answer.

### Constraints

- Microphone permission prompt and a privacy manifest entry if anything derived is sent. https://developer.apple.com/documentation/bundleresources/privacy-manifest-files
- 5.1.1(iv): the app must work without the mic. Fine, since this is optional.
- iPhone microphone levels are not calibrated dBA (inference), so use the classifier's verdict, not a dB reading.

### How to evaluate

The founder's balcony week from hearing-planes.md, section 4: run a session, compare classifier detections against predicted LAmax, and see whether the detection rate rises with predicted SNR as the model expects.

### Effort and risk

M. Risk: low detection near threshold makes it look broken. Verdict: useful as a founder-only calibration tool. As a user feature, a gimmick.

## 3. Ambient level from Apple Watch (a cousin of idea 2)

### What it does for the user

Replaces the city-wide 48 / 45 / 40 dBA guess for background noise with what the person's own watch measured, so a quiet courtyard and a main road get different thresholds.

### How it would work

- HealthKit `environmentalAudioExposure`: "measures audio exposure to sounds in the environment", in A-weighted dB as an equivalent continuous level, "automatically collected by an Apple Watch". https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/environmentalaudioexposure
- On the phone, compute a rough L90 per hour of day from the last weeks of samples. Send only the offset against the default, as with idea 1.
- Background delivery needs the `com.apple.developer.healthkit.background-delivery` entitlement, and "Some sample types have a maximum frequency of hourly". https://developer.apple.com/documentation/healthkit/hkhealthstore/enablebackgrounddelivery(for:frequency:withcompletion:). Hourly is plenty.

### Constraints

- App Review 5.1.3(i) restricts health data to uses that improve "health management" or research, but allows using it "to provide a benefit directly to that user". It also says "You must disclose the specific health data that you are collecting from the device." https://developer.apple.com/app-store/review/guidelines/. Inference: a reviewer may question a flight app asking for HealthKit. Keep it opt-in and on-device.
- Only Watch owners benefit. It is not ML at all, just better input data for the hearing model.

### Effort and risk

S to M. Risk: review friction and an extra permission prompt for a minority of users.

## 4. Learned departure and arrival paths, so turning planes get cards on time

### What it does for the user

A departure still turning onto its course is recognized at the 45 s mark instead of about 30 s (the ISR053 case in PRODUCT.md), and planes that turn away stop starting cards that end quietly.

### How it would work

- Server-side, offline training, tiny runtime model.
- Data: adsb.lol publishes "a collection of all the data known to ADSB.lol, uploaded daily", under ODbL-1.0 and CC0-1.0. The 2025 repo totals about 2,115 GiB, as gzip JSON traces in readsb format. https://github.com/adsblol/globe_history_2025. Inference: about 6 GB a day worldwide, so download a month and cut it to a 30 km box around TLV.
- Method: cluster the first minutes of TLV departures and the last minutes of arrivals into flows. Olive and Morio applied DBSCAN to Toulouse arrivals and obtained clusters matching the published STARs (Aerospace Science and Technology 84, 2019). https://doi.org/10.1016/j.ast.2018.11.031. The open-source `traffic` toolbox does this processing (JOSS 2019). https://doi.org/10.21105/joss.01518
- Runtime: when a plane near TLV matches a cluster's first points, predict along that cluster's centerline (a few KB of JSON) instead of a straight line. Fall back to straight-line extrapolation otherwise.
- A heavier option is a sequence model. Terminal-area LSTM and attention models exist (for example "A New Accurate Aircraft Trajectory Prediction in Terminal Airspace Based on Spatio-Temporal Attention Mechanism", Aerospace 11(9) 718, 2024, https://www.mdpi.com/2226-4310/11/9/718), and so do generative models of terminal trajectories (Krauth et al., 2022, https://doi.org/10.1016/j.mlwa.2022.100446). Inference: for a 120 s horizon and one airport, cluster templates are enough and far easier to explain in an interview.

### Constraints

- adsb.fi's live data is "for personal, non-commercial use only". https://github.com/adsbfi/opendata. The archive's ODbL needs attribution, and share-alike applies if we publish the derived database (inference). Keep the centerlines server-side or attribute them.
- No phone cost, no battery, no review impact.

### How to evaluate

Replay held-out days (idea 9) and compare against the straight-line baseline: median lead time at the start of Approaching, share of passes that reach 40 s or more, and false starts (cards for planes that never came within the rule).

### Effort and risk

M. Risk: procedures change with runway in use, so templates must be keyed by flow (idea 5). It only helps near one airport per template set.

## 5. Runway configuration and traffic flow

### What it does for the user

The server knows which runways are in use, so it knows which paths planes will fly over you in the next minutes, and picks the right templates from idea 4.

### How it would work

- Current flow without ML: count departures and arrivals per runway end in the last 15 minutes of tracks. Wang et al. mined runway configurations from flight trajectories with a hierarchical pattern method (J. Aerospace Information Systems 21(3), 2024). https://doi.org/10.2514/1.I011321
- Prediction with ML: NASA's Run-way Functions challenge defined configuration as "the combination of runways used for arrivals and departures and the flow direction on those runways". With a year of traffic and weather data for 10 US airports, the winner correctly predicted configuration changes "41% of the time" two hours ahead, with 49% precision, using per-airport CatBoost models. https://drivendata.co/blog/airport-configuration-winners. Earlier academic work: Avery and Balakrishnan, Transportation Research Record 2600, 2016. https://doi.org/10.3141/2600-01

### Verdict

Inference: a 45 s card needs to know the flow now, not in two hours, and live tracks show it within minutes of a change. ML prediction here is a gimmick for this product. The current-flow rule is S effort and worth doing as part of idea 4.

### Effort and risk

S for current flow, L for prediction. Low risk.

## 6. A grounded "something special about this plane" line

### What it does for the user

One short line under the route, such as "This A321 first flew in 2009, older than most of the fleet" or "4,400 km to Bangkok, the longest route over you today". This is the "plus something delightful" part of the goal.

### How it would work

- Grounding data, server-side:
  - Registration and type for the hex code from the position feed (adsb.fi supports search by registration and hex, https://github.com/adsbfi/opendata).
  - The OpenSky aircraft database, with columns including `registration`, `typecode`, `operator`, `built`, `firstflightdate` and `registered`. Its README: "a crowdsourced effort and provided 'as is' without guarantees", and the daily snapshot is "incomplete". https://s3.opensky-network.org/data-samples/metadata/README.TXT
  - Route facts we already compute: great-circle distance, cities (OurAirports), airline (OpenFlights).
- Step 1, no LLM: deterministic templates ("first flew in 2009", "3,900 km"). That covers most of the value (inference).
- Step 2, LLM for variety: Claude Haiku 5.5 with the facts as the only input, structured output with one field `line` (at most 60 characters, or null).
  - Structured outputs "constrain Claude's responses to follow a specific schema" and are supported on `claude-haiku-5-5`. https://platform.claude.com/docs/en/build-with-claude/structured-outputs
  - Anthropic's own anti-hallucination advice: allow "I don't know", and "Explicitly instruct Claude to only use information from provided documents and not its general knowledge". https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations
  - Add a code guard (inference): every number, year and proper noun in the line must appear in the input facts, else drop the line and use the template.
- Caching: generate once per airframe (registration facts do not change daily) in a nightly batch. Store it in the existing SQLite. Route lines stay templated.
- On-device alternative (Foundation Models), and why it does not fit the card:
  - The framework needs "a device that supports Apple Intelligence", on iOS 26 and later. https://developer.apple.com/documentation/foundationmodels. Supported iPhones start at iPhone 15 Pro. https://www.apple.com/apple-intelligence/
  - Context is 4,096 tokens per session on iOS 26 (https://developer.apple.com/documentation/technotes/tn3193-managing-the-on-device-foundation-model-s-context-window) and 8,192 on iOS 27 (https://developer.apple.com/videos/play/wwdc2026/241/).
  - The rate limit error "will only happen if your app is running in the background and exceeds the system defined rate limit". https://developer.apple.com/documentation/foundationmodels/languagemodelsession/generationerror/ratelimited(_:)
  - The Private Cloud Compute model (WWDC26) has no token cost, a 32K context and a per-user daily quota, is for apps "with less than 2M downloads", and requires applying. https://developer.apple.com/videos/play/wwdc2026/319/
  - Inference: the Lock Screen card is rendered from server push payloads (4 KB limit, https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities) while the app is usually not running. So on-device generation could only fill the in-app card after a tap. Server generation reaches every user and every device.

### Cost (inference, from https://platform.claude.com/docs/en/about-claude/pricing)

- Haiku 5.5: $0.10 per million input tokens and $0.50 per million output. The Batch API gives 50 percent off.
- Per line: about 800 input and 60 output tokens, so about $0.0001 (half that in batch).
- Users near one airport share planes, so cost scales with distinct airframes, not users. TLV sees a few hundred movements a day. Even 15,000 distinct airframe-lines a month costs about $1.50, at 10 users or 100.
- Privacy: only aircraft data goes to Anthropic, never a location or device. Inference: 5.1.2(i)'s disclosure for personal data shared "with third-party AI" does not apply, but say it in PRIVACY.md anyway.

### How to evaluate

- An offline eval set of about 200 airframes. Code-graded: the number guard passes and the length fits.
- LLM-graded or by hand: "is it true given the facts" and "would a non-expert find it interesting". Anthropic's eval guidance: "Be task-specific", "Automate when possible", and "More questions with slightly lower signal automated grading is better than fewer questions with high-quality human hand-graded evals". https://platform.claude.com/docs/en/test-and-evaluate/develop-tests
- In the beta, ask "did you read the extra line?" in the day-14 interview.

### Effort and risk

S for templates, M with the LLM and eval. Risk: wrong registry data (crowdsourced) produces a confident wrong fact. The guard cannot catch a wrong input. PRODUCT.md also says "There is no rare-aircraft label", so get the founder's sign-off on adding a line to the card.

## 7. Point the camera at the plane

### What it does for the user

Point the phone at the sky and get the plane's name.

### How it would work, and why it is mostly a gimmick

- Image route: Vision's `ClassifyImageRequest` exposes `supportedIdentifiers` (iOS 18 and later) https://developer.apple.com/documentation/vision/classifyimagerequest. The iOS 27 on-device model accepts image input https://developer.apple.com/videos/play/wwdc2026/241/. Fine-grained type datasets such as FGVC-Aircraft (10,000 images, 100 models, from aircraft enthusiasts' photos, Maji et al. 2013) are close-up spotter shots. https://arxiv.org/abs/1306.5151
- Inference: an A321 (about 36 m span) at 3 km spans about 0.7 degrees, roughly 40 pixels across on a 4,000-pixel-wide main camera image. Type identification from that is not realistic. Detecting "a bright dot" is.
- Geometry route (no ML): the app already knows each plane's bearing and elevation and the phone's heading, and the arrow turns green when you face it. Overlaying a label in the camera view is AR math, not AI.
- System route: Visual Intelligence can pass the app a `SemanticContentDescriptor` with "labels" and the "pixel buffer", and the app answers through an `IntentValueQuery`. https://developer.apple.com/documentation/visualintelligence/integrating-your-app-with-visual-intelligence. Inference: Overhead could ignore the pixels and return the plane from the current sky snapshot. That is a cheap discovery hook, not recognition.

### Effort and risk

Image recognition: L, low value. Visual Intelligence hook: S to M, nice-to-have. Camera needs another permission and a green indicator (2.5.14).

## 8. Motion activity: no cards when you can't look up

### What it does for the user

"None you don't notice": no card while you drive or ride a train, where you neither hear nor see planes.

### How it would work

- Core Motion's on-device classifier reports "whether the user is walking, running, in a vehicle, or stationary". It needs `NSMotionUsageDescription`. https://developer.apple.com/documentation/coremotion/cmmotionactivitymanager
- The flags are not exclusive ("a car stopped at a red light" is automotive and stationary) and carry a `confidence`. https://developer.apple.com/documentation/coremotion/cmmotionactivity
- History can be queried for "the last seven days" with "a delay of up to several minutes". https://developer.apple.com/documentation/coremotion/cmmotionactivitymanager/queryactivitystarting(from:to:to:withhandler:)
- Inference: on each background location wake, the app checks for recent automotive activity and sends "paused" in the check-in instead of the activity itself. Fast location changes already hint at this without any permission.

### Effort and risk

S. Risk: one more permission prompt during onboarding, for a modest gain. Try the speed heuristic first.

## 9. AI in the development process: evals and replay

### What it does

Nothing visible to users directly. It makes every other idea measurable, and it is the clearest portfolio signal for a Berlin startup interview: "here is the number, here is how it moved".

### How it would work

- A replay eval: take one adsb.lol day (idea 4 data), cut it to the TLV box, and feed it at 5 s ticks through the existing sky, policy and watcher for 20 to 50 synthetic phone spots. The repo already replays situations on a fake clock in `server/test/real-world.test.ts`.
- Ground truth comes from the actual tracks after the fact: did the plane really pass within 2.8 km, or reach 48 dBA by the hearing model?
- Score:
  - lead time when Approaching started (target 45 s, at least 40)
  - missed passes
  - false starts
  - starts per hour against the cap of 10
- Run it in CI on every pull request and print the scores. Claude Code GitHub Actions can run Claude on pull requests and post review comments. https://code.claude.com/docs/en/github-actions
- LLM-graded evals for idea 6 sit in the same harness.

### Constraints

The archive license is ODbL (attribution). Keep the cut fixtures small, or download them in CI rather than committing them (inference).

### Effort and risk

S to M. Low risk. Interview risk: a reviewer asks whether AI wrote it, so keep the CLAUDE.md conventions and the tests readable.

## 10. "Hey Siri, what plane is that?"

### What it does for the user

Hands-free: ask Siri and hear the route of the plane above you.

### How it would work

App Intents "make content and actions discoverable by Apple Intelligence and support system experiences like Siri, Spotlight, Shortcuts, and widgets". https://developer.apple.com/documentation/appintents. The intent reads the latest sky snapshot and speaks the card text.

### Constraints

Siri's newer features are "available in beta ... in English, French, Japanese, Korean, Portuguese, and Spanish to start" and "will not be initially available in the EU". https://www.apple.com/apple-intelligence/. Hebrew is not among the supported Apple Intelligence languages (same URL). A plain App Shortcut works without Apple Intelligence (inference).

### Effort and risk

S. Low risk, low impact: the card already answers before you could ask.

## What was left out and why

- On-device training with Core ML for idea 1: one offset does not need a model framework. Plain arithmetic in the app is enough (inference).
- An LLM to pick which planes get a card: rules plus the physics model are testable and explainable, and an LLM in the 5 s loop adds latency and cost for no gain (inference).
- Inferring routes the Flightradar24 API cannot find: an ML guess shown as fact would break trust. Showing "Route unknown" is the honest answer (PRODUCT.md).

## Recommendation

Ranked by impact on the goal per unit of effort. All inference.

1. Replay eval harness (idea 9). Impact: it makes "on time, every plane, none extra" a number, and unlocks ideas 1, 4 and 6. Effort S to M. First step: download one weekday from the adsb.lol archive, cut it to a 30 km box around Ramat Gan, and write a script that feeds it through the watcher's sky and policy for 20 fixed spots. Have it print median lead time, misses and false starts for today's straight-line predictor. That is the baseline.
2. Learned departure and arrival templates, keyed by current runway flow (ideas 4 and 5). Impact: it fixes the one known timing failure (turning departures at about 30 s instead of 45) where most testers live. Effort M. First step: take 30 days of TLV traffic from the archive, cluster departures by runway and first turn with DBSCAN as in Olive and Morio, save the centerlines as JSON, and compare lead time on held-out days in the harness against the baseline.
3. Grounded "something special" line (idea 6). Impact: it delivers the "plus something delightful" half of the goal for about $1 to $2 a month. Effort S (templates) to M (LLM plus eval). First step: join the OpenSky aircraft database (`built`, `firstflightdate`, `operator`) on registration for the airframes seen in one replay day, and write two templates. Check by hand how many planes get a true, interesting line before adding Haiku 5.5 with structured output and the number guard.

Next after these: the personal threshold (idea 1), once the beta has shown whether taps carry any signal. Skip camera recognition, background listening and runway-change prediction.

## Sources

Apple developer documentation
- https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities
- https://developer.apple.com/documentation/activitykit/activitystate
- https://developer.apple.com/documentation/soundanalysis/snclassifysoundrequest/knownclassifications
- https://developer.apple.com/documentation/xcode/configuring-background-execution-modes
- https://developer.apple.com/documentation/coreaudiotypes/avaudiosession/errorcode/cannotstartrecording
- https://developer.apple.com/documentation/foundationmodels
- https://developer.apple.com/documentation/foundationmodels/languagemodelsession/generationerror/ratelimited(_:)
- https://developer.apple.com/documentation/technotes/tn3193-managing-the-on-device-foundation-model-s-context-window
- https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/environmentalaudioexposure
- https://developer.apple.com/documentation/healthkit/hkhealthstore/enablebackgrounddelivery(for:frequency:withcompletion:)
- https://developer.apple.com/documentation/coremotion/cmmotionactivitymanager
- https://developer.apple.com/documentation/coremotion/cmmotionactivity
- https://developer.apple.com/documentation/coremotion/cmmotionactivitymanager/queryactivitystarting(from:to:to:withhandler:)
- https://developer.apple.com/documentation/vision/classifyimagerequest
- https://developer.apple.com/documentation/visualintelligence/integrating-your-app-with-visual-intelligence
- https://developer.apple.com/documentation/appintents
- https://developer.apple.com/documentation/bundleresources/privacy-manifest-files
- https://developer.apple.com/app-store/app-privacy-details/
- https://developer.apple.com/app-store/review/guidelines/ (2.4.2, 2.5.4, 2.5.14, 5.1.1, 5.1.2, 5.1.3)
- https://support.apple.com/en-us/108331 (microphone indicator)
- https://www.apple.com/apple-intelligence/ (supported devices and languages)

WWDC sessions
- https://developer.apple.com/videos/play/wwdc2019/425/ (Training Sound Classification Models in Create ML)
- https://developer.apple.com/videos/play/wwdc2021/10036/ (Discover built-in sound classification in SoundAnalysis)
- https://developer.apple.com/videos/play/wwdc2026/241/ (What's new in the Foundation Models framework)
- https://developer.apple.com/videos/play/wwdc2026/319/ (Apple Foundation Model on Private Cloud Compute)

Anthropic
- https://platform.claude.com/docs/en/about-claude/pricing
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations
- https://platform.claude.com/docs/en/test-and-evaluate/develop-tests
- https://code.claude.com/docs/en/github-actions

Data
- https://github.com/adsblol/globe_history_2025 (adsb.lol daily archives, ODbL-1.0 and CC0-1.0)
- https://github.com/adsbfi/opendata (adsb.fi API and terms)
- https://s3.opensky-network.org/data-samples/metadata/README.TXT (OpenSky aircraft database)
- https://research.google.com/audioset/ontology/aircraft_1.html (AudioSet aircraft classes)
- https://note.com/shu223/n/n397ea22f62ef (third-party dump of the built-in classifier labels, verify on device)

Papers and challenges
- https://doi.org/10.1016/j.ast.2018.11.031 (Olive and Morio 2019, trajectory clustering around airports)
- https://doi.org/10.21105/joss.01518 (Olive 2019, traffic toolbox)
- https://doi.org/10.1016/j.mlwa.2022.100446 (Krauth et al. 2022, generative TMA trajectories)
- https://www.mdpi.com/2226-4310/11/9/718 (Aerospace 2024, TMA trajectory prediction with attention)
- https://doi.org/10.2514/1.I011321 (Wang et al. 2024, mining runway configurations from trajectories)
- https://doi.org/10.3141/2600-01 (Avery and Balakrishnan 2016, runway configuration prediction)
- https://drivendata.co/blog/airport-configuration-winners (NASA Run-way Functions challenge results)
- https://arxiv.org/abs/1806.04779 (Heller et al. 2018, CNN for aircraft noise monitoring, preprint)
- https://arxiv.org/abs/1306.5151 (Maji et al. 2013, FGVC-Aircraft)
