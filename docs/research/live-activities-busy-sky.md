# Live Activities in a busy sky: what Apple documents, and what to change

Researched 2026-11-05 from Apple primary sources only (developer docs, HIG, App Review Guidelines, WWDC transcripts, Apple staff replies on the Developer Forums). Every claim has its URL next to it. "Inference" marks my own reasoning.

## Summary

1. Apple documents no account ban or app block for frequent Live Activity pushes. What it does document is throttling on the device: once the budget is gone, updates stop or the card stops showing, and recovery "can take up to 24 hours".
2. Priority 5 updates do not count toward the budget. Apple says to use them for most updates. Priority 10 is budgeted. Push-to-start has its own small, fixed budget: about 10 starts "in a short time frame".
3. The riskiest part of the current design is renewing the card every 20 minutes. Each renewal spends a push-to-start, and each start must carry an alert. All day near an airport, that is an alert every 20 minutes. The HIG says to alert only for essential updates.
4. The HIG asks for what we already do: one Live Activity that rotates through events, not one per plane. It also says to update only when content changes and to end the card when the event ends.
5. Recommendation (inference): keep one card alive for hours and stop the 20 minute renewal. Send priority 5 updates only on real changes, and use priority 10 rarely. End the card after a quiet gap. Do not send notifications for the same planes. Give users pause and "busy airport" controls.

## (a) Live Activities

### Push-to-start budget

- Push-to-start needs iOS 17.2 or later. On 17.1 and earlier you can update and end by push, but not start. https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications and https://developer.apple.com/documentation/activitykit/activity/pushtostarttoken (introduced iOS 17.2)
- A start payload must have `event: start`, an `alert`, `attributes-type` and `attributes`. Apple's reason for the alert: "you make sure the system notifies a person about the newly started Live Activity and you avoid surprising them." https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications
- On iOS 18 and later you can add `input-push-token: 1` to get an update token, or `input-push-channel` to subscribe the new card to a broadcast channel. https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications
- You cannot start a Live Activity with a broadcast push. https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications
- The docs give no number for the push-to-start budget.
- An Apple DTS engineer (Argun Tekant, Sep 2025), replying to "after around 10 pushes live activities are no longer being started", said it is "the depletion of the on-device budget". He said "The budget is fixed and there is nothing you can do to increase it", that `NSSupportsLiveActivitiesFrequentUpdates` "does not make a difference" to it, and "If you need to push to start more than 10 activities, you would need to expand the time you are doing that in. It cannot be done in a short time frame." The device log line quoted in the thread is "Push-to-start budget exceeded ... not starting activity". https://developer.apple.com/forums/thread/799505
- What happens when it runs out: the device does not start the card. Per the forum log, it fails silently on the device. APNs still accepts the request. https://developer.apple.com/forums/thread/799505
- Apple does not publish the refill window. Our "10 per hour" is a guess, not a documented limit. Inference: 10 per hour sits at the edge of what DTS described, not safely inside it.

### Update budget, priority 5 vs 10

- Docs: "The system allows for a certain budget of ActivityKit push notifications per hour." Priority 10 (also the default when you omit the header) "counts it toward the notification budget". "If you exceed the budget, the system may throttle your ActivityKit push notifications." https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications#Determine-the-update-frequency
- Docs: priority 5 "doesn't count toward the budget". "Consider this lower priority first before using the priority of 10." A mix of 5 and 10 "prevents the system from throttling". Same URL.
- WWDC23 "Update Live Activities with push notifications": low priority updates "are delivered opportunistically". "Another benefit of using low priority is that there is no limit on how many updates you can send." "You should be using low priority for the majority of your Live Activity updates." High priority has "a budget depending on the device condition". Throttling "will dramatically impact your user experience". https://developer.apple.com/videos/play/wwdc2023/10185/
- APNs docs warn that priority 5 and 1 pushes "might get grouped and delivered in bursts". They also say "Your notifications may also get throttled, saved in storage, and in some cases, not delivered", depending on how the person uses the app and the device power state. https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns
- When offline, APNs stores only one notification per app per device. The newest usually wins, but this is not guaranteed. https://developer.apple.com/documentation/usernotifications/viewing-the-status-of-push-notifications-using-metrics-and-apns
- Apple Frameworks Engineer (May 2024), on a developer pushing every 5 to 60 seconds at priority 10 with frequent updates on: look in Console for `priority(0)`, `budget(0)` or `running-not-visible`, which means "the system has decided to not show your activity". Causes: "low battery mode", "bad data in the push(es)", "too many pushes in a short period of time". "The only way to remedy this ... is to wait for the system to add budget which can take up to 24 hours." https://developer.apple.com/forums/thread/731715
- Apple Engineer (Mar 2024): "If you stay within the 'budget' on the device for each user, you will not have any rate limitation issues with sending push requests to APNs." "The per user 'budget' is not documented, and could change. If you keep in mind that Live Activities are designed for occasional updates as needed, you should be OK." https://developer.apple.com/forums/thread/747624
- Apple Frameworks Engineer (Jun 2024): "We purposely discourage and throttle update frequencies similar to a now playing experience in Live Activities." Lock Screen and SpringBoard "also have a say in whether an update takes place". https://developer.apple.com/forums/thread/748569
- APNs can return `429 TooManyRequests` ("Too many requests were made consecutively to the same device token"). You may retry it after a delay. Other 4XX errors slow down your sending, and too many error conditions get the connection dropped. `410` does not count as an error. https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns
- Payload limit: static plus dynamic data "can't exceed a combined size of 4 KB". https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities

### Frequent updates key and the user setting

- `NSSupportsLiveActivitiesFrequentUpdates = YES` lets the app "receive frequent updates with remote push notifications". https://developer.apple.com/documentation/bundleresources/information-property-list/nssupportsliveactivitiesfrequentupdates
- WWDC23: it gives "a higher update budget, so my Live Activity updates are less likely to get throttled". "Users can disable frequent updates independently of Live Activities in Settings." https://developer.apple.com/videos/play/wwdc2023/10185/
- Docs: read `frequentPushesEnabled`, watch `frequentPushEnablementUpdates`, "send the value of this setting to your server and adjust the update frequency accordingly". https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications#Determine-the-update-frequency
- DTS: "just declaring it does not guarantee a larger update budget". https://developer.apple.com/forums/thread/799505
- Doc inconsistency: the ActivityAuthorizationInfo page names the key `NSSupportsFrequentLiveActivityUpdates`. The Info.plist reference and WWDC23 both use `NSSupportsLiveActivitiesFrequentUpdates`, so use that one. https://developer.apple.com/documentation/activitykit/activityauthorizationinfo

### Relevance score

- With several activities from the same app, the highest `relevance-score` wins the Dynamic Island and sorts the Lock Screen. On a tie, the first one started wins. Scores are relative (e.g. 100 vs 50). https://developer.apple.com/documentation/activitykit/activitycontent/relevancescore and https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications
- It only orders your own activities. Nothing in the docs says it ranks you against other apps. With one card per user, it does nothing for us (inference).

### Stale date and dismissal

- `stale-date`: at that time the state becomes `.stale` and `isStale` becomes true, so the UI can show "outdated". "With each update, you can advance this stale-date." https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications and https://developer.apple.com/documentation/activitykit/activitycontent/staledate
- `dismissal-date` on end: a past date removes the card at once. Leaving it out keeps the card on the Lock Screen up to 4 hours. Any date is capped at 4 hours. https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications and https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities
- Include a final `content-state` when ending. The system ignores pushes that arrive after the activity ended. https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications
- HIG: "Always end a Live Activity immediately when the task or event ends". A custom dismissal time should be "proportional to the duration", and "In most cases, 15 to 30 minutes is adequate." https://developer.apple.com/design/human-interface-guidelines/live-activities

### 8 hour active and 12 hour total

- "A Live Activity can be active for up to eight hours". After that the system ends it and removes it from the Dynamic Island. It can stay on the Lock Screen up to 4 more hours, so 12 hours maximum. https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities
- DTS confirmed: active up to 8 hours, then up to 4 hours on the Lock Screen "even though after 8, it is not showing anything new". https://developer.apple.com/forums/thread/797676
- HIG: "Live Activities work best for tracking short to medium duration activities that don't exceed eight hours." https://developer.apple.com/design/human-interface-guidelines/live-activities

### Alerts in updates

- An update can include `alert`. It lights the screen and shows the expanded view (Dynamic Island) or a banner. https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications
- On iPhone the alert title and body are not shown as a normal notification. They are used on Apple Watch. https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities
- HIG: "Alert people only for essential updates that require their attention." Alerts "by default play the notification sound". "Avoid alerting people too often", and "don't use push notifications alongside Live Activities for the same updates". https://developer.apple.com/design/human-interface-guidelines/live-activities

### What changed in iOS 17, 18, 26 and 27

- iOS 17.2: push-to-start (`pushToStartToken`). https://developer.apple.com/documentation/activitykit/activity/pushtostarttoken
- iOS 18 (June 2024): broadcast channels, Live Activities in the watchOS Smart Stack, and `input-push-token` / `input-push-channel` on push-to-start. https://developer.apple.com/documentation/updates/activitykit and https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications
- Channel facts: up to 10,000 channels per environment. "No Message Storage" allows "a higher publishing budget" and suits sports. "Most Recent Message Stored" suits "event tracking and flight updates" and keeps messages up to 8 hours. https://developer.apple.com/documentation/usernotifications/sending-channel-management-requests-to-apns and https://developer.apple.com/videos/play/wwdc2024/10069/
- iOS 26 (June 2025): Live Activities show in the Mac menu bar and in CarPlay. You can also schedule a start date with `request(...start:)`. Scheduling needs an `AlertConfiguration`, must be called from the foreground (or a `LiveActivityIntent`), and scheduled activities "count towards this limit" of simultaneous activities. https://developer.apple.com/documentation/updates/activitykit and https://developer.apple.com/documentation/activitykit/activity/request(attributes:content:pushtype:style:alertconfiguration:start:)
- iOS 27 (WWDC26): Live Activities show in the Dynamic Island in landscape too. A limited width layout (`isDynamicIslandLimitedInWidth`, 28 pt circle) is used in landscape and when two activities share the island. ActivityKit APIs are listed as beta on macOS 27.3. https://developer.apple.com/videos/play/wwdc2026/223/ and https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities and https://developer.apple.com/design/human-interface-guidelines/live-activities
- None of these releases published a number for any budget.

### Concurrent activities

- No number is published: "the exact number may depend on a variety of factors". Starting may fail if the device "reached its limit of active and scheduled Live Activities". https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities
- The error cases are `targetMaximumExceeded` (the app hit its maximum), `globalMaximumExceeded` (the device hit its maximum), `attributesTooLarge` (4 KB), `denied` and `visibility` (started from the background). https://developer.apple.com/documentation/activitykit/activityauthorizationerror
- The Dynamic Island shows up to three activities in minimal form. https://developer.apple.com/design/human-interface-guidelines/live-activities

## (b) Notifications

- Interruption levels (HIG). Passive: "view at their leisure". Active (default): "might appreciate knowing about when it arrives, like a score update". Time Sensitive: "directly impacts the person and requires their immediate attention". Critical: health and safety, needs an entitlement. Only Time Sensitive and Critical override scheduled delivery (Notification Summary) and Focus. https://developer.apple.com/design/human-interface-guidelines/managing-notifications
- Passive "adds the notification to the notification list without lighting up the screen or playing a sound". https://developer.apple.com/documentation/usernotifications/unnotificationinterruptionlevel/passive
- Time Sensitive "can break through system controls such as Notification Summary and Focus. The user can turn off" that ability. https://developer.apple.com/documentation/usernotifications/unnotificationinterruptionlevel/timesensitive
- HIG: use Time Sensitive only for an event "happening now or will happen within an hour". The system explains Time Sensitive to the person the first time, offers a way to turn it off, and "periodically" asks them to re-evaluate it. https://developer.apple.com/design/human-interface-guidelines/managing-notifications
- Notification Summary: `relevanceScore` (0 to 1) picks the featured notification in the summary. https://developer.apple.com/documentation/usernotifications/unnotificationcontent/relevancescore
- Rate limits: no published count for alert pushes. What is documented: `429 TooManyRequests` per device token, priority 5 batching, power-based throttling, and one stored message per app while offline. https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns and https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns
- Overuse, per HIG: "Avoid sending multiple notifications for the same thing", because "people may turn off all notifications from your app". https://developer.apple.com/design/human-interface-guidelines/notifications. Apple's Push Console metrics treat a rise in "Discarded - Disabled" as a sign that people find your notifications "irrelevant or noisy". https://developer.apple.com/documentation/usernotifications/viewing-the-status-of-push-notifications-using-metrics-and-apns
- App Review 4.5.4: "Push Notifications must not be required for the app to function". No sensitive data. No marketing without opt-in plus an in-app opt-out. "Abuse of these services may result in revocation of your privileges." https://developer.apple.com/app-store/review/guidelines/
- App Review 4.5.3: "Do not use Apple Services to spam, phish, or send unsolicited messages to customers, including Game Center, Push Notifications, Live Activities, etc." https://developer.apple.com/app-store/review/guidelines/
- WWDC25: "If you have an urgent or important update to show, provide a User Notification. If you have updates occurring regularly during a limited period of time, such as ... flight updates, use a Live Activity." https://developer.apple.com/videos/play/wwdc2025/278/

## (c) Other surfaces

- WidgetKit budget: a frequently viewed widget typically gets "from 40 to 70 refreshes" a day, "roughly ... every 15 to 60 minutes". Timeline entries should be "at least about 5 minutes apart". https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date
- Reloads are free when the app is in the foreground, plays audio or navigation, or runs an app intent. In StandBy the system refreshes widgets "at a system-defined rate that doesn't count against its budget". Same URL.
- WidgetKit push updates are "budgeted" and delivered "opportunistically", and they do not replace timelines. https://developer.apple.com/documentation/widgetkit/updating-widgets-with-widgetkit-push-notifications. WWDC25: "Try to keep your update pushes limited, such as by throttling updates on your server." https://developer.apple.com/videos/play/wwdc2025/278/
- WWDC26: frequent reloads from the foreground "might be throttled". For content with "a defined start and end date" that needs frequent updates and alerts, "consider building a live activity". https://developer.apple.com/videos/play/wwdc2026/277/
- Smart Stack relevance on iPhone uses `TimelineEntryRelevance` (score plus duration). A score of 0 or less means "not relevant". The `relevance()` callback is ignored on iPhone and iPad and only applies on watchOS. Donating `PredictableIntent` helps Smart Rotate. https://developer.apple.com/documentation/widgetkit/widget-suggestions-in-smart-stacks and https://developer.apple.com/documentation/widgetkit/timelineentryrelevance
- StandBy: the Live Activity shows in minimal form, and a tap expands the Lock Screen view at 2x. Check it in Night Mode (red tint). https://developer.apple.com/design/human-interface-guidelines/live-activities
- Controls (iOS 18 and later): buttons or toggles in Control Center, the Lock Screen and the Action button, built with WidgetKit and App Intents. https://developer.apple.com/documentation/widgetkit/controls-collection. HIG suggests "launching a Live Activity from a control". https://developer.apple.com/design/human-interface-guidelines/controls
- A `LiveActivityIntent` can start or change a Live Activity without opening the app. https://developer.apple.com/documentation/appintents/liveactivityintent
- HIG allows buttons in a Live Activity for actions people "temporarily pause and resume". https://developer.apple.com/design/human-interface-guidelines/live-activities
- Inference: a widget cannot follow a plane every 1 to 3 minutes. The Live Activity is the right surface. A widget fits slow facts, like "last plane" or "planes today".

## (d) Risk

Documented facts:

- There is no Apple statement that frequent Live Activity pushes get an app removed or a developer account blocked.
- The documented consequence is on-device throttling: pushes ignored, starts refused, or the card not shown, with recovery up to 24 hours. https://developer.apple.com/forums/thread/731715 and https://developer.apple.com/forums/thread/799505
- APNs side: `429` per device token, and dropped connections after many error responses. https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns
- The policy hooks that could be used against an app:
  - 4.5.3 (no unsolicited messages, Live Activities named explicitly)
  - 4.5.4 ("Abuse ... may result in revocation of your privileges")
  - 2.4.2 ("should not rapidly drain battery")
  - 2.5.16 (notifications must relate to the app)
  - 5.6.4 ("excessive customer reports" count toward quality)
  - https://developer.apple.com/app-store/review/guidelines/
- What Live Activities are for (HIG): "tasks and events that have a defined beginning and end", "short to medium duration", "Update a Live Activity only when new content is available", no ads, and one card that "rotates through events" rather than many cards. https://developer.apple.com/design/human-interface-guidelines/live-activities
- The ActivityKit overview says Live Activities exist for tracking an event "over several hours, especially for apps that push the limit of notifications". https://developer.apple.com/documentation/activitykit
- HIG warns that cards that appear unexpectedly "can be surprising or even unwanted". If people can't control them in the app, "they may choose to turn off Live Activities in Settings altogether". https://developer.apple.com/design/human-interface-guidelines/live-activities

Inference:

- The realistic risks, in order:
  1. Silent throttling on the busiest users' phones, which looks like "the app is broken".
  2. Users turning off Live Activities or the frequent-updates toggle.
  3. An App Review question under 4.5.3 if a reviewer sees cards appear and alert many times without having asked.
- An account-level penalty would need something that looks like abuse or spam. Nothing in the sources suggests normal heavy use triggers one.
- "All day, every 1 to 3 minutes" does not match the "defined beginning and end" framing. The safer reading: each "busy period" is the event, not the whole day.

## (e) Recommendation for the busy-sky case

Everything in this section is inference unless it cites a source.

Card lifecycle:

- Keep the current model: one card per user that switches planes. The HIG explicitly prefers this. https://developer.apple.com/design/human-interface-guidelines/live-activities
- Stop the 20 minute renewal. Raise the app's "end cards older than 30 min" cutoff to about 7.5 hours. Then one push-to-start covers a whole busy period instead of three or more per hour. Each renewal also forces an alert (start payloads require one). https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications
- Only renew near the 8 hour cap. Do it when the sky is quiet, never mid-pass.
- Cap push-to-start well below the observed ~10. Suggestion: at most 3 per hour and about 12 per day per user. Back off exponentially after each failed start (15 min, then 30, then 60). Treat a missing token as a likely sign of a spent budget. DTS says the budget is fixed and the window is unknown. https://developer.apple.com/forums/thread/799505
- End the card after a quiet gap, not at the moment one plane leaves. Suggestion: if no qualifying plane is expected within about 10 minutes, send `end` with a final state and `dismissal-date` = now. Then start again on the next plane. Inside the gap, show a "waiting for next plane" state.

Updates:

- Drop the 30 second keep-alive when nothing changed. The HIG says "Update a Live Activity only when new content is available."
- Let the card animate on its own instead. Use date-based SwiftUI views like timer text and timer progress, driven by an ETA or pass-end time in the content state (inference about the approach). https://developer.apple.com/documentation/widgetkit/displaying-dynamic-dates
- Send updates at priority 5 when a value the user can see changes in a meaningful way. Examples: a new plane, a new phase (approaching, overhead, leaving), or an ETA shift of 30 seconds or more. Coalesce to at most about one push per 15 to 30 seconds while a plane is overhead, and much less in between.
- Use priority 10 only for the plane switch and for `end`. If you send `end` at priority 5, set a short stale date so a late end still looks right.
- Budget priority 10 for something like 6 to 10 per hour per user. Watch `frequentPushesEnabled` from the app, and halve these rates when it is off. https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications#Determine-the-update-frequency
- Stale date: tie it to when the data really expires, for example pass-end time plus 60 to 120 seconds, rather than a fixed now+60s. Priority 5 can arrive in bursts, so a 60 second stale window will flicker to "stale" even when nothing is wrong. https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns
- No `alert` in updates. Not even for the plane switch, unless the user opted into "alert me for special aircraft".
- Do not set `relevance-score`. With one card it changes nothing.

Notifications:

- Do not send a notification per plane, because the card already shows it. HIG: "don't use push notifications alongside Live Activities for the same updates".
- If you notify at all, keep it for rare items the user picked (a specific aircraft type or airline), at `active`. Do not use `timeSensitive` for planes. https://developer.apple.com/design/human-interface-guidelines/managing-notifications
- Make sure the app works fully without notification or Live Activity permission (4.5.4).

User controls (HIG asks for in-app controls to turn cards off):

- A "Pause for 1 hour / until tomorrow" button on the card, via a `LiveActivityIntent`.
- A "busy airport mode" that only starts cards for planes below an altitude the user picks, or only for notable aircraft.
- Quiet hours.
- A Control Center control to turn the card on or off.
- https://developer.apple.com/design/human-interface-guidelines/live-activities and https://developer.apple.com/documentation/appintents/liveactivityintent

Server hygiene:

- Handle `410` by dropping the token.
- Handle `429` by delaying and halving that user's rate.
- Never retry `BadDeviceToken`, `Unregistered` and similar errors.
- Check the Push Notifications Console metrics for "Discarded" and "Stored" spikes.
- https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns and https://developer.apple.com/documentation/usernotifications/viewing-the-status-of-push-notifications-using-metrics-and-apns

Not recommended for now:

- Broadcast channels. Cards are per-user location, and channels cannot start cards.
- Scheduled start. Planes are not predictable from the foreground app.

## Sources

Apple developer documentation
- https://developer.apple.com/documentation/activitykit
- https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications
- https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities
- https://developer.apple.com/documentation/activitykit/activitycontent/relevancescore
- https://developer.apple.com/documentation/activitykit/activitycontent/staledate
- https://developer.apple.com/documentation/activitykit/activityauthorizationinfo
- https://developer.apple.com/documentation/activitykit/activityauthorizationerror
- https://developer.apple.com/documentation/activitykit/activity/pushtostarttoken
- https://developer.apple.com/documentation/activitykit/activity/request(attributes:content:pushtype:style:alertconfiguration:start:)
- https://developer.apple.com/documentation/updates/activitykit
- https://developer.apple.com/documentation/bundleresources/information-property-list/nssupportsliveactivitiesfrequentupdates
- https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns
- https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns
- https://developer.apple.com/documentation/usernotifications/viewing-the-status-of-push-notifications-using-metrics-and-apns
- https://developer.apple.com/documentation/usernotifications/sending-channel-management-requests-to-apns
- https://developer.apple.com/documentation/usernotifications/unnotificationinterruptionlevel/passive
- https://developer.apple.com/documentation/usernotifications/unnotificationinterruptionlevel/timesensitive
- https://developer.apple.com/documentation/usernotifications/unnotificationcontent/relevancescore
- https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date
- https://developer.apple.com/documentation/widgetkit/updating-widgets-with-widgetkit-push-notifications
- https://developer.apple.com/documentation/widgetkit/widget-suggestions-in-smart-stacks
- https://developer.apple.com/documentation/widgetkit/timelineentryrelevance
- https://developer.apple.com/documentation/widgetkit/displaying-dynamic-dates
- https://developer.apple.com/documentation/widgetkit/controls-collection
- https://developer.apple.com/documentation/appintents/liveactivityintent

Human Interface Guidelines
- https://developer.apple.com/design/human-interface-guidelines/live-activities
- https://developer.apple.com/design/human-interface-guidelines/notifications
- https://developer.apple.com/design/human-interface-guidelines/managing-notifications
- https://developer.apple.com/design/human-interface-guidelines/controls

App Store Review Guidelines (2.4.2, 2.5.16, 4.5.3, 4.5.4, 5.6.4)
- https://developer.apple.com/app-store/review/guidelines/

WWDC sessions
- https://developer.apple.com/videos/play/wwdc2023/10184/ (Meet ActivityKit)
- https://developer.apple.com/videos/play/wwdc2023/10185/ (Update Live Activities with push notifications)
- https://developer.apple.com/videos/play/wwdc2023/10194/ (Design dynamic Live Activities)
- https://developer.apple.com/videos/play/wwdc2024/10069/ (Broadcast updates to your Live Activities)
- https://developer.apple.com/videos/play/wwdc2025/278/ (What's new in widgets)
- https://developer.apple.com/videos/play/wwdc2026/223/ (Live Activities essentials)
- https://developer.apple.com/videos/play/wwdc2026/277/ (WidgetKit foundations)

Apple staff on the Developer Forums
- https://developer.apple.com/forums/thread/799505 (DTS, push-to-start budget, Sep 2025)
- https://developer.apple.com/forums/thread/797676 (DTS, 8h and 12h)
- https://developer.apple.com/forums/thread/747624 (Apple Engineer, per-user budget undocumented, Mar 2024)
- https://developer.apple.com/forums/thread/731715 (Frameworks Engineer, throttling causes, up to 24h recovery, May 2024)
- https://developer.apple.com/forums/thread/748569 (Frameworks Engineer, update throttling, Jun 2024)
