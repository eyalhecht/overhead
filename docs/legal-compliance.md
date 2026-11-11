# Overhead - legal compliance before a public App Store launch

Researched 10 November 2026 for the current build, then re-checked on 11 November 2026 against the planned design in `docs/research/scalability.md` (not built yet). Primary sources only: the laws, regulators, Apple's guidelines and help pages, and each provider's own terms. Every claim has its URL. "Inference" marks my reading where the source does not say it outright. Scope: EU/Germany, US, Israel; a free iPhone app by an individual in Berlin, server on Google Cloud (us-central1 today, maybe an EU region).

The new design in short: FlyItalyADSB Pro positions with adsb.lol as fallback; one shared snapshot per region (or the world) every ~5 s, filtered per phone on the server; routes from Virtual Radar Server (VRS) standing data, with Airlabs or FlightAware AeroAPI only for misses and only for planes on a card; phones that cannot receive a card are not watched; a bigger VM, maybe in the EU.

## Summary

- The new design removes both old data blockers: Flightradar24 (the "supplement or backfill" ban) and adsb.fi ("personal, non-commercial use only") are gone, and so is adsbdb, whose route data needs permission. They still apply to the build running today, so do not submit the current build.
- A new blocker takes their place: the paid route fallback. FlightAware's Standard licence bans using its data "in conjunction with" another real-time provider's data without written permission, the same problem FR24 had. Airlabs has no such clause, but no explicit display licence either. Use Airlabs with a written OK, or launch with VRS only.
- FlyItalyADSB allows commercial use in apps on every plan, but its data is CC BY-SA 4.0: a credit with link and licence notice, and share-alike for anything derived from it that we publish.
- Privacy gets simpler: the feeds no longer receive any area derived from a user, so only Google (hosting) and Apple (push) process user data. Still open: the Precise Location label, the policy gaps, deletion, the Impressum, the Art. 30 record and the App Store Connect paperwork.
- Monetizing: FlyItalyADSB needs no new licence. FlightAware Standard allows passing data to users only "without additional fee". The DSA, Gewerbe, residence-permit and consumer-law points stay.

## What changed with the new design

Resolved, once the new design ships:
- Old item 1, FR24 "supplement or backfill" (and the FR24 "significant value" rule, credit limits and trademark caution): FR24 is dropped.
- Old item 2, adsb.fi "personal, non-commercial" and its missing credit: adsb.fi is dropped.
- adsbdb route data "may not be copied, published, or incorporated into other databases without the explicit permission" of its author https://github.com/mrjackwills/adsbdb (found during the scalability research; it applies to today's `routes.ts` fallback): adsbdb is dropped.
- Feeds receiving the centre of a ~10 km area around each phone: gone with the shared snapshot.
- US transfer of the stored data: resolved for data at rest only if the VM moves to the EU. Google access from abroad and Apple APNs remain (item 4).

Remain as they were: 3 (Precise label), 5 (deletion), 6 (Impressum), 10 (App Store Connect), most of "Fix before monetizing", most of "Nice to have".

Change: 4 (policy: new recipient list, region), 7 (notices: CC BY-SA, ODbL, CC0), 8 (disclaimer: new sources), 9 (Art. 30 record).

New: 1 (FlyItalyADSB CC BY-SA), 2 (paid route fallback), 11 (switch-over), the FlightAware fee clause and CC BY-SA "no downstream restrictions" before monetizing, VRS data provenance and adsb.lol's planned key under "Nice to have".

## Privacy: what the new design changes

- **Feeds see no user-derived area.** The server downloads one snapshot per region or the world, so FlyItalyADSB and adsb.lol see only the server's IP and a fixed box. FlyItalyADSB logs "IP address, date and time, requested path and user agent" https://flyitalyadsb.com/privacy/; adsb.lol keeps "temporary logs for under 30 days" https://www.adsb.lol/docs/privacy-license/. Inference: neither receives personal data any more, so both leave the recipients list. Keep the adsb.lol fallback boxes fixed (a region or a fixed metro list), never built around a phone, or the old exposure comes back.
- **Route providers get callsigns only,** and now only for planes on a card. Inference: a callsign at a time hints that some user was near that plane, but with no user ID and only the server's IP it is not personal data for them. Say "receive callsigns, no user data".
- **Fewer phones watched.** Not watching phones that cannot get a card fits data minimisation, data "limited to what is necessary" (Art. 5(1)(c)) https://eur-lex.europa.eu/eli/reg/2016/679/oj. Inference: their last location is still stored until the 30-day purge, so the policy must still list it.
- **Processors left:** Google Cloud (hosting, under its DPA https://cloud.google.com/terms/data-processing-addendum) and Apple (APNs: push tokens and card contents).
- **PRIVACY.md and the public policy must now say:**
  - "Where it goes": the position feeds (FlyItalyADSB, adsb.lol) receive no user data; the server fetches one snapshot per region and does the matching itself.
  - Routes come from a local copy of VRS data; for a plane on a card that VRS misses, Airlabs (or FlightAware) receives its callsign, no user data. Remove adsb.fi and Flightradar24.
  - The region (for example "Google Cloud, europe-west3, Frankfurt, Germany") and, either way, the Google transfer safeguard (item 4).
  - Phones that cannot receive a card are not checked; their stored data is still deleted after 30 days.
  - Label: Precise Location (item 3). Basis: PRIVACY.md says consent, item 4 suggests Art. 6(1)(b); pick one (lawyer question 3).

## Blockers before App Store submission

Ordered by risk: first what could get the data cut off or the app rejected, then legal duties with fines.

### 1. FlyItalyADSB: CC BY-SA 4.0 credit and share-alike (new)

- **Plan:** Pro, EUR 49 + VAT a month: radius "the whole world", "300 per minute, per key", "10,000,000 a month" https://flyitalyadsb.com/data/api/. Provider: Nesso Labs S.r.l., Brescia, Italy; "Italian law applies" https://flyitalyadsb.com/terms/.
- **What is fine:** "Commercial use is allowed on every plan, Free included, within that plan's limits", and "your server can use it to serve your product's users, caching the responses too" https://flyitalyadsb.com/terms/. "The key can be built into an app or device you distribute or sell" https://flyitalyadsb.com/data/api/. For Apple 5.2.2 ("Authorization must be provided upon request" https://developer.apple.com/app-store/review/guidelines/), these public terms are the authorization; save a dated PDF.
- **Why:** "The data is published under the Creative Commons Attribution-ShareAlike 4.0 licence (CC BY-SA 4.0): anyone reusing it must credit 'FlyItalyADSB' with a link to flyitalyadsb.com and share derivative works under the same licence" https://flyitalyadsb.com/terms/. "Use one key per product and credit FlyItalyADSB and flyitalyadsb.com in the product" https://flyitalyadsb.com/data/api/. CC BY-SA 3(a)(1) asks for the credit, a licence notice and link, a disclaimer notice, a link to the material and a note of modifications, and a link to a page holding these is enough. 3(b): Adapted Material you Share must stay BY-SA. Section 4: putting "all or a substantial portion" of the data into your own database makes that database Adapted Material https://creativecommons.org/licenses/by-sa/4.0/legalcode.en. ODbL is not a BY-SA compatible licence https://creativecommons.org/compatiblelicenses.
- **Limits:** no "resell or redistribute the data in real time as an API or feed for other people's products without a written agreement"; they "may limit, suspend or revoke a key" https://flyitalyadsb.com/terms/. The API page also says "For more than 25 aircraft, write to" them, and "No plan includes an SLA" https://flyitalyadsb.com/data/api/. Inference: "25 aircraft" probably means fleet tracking, but ask.
- **Inference:** one plane on a card is not a substantial portion, so cards need the credit, not share-alike. Share-alike bites if snapshots, logs or a dataset are published (repo fixtures, an API) or if FlyItalyADSB and adsb.lol data are merged into one database, because BY-SA and ODbL cannot both be met.
- **Fix:** credit line in the app (item 7); never commit snapshot data to the public repo; keep the two feeds as separate sources (fallback, not merge); no public API. Email FlyItalyADSB once: a free public app, one global snapshot every 5 s on Pro, cached in memory; is that fine, and what does "25 aircraft" mean?
- **Effort:** S. **Who:** founder action (email), code (credit).

### 2. Paid route fallback: FlightAware's "in conjunction with" clause (new, replaces the FR24 item)

- **Plan:** VRS for most routes; a paid API for misses, shown on a card next to FlyItalyADSB or adsb.lol positions.
- **Why (FlightAware):** the Standard licence allows "a business-to-individual consumer application ... sold on an application store" (May 7), but the licensee may not "Use the AeroAPI Data in conjunction with or as a backfill to data sourced from any other real-time or near-real-time flight data provider without the prior written permission of FlightAware" (May Not 10), nor use it "for commercial aircraft situational displays" (8). Data goes to users only "without additional fee" (May 9), raw data is kept at most 30 days (May Not 9), and the credit reads "Contains AeroAPI data © FlightAware LLC [year]" https://www.flightaware.com/commercial/aeroapi/AeroAPI_Standard_License.pdf. Standard costs at least $100 a month, $0.005 per `/flights/{ident}` https://www.flightaware.com/commercial/aeroapi/.
- **Why (Airlabs):** the terms (updated 07/20/2021, Data Products Ltd, London, UK law) have no combining clause and no attribution rule, but no data licence either. They cover "web pages" and bar "any robot ... to access Service for any purpose, including monitoring or copying any of the material on Service" https://airlabs.co/terms-of-service. The FAQ says that once "use of the API requires a commercial license ... you can choose one of the available paid subscriptions" https://airlabs.co/faq. From $19 per 10,000 requests https://airlabs.co/. Inference: the right to show Airlabs data rests on one FAQ line; Apple 5.2.2 wants something you can show.
- **Inference:** the FR24 problem moves to FlightAware unchanged. Airlabs fits better but needs written confirmation.
- **Fix (pick one):** (a) Airlabs, after an email confirming display of origin and destination on cards in a free public app, next to another provider's positions, with a daily cache; (b) FlightAware only with written permission covering clauses 10 and 8; (c) launch with VRS only and show no route on a miss. Cheapest safe path: (c) at launch, (a) once Airlabs answers.
- **Effort:** S to ask, S code. **Who:** founder action, then code.

### 3. Privacy label says Coarse Location, but the data is Precise (remains)

- **Now:** `shared/src/rules.ts` rounds to `LOCATION_DECIMALS = 3`. `app.json` declares `NSPrivacyCollectedDataTypeCoarseLocation`, and PRIVACY.md plans the same label. The new design does not change this.
- **Why:** Apple defines Precise Location as resolution of "three or more decimal places" and Coarse as "lower resolution than" that, and "You're responsible for keeping your responses accurate" https://developer.apple.com/app-store/app-privacy-details/. Under the CCPA, about 100 m is also "precise geolocation" (radius of 1,850 ft or less) https://cppa.ca.gov/regulations/pdf/cppa_act.pdf.
- **Fix:** declare Precise Location (linked, App Functionality, no tracking) in App Store Connect and `app.json`. Inference: rounding to 2 decimals (~1.1 km) would harm the 2.8 km close-pass rule, so change the label. Say "about 100 m" in the policy.
- **Effort:** S. **Who:** code (manifest), founder action (App Store Connect).

### 4. The privacy policy is incomplete and not linked in the app (changes)

- **Now:** https://eyalhecht.github.io/overhead-privacy/ names the controller, an email, the data, recipients and retention. It has no lawful basis, transfer safeguard, complaint right or change-notice process, and the app does not link to it. Its recipient list (adsb.fi, Flightradar24) will be wrong after the switch.
- **Why:**
  - Apple 5.1.1(i): a link "in the App Store Connect metadata field and within the app in an easily accessible manner", explaining "how a user can revoke consent and/or request deletion" https://developer.apple.com/app-store/review/guidelines/.
  - GDPR Art. 13 applies (controller established in Germany, Art. 3(1)): purposes and legal basis (13(1)(c)), recipients (13(1)(e)), the transfer safeguard (13(1)(f)), the rights to object and withdraw consent, and the right to complain (13(2)(b)-(d)) https://eur-lex.europa.eu/eli/reg/2016/679/oj. The Berlin authority: https://www.datenschutz-berlin.de.
  - Transfer: Google LLC is certified under the EU-U.S. Data Privacy Framework https://www.dataprivacyframework.gov/participant/5780, and Google Cloud's DPA is "incorporated into the Agreement", with SCCs or an "Alternative Transfer Solution" https://cloud.google.com/terms/data-processing-addendum. Inference: moving the VM to the EU keeps data at rest in the EU, but Google remains a processor with possible access from abroad, and APNs is run by Apple, so keep a short transfer section either way.
  - CalOPPA: effective date, how changes are announced, how Do Not Track is handled (Cal. Bus. & Prof. Code 22575(b)) https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=22575.
  - Israel, section 11 of the Privacy Protection Law: whether giving the data is voluntary, its purpose, the controller, recipients, and access and rectification rights https://www.gov.il/BlobFolder/legalinfo/legislation/en/Protection-of-Privacy-Law57411981unofficialtranslatioup.pdf.
- **Fix:** add the lawful basis (likely Art. 6(1)(b), see lawyer question 3); recipients by name: Google (hosting), Apple (push), and "position feeds and route providers (FlyItalyADSB, adsb.lol, Airlabs or FlightAware) receive no user data"; the region and the transfer safeguard (DPF and Google DPA); rights under GDPR Art. 15-21 and Israeli sections 13-14, plus the complaint right; that location is voluntary but needed for cards; how changes are announced; "no tracking, so Do Not Track changes nothing"; the device ID under TDDDG §25(2) Nr. 2 ("unbedingt erforderlich" for a service the user asked for) https://www.gesetze-im-internet.de/ttdsg/__25.html. Then link the policy in Settings and in App Store Connect.
- **Effort:** S. **Who:** text, code (link), founder action.

### 5. Deletion only works in theory (remains)

- **Now:** deletion by email, but the server knows the phone only by its identifierForVendor, which the user cannot see. There is no delete endpoint.
- **Why:** GDPR Art. 17 (erasure "without undue delay") and Art. 12(2) (the controller "shall facilitate the exercise" of rights) https://eur-lex.europa.eu/eli/reg/2016/679/oj. Apple 5.1.1(i) requires a described way to request deletion; 5.1.1(v) applies only to apps with accounts https://developer.apple.com/app-store/review/guidelines/.
- **Fix:** a "Delete my data" button calling a new `DELETE /register` (same app key and device ID check), removing the user row and tokens. At minimum, show the device ID in Settings.
- **Effort:** S. **Who:** code.

### 6. German Impressum (§5 DDG) (remains)

- **Why:** §5(1) DDG requires name, the address where the provider is "niedergelassen" and an email, "leicht erkennbar und unmittelbar erreichbar", for "geschäftsmäßige, in der Regel gegen Entgelt angebotene digitale Dienste" https://www.gesetze-im-internet.de/ddg/__5.html; fines up to EUR 50,000 https://www.gesetze-im-internet.de/ddg/__33.html. Inference: a free app may fall outside "geschäftsmäßig", but it is also a job-search portfolio piece, so an Impressum is cheap insurance.
- **Fix:** an Impressum page (full name, a street address for service, email, a second quick contact) next to the policy, linked from Settings and set as the Support URL.
- **Effort:** S. **Who:** text, founder action (which address: lawyer question 4).

### 7. Licence notices and a credits screen (changes)

- **adsb.lol:** "license: ODbL 1.0" https://www.adsb.lol/docs/open-data/api/. ODbL 4.3: a Produced Work (a card) that is publicly used needs a notice, for example "Contains information from DATABASE NAME, which is made available here under the Open Database License (ODbL)". 4.5(b): making a Produced Work does not create a Derivative Database. 4.6: a publicly used Derivative Database must be offered, or "the method of making the alterations ... (such as an algorithm)" https://opendatacommons.org/licenses/odbl/1-0/. Inference: cards are Produced Works; if 4.6 ever applies, the public source code of the filter is that method.
- **OpenFlights:** ODbL, "license any derived works made available to the public with a free license as well" https://openflights.org/data.php. `server/src/flights/airlines.json` sits in the public repo under an "All rights reserved" LICENSE.
- **VRS standing data:** CC0 1.0, which also waives "database rights (such as those arising under Directive 96/9/EC" https://github.com/vradarserver/standing-data/blob/main/LICENSE. New CSVs are committed daily (commits on 9, 10 and 11 November 2026) https://github.com/vradarserver/standing-data/commits/main. No credit required; give one as a courtesy.
- **OurAirports:** public domain https://ourairports.com/data/.
- **Fix:** one Credits screen, linked from Settings: "Aircraft positions: FlyItalyADSB (flyitalyadsb.com), CC BY-SA 4.0, filtered by Overhead. Backup positions: contains information from adsb.lol, available under the ODbL. Airline names: contains information from OpenFlights, available under the ODbL. Routes: Virtual Radar Server standing data (CC0) and Airlabs. Airports: OurAirports." Each name links to its source and licence; add FlightAware's line if it is used. In LICENSE, carve out `airlines.json` as ODbL.
- **Effort:** S. **Who:** text, code.

### 8. "Not for navigation or safety" disclaimer (changes)

- **Why:** FlyItalyADSB: data "may be incomplete, delayed or wrong: it is provided as is" https://flyitalyadsb.com/terms/, and "No plan includes an SLA" https://flyitalyadsb.com/data/api/. adsb.lol: data "on an 'as is' basis", and users "will indemnify, defend and hold harmless adsb.lol" against third-party claims from use not in line with its notice https://www.adsb.lol/docs/privacy-license/. FlightAware and Airlabs: "AS IS" https://www.flightaware.com/commercial/aeroapi/AeroAPI_Standard_License.pdf, https://airlabs.co/terms-of-service. OpenFlights: "not suitable for navigation" https://openflights.org/data.php.
- **Fix:** in Settings or About, and the App Store description: "For curiosity only. Flight data comes from volunteers and third parties, can be late or wrong, and must not be used for navigation or safety. Loudness is an estimate, not a measurement."
- **Effort:** S. **Who:** text, code.

### 9. GDPR record of processing (Art. 30) (changes)

- **Why:** Art. 30(5) does not exempt processing that "is not occasional"; location is processed every 5 seconds https://eur-lex.europa.eu/eli/reg/2016/679/oj.
- **Fix:** add the Art. 30(1) fields to PRIVACY.md or a private file: controller, purposes, categories, recipients (now only Google and Apple), the region and transfer safeguard, retention, security measures.
- **Effort:** S. **Who:** text.

### 10. App Store Connect declarations and review notes (remains)

- **DSA trader status:** individual traders must show "Address or P.O. Box", phone and email on EU pages; hobbyists "with no commercialization intent are unlikely to be considered traders" https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/ (DSA Art. 30 https://eur-lex.europa.eu/eli/reg/2022/2065/oj). Declare non-trader for the free launch. S, founder action.
- **Age rating:** answer the new questionnaire; new descriptors start 16 November 2026, due 12 January 2027 https://developer.apple.com/news/?id=ks775ehf, https://developer.apple.com/news/?id=yxkh08us. Inference: 4+. S, founder action.
- **Background location and Live Activities:** 2.5.4 (background "only for their intended purposes") and 5.1.5 ("directly relevant") https://developer.apple.com/app-store/review/guidelines/. Review notes, a screen recording of a real pass, a test location under a flight path. S, founder action.
- **Already fine:** `ITSAppUsesNonExemptEncryption: false` for HTTPS only https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations; 4.2 and 4.5.4 low risk.

### 11. Switch-over before submission (new)

- **Why:** the old blockers bind whatever build is live. FR24 may end a subscription "if any use in violation of these Terms is detected or suspected" (6.2.4) https://www.flightradar24.com/terms-and-conditions; adsb.fi is "personal, non-commercial use only" https://github.com/adsbfi/opendata.
- **Fix:** submit only a build whose server uses the new stack; remove the adsb.fi, FR24 and adsbdb code and keys; cancel the FR24 plan; restart so FR24 and adsbdb routes in the in-memory cache are gone.
- **Effort:** S once the new design is built. **Who:** code, founder action.

## Fix before monetizing

- **FlyItalyADSB.** Commercial use, including "apps and devices you sell", needs no new licence; "an SLA ... or more volume" means a tailored deal https://flyitalyadsb.com/data/api/. S, founder action.
- **CC BY-SA "no downstream restrictions".** You may not impose "additional or different terms" that restrict the licensed rights in the material (2(a)(5)(B), 3(b)) https://creativecommons.org/licenses/by-sa/4.0/legalcode.en. Inference: charging for the app is fine, but paid terms of use must not forbid reuse of the position data shown. S, lawyer and text.
- **Route fallback fees.** FlightAware Standard passes data to users only "without additional fee" (May 9); Premium (from $1,000 a month) covers "business-to-consumer commercial purposes" https://www.flightaware.com/commercial/aeroapi/. Inference: a paid tier with FlightAware routes needs Premium or written permission. For Airlabs, confirm in the same email (item 2). S, founder action.
- **DSA trader status becomes "trader".** Revenue is Apple's first factor; then address, phone and email are published https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/. Get a business address or P.O. box first. S, founder action.
- **Residence permit.** §4a AufenthG: work beyond the residence title "bedarf der Erlaubnis" https://www.gesetze-im-internet.de/aufenthg_2004/__4a.html. Check self-employment is allowed before taking money. S, founder action or lawyer.
- **Gewerbe and tax.** An independent Gewerbe is registered when it starts (§14(1) GewO) https://www.gesetze-im-internet.de/gewo/__14.html. Inference: paying EUR 49 a month for data does not make a free app a Gewerbe; paid features do. Then register, tell the Finanzamt, and ask a Steuerberater about VAT and the Kleinunternehmer rule. S, founder action.
- **Company for liability.** A UG (haftungsbeschränkt) needs less capital than a GmbH (§5a GmbHG) https://www.gesetze-im-internet.de/gmbhg/__5a.html. Inference: weigh it once there is revenue or many users. L, founder action and lawyer.
- **In-app purchase.** Unlocking features must use IAP (3.1.1) https://developer.apple.com/app-store/review/guidelines/. M, code.
- **EU consumer law.** §327(1) BGB covers contracts "gegen Zahlung eines Preises", and data instead of money only when used beyond the service (§327(3), §312(1a)) https://www.gesetze-im-internet.de/bgb/__327.html, https://www.gesetze-im-internet.de/bgb/__312.html; Digital Content Directive Art. 3(1) https://eur-lex.europa.eu/eli/dir/2019/770/oj. A paid tier brings conformity, update and withdrawal duties and needs real terms. M, lawyer and text.
- **US thresholds.** CCPA applies above $26,625,000 revenue https://cppa.ca.gov/regulations/cpi_adjustment.html, or 100,000+ consumers' data bought, sold or shared, or 50%+ revenue from selling it https://cppa.ca.gov/regulations/pdf/cppa_act.pdf. None today; re-check if ads or data sharing come in. S, founder action.
- **Israel at scale.** A privacy protection officer is required for "systematic monitoring of a person's ... location ... on a significant scale" (section 17B1) https://www.gov.il/BlobFolder/legalinfo/legislation/en/Protection-of-Privacy-Law57411981unofficialtranslatioup.pdf; the GDPR equivalent is Art. 37(1)(b). S to M, lawyer.

## Nice to have

- **EU region (now part of the plan).** europe-west3 (Frankfurt) costs $15.76 a month for an e2-small, $31.51 for an e2-medium https://cloud.google.com/products/compute/pricing/general-purpose; the free e2-micro exists only in US regions https://cloud.google.com/free/docs/free-cloud-features#compute. Inference: data at rest stays in the EU and the transfer section shrinks to Google's possible access and Apple's APNs. Update `deploy.sh`, PRIVACY.md and the policy together. M, code and founder action.
- **Short DPIA note (Art. 35).** Background location of many users is what regulators ask about https://eur-lex.europa.eu/eli/reg/2016/679/oj. Write down ~100 m, last location only, 30-day deletion, no user-derived queries to feeds, and only card-capable phones watched. S, text.
- **VRS data provenance (new).** The routes are submitted by VRS users, with corrections "via the SDM site" https://github.com/vradarserver/standing-data. Inference: CC0 is the publisher's statement, and no one checks where each route came from. Low risk; remove a route quickly if anyone complains. S, code.
- **adsb.lol may need a key (new).** "In the future, you will require an API key which you can obtain by feeding adsb.lol", and limits "are dynamic" https://github.com/adsblol/api. Inference: the fallback can disappear or change terms; re-read them before relying on it. S, founder action.
- **EASA ANP legacy data.** Used on the server, never redistributed; Doc 29 5th edition says legacy data "are not subject to the ANP terms and conditions" (docs/research/hearing-planes.md, https://www.easa.europa.eu/en/downloads/138164/en). Before monetizing, ask EASA to confirm. Never use the registered database, clause 6(a) https://www.easa.europa.eu/en/downloads/116585/en. S, founder action.
- **Trademarks.** Naming airlines and aircraft to say which plane it is is allowed (EUTMR Art. 14(1)(c)) https://eur-lex.europa.eu/eli/reg/2017/1001/oj. Keep not using logos. A credit is not an endorsement: CC BY-SA forbids implying the use is "sponsored, endorsed, or granted official status by" the licensor https://creativecommons.org/licenses/by-sa/4.0/legalcode.en. FlightAware's credit must follow its Brand Guide https://flightaware.com/about/logo/. Search "Overhead" in TMview https://www.tmdn.org/tmview/. S, founder action.
- **Custom terms of use.** Apple's Standard EULA disclaims warranties "AS IS" https://www.apple.com/legal/internet-services/itunes/dev/stdeula/. Inference: enough for a free launch with item 8. §309 Nr. 7 BGB voids exclusions for injury and gross negligence https://www.gesetze-im-internet.de/bgb/__309.html. S, text.
- **Without location.** 5.1.2: an app "may not require users to enable system functionalities (such as push notifications, location services...)" https://developer.apple.com/app-store/review/guidelines/. Denying location must show an explanation and the sky map for a chosen place. M, code.
- **US state app-store age laws.** Developers "may need to adopt" the Declared Age Range and Significant Change APIs https://developer.apple.com/news/?id=2ezb6jhj; Texas took effect 4 June 2026 https://developer.apple.com/news/?id=sg176nne. COPPA counts street-level geolocation as children's data https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.2. Inference: a general 4+ app is not "directed to children"; confirm. S, lawyer.
- **Old data.** OpenFlights still lists defunct airlines (for example Aigle Azur). Not a legal issue, but it adds to the disclaimer case. S, code.

## Questions for a lawyer

1. FlyItalyADSB is CC BY-SA 4.0. Is a card (one plane, joined with a route and an airline name) Adapted Material or a mere use, and is an in-memory snapshot used to serve users "Shared"?
2. Are VRS (CC0) routes and OpenFlights (ODbL) names shown next to FlyItalyADSB (BY-SA) or adsb.lol (ODbL) positions a Collective Database or Produced Work, not a derivative database under either share-alike licence?
3. Lawful basis: Art. 6(1)(b) or 6(1)(a) consent for background location? Does the iOS prompt count as consent, and is the device ID covered by §25(2) Nr. 2 TDDDG?
4. Is a free app with no revenue "geschäftsmäßig" under §5 DDG and a "trader" under the DSA when it is also a portfolio piece? Can the Impressum use a c/o or virtual-office address?
5. Does the new Product Liability Directive (products placed on the market after 9 December 2026) cover a free app with no commercial activity? https://eur-lex.europa.eu/eli/dir/2024/2853/oj
6. Is a free app a gift under German law (§521 BGB https://www.gesetze-im-internet.de/bgb/__521.html), and how far does Apple's Standard EULA disclaimer hold for German consumers?
7. Does Israel's Privacy Protection Law apply to a Germany-based controller serving Israeli users, and are its rules on transfers abroad met by an EU- or US-hosted server?
8. At what user count does background location become "large scale" monitoring, needing a DPO (GDPR Art. 37) or a privacy protection officer (Israel section 17B1), and a DPIA?
9. Does my residence title allow self-employment, and should I set up a UG before monetizing or at a certain user count?

This document is research, not legal advice; have a lawyer licensed in Germany (and Israel, for question 7) confirm it before launch.
