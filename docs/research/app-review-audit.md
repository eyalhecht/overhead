# App Store review audit (pre-submission)

12 November 2026. Report only, no code changed. Checked against the shipped `release-1.2.0` config, the app source, and the final Info.plist from `npx expo config --type introspect`. Guideline wording verified the same day at https://developer.apple.com/app-store/review/guidelines/. Skills used: `apple-appstore-reviewer` (github/awesome-copilot), `app-store-review` (dpearson2699/swift-ios-skills).

## Summary

- The app is in good shape on the big-ticket items. It has no accounts, payments, ads, tracking, or user-generated content. It has a privacy policy (in the app and on the web), Delete my data, a privacy manifest, honest purpose strings, and a safety disclaimer. The 1.2.0 build already passed upload checks and Beta App Review.
- One real, likely rejection: the location pre-permission screen breaks 5.1.1(iv) as Apple currently enforces it.
- The second biggest risk is reviewer experience. A reviewer who doesn't see a low plane may decide the app does nothing (2.1). This is fixed with review notes and a video, not code.
- Everything else is cheap cleanup.

## Findings, by priority

### P1: likely rejection

1. **Pre-permission screen wording (5.1.1(iv)).** `app/src/app/location.tsx`: the custom screen before the iOS prompt has a button labelled "Allow location", a "Not now" button that skips the prompt, and copy that says "Choose 'Always Allow' when iOS asks". App Review's current boilerplate wants exactly one button that opens the system prompt, labelled neutrally ("Continue" or "Next"), with no way to skip or delay it, and no steering toward a particular choice. This was seen in a rejection as recently as October 2026.
   Fix (code, small): rename the button to "Continue", remove "Not now", and soften the copy to explain why "Always" helps without telling people what to tap. Optional: set `isIosBackgroundLocationEnabled` usage so the "Always" upgrade comes later in context. Your home-screen hint already does this well.
   Verify: fresh install, then Welcome > Continue > the system prompt appears straight away, and there's no way out except the prompt.
   Confidence: high. Effort: S.

2. **Reviewer may see "nothing happening" (2.1 completeness, 4.2).** The core feature needs a plane passing low over wherever the reviewer is. The map does show live planes nearby and there's a sample card button, but a reviewer at a desk may never get a real card. `DEMO_DEVICE` can't target the reviewer, because their device ID isn't known in advance, and setting `DEMO_LOCATION` without it would move every user.
   Fix (no code): review notes explaining what to expect, the "Show it on my Lock Screen" sample, that the map shows live aircraft, and why cards are rare by design. Attach a short screen recording of a real pass (Lock Screen card and Dynamic Island). The launch plan already calls for this.
   Confidence: high that it's needed. Effort: S.

3. **"Always" background location must be justified (2.5.4, 5.1.1).** `UIBackgroundModes` includes `location`, and the app asks for Always. Apple routinely asks: "what feature needs persistent background location?" The use is legitimate: the server needs your area to push a card when a plane approaches while the app is closed. It's also low power (Accuracy.Low, 500 m distance filter).
   Fix (no code): say this plainly in the review notes and show it in the video.
   Confidence: medium. Effort: S.

### P2: could trigger a question or rejection

4. **Dead end after "Not now".** If the user skips the prompt, the home screen shows "Finding your location…" forever, with no button to grant access (`index.tsx`, permission `unknown`). Removing "Not now" (finding 1) fixes this too.

5. **Generic purpose strings in Info.plist (5.1.1).** expo-location adds defaults: `NSLocationAlwaysUsageDescription` = "Allow $(PRODUCT_NAME) to access your location", and `NSMotionUsageDescription` = "Allow $(PRODUCT_NAME) to detect your current motion activity", plus a generic precise-accuracy string. Modern iOS never shows these (the app uses AlwaysAndWhenInUse, never asks for motion or temporary full accuracy), but vague strings are a classic flag.
   Fix (config, S): set the `locationAlwaysPermission` and `motionPermission` options on the expo-location plugin, or disable motion.

6. **No fallback when location is denied (5.1.1(iv), "where possible").** The guideline's example is "offer the ability to manually enter an address". Overhead is location-native, so this is usually accepted, but a reviewer could ask.
   Fix: none needed now. Have a one-line answer ready: the card is about planes over you right now, so a typed address wouldn't serve the feature.

### P3: cleanup

7. **Unused `fetch` background mode.** It's auto-added by the expo-task-manager plugin, and the app never does background fetch. Apple rarely flags `fetch`, but unused modes are against 2.5.4. Remove it with a tiny config plugin, or leave it.
8. **Dev-client network string.** `NSLocalNetworkUsageDescription` mentions "Expo Dev Launcher… development servers". Release builds don't use it, so no prompt appears, but the string ships. Low risk.
9. **Privacy label consistency.** In App Store Connect, declare exactly what the manifest says: Precise Location and Device ID, linked to the user, for App Functionality, no tracking. Location is rounded to about 100 m, which is still "precise" by Apple's definition (3+ decimal places), so Precise is the honest choice. Don't declare Coarse.

## Checked and fine

- No accounts, so no Sign in with Apple and no account-deletion requirement. "Delete my data" exists anyway.
- No IAP or external payments, so 3.1.1 doesn't apply.
- No ATT prompt, and `NSPrivacyTracking` is false. Correct, since nothing tracks.
- Privacy policy linked in-app (Settings > Privacy policy) and live on the web. Legal notice too.
- Privacy manifest present, with standard required-reason codes (UserDefaults CA92.1, file timestamp C617.1, boot time 35F9.1, disk space E174.1).
- Push / Live Activities (4.5.3, 4.5.4): triggered only by real planes, capped at 10 starts an hour, off switch in Settings, quiet hours, no marketing. The app doesn't need the notification permission.
- Purpose strings shown to users are specific and honest ("rough, low-power location").
- No airline logos or trademarked images (SF Symbols only). Airline names are plain text.
- Safety disclaimer in Credits ("must not be used for navigation or safety").
- `ITSAppUsesNonExemptEncryption` = false (HTTPS only).
- `supportsTablet` = false, so no iPad screenshots needed.
- Upload floor (SDK/Xcode): met, because 1.2.0 uploaded and passed Beta App Review.

## Blockers that aren't code

- **Screenshots:** the iPhone 6.9" set (1320 x 2868 or 1290 x 2796) is required and doesn't exist yet. It has to be captured on your phone running the build.
- **Metadata:** don't use "Free" or any price wording in the name, subtitle, keywords, or screenshots (2.3.7), even though the app is free.

## Reviewer experience walk-through

- Install and launch: OK.
- First run: clear (Welcome explains it, and the sample card works).
- Location prompt: **fails 5.1.1(iv) today** (finding 1).
- Core feature: map with live planes OK. A real card depends on luck, so notes and a video are needed (finding 2).
- Purchases: none.
- Links, support, legal: OK. Use the Impressum page as the support URL.
- Edge cases: location denied shows "Location is off" with Open Settings (OK). Skipped prompt is a dead end (finding 4).

## Suggested order

1. Fix finding 1 (and with it 4), plus finding 5's strings. This is one small app change, so it needs a new build (1.2.1).
2. Record the pass video and capture the screenshots on your phone.
3. Write the review notes (findings 2 and 3), then submit.
