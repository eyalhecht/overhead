# Overhead - legal compliance before a public App Store launch

Researched 10 November 2026 from primary sources: the laws, regulators, Apple's guidelines and help pages, and each data provider's own terms. Every claim has its URL. "Inference" marks my reading where the source does not say it outright. Scope: EU/Germany, US, Israel; a free iPhone app by an individual in Berlin, server in Google Cloud us-central1.

## Summary

- The two real blockers are data terms, not privacy law. Flightradar24 forbids using its API to "supplement" another provider's real-time flight data, which is what joining FR24 routes onto adsb.fi positions does. adsb.fi allows "personal, non-commercial use only" and requires a credit and link, which the app does not show.
- The App Store privacy label is wrong: locations rounded to 3 decimals count as Precise Location by Apple's definition, not Coarse.
- The privacy policy lacks the GDPR basics (lawful basis, transfer safeguard, complaint right) and is not linked inside the app. Deletion by email cannot work, because users cannot know their device ID.
- Smaller items before submission: a German Impressum, ODbL notices for the OpenFlights airline names, a "not for navigation" disclaimer, a GDPR record of processing, and App Store Connect paperwork (DSA trader status, age rating, background-location review notes).
- No company or Gewerbe is needed to publish for free. Monetizing changes several answers: adsb.fi licence, DSA trader status (address and phone published), Gewerbe and tax registration, and a check that the residence permit allows self-employment.

## Blockers before App Store submission

Ordered by risk: first what could get the data cut off or the app rejected, then legal duties with fines.

### 1. Flightradar24: the "supplement or backfill" clause

- **Now:** `server/src/flights/routes.ts` looks up each callsign seen in the adsb.fi feed with FR24 `flight-summary/full` and puts FR24's origin and destination on the adsb.fi plane.
- **Why:** FR24's terms (last updated 23 June 2026), section 6.3.1, prohibit "Using the FR24 API to supplement or backfill any other near-time or real-time flight data sourced from an alternative data provider for any commercial or non-commercial use", and 6.2.4 lets FR24 end the subscription "if any use in violation of these Terms is detected or suspected". https://www.flightradar24.com/terms-and-conditions. Apple 5.2.2: if an app displays content from a third-party service, "ensure that you are specifically permitted to do so under the service's terms of use. Authorization must be provided upon request." https://developer.apple.com/app-store/review/guidelines/
- **What is fine:** commercial use is allowed at every plan level, Explorer included (6.3.1). The 24 h in-memory cache is within FR24's storage rule, "should not be stored for more than 30 days" https://fr24api.flightradar24.com/docs/endpoints/overview. Inference: a route is a fact about a flight, but the clause names the exact pattern Overhead uses, so do not rely on that argument.
- **Fix (pick one):** (a) get written permission from FR24's business team for this exact use (positions from adsb.fi plus routes from FR24 on a public app), linked from https://fr24api.flightradar24.com/subscriptions-and-credits; (b) take positions from FR24 as well ("Live flight positions full" includes origin and destination, same page), which ends the mixing but costs far more credits than Explorer's 60,000 a month; (c) get routes from a source whose terms allow combining. Ask FR24 first, by email, before launch.
- **Effort:** S to ask, M to L if the code has to change. **Who:** founder action, then code.

### 2. adsb.fi: "personal, non-commercial use" and the missing credit

- **Now:** adsb.fi is the main position feed. The app shows no credit. README says the use is non-commercial "today".
- **Why:** "adsb.fi open data is for personal, non-commercial use only" and "You must cite adsb.fi and include a link to our home page." Commercial use or higher rates: contact them. https://github.com/adsbfi/opendata. Inference: a public app that anyone can download is hard to call "personal" use, even when it is free. Apple 5.2.2 (above) needs a permission you can show.
- **Fix:** email adsb.fi, describe the app (free, public, about 1 request a second, monetization possible later) and ask for written permission. Add "Aircraft positions: adsb.fi" with a link in the app (Settings or an About screen). If they say no, make adsb.lol the main feed: it is ODbL 1.0 https://www.adsb.lol/docs/open-data/api/, which allows commercial use with attribution https://opendatacommons.org/licenses/odbl/1-0/.
- **Effort:** S. **Who:** founder action (email), code (attribution line).

### 3. Privacy label says Coarse Location, but the data is Precise

- **Now:** `shared/src/rules.ts` rounds to `LOCATION_DECIMALS = 3`. `app.json` declares `NSPrivacyCollectedDataTypeCoarseLocation`, and PRIVACY.md plans the same label.
- **Why:** Apple defines Precise Location as resolution of "three or more decimal places" and Coarse as "lower resolution than" that. Apple also says "You're responsible for keeping your responses accurate". https://developer.apple.com/app-store/app-privacy-details/. Under the CCPA, about 100 m is also "precise geolocation" (a circle of 1,850 ft radius or smaller) https://cppa.ca.gov/regulations/pdf/cppa_act.pdf.
- **Fix:** declare Precise Location (linked, App Functionality, no tracking) in App Store Connect and in `app.json`. Or round to 2 decimals (about 1.1 km) before the phone sends anything, and keep Coarse. Inference: 1.1 km would harm the 2.8 km close-pass rule, so changing the label is the honest, cheap fix. In the policy, say "about 100 m" rather than "rough".
- **Effort:** S. **Who:** code (manifest), founder action (App Store Connect).

### 4. The privacy policy is incomplete and not linked in the app

- **Now:** https://eyalhecht.github.io/overhead-privacy/ names the controller and an email, the data, recipients and retention. It has no lawful basis, no transfer safeguard, no complaint right and no change-notice process. The app does not link to it.
- **Why:**
  - Apple 5.1.1(i): a link "in the App Store Connect metadata field and within the app in an easily accessible manner". The policy must also explain "how a user can revoke consent and/or request deletion". https://developer.apple.com/app-store/review/guidelines/
  - GDPR Art. 13 applies, because the controller is established in Germany (Art. 3(1)). It requires purposes and legal basis (13(1)(c)), the safeguard for transfers abroad (13(1)(f)), the rights to object and to withdraw consent, and the right to complain to a supervisory authority (13(2)(b)-(d)). https://eur-lex.europa.eu/eli/reg/2016/679/oj. The authority for Berlin is the Berliner Beauftragte für Datenschutz und Informationsfreiheit https://www.datenschutz-berlin.de.
  - Transfer: Google LLC is certified under the EU-U.S. Data Privacy Framework https://www.dataprivacyframework.gov/participant/5780. Google Cloud's Data Processing Addendum is "incorporated into the Agreement", with SCCs or an "Alternative Transfer Solution" https://cloud.google.com/terms/data-processing-addendum, https://policies.google.com/privacy/frameworks. So the Art. 28 processor contract with Google already exists; it only needs naming.
  - CalOPPA requires an effective date, how material changes are announced, and how the service responds to Do Not Track signals (Cal. Bus. & Prof. Code 22575(b)) https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=22575.
  - Israel: section 11 of the Privacy Protection Law (after Amendment 13) requires the notice to say whether providing the data is voluntary, its purpose, the controller's name and contact, recipients, and the rights of access and rectification https://www.gov.il/BlobFolder/legalinfo/legislation/en/Protection-of-Privacy-Law57411981unofficialtranslatioup.pdf.
- **Fix:** add to the policy:
  - the lawful basis, likely Art. 6(1)(b), providing the service the user asked for; see the lawyer questions;
  - the US transfer and its safeguard (DPF and the Google DPA);
  - processors and recipients by name: Google, Apple, adsb.fi or adsb.lol, Flightradar24;
  - the rights under GDPR Art. 15-21 and Israeli law sections 13-14, plus the right to complain to the Berlin authority;
  - that location is voluntary but needed for cards;
  - how changes are announced, and "no tracking, so Do Not Track changes nothing".
  Then link the policy in Settings and enter its URL in App Store Connect. Also cover the device ID under TDDDG §25(2) Nr. 2, the exemption for access that is "unbedingt erforderlich" to provide a service the user explicitly asked for https://www.gesetze-im-internet.de/ttdsg/__25.html.
- **Effort:** S. **Who:** text, code (link), founder action (App Store Connect).

### 5. Deletion only works in theory

- **Now:** the policy offers deletion by email. The server only knows the phone by its identifierForVendor, which the user cannot see, so an email cannot be matched to a phone. There is no delete endpoint.
- **Why:** GDPR Art. 17 (erasure "without undue delay") and Art. 12(2) (the controller "shall facilitate the exercise" of rights) https://eur-lex.europa.eu/eli/reg/2016/679/oj. Apple 5.1.1(i) requires a described way to request deletion. Its in-app account-deletion rule, 5.1.1(v), applies only to apps with accounts.
- **Fix:** add a "Delete my data" button in Settings that calls a new `DELETE /register` (same app key and device ID check as `/register`) and removes the user row and tokens. Or, at minimum, show the device ID in Settings so an email request can be honoured.
- **Effort:** S. **Who:** code.

### 6. German Impressum (§5 DDG)

- **Now:** no provider identification anywhere.
- **Why:** §5(1) DDG requires the name, the address where the provider is "niedergelassen" and an email address, "leicht erkennbar und unmittelbar erreichbar", for "geschäftsmäßige, in der Regel gegen Entgelt angebotene digitale Dienste" https://www.gesetze-im-internet.de/ddg/__5.html. The fine is up to EUR 50,000 (§33(2) Nr. 1, (6) Nr. 3) https://www.gesetze-im-internet.de/ddg/__33.html. Inference: a free app with no money may fall outside "geschäftsmäßig", but it is also a portfolio piece for a job search, so it is a grey zone. An Impressum is cheap insurance.
- **Fix:** publish an Impressum page (full name, a street address where you can be served, email, a second quick contact) next to the privacy policy. Link it from Settings and set it as the App Store Support URL.
- **Effort:** S. **Who:** text, founder action (which address to use: see the lawyer questions).

### 7. ODbL notices for OpenFlights (and adsb.lol)

- **Now:** `server/src/flights/airlines.json` is an extract of the OpenFlights airline database. It sits in the public GitHub repo, and the repo's LICENSE says "All rights reserved". The app shows airline names with no credit.
- **Why:** OpenFlights data is under the Open Database License, and users must "acknowledge the source and license any derived works made available to the public with a free license as well" https://openflights.org/data.php. ODbL 4.4: a Derivative Database you Publicly Use must be under the ODbL. ODbL 4.3: a Produced Work (the card text) needs a notice that the content came from the database https://opendatacommons.org/licenses/odbl/1-0/. adsb.lol is ODbL too.
- **Fix:** in LICENSE, carve out `airlines.json` ("derived from OpenFlights, available under the ODbL 1.0") and add the ODbL link. Add "Airline names: OpenFlights (ODbL)" and "Airport names: OurAirports" to the in-app credits. OurAirports is public domain, so its credit is a courtesy https://ourairports.com/data/.
- **Effort:** S. **Who:** text, code.

### 8. "Not for navigation or safety" disclaimer

- **Now:** none in the app.
- **Why:** FR24 prohibits use "for any flight-critical or safety-critical decisions" (6.3.1) https://www.flightradar24.com/terms-and-conditions. OpenFlights: the data "is not suitable for navigation" https://openflights.org/data.php. adsb.fi: data "provided as-is" https://github.com/adsbfi/opendata.
- **Fix:** one line in Settings or About: "For curiosity only. Flight data comes from third parties, can be late or wrong, and must not be used for navigation or safety. Loudness is an estimate, not a measurement." Put the same line in the App Store description.
- **Effort:** S. **Who:** text, code.

### 9. GDPR record of processing (Art. 30)

- **Now:** PRIVACY.md is close to a record but is not one.
- **Why:** the small-organisation exemption in Art. 30(5) does not apply when processing "is not occasional". Location is processed every 5 seconds https://eur-lex.europa.eu/eli/reg/2016/679/oj.
- **Fix:** add to PRIVACY.md (or a private file) the Art. 30(1) fields: controller, purposes, data subjects and categories, recipients, the third-country transfer and its safeguard, retention, and security measures.
- **Effort:** S. **Who:** text.

### 10. App Store Connect declarations and review notes

- **DSA trader status:** every developer must declare it. Traders who are individuals must give "Address or P.O. Box", phone and email for display on EU product pages, and Apple says hobbyists "with no commercialization intent are unlikely to be considered traders" https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/ (DSA Art. 30 https://eur-lex.europa.eu/eli/reg/2022/2065/oj). Fix: declare non-trader for the free launch, and revisit before monetizing. If the lawyer says portfolio use already makes you a trader, use a P.O. box rather than the home address. Effort S, founder action.
- **Age rating:** answer the new questionnaire. Without it, updates cannot be submitted, and new content descriptors start on 16 November 2026, due by 12 January 2027 https://developer.apple.com/news/?id=ks775ehf, https://developer.apple.com/news/?id=yxkh08us. Inference: Overhead should come out 4+. Effort S, founder action.
- **Background location and Live Activities:** 2.5.4 allows background services "only for their intended purposes", and 5.1.5 requires location to be "directly relevant" https://developer.apple.com/app-store/review/guidelines/. Fix: review notes explaining Always location (cards while the phone is locked), a short screen recording of a real pass, and a test location under a flight path. Effort S, founder action.
- **Export compliance:** already done. `ITSAppUsesNonExemptEncryption: false` is right for HTTPS only https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations.
- **4.2 minimum functionality and 4.5.4 push:** low risk. Overhead is native (Live Activities, compass, location). Pushes are Live Activity updates, not marketing, and the app works without them https://developer.apple.com/app-store/review/guidelines/.

## Fix before monetizing

- **adsb.fi commercial licence.** Paid features, ads or a subscription remove any "non-commercial" argument https://github.com/adsbfi/opendata. Get a written commercial agreement or move to adsb.lol (ODbL) or a paid feed. M, founder action.
- **FR24 plan and value rule.** 6.3.2 allows commercial derivatives only where the user adds "significant value" or the data is not "the main selling point" https://www.flightradar24.com/terms-and-conditions. Inference: route names on the card are the main thing users see, so get this in the written FR24 permission. At scale, Explorer's 60,000 credits a month will not last; Essential is $90 https://fr24api.flightradar24.com/subscriptions-and-credits. M, founder action.
- **DSA trader status becomes "trader".** Revenue is Apple's first factor, and then address, phone and email are published on EU product pages https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/. Line up a business address or P.O. box first. S, founder action.
- **Residence permit.** §4a AufenthG: work beyond what the residence title allows "bedarf der Erlaubnis" https://www.gesetze-im-internet.de/aufenthg_2004/__4a.html. Check that your title allows self-employment before taking any money. S, founder action or lawyer.
- **Gewerbe and tax.** Starting an independent Gewerbe must be registered at the same time it starts (§14(1) GewO) https://www.gesetze-im-internet.de/gewo/__14.html. Inference: a free app with no intent to profit is not a Gewerbe, but paid features are. Register the Gewerbe and with the Finanzamt then, and ask a Steuerberater about VAT on App Store sales and the Kleinunternehmer rule. S, founder action.
- **Company for liability.** As an individual you are liable with your personal assets. A UG (haftungsbeschränkt) can be founded with less capital than a GmbH (§5a GmbHG) https://www.gesetze-im-internet.de/gmbhg/__5a.html. Inference: not worth it for a free app; worth weighing once there is revenue or meaningful user numbers. L, founder action and lawyer.
- **In-app purchase.** Unlocking features must use IAP (3.1.1) https://developer.apple.com/app-store/review/guidelines/. M, code.
- **EU consumer law starts to apply.** German digital-product rules apply to consumer contracts "gegen Zahlung eines Preises" (§327(1) BGB), and to data instead of money only when the data is used beyond providing the service (§327(3) with §312(1a) BGB) https://www.gesetze-im-internet.de/bgb/__327.html, https://www.gesetze-im-internet.de/bgb/__312.html; same in the Digital Content Directive Art. 3(1) https://eur-lex.europa.eu/eli/dir/2019/770/oj. Inference: today's free app with function-only data is outside. A paid tier brings conformity, update and withdrawal-right duties, and needs real terms. M, lawyer and text.
- **US thresholds.** CCPA applies to a "business" above $26,625,000 revenue https://cppa.ca.gov/regulations/cpi_adjustment.html, or one that buys, sells or shares personal information of 100,000+ consumers, or earns 50%+ of revenue from selling it https://cppa.ca.gov/regulations/pdf/cppa_act.pdf. Overhead meets none of these today. Re-check if ads or data sharing ever come in, because precise geolocation is sensitive data. S, founder action.
- **Israel at scale.** Registration is only needed for data brokers with 10,000+ people or public bodies, so not Overhead (section 8A(a)). A privacy protection officer is required where core activity involves "systematic monitoring of a person's ... location ... on a significant scale" (section 17B1) https://www.gov.il/BlobFolder/legalinfo/legislation/en/Protection-of-Privacy-Law57411981unofficialtranslatioup.pdf. Inference: this may apply once usage is wide; the GDPR equivalent is Art. 37(1)(b). S to M, lawyer.

## Nice to have

- **Move the VM to an EU region** (europe-west3 Frankfurt or europe-west10 Berlin). Data at rest stays in the EU and the transfer section shrinks to Google as processor. The always-free e2-micro exists only in three US regions https://cloud.google.com/free/docs/free-cloud-features#compute, so this costs a few dollars a month. M, code (deploy.sh) and founder action.
- **Short DPIA note (Art. 35).** Background location of many users is the kind of processing regulators ask about https://eur-lex.europa.eu/eli/reg/2016/679/oj. Writing down why ~100 m, the last location only, and the 30-day deletion is enough. S, text.
- **EASA ANP legacy data.** It is used on the server, never redistributed. Doc 29 5th edition says legacy data "are not subject to the ANP terms and conditions", but no licence is stated (docs/research/hearing-planes.md, https://www.easa.europa.eu/en/downloads/138164/en). Inference: low risk for showing an estimated dBA. Before monetizing, ask EASA by email to confirm. Never use the current registered database, whose clause 6(a) limits use to airport noise contours https://www.easa.europa.eu/en/downloads/116585/en. S, founder action.
- **Trademarks.** Airline and aircraft names used to say which plane it is are allowed: an EU trademark cannot stop use "for the purpose of identifying or referring to goods or services as those of the proprietor" (EUTMR Art. 14(1)(c)) https://eur-lex.europa.eu/eli/reg/2017/1001/oj. Keep not using logos. Do not use "Flightradar24" in the App Store name, subtitle, keywords or marketing (FR24 terms 10.3: use of its trademarks "is by all means prohibited"). Naming it as a data recipient in the privacy policy is a legal disclosure; confirm with the lawyer. Search "Overhead" in TMview before launch https://www.tmdn.org/tmview/. S, founder action.
- **Custom terms of use.** Apple's Standard EULA applies when there is no custom one, and disclaims warranties "AS IS" https://www.apple.com/legal/internet-services/itunes/dev/stdeula/. Inference: that is enough for a free launch together with the disclaimer in item 8. German law voids exclusions for injury to life, body or health and for gross negligence in standard terms (§309 Nr. 7 BGB) https://www.gesetze-im-internet.de/bgb/__309.html, so a German-law terms page adds little until there is a paid tier. S, text.
- **Without location.** 5.1.2 says an app "may not require users to enable system functionalities (such as push notifications, location services...)" https://developer.apple.com/app-store/review/guidelines/. Make sure that denying location shows an explanation and the sky map for a chosen place, not a dead end. M, code.
- **US state app-store age laws.** Texas, Utah and Louisiana make app stores verify age and get parental consent, and developers "may need to adopt" the Declared Age Range and Significant Change APIs https://developer.apple.com/news/?id=2ezb6jhj. Texas took effect on 4 June 2026 https://developer.apple.com/news/?id=sg176nne. COPPA counts "geolocation information sufficient to identify street name and name of a city or town" as children's personal information https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.2. Inference: a general-audience 4+ app with no child targeting is not "directed to children", but get this confirmed. S, lawyer.
- **Old data.** The OpenFlights airline list contains defunct airlines (for example Aigle Azur). A wrong name is not a legal issue, but it adds to the disclaimer case. S, code.

## Questions for a lawyer

1. Does joining FR24 routes onto adsb.fi or adsb.lol positions fall under FR24's "supplement or backfill" ban, and what wording should the permission request use?
2. Is a free, public app "personal, non-commercial use" under adsb.fi's terms, and does a portfolio or job-search purpose count as commercial?
3. Lawful basis: Art. 6(1)(b) (service requested) or 6(1)(a) consent for background location? Does iOS's permission prompt count as consent, and is the device ID covered by §25(2) Nr. 2 TDDDG?
4. Is a free app with no revenue "geschäftsmäßig" under §5 DDG and a "trader" under the DSA when it is also a portfolio piece? Can the Impressum use a c/o or virtual-office address instead of a home address?
5. Does the new Product Liability Directive (software is a product; it applies to products placed on the market after 9 December 2026) cover a free app with no commercial activity? https://eur-lex.europa.eu/eli/dir/2024/2853/oj
6. Is a free app a gift under German law (liability only for intent and gross negligence, §521 BGB https://www.gesetze-im-internet.de/bgb/__521.html), and how far does Apple's Standard EULA disclaimer hold for German consumers?
7. Does Israel's Privacy Protection Law apply to a Germany-based controller serving Israeli users, and are Israel's rules on transfers abroad met by a US-hosted server?
8. At what user count does background location become "large scale" monitoring, needing a DPO (GDPR Art. 37) or a privacy protection officer (Israel section 17B1), and a DPIA?
9. Does my residence title allow self-employment, and should I set up a UG before monetizing or before reaching a certain user count?

This document is research, not legal advice; have a lawyer licensed in Germany (and Israel, for item 7) confirm it before launch.
