# AI agents: should Overhead be reachable from ChatGPT, Claude, Gemini and Siri?

Researched 2026-11-07 from primary sources: the Model Context Protocol specification, Anthropic's connector and directory docs, OpenAI's Apps SDK docs, Google's Gemini CLI, Gemini Enterprise and Android docs, Perplexity's help center, Apple's App Intents documentation and WWDC sessions, the App Review Guidelines, Expo's docs, and the data providers' terms. Every claim has its URL next to it. "Inference" marks my own reasoning. Nothing was added to the codebase.

The goal this is measured against (PRODUCT.md): you hear a plane, glance at your phone, and know where it is going, before it is gone. Every agent path below is pull-based: someone has to ask. The card already answers before you could ask, so no agent path improves the core goal much. That frames everything below (inference).

Related: docs/research/ai-opportunities.md section 10 already covers "Hey Siri, what plane is that?" briefly. This file goes deeper on it and on everything else.

## Summary

1. A remote MCP server is technically small: one Streamable HTTP endpoint on the existing Express app, one read-only tool, no auth. Claude (all plans, Free is limited to one custom connector), ChatGPT developer mode, Gemini CLI, Gemini Enterprise and Perplexity can all connect to an authless server.
2. The blocker is data rights, not code. Flightradar24's terms prohibit "reselling, transferring, redistributing ... or manipulating raw data accessed via the FR24 API". A public tool that returns FR24 routes to any AI platform is hard to square with that. adsb.fi is "personal, non-commercial use only", needs attribution, and allows 1 request per second, a budget the watcher already shares between phones.
3. Flightradar24 already ships an official MCP server (MIT, local, the user's own API key). The data owner already covers "where is flight X going" for agents. An Overhead MCP would be a worse copy of it.
4. Per-user tools ("what's flying over me") need to link a chat account to a phone. That means OAuth and an identity, which breaks the no-accounts promise. Anonymous tools by place name are possible: the model can pass coordinates itself, and ChatGPT sends a coarse `openai/userLocation` hint.
5. Siri is the one path that fits the product. An App Shortcut ("What's above me in Overhead") works from iOS 16 with no Apple Intelligence. Expo SDK 58 ships `expo-app-intents` (alpha). It needs one small Swift file. Apple's new Siri AI Developer Preview even drops the app name while a Live Activity is active, but only for development builds and internal TestFlight testers.
6. Android AppFunctions are experimental, need Android 16, and their Gemini link is in private preview. Overhead is iOS-only. Skip.
7. llms.txt is a proposal. Google says no AI files are needed for its AI features, and Lighthouse checks for llms.txt only in an experimental audit. Overhead has no public website or public API to describe, so there is nothing to add.
8. Recommendation: no MCP server and no public API now. Build one App Shortcut with `expo-app-intents` (effort S). If an MCP demo is wanted for the portfolio, keep it positions-only (no FR24 data), served from cache, rate-limited and unlisted, and ask Flightradar24 before adding routes.

## 1. Remote MCP server

### What the protocol asks for

- Streamable HTTP is the remote transport. The server "MUST provide a single HTTP endpoint path ... that supports both POST and GET". Session IDs are optional ("MAY assign a session ID"), so a stateless server is allowed. Servers "MUST validate the `Origin` header on all incoming connections" and "SHOULD implement proper authentication". https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
- Authorization "is OPTIONAL for MCP implementations". When it is used, the MCP server is an OAuth 2.1 resource server, "MUST implement OAuth 2.0 Protected Resource Metadata (RFC9728)", clients must use PKCE with S256, and tokens must be audience-bound (RFC 8707). Client ID Metadata Documents are the preferred registration method and Dynamic Client Registration is a fallback. https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- The official TypeScript SDK has an Express adapter (`@modelcontextprotocol/express`). https://github.com/modelcontextprotocol/typescript-sdk
- Inference: an anonymous, read-only tool needs no OAuth at all. OAuth only matters for per-user tools (see "Identity" below). Overhead would need its own authorization server for that, or a hosted one. That is the L-sized part.

### Which assistants can use it

- Claude: "Custom connectors using remote MCP are available ... for users on Free, Pro, Max, Ultra, Team, and Enterprise plans. Free users are limited to one custom connector." Requests come "from Anthropic's cloud infrastructure, rather than from your local device". https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp
- Claude supports `none` (authless), OAuth with DCR or CIMD, and Anthropic-held OAuth clients. Static API-key headers are "Beta, for a limited set of organizations". All traffic "originates from `160.79.104.0/21`". https://claude.com/docs/connectors/building/authentication
- Claude Code: `claude mcp add --transport http <name> <url>`, with `--header` for a key, and OAuth. https://code.claude.com/docs/en/mcp
- Claude directory listing: any paid plan can submit. Requirements are an HTTPS URL, "OAuth 2.0 if your tools act on a user's account, or no authentication for public data", a `title` plus `readOnlyHint` or `destructiveHint` on every tool, a documentation URL, a privacy policy URL, a support contact and an icon. A "Data handling" step asks whether the underlying API is "your own, proxied from a partner with permission, or a third party's you don't control". After an automatic scan, a submission is listed "as a Community connector". https://claude.com/docs/connectors/building/submission
- Claude directory policy: software "must not infringe on the intellectual property rights of others" and "must not collect extraneous conversation data". https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy
- ChatGPT: "Many plugin MCP servers can operate in a read-only, anonymous mode." With OAuth, it needs protected resource metadata and PKCE S256, with CIMD preferred and DCR "still supported". https://developers.openai.com/apps-sdk/build/auth
- ChatGPT developer mode for testing: the help center article says full MCP (read and write) is for Business and Enterprise/Edu, and Pro users can connect custom servers with read/fetch permissions. The page returned 403 to my fetcher, so this comes from its search snippet. https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt
- ChatGPT submission: verification of the person or organization; website, support, privacy policy and terms of service URLs; "Five positive test cases", "Three negative test cases", a video and a test account; "a stable, public HTTPS endpoint". Auth can be "no authentication, OAuth, and mixed". https://developers.openai.com/apps-sdk/deploy/submission
- ChatGPT guidelines that bite here: "Don't ... integrate with third-party APIs without proper authorization", "Trial or demo plugins will not be accepted", "Gather only the minimum data required", and use coarse location rather than precise. https://developers.openai.com/apps-sdk/app-submission-guidelines
- ChatGPT passes `_meta["openai/userLocation"]` (city, region, country, timezone, latitude, longitude) as "a hint only". https://developers.openai.com/plugins/reference
- Gemini CLI supports Stdio, SSE and Streamable HTTP (`httpUrl`), with automatic OAuth discovery. https://geminicli.com/docs/tools/mcp-server/
- Gemini Enterprise (Business edition) accepts custom MCP servers with "No authentication" or "OAuth 2.0". "The legacy `SSE` transport is not supported; only the new StreamableHTTP transport is compatible." https://support.google.com/g/answer/17106276?hl=en. Google's MCP Apps guide is about Gemini Enterprise too. I found no primary source saying the consumer Gemini app accepts third-party MCP servers. https://cloud.google.com/blog/topics/developers-practitioners/devs-guide-to-mcp-apps-in-gemini
- Perplexity: custom remote connectors with authentication "OAuth, API Key, or None" and transport "Streamable HTTP or SSE". The article does not say which plans. https://www.perplexity.ai/help-center/en/articles/13915507-adding-custom-remote-connectors

### The existing alternative

- Flightradar24 publishes an official MCP server, `@flightradar24/fr24api-mcp`, under MIT. It has live positions by bounds, flight summaries (origin and destination) and history. It runs locally over stdio with the user's own `FR24_API_KEY`. https://github.com/Flightradar24/fr24api-mcp
- Inference: anyone who wants "where is flight X going?" in Claude can already get it from the data owner, within FR24's terms, paid by their own key. Overhead's edge is proactive, location-aware timing, and a chat tool cannot carry that.

### Anonymous tool by place name

What it would look like (inference): one tool, `planes_over(latitude, longitude)`, read-only. It returns the lowest few planes within about 10 km, each with flight, aircraft type, altitude, distance and bearing. Routes are left out (see section 5).

- Geocoding can stay out of the server. The tool takes coordinates and its description tells the model to pass the place's coordinates. ChatGPT can also fill them from `openai/userLocation`. A 10 km area forgives a model's rough guess (inference).
- If server-side geocoding were wanted, the OSM Nominatim service forbids it at app scale: "an absolute maximum of 1 request per second", no "Systematic queries", and limited capacity. https://operations.osmfoundation.org/policies/nominatim/. An offline GeoNames cities file works instead (CC BY 4.0, about 25,000 places in cities15000). https://download.geonames.org/export/dump/readme.txt
- The server already shares one feed call per 10 km area per tick (README "Limits"). An agent query for a new area costs a fresh adsb.fi call against a 1 request per second budget (section 5). Inference: answer only from areas already in the cache, or from one global, slow-refill bucket, so agents can never delay a phone's card.

### Identity: per-user tools

- "What's flying over me" or "turn my cards off" needs the chat user mapped to a phone. Today the only proof of a phone is its device ID plus a shared app key (README "Limits"). Exposing that to an AI platform would let anyone holding a device ID read that phone's sky (inference).
- Doing it properly means an OAuth authorization server and a link between an OAuth subject and a device. That is an account in all but name. It breaks PRIVACY.md's "There is no account to create". Under App Review 5.1.1(v), it would also bring in-app account deletion: "If your app supports account creation, you must also offer account deletion within the app." https://developer.apple.com/app-store/review/guidelines/
- Claude sends every user's traffic from one IP range (above). The server cannot tell callers apart without auth, which also means it learns nothing about them (inference).

### Hosting, rate limits and cost

- Hosting: the existing VM and Caddy. The MCP route mounts on the same Express app, with its own router and no app key (inference).
- The e2-micro free tier includes "1 GB of outbound data transfer ... per month". https://docs.cloud.google.com/free/docs/free-cloud-features. Inference: a 2 KB answer is about 500,000 answers per GB, so egress is not the limit. The feed budget is.
- Flightradar24 credits: the Explorer tier is "30,000 data credits per month ... for $9 a month". https://www.flightradar24.com/blog/b2b/how-to-get-started-with-the-flightradar24-api/. Inference: any tool that triggers route lookups for areas nobody watches spends the founder's credits on strangers.
- Abuse controls (inference): a global token bucket per tool, a cache-only mode, a 2 KB body limit (already in `app.ts`), and logs that never record tool arguments. That last one extends the existing test that logs never contain a location.

### Verdict for this path

- User value: low. It answers a question nobody asks while the plane is overhead, and FR24's own MCP already does it better.
- Effort: M for authless and listed (endpoint, tool, limits, a public privacy policy page, a listing, test cases). L for per-user OAuth.
- Risks: FR24 terms, adsb.fi non-commercial terms and attribution, a feed budget shared with real users, a public unauthenticated endpoint, and ChatGPT's "no demo" rule.
- Portfolio signal: medium-high in Berlin startups right now (MCP is current), but only if it is clean. An MCP server that breaks a data provider's terms is a negative signal in an interview.

## 2. Siri, App Intents, Shortcuts, Spotlight

### What exists

- `AppShortcut` and `AppShortcutsProvider` are available from iOS 16.0. https://developer.apple.com/documentation/appintents/appshortcut and https://developer.apple.com/documentation/appintents/appshortcutsprovider
- App Shortcuts need zero setup, are available right after install, are limited to 10 per app, and their phrases must include `.applicationName`. App Intents are written in Swift. https://developer.apple.com/videos/play/wwdc2022/10170/. They appear in Siri, Spotlight, the Shortcuts app and the Action button. https://developer.apple.com/design/human-interface-guidelines/app-shortcuts
- An intent can return a dialog and a SwiftUI snippet (`ProvidesDialog`, `ShowsSnippetView`). Same WWDC22 session.
- Interactive snippets (`SnippetIntent`) need iOS 26. "Similar to widgets and Live Activities, a snippet can include buttons or toggles", and "you might be able to reuse views of your interactive widget". https://developer.apple.com/documentation/appintents/snippetintent and https://developer.apple.com/videos/play/wwdc2025/275/
- `LiveActivityIntent` (iOS 17) lets an intent start a Live Activity "without opening the app". https://developer.apple.com/documentation/appintents/liveactivityintent. Inference: "Hey Siri, watch the sky in Overhead" could start the card on demand, but the server already starts it by push, so this adds little.

### Apple Intelligence and the new Siri

- App schema domains: audio, calendar, camera, clock, mail, maps, messages, notes, phone, photos, reminders, search and video, plus assistant and visual intelligence, plus Shortcuts-only domains (books, browser, files and others). https://developer.apple.com/documentation/appintents/app-schema-domains. None covers flights or the sky. Maps is about navigation (inference).
- WWDC26: "App Intents expose actions to the system. App schemas make those actions understandable by Siri." https://developer.apple.com/videos/play/wwdc2026/240/
- The Siri AI Developer Preview goes beyond schemas: Siri can perform "custom actions and information". People "don't have to mention your app in their request while your app is in the foreground, while a Live Activity is active". The catch: it "isn't available to external testers in TestFlight or to versions of your app that you publish on the App Store". https://developer.apple.com/documentation/appintents/siri-ai-developer-preview
- Inference: this is the one place an assistant fits Overhead's moment. While the card is on screen, "Hey Siri, where's that plane going?" could resolve to Overhead with no app name. Today it would only work for the founder and internal testers.
- On-screen awareness ties visible content to entities through `NSUserActivity` or view annotations. https://developer.apple.com/videos/play/wwdc2026/343/. The Lock Screen card is a Live Activity, not an app view, so this would only cover the in-app card (inference).
- Availability: Siri AI "will not be initially available in the EU on iOS". Hebrew is not a supported language. It needs an Apple Intelligence iPhone (15 Pro or later). https://www.apple.com/apple-intelligence/. Inference: Berlin testers (EU) and Hebrew-language Siri users would not get Siri AI. A plain App Shortcut works for all of them.

### Expo and React Native

- Expo SDK 58 ships `expo-app-intents`. It is "currently in alpha and will frequently experience breaking changes", supports iOS 16.4 and later, and is "not available in Expo Go". You "cannot create App Intent types dynamically from JavaScript ... Declare the `AppIntent` types you need in Swift." It supports `AppShortcutsProvider`, Spotlight, `openAppWhenRun`, and handing an intent to JavaScript. https://docs.expo.dev/versions/latest/sdk/app-intents/ and https://expo.dev/blog/introducing-expo-app-intents
- The alternative is `@bacons/apple-targets`, which generates native targets including an "app-intent" extension. https://github.com/EvanBacon/expo-apple-targets
- Overhead is already on Expo 58 with `expo-widgets` and a dev build (app/package.json), and the card is already SwiftUI. Inference: adding Swift is not a new kind of work for this repo.

### Verdict for this path

- User value: low to medium. It is hands-free, it covers the "I missed the card" case, and it reads the same snapshot `GET /sky` serves. It does not beat the card.
- Effort: S for one App Shortcut with a spoken answer (one Swift intent calling `GET /sky`, phrases, a dev build). M to also add a snippet that reuses the card view and the Siri AI preview.
- Risks: the alpha module may break between SDKs. The data stays inside Overhead's own app for its own user, so FR24 and adsb.fi use does not change (inference). Nothing new reaches a third party. Siri handles the phrase on Apple's side, and the answer comes from Overhead's server.
- Portfolio signal: medium. Swift in an Expo app, a 2026 Expo alpha module, and a feature that fits the product.

## 3. Android and Gemini

- AppFunctions are "in an experimental preview", available "on devices running Android 16 or higher". "As of May 2026, AppFunctions integration with Gemini is in a private preview with trusted testers." Only "a limited number of apps and system agents can access the entire pipeline." https://developer.android.com/ai/appfunctions
- Assistant App Actions still exist (built-in intents in `shortcuts.xml`, Android 5 and later). https://developer.android.com/develop/devices/assistant/overview
- Verdict: Overhead has no Android app. Value none, effort L (a whole Android app first), no portfolio signal for now.

## 4. Agent-readable web presence

- llms.txt was proposed by Jeremy Howard on 3 September 2024. It is not a standards-body specification. Its authors say it is used "mainly ... for inference rather than training". https://llmstxt.org/
- Google: "You don't need to create new machine readable files, AI text files, or markup to appear in these features." https://developers.google.com/search/docs/appearance/ai-features
- Lighthouse checks for llms.txt in its Agentic Browsing category, which is "experimental and based on proposed standards". https://developer.chrome.com/docs/lighthouse/agentic-browsing/scoring
- Anthropic and the MCP site publish llms.txt for their own docs (the header on https://claude.com/docs/connectors/building/submission and https://modelcontextprotocol.io/specification/2025-11-25/basic/transports). That shows publishers, not that consumers fetch it on their own.
- Inference: the evidence is that docs sites publish it and coding agents read it when pointed at it. There is no primary source of a search or chat product fetching it on its own. Overhead has no public site yet (the README links only to TestFlight). If the personal website gets an Overhead page, a 10-line llms.txt costs nothing, but expect no traffic from it.
- OpenAPI: the API is private (shared app key, device ID). Publishing a description of `POST /register` and `GET /sky` invites the abuse the README already warns about, and there is no public endpoint to describe (inference).
- A public read-only endpoint has the same licensing and budget problems as the MCP tool (sections 1 and 5).
- Verdict: value none for the goal, effort S, low portfolio signal.

## 5. Data licensing

- adsb.fi: "personal, non-commercial use only. You may not license, sell, rent, or lease any part of the data". "You must cite adsb.fi and include a link". Public endpoints are "rate limited to 1 request per second". https://github.com/adsbfi/opendata. Inference: a free MCP tool is still non-commercial, but it needs attribution in every answer. Once the portfolio piece is shown to employers, "non-commercial" is a judgment call worth an email to adsb.fi.
- adsb.lol (fallback) is ODbL 1.0. https://www.adsb.lol/docs/open-data/api/. ODbL permits reuse with attribution and share-alike, which suits an agent tool better than adsb.fi.
- Flightradar24 Terms of Service (last updated 23 June 2026), section 6.3.1. https://www.flightradar24.com/terms-of-service (the page refuses automated fetches; I read it with a browser user agent):
  - "You are prohibited from reselling, transferring, redistributing, lending, leasing, sublicensing or manipulating raw data accessed via the FR24 API."
  - Prohibited: "Using the FR24 API to supplement or backfill any other near-time or real-time flight data sourced from an alternative data provider for any commercial or non-commercial use."
  - Prohibited: "storing the data accessed via the FR24 API beyond the storage restrictions specified in our API documentation". Section 2: "you can temporarily cache or store retrieved data for a limited time as documented per endpoint within the API Portal".
  - 6.3.2 allows derivative data sets "by adding significant value to the data and/or the data itself not being the main selling point".
- Inference on FR24 and an MCP tool: Overhead's card arguably fits 6.3.2, since the route is one line inside a timed, location-aware product. A tool that answers "where is flight X going?" with FR24's origin and destination makes the route the main selling point, and it hands it on to Anthropic or OpenAI and to anyone who connects. That reads as redistribution of raw data. Do not put FR24 fields in any agent-facing output without written permission.
- Inference, and a risk for the existing app that needs checking: the "supplement or backfill" clause could be read as covering what Overhead does today, FR24 routes joined onto adsb.fi positions. The route cache in `server/src/flights/routes.ts` keeps entries for a calendar day. The per-endpoint cache limit sits in the JS-rendered API portal, and I could not read it. Check both in the portal, or ask FR24 support, before anything grows.
- EASA ANP: the current database terms forbid "sharing with third parties" and publishing without consent (clauses 6(d) and 6(g)). The legacy 2.3 tables have no stated license (docs/research/hearing-planes.md). Inference: a tool may return a computed "you'd hear it at about 50 dBA" estimate, which is a derived number, but never the NPD rows.
- App Review 5.2.2: "If your app uses, accesses, monetizes access to, or displays content from a third-party service, ensure that you are specifically permitted to do so under the service's terms of use." https://developer.apple.com/app-store/review/guidelines/

## 6. Abuse, cost and privacy

- Agents hammering the API (inference): an authless MCP URL is public the moment it is listed. One busy chat user can trigger a call for a new 10 km area on every turn. With a 1 request per second adsb.fi budget shared with the watcher, that can push phones' cards late. Answer from cache only, or from a global bucket of a few calls a minute, and return "no data for that area right now" when it is empty.
- Scraping (inference): a free planes-by-coordinate endpoint turns Overhead into an adsb.fi proxy without its rate limit, which breaks the spirit of adsb.fi's terms. A grid of `planes_over` calls is exactly Nominatim's forbidden "systematic queries" pattern applied to us.
- Location exposure (inference): with place-name tools, the user tells the AI platform where they are, and the platform sends coordinates to Overhead. Overhead stores nothing and logs nothing, but the location now also sits in the chat provider's history. That is the user's choice, but it differs from the app, where a location rounded to about 100 m goes only to Overhead.
- App Review 5.1.2(i): "You must clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission before doing so." https://developer.apple.com/app-store/review/guidelines/. Inference: an MCP tool fed by the chat side does not share app data with AI. Any app feature that sends the phone's location to an AI provider would need that consent.
- Cost (inference): the VM and egress are effectively free at this scale. The real costs are FR24 credits (avoid them entirely in agent paths) and founder time on a public endpoint: reviews, abuse and an extra privacy policy section.

## Recommendation

Do not build an MCP server, an OpenAPI description or a public endpoint now. They do not serve "answer at a glance", Flightradar24 already covers flight lookups for agents, and re-serving FR24 routes conflicts with section 6.3.1 of its terms. Per-user tools would also need accounts, which Overhead has chosen not to have.

Do build the Siri path first, because it is the only one that fits the product and the privacy model:

1. Smallest version: one App Shortcut, "What's above me in Overhead" (plus "What plane is that in Overhead"). Its `perform()` calls `GET /sky` and speaks the card text, for example "Lufthansa A321neo, Frankfurt to Berlin, above you now". If there is no card, it says "No low planes near you right now". No snippet, no Apple Intelligence and no new server code. Effort S.
2. Next, only if the beta asks for it: a snippet that reuses the Live Activity view (iOS 26 `SnippetIntent`), then the Siri AI Developer Preview for the founder's own phone, to show "where's that plane going?" with no app name while the card is up.
3. Portfolio MCP, optional and later: a positions-only tool (adsb.lol ODbL data plus the hearing estimate, no FR24 fields), served from cache, globally rate-limited, authless, connected as a custom connector in Claude and not listed. Email Flightradar24 first if routes are ever wanted in it.

First concrete step: add `expo-app-intents` to `app/app.json`. Declare one Swift `AppIntent` and an `AppShortcutsProvider` with phrases that include `\(.applicationName)`, and have `perform()` call `GET /sky` with the same device ID and app key the app uses, returning `.result(dialog:)`. Build a dev build and say "What's above me in Overhead" on the founder's iPhone while a card is up.

Separately, and more urgent than any of this: check the Flightradar24 API portal's cache limit for flight-summary, and read the "supplement or backfill" clause against the current adsb.fi plus FR24 design, before inviting the 5 to 10 testers.

## Sources

Model Context Protocol
- https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
- https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- https://github.com/modelcontextprotocol/typescript-sdk

Anthropic
- https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp
- https://claude.com/docs/connectors/building/authentication
- https://claude.com/docs/connectors/building/submission
- https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy
- https://code.claude.com/docs/en/mcp

OpenAI
- https://developers.openai.com/apps-sdk/build/auth
- https://developers.openai.com/apps-sdk/deploy/submission
- https://developers.openai.com/apps-sdk/app-submission-guidelines
- https://developers.openai.com/plugins/reference
- https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt (read via search snippet, the page returned 403)

Google
- https://geminicli.com/docs/tools/mcp-server/
- https://support.google.com/g/answer/17106276?hl=en
- https://cloud.google.com/blog/topics/developers-practitioners/devs-guide-to-mcp-apps-in-gemini
- https://developer.android.com/ai/appfunctions
- https://developer.android.com/develop/devices/assistant/overview
- https://developers.google.com/search/docs/appearance/ai-features
- https://developer.chrome.com/docs/lighthouse/agentic-browsing/scoring
- https://docs.cloud.google.com/free/docs/free-cloud-features

Perplexity
- https://www.perplexity.ai/help-center/en/articles/13915507-adding-custom-remote-connectors

Apple
- https://developer.apple.com/documentation/appintents/appshortcut
- https://developer.apple.com/documentation/appintents/appshortcutsprovider
- https://developer.apple.com/documentation/appintents/snippetintent
- https://developer.apple.com/documentation/appintents/liveactivityintent
- https://developer.apple.com/documentation/appintents/app-schema-domains
- https://developer.apple.com/documentation/appintents/siri-ai-developer-preview
- https://developer.apple.com/videos/play/wwdc2022/10170/
- https://developer.apple.com/videos/play/wwdc2025/275/
- https://developer.apple.com/videos/play/wwdc2026/240/
- https://developer.apple.com/videos/play/wwdc2026/343/
- https://developer.apple.com/design/human-interface-guidelines/app-shortcuts
- https://developer.apple.com/app-store/review/guidelines/
- https://www.apple.com/apple-intelligence/

Expo
- https://docs.expo.dev/versions/latest/sdk/app-intents/
- https://expo.dev/blog/introducing-expo-app-intents
- https://github.com/EvanBacon/expo-apple-targets

Data providers and geocoding
- https://github.com/adsbfi/opendata
- https://www.adsb.lol/docs/open-data/api/
- https://www.flightradar24.com/terms-of-service
- https://www.flightradar24.com/blog/b2b/how-to-get-started-with-the-flightradar24-api/
- https://github.com/Flightradar24/fr24api-mcp
- https://operations.osmfoundation.org/policies/nominatim/
- https://download.geonames.org/export/dump/readme.txt
- https://llmstxt.org/

## Red-team of the recommendation

Ranked by impact if wrong, times how likely it is wrong, times how cheap it is to check.

1. **Claim: today's design is allowed by Flightradar24's terms.**
   - Fails if: joining FR24 routes onto adsb.fi positions counts as "supplementing" another provider's real-time data, or a 24 h route cache breaks FR24's per-endpoint cache limit. Then the core card loses its route line, agents or not.
   - Evidence this week: the cache limit on the FR24 API portal (logged in), and a short email to FR24 support describing exactly what Overhead does.
   - Kill criterion: FR24 says no, or does not answer before friends are invited. Then switch the route lookup to a source that allows it, or shorten the cache to their limit.
   - Cheapest test: the support email. One paragraph, no code.
2. **Claim: people will ask Siri what is above them.**
   - Steelman: when the card was missed or dismissed, or the phone is in a pocket, asking is faster than opening the app.
   - Fails if: the card already answers before anyone thinks to ask, so the shortcut goes unused.
   - Evidence this week: in your own week, count the times you wanted the answer and the card was not there.
   - Kill criterion: fewer than one use per tester per week during the beta, counted on the server as a request total by type, with no IDs.
   - Cheapest test: none before the next build. Bundle it into the next app build and do not spend a build on it alone.
3. **Claim: `expo-app-intents` (alpha) builds next to `expo-widgets`.**
   - Fails if: the two config plugins clash, or the alpha breaks the EAS build, which costs one of 15 monthly builds and cannot be tried locally without a Mac.
   - Kill criterion: one failed build, then drop it until the package is stable.
   - Cheapest test: run `npx expo prebuild` on Windows and read the generated Xcode project and entitlements for conflicts before spending a build.
4. **Claim: skipping MCP is the right portfolio call.**
   - Steelman: a written, sourced decision not to build (data rights, privacy, no user value) shows more judgment than a demo.
   - Fails if: the Berlin roles you want screen for hands-on agent or MCP work.
   - Evidence this week: count MCP or agent mentions in the next 10 job posts you would apply to.
   - Kill criterion: 4 or more of 10. Then build the unlisted, positions-only MCP demo (no FR24 fields, cached, rate-limited, adsb.fi attributed).

What holds up: skipping per-user agent tools (they need accounts, which breaks the no-accounts promise and adds App Review account-deletion duties), skipping llms.txt (no evidence anyone reads it, and there is no public site), and skipping Android (the app is iOS-only).

What could not be assessed: FR24's exact cache limit, how well Siri reads the card aloud, and current ChatGPT and Perplexity plan rules.
