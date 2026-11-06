# Hearing planes: when would a person actually hear this aircraft?

Researched 2026-11-06 from primary sources: ECAC Doc 29 (4th and 5th editions), the EASA/EUROCONTROL ANP database and its terms, the FAA AEDT Technical Manual, government reports (EASA, US EPA, Australian DOTARS, UK CAA, RIVM, Airservices, IAA) and peer-reviewed papers. Every claim has its URL next to it. "Inference" marks my own reasoning or arithmetic. All worked numbers were computed from the ANP 2.3 tables with the Doc 29 equations (script logic is described in the text, nothing was added to the codebase).

## Summary

1. The standard way to get LAmax at a ground point is a Noise-Power-Distance (NPD) lookup: aircraft (or proxy), thrust per engine, slant distance, then corrections for engine installation and lateral attenuation. That is Doc 29 equation 4-8a. There is no speed correction for LAmax.
2. Thrust state is the biggest lever. For the same B737-800 at the same 3.8 km slant distance, the ANP tables give about 54 dBA at climb thrust and about 41 dBA at approach thrust. A fixed loudness per aircraft class cannot represent a 13 dB swing.
3. The legacy ANP database (versions 1.0 to 2.3) is a free public download from EASA, as CSV files, and Doc 29 5th edition says legacy data "are not subject to the ANP terms and conditions". The current EASA database (with A320neo, A321neo, 787-9, E2) needs registration and its terms forbid uses outside airport contour modelling without the manufacturer's written consent.
4. Detection is relative to the ambient, not a fixed dBA. FAA AEDT uses a signal-detection model (detectability d'). Lab work (Sneddon, Pearsons and Fidell 2003) puts "50 percent noticed while doing something else" about 5 dB above the "focused listener detects it" level. Inference: in A-weighted terms, a plane gets noticed around LAmax roughly equal to the background L90, and grabs attention about 5 dB above it.
5. Urban background in a dense city is about 45 to 50 dBA (L90) by day and about 10 dB lower at night. ISR725 at about 50 to 54 dBA sits above daytime background. An approach-thrust A320 at the same spot gives about 40 dBA, below it. That matches what was observed.
6. Recommendation: NPD lookup with thrust inferred from ADS-B by the Doc 29 force balance, plus Doc 29 lateral attenuation, compared against a time-of-day L90. The full model, its parameters and the data files are at the end.

## 1. Estimating LAmax from type, thrust and distance

### The Doc 29 method

- Doc 29 5th edition (endorsed 19 May 2026) "replaces the previous (2016) 4th edition ... which should now be discarded". The Lmax equations and the lateral attenuation constants are the same in both. https://www.ecac-ceac.org/images/documents/ECAC-CEAC-DOC_29_5th_Edition-REPORT_ON_STANDARD_METHOD_OF_COMPUTING_NOISE_CONTOURS_AROUND_CIVIL_AIRPORTS-Volume_2-TECHNICAL_GUIDE.pdf and https://www.ecac-ceac.org/images/documents/ECAC-Doc_29_4th_edition_Dec_2016_Volume_2.pdf
- The ICAO counterpart is Doc 9911. The ANP 2.3 release note cross-references the same jet thrust equation as "Eq. B-1 of ECAC Doc. 29 4th Ed. Volume 2, Eq. C-1 of ICAO Doc 9911 2nd Ed." https://www.easa.europa.eu/en/downloads/138159/en
- The maximum level from one flight path segment is `Lmax,seg = L(P,d) + ΔI(φ) - Λ(β,ℓ) + ΔLOSB` (eq. 4-8a). The duration correction ΔV "is not applied to Lmax,seg". The event Lmax is the greatest segment value (eq. 4-10). Doc 29 5th ed, section 4.3.
- NPD interpolation (section 4.2): linear in power between tabulated thrust values (eq. 4-3), and linear in log distance between tabulated distances (eq. 4-4). Outside the table, extrapolate from the last two points, but beware "more than 5 dB difference from the NPD envelope". Use a lower limit of d = 30 m. Negative computed power is reset to 1 lb per engine.
- For Lmax, the NPD distance is the minimum distance from observer to segment. Lateral attenuation for Lmax "depends only on the elevation angle of, and ground distance to, the same point". Doc 29 5th ed, sections 4.2 (footnote 16) and 4.5.5.
- Impedance adjustment (new emphasis in the 5th edition, eq. 4-6): under standard conditions it is "less than 0.1 dB (0.074 dB)". It can be ignored for this purpose. Doc 29 5th ed, section 4.2.1.

### The ANP database: access, format, contents, license

- EASA hosts the ANP data. The current database is available to "any competent authority, aircraft operator, air navigation service provider and airport operator" and to others who "demonstrate a need for modelling purposes", via a request form. https://www.easa.europa.eu/en/domains/environment/policy-support-and-research/aircraft-noise-and-performance-anp-data and https://www.easa.europa.eu/en/anp-data-request
- Legacy data: "EUROCONTROL published consecutive versions of the ANP data (versions 1.0 to 2.3) which are now published on the EASA website". The ZIPs download directly with no login. ANP 2.3: https://www.easa.europa.eu/en/downloads/138164/en (I downloaded it, 153 KB).
- Doc 29 5th ed Appendix G1: "Users must be registered to access the database ... Use of data is subject to terms and conditions" but "The use of the legacy ANP data are not subject to the ANP terms and conditions. They are available on the website."
- Current-database terms (Issue 3, 03/06/2024), clause 6(a): the data is "solely provided to calculate noise contours around airports for an average of fleet and traffic mix". Other uses need "the prior written consent of the ANP Data Provider". Clause 6(b): no benchmarking of specific types without consent. Clause 6(d): no sharing with third parties. Clause 6(g): no publishing or reproducing without consent. https://www.easa.europa.eu/en/downloads/116585/en
- Inference: a per-flight "can you hear it" consumer feature is outside 6(a). So Overhead should use only the legacy 2.3 tables unless a manufacturer consents. That leaves no direct data for the A320neo, A321neo, 787-9 or E2 (see below).
- File format (ANP 2.3 ZIP, semicolon-separated CSV). Files: `ANP2.3_Aircraft.csv`, `ANP2.3_NPD_data.csv`, `ANP2.3_Jet_engine_coefficients.csv`, `ANP2.3_Aerodynamic_coefficients.csv`, `ANP2.3_Default_departure_procedural_steps.csv`, `ANP2.3_Default_approach_procedural_steps.csv`, `ANP2.3_Default_fixed_point_profiles.csv`, `ANP2.3_Default_weights.csv`, `ANP2.3_Propeller_engine_coefficients.csv`, `ANP2.3_Spectral_classes.csv`.
- NPD columns are exactly: `NPD_ID;Noise Metric;Op Mode;Power Setting;L_200ft;L_400ft;L_630ft;L_1000ft;L_2000ft;L_4000ft;L_6300ft;L_10000ft;L_16000ft;L_25000ft`. Noise Metric is one of `LAmax`, `SEL`, `EPNL` or `PNLTM` (694 rows each). Op Mode is `A` (approach) or `D` (departure). Power Setting is corrected net thrust per engine in lb for jets, or the unit in the aircraft's `Power Parameter` column (for example `CNT (% of Max Static Thrust)` for the Cessna 172).
- Aircraft table columns: `ACFT_ID;Description;Engine Type;Number Of Engines;Weight Class;Owner Category;Max Gross Takeoff Weight (lb);Max Gross Landing Weight (lb);Max Landing Distance (ft);Max Sea Level Static Thrust (lb);Noise Chapter;NPD_ID;Power Parameter;Approach Spectral Class ID;Departure Spectral Class ID;Lateral Directivity Identifier`. The last field is Wing, Fuselage or Prop and selects the installation correction. Field meanings: Doc 29 5th ed Appendix G2.
- ANP 2.3 contents: 155 aircraft (125 jet, 20 turboprop, 10 piston; 43 Heavy, 92 Large, 20 Small) mapped to 112 NPD sets. For Overhead's fleet that includes `737800` (CFM56-7B26, NPD `CF567B`), `737700`, `7378MAX` (LEAP-1B), `A320-211` (CFM56-5A1, NPD `CFM565`), `A320-232` (V2527-A5), `A321-232`, `7878R` (787-8 Trent 1000), `A350-941`, `EMB190`/`EMB195` (NPD `CF3410E`), `ATR72` and `CNA172` (NPD `IO360L`). Military aircraft and helicopters are excluded (Doc 29 5th ed Appendix G1).
- Newer types exist only in the current, registered database. EASA's "verified ANP aircraft types" list includes A320-270N/PW1100G, A320-250N/LEAP-1A, A321-270N, 787-9/GEnx, A330-941, A350-1041, ERJ190-300/-400 (E2) and others. https://www.easa.europa.eu/en/downloads/143284/en

### Substitution (ICAO type code to ANP proxy)

- EASA publishes "ANP Aircraft Substitutions - Jets & heavy props" (xlsx, 22/02/2018). https://www.easa.europa.eu/en/downloads/138165/en. Its readme says proxies were chosen by "MTOW, the engine static thrust to MTOW ratio or the certified noise levels", following "the substitution methodology in the ICAO Doc 9911 and ECAC Doc 29".
- Tab "by ICAO code" columns: `AIRFRAME_MANUFACTURER, ICAO_CODE, AIRCRAFT_VARIANT, ANP_PROXY, DELTA_DEP_dB, DELTA_APP_dB, N_DEP, N_APP`. "A positive DELTA_db ... means that the aircraft to be modelled has higher certified noise levels than the proposed ANP proxy." Each delta is "the noisiest aircraft configuration for a given ICAO code". Light props under 8,618 kg are not included.
- Rows that matter here (proxy, then departure / approach delta in dB):
  - B738 - 737800, +0.6 / +0.4
  - B38M - 7378MAX, +0.2 / 0
  - A320 (CFM) - A320-211, +0.2 / 0
  - A320 (IAE) - A320-232, +2.3 / +2.2
  - A20N (CFM) - A320-211, -6.7 / -3.5
  - A20N (IAE) - A320-232, -3.5 / -2.0
  - A21N - A321-232, -3.7 / -0.7
  - A321 - A321-232, +3.5 / +1.4
  - B789 - 7878R, +3.2 / +2.8
  - B788 - 7878R, +3.1 / +4.7
  - E190 - EMB190, 0 / 0; E195 - EMB195, 0 / 0
  - BCS3 (A220-300) - 737700, -4.6 / -3.5
  - DH8D - DHC830, -1.5 / 0
  - A359 - A350-941, +0.2 / 0; B77W - 7773ER, 0 / 0
- Inference: the deltas are differences in certified EPNdB. Adding them straight onto an LAmax estimate is an approximation, but it is the documented default. A20N at -6.7 dB on departure shows why a single "narrowbody" loudness is wrong.

### LAmax NPD values

The raw table rows are not reproduced here: the legacy ANP data carries no stated license, so this repository never stores it (see "Data files and licenses" below). Read them in `ANP2.3_NPD_data.csv` from https://www.easa.europa.eu/en/downloads/138164/en, for example `CF567B` departure (B737-800) and `V2527A` / `CFM565` approach (A320).

Observations (inference from the tables):

- Approach curves are nearly flat in thrust: airframe noise dominates. Departure curves rise about 2.5 dB per 3,000 lb.
- Between 4,000 and 16,000 ft the curves fall 7 to 8 dB per doubling of distance, steeper than the 6 dB of spherical spreading. The extra is atmospheric absorption, which is already in the data (see below).

### Typical thrust values

- Corrected net thrust per engine for a rating is `CNT = E + F·Vc + Ga·h + Gb·h² + H·T` (Doc 29 5th ed eq. B-9). Vc is CAS in kt, h is pressure altitude in ft. "The Corrected Net Thrust (per engine) is expressed as Fn/δ". Coefficients are in `ANP2.3_Jet_engine_coefficients.csv`, with ratings MaxTakeoff, MaxClimb and IdleApproach (plus HiTemp variants).
- The 737800 MaxTakeoff, MaxClimb and IdleApproach coefficients are in `ANP2.3_Jet_engine_coefficients.csv` (not reproduced here).
- Inference (arithmetic with eq. B-9): B738 MaxTakeoff at 160 kt and 1,000 ft is about 21,600 lb. MaxClimb at 240 kt and 4,925 ft is about 17,400 lb. MaxClimb at 250 kt and 10,000 ft is about 18,600 lb.
- Approach thrust on a 3 degree glide comes from the force balance `CNT = W/(δ·N) · (R/cos ε - sin γ/1.03)` (eq. B-40, W = 90 percent of max landing weight, R = drag/lift for the flap setting).
- Inference (arithmetic): with landing-flap R (737800 A_30 R 0.117166; A320-232 FULL_D R 0.121141), final approach is about 4,600 lb per engine for the B738 and 4,900 lb for the A320. Higher up, the default ANP approach steps are "Descend-Idle"/"Level-Idle", where IdleApproach gives only a few hundred lb. That is below the NPD table, so clamp to the lowest row (the curves are flat there anyway).
- So departure NPD powers are about 10,000 to 23,500 lb and approach about 2,000 to 7,000 lb for this class. That is a 10 to 15 dB difference at the same distance.

### Inferring thrust state from ADS-B

- Doc 29 calls radar tracks "the most readily accessible source of information on actual flight paths" but says "it is not possible at present to recommend a specific methodology" for analysing them. Doc 29 5th ed section 3.2.1.
- Climb steps solve `γ = asin[K · (N·CNT/(W/δ) - R/cos ε)]` (eq. B-21, K = 0.95 above 200 kt CAS, 1.01 below). Inverting gives thrust from an observed climb: `CNT = (W/δ)/N · (sin γ/K + R/cos ε)`. Inference: with ADS-B, `sin γ ≈ vertical_rate / ground_speed`. Add `+ (1/g)·dV/dt` if the plane is accelerating. Doc 29 ignores that term in descents, and calls its descent thrust "conservative" as a result (section B7.1.1).
- Inference for ISR725: 2,500 fpm at about 260 kt gives sin γ ≈ 0.095. With clean R 0.05625 (737800 T_00), δ = 0.835 at 4,925 ft and W = 130,000 to 160,000 lb, CNT comes out at 12,200 to 15,000 lb. That is below the MaxClimb rating of about 17,400 lb, consistent with a derated climb or some thrust spent on acceleration. Use the force balance, capped above by the MaxTakeoff/MaxClimb rating.
- Inference for phase:
  - Climbing more than about 300 fpm: Op Mode D, force-balance thrust.
  - Descending, or below about 4,000 ft AGL inbound with speed under about 210 kt: Op Mode A. Thrust hardly matters because A curves are flat; use the force balance with landing R when below about 2,000 ft AGL, and the lowest A row otherwise.
  - Level: clean `CNT = W·R/(δ·N)`. For a B738 at 10,000 ft and 250 kt that is about 6,100 lb.
- Weight is unknown. `ANP2.3_Default_weights.csv` gives the 737800 by stage length: 133,300 / 139,200 / 145,500 / 156,700 / 167,600 / 172,300 lb (stages 1 to 6). Inference: ±10 percent weight shifts departure thrust by ±10 percent, which is about ±0.8 dB on the NPD.

### Lateral attenuation and engine installation (SAE AIR-5662 as adopted by Doc 29)

- Engine installation, eq. 4-15: `ΔI(φ) = 10·log10[(a·cos²φ + sin²φ)^b / (c·sin²2φ + cos²2φ)]`. Wing-mounted: a 0.0039, b 0.062, c 0.8786. Fuselage-mounted: a 0.1225, b 0.329, c 1. Props: ΔI = 0. For negative φ use ΔI(0). φ is the depression angle from the wing plane (equal to the elevation angle β with wings level). Doc 29 5th ed section 4.5.3.
- Lateral attenuation, eqs. 4-18 and 4-19 ("adapted from AIR-5662"): `Λ(β,ℓ) = Γ(ℓ)·Λ(β)`.
  - `Γ(ℓ) = 1.089·(1 - exp(-0.00274·ℓ))` for ℓ ≤ 914 m, else 1.
  - `Λ(β) = 1.137 - 0.0229·β + 9.72·exp(-0.142·β)` for β ≤ 50°, else 0. β is in degrees and ℓ is the lateral ground distance in m.
  - Section 4.5.4.
- What it means: about 1 dB at β = 23°, about 3.5 dB at 9°, about 7 dB at 3°, and up to about 10.9 dB at 0°.
- Doc 29 warns that it is "very strongly affected by sound refraction ... wind and temperature gradients and turbulence". It covers only "soft level ground". Adjustments "for the effects of a hard ground surface ... are still under development". Inference: in a city of hard surfaces and buildings the real values will scatter more.
- SAE AIR-5662 itself is paywalled. Doc 29 cites it as "[11] SAE International: AIR-5662, update to AIR-1751 (2006)".

### Atmospheric absorption and the reference atmosphere

- NPD data "have been normalised using average atmospheric attenuation rates defined in SAE AIR-1845" (Table D-1). The set "cannot be associated with a single reference atmosphere" and is a notional "AIR-1845 atmosphere". Rates per 100 m include 0.230 dB at 250 Hz, 0.590 dB at 1 kHz, 1.311 dB at 2 kHz and 3.115 dB at 4 kHz. Doc 29 5th ed Appendix D.
- SAE ARP 5534 (2013) is the recommended method to re-compute NPDs for other conditions. ARP 866A (1975) is allowed for transition. Doc 29 says the NPDs apply within this envelope: "Air temperature less than 30 C", "Product of air temperature (C) and relative humidity (percent) greater than 500", "Wind speed less than 8 m/s". Doc 29 5th ed sections 2.5 and Appendix D. ISO 9613-1 is not referenced by Doc 29.
- Inference: absorption is already in the NPD numbers. At 3.8 km that is about 22 dB at 1 kHz, which is why distant jets sound like a low rumble. Tel Aviv summers (about 30 C, humid) are at the edge of the envelope, so keep the tables as they are.

### Doppler and speed

- NPDs relate to "steady flight at specific reference speeds Vref" (reference groundspeed 160 kt). The speed (duration) correction ΔV applies to exposure levels only, "not applied to Lmax,seg". Doc 29 5th ed sections 2.5, 4.2 and 4.3.1.
- Doc 29 has no Doppler term and no longitudinal (fore/aft) directivity for airborne segments. Directivity is modelled only behind start of roll (section 4.5.7).
- Inference: Doppler shifts pitch but changes A-weighted LAmax little at airliner speeds. A bigger practical effect is propagation delay. At 3.8 km the sound arrives about 11 s after it leaves the plane (343 m/s), and a jet at 250 kt has moved about 1.4 km by then. The "loudest" moment the user hears lags the geometric closest point.

### Why "one fixed loudness per class, 55 dBA threshold" fails

All inference from the sources above:

- Thrust: the same airframe at the same distance differs by about 13 dB between climb and approach (ANP CF567B D vs A rows). One number per class has to be wrong for one of the two.
- Distance: the NPD drops 7 to 8 dB per doubling between 1.2 and 5 km. A flat radius treats 2 km and 4 km alike.
- Geometry: lateral attenuation adds 1 to 7 dB depending on elevation angle, so low passes far away fade fast.
- Type spread inside a class: the substitution deltas run from -6.7 dB (A20N CFM) to +3.5 dB (A321ceo) against the proxy.
- Threshold: 55 dBA is above the ISR725 estimate (50 to 54 dBA), so the model would have rejected the one plane we know was heard. Background varies about 10 dB day to night (section 2), so any fixed absolute threshold is wrong half the day.

## 2. Detection threshold against urban ambient

### Detectability (signal detection theory)

- FAA AEDT computes audibility "based on detectability from signal detection theory" for "an attentive listener", per one-third octave band:
  - `D'L_band = (L_signal,band - L_noise,band) + 10·log10(η_band) + 0.5·10·log10(bandwidth)` (eq. 10-46).
  - L_noise includes the ambient plus the Equivalent Auditory System Noise floor (EASN, for example 6.3 dB at 1 kHz).
  - Bands combine as `d'_total = sqrt(Σ d'_band²)`, and the signal is "detectable" if `10·log10(d'_total) ≥ 7`.
  - Band constants 10·log η: for example -3.96 at 250 Hz and -3.56 at 1 kHz. Bandwidths: 56 Hz at 250 Hz and 220 Hz at 1 kHz.
  - Source: AEDT 2b Technical Manual, section 10.1.5, citing Green and Swets and "Fidell, et al., Predicting Annoyance from Detectability of Low-Level Sounds". https://ntlrepository.blob.core.windows.net/lib/59000/59400/59497/AEDT2b_TechManual.pdf
- Noticeability: Sneddon, Pearsons and Fidell, "Laboratory study of the noticeability and annoyance of low signal-to-noise ratio sounds", Noise Control Eng. J. 51(5), 2003. Subjects were reading and noted sounds in a free-response paradigm. https://ince.publisher.ingentaconnect.com/content/ince/ncej/2003/00000051/00000005/art00003
- A NASA summary of that paper (Begault, NASA Ames, 2021) gives: "d'L 6 (d' 4) = detection when focused", "d'L 11 = level for 50 % signals to be noticed", "d'L 16 = level to command attention when distracted". It defines noticeability as "the ability of an audible signal to attract the attention of an individual engaged in an activity other than listening for such a sound". https://ntrs.nasa.gov/api/citations/20210013192/downloads/ATWG_SPR21_v4.5.21.pdf
- Inference (converting to A-weighted levels):
  - In the 250 Hz to 1 kHz bands, 10·log η + 5·log BW is about +5 to +8 dB. With about 10 contributing bands of similar SNR, the root-sum-square adds about 5 dB more.
  - So D'L ≈ SNR + 11 to 13 dB when the aircraft and background spectra have similar shape. A distant jet and road-traffic background both peak at low frequency (the SINTEF report below says background "resembles that of road traffic noise").
  - Therefore: a focused listener detects at about SNR_A -5 to -7 dB, 50 percent notice at about SNR_A 0 dB, and it commands attention at about SNR_A +5 dB, where SNR_A = LAmax - LA90.
  - These are starting values to calibrate, not established constants.

### Urban ambient levels

- EASA-commissioned report (SINTEF A6631, Gjestland 2008): in populated areas "the overall background noise level ... seems to be proportional to the logarithm ... of the population density". The equation is `Ldn = 18 + 10·log(ρ)` with ρ in persons per km². It was validated for 230 to 5,000 persons/km². "Typical noise levels in shielded inner city locations are in the range 45-50 dBA." https://www.easa.europa.eu/sites/default/files/dfu/Background_noise_report.pdf
- Same report, measured examples:
  - Trondheim city park, 1 hour by day: LAeq 49.3, LA90 46.9.
  - Berlin Tiergarten: LAeq 49, LA90 47.4.
  - Amsterdam: LA95 41 to 35 dBA.
  - By day, "L95 is about 7.5 dB below Lden". Night-time road noise is "about 7 dB below the hourly average", and the night low to day high difference is "around 10 dB" (Klagenfurt).
  - The report recommends "a certain percentile level" as the best descriptor for audibility.
- US EPA (condensed Levels Document, EPA 550/9-79-100): "nearly half of the urban population live in areas exposed to traffic sounds" of Ldn 55 to 60 dB. https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=20012HG5.TXT
- Inference for Ramat Gan / Tel Aviv: residential density is roughly 8,000 to 15,000 per km², above the validated range. The formula gives Ldn about 57 to 60. Daytime L90 is about 48 to 52 dBA on a street-facing side and about 45 dBA in a shielded courtyard. Night L90 is about 38 to 42 dBA. A street-side flat on a main road will be higher.

### Number-above metrics and facades

- N70 origin (DOTARS, "Expanding Ways to Describe and Assess Aircraft Noise", March 2000, chapter 4): 70 dB(A) "has been chosen because this is equivalent to the single event level of 60 dB(A) specified in Australian Standard AS2021 as the indoor design sound level". "An external single event noise will be attenuated by approximately 10 dB(A) by the fabric of a house with open windows." An internal 60 dB(A) event "is likely to interfere with conversation or with listening to the radio or the television". It also suggests N65 for 7 to 10 pm and N60 for 10 pm to 7 am (sleeping). https://web.archive.org/web/2015/http://www.infrastructure.gov.au/aviation/environmental/transparent_noise/expanding/4.aspx
- The 2003 Australian guidance repeats this. N60 suits general aviation airports because "a level of 60 dB(A) is typical of the noise level of aircraft in training circuits". https://www.infrastructure.gov.au/sites/default/files/migrated/aviation/environmental/transparent_noise/files/GuidanceMaterial.pdf
- Inference: N70 marks disturbance, not audibility. A plane at 50 dBA is clearly audible and well below N70.
- Facade attenuation:
  - EPA Table II: windows open, national average 15 dB (warm climate 12 dB); windows closed, 25 dB (warm 24 dB). https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=20012HG5.TXT
  - Locher et al. 2018 measured 307 cases in Swiss dwellings (road traffic noise). Median outdoor-indoor difference was 10 dB(A) with windows open, 16 tilted and 28 closed. https://pmc.ncbi.nlm.nih.gov/articles/PMC5800248/ (doi:10.3390/ijerph15010149)
- Inference: with a window open, both the aircraft and the outdoor background drop by about 10 dB. The SNR test still holds unless indoor sounds (fridge, TV, AC) exceed the attenuated background. With windows closed, assume "not heard" unless outdoor LAmax is about 65 dBA or more.

## 3. A model a small server can run every 5 s

All of this section is inference built on the cited equations.

Per tracked aircraft, per 5 s tick, predict positions over the next 120 s (5 s steps, the linear extrapolation already used) and compute:

1. Proxy: `proxy, ΔDEP, ΔAPP = SUBST[icao_type]` (by-ICAO-code tab of the EASA xlsx). Where several proxies exist, pick the engine variant if known, else the noisier one. If the type is unknown, fall back by class:
   - jet twin Large: 737800 (ΔDEP 0)
   - jet twin Heavy: 7878R or A330-301
   - jet quad Heavy: 747400
   - regional jet: EMB190
   - turboprop twin: ATR72 or DHC830
   - piston single: CNA172
   - rotorcraft: not in ANP. Use a fixed 0 dB-margin rule (card if within about 2 km and below 2,000 ft).
2. Atmosphere: `δ = (1 - 6.8756e-6·h_ft)^5.2559` (ISA), with h the barometric altitude.
3. Mode and thrust per engine:
   - `sinγ = clamp(vrate_fpm / (gs_kt·101.27), -0.2, 0.3)`
   - Climbing (vrate > +300 fpm): Mode D, `P = (W_dep/δ)/N · (sinγ/0.95 + R_clean)`, clamped to [0.5·MaxClimb, MaxTakeoff] from eq. B-9.
   - Descending, or inbound below 4,000 ft AGL: Mode A, `P = W_app/(δ·N) · (R_land - sinγ_abs/1.03)`, clamped to [lowest A row, highest A row].
   - Level: `P = W·R_clean/(δ·N)`. Use Mode A if gs < 210 kt, else D.
   - W_dep = ANP default weight for stage 2. W_app = 0.9·MLW.
4. Geometry per predicted point: `ℓ` = horizontal distance (m), `hAGL` = baro alt minus about 30 m local elevation, `d = sqrt(ℓ² + hAGL²)`, `β = atan2(hAGL, ℓ)` in degrees.
5. Level: `L = NPD_LAmax(proxy, mode, P, d) + ΔI(β) - Λ(β, ℓ) + Δtype`. NPD interpolation follows eqs. 4-3/4-4 with d ≥ 30 m. ΔI and Λ follow eqs. 4-15, 4-18 and 4-19. `Δtype` = ΔDEP in mode D or ΔAPP in mode A.
6. Peak: `Lpk = max over predicted points`. The peak is heard at time `t_cpa + d/343` s.
7. Ambient `LA90(local hour)`. Defaults for urban residential:
   - 07-19: 48 dBA
   - 19-23: 45 dBA
   - 23-07: 40 dBA
   - Optional per-user offset: quiet courtyard -3, main road +5.
8. Heard if `Lpk - LA90 ≥ M`. Start with M = 0 dB (50 percent noticed). Use hysteresis: start the card at M + 1, keep it until the level drops below M - 3.
9. Guard rails: always card for anything below 1,500 ft AGL within 2 km. Never card if `Lpk < 35 dBA` (very quiet night limit).

Cost: per plane per tick, about 25 evaluations, each a few log and exp calls. That is trivial even for hundreds of planes.

The data to load at startup is about 30 proxies' NPD LAmax rows, jet coefficients, aero R values and default weights, plus the substitution map: a few hundred KB of JSON.

## 4. Public validation data (without users)

- Schiphol: NOMOS has 41 measuring posts. Per-passage LAmax is shown on "NOMOS online" on the Casper platform (noiselab.casper.aero). https://news.schiphol.com/improved-noise-measurements-in-the-area-around-schiphol/
- RIVM report 2023-0429 used NOMOS to validate Doc 29:
  - "For high noise exposures, the difference ... was less than 2 dB Lden".
  - Per-flight SEL differences for most posts were "-2 tot +4 dBA".
  - NOMOS records only events above a threshold, so "lage geluidniveaus minder vaak gemeten" (low levels are measured less often).
  - https://www.rivm.nl/bibliotheek/rapporten/2023-0429.pdf
  - Inference: that threshold censors exactly the 40 to 55 dBA range we care about.
  - I found no documented bulk download API.
- Sydney and other Australian airports (Airservices WebTrak): per-flight noise events at monitors, with a 3-minute delay, are "provided for personal and non-commercial use". The terms say "Users may not modify, copy, distribute or reproduce in any form the data obtained from WebTrak". https://www.airservicesaustralia.com/community/environment/aircraft-noise/webtrak/. Inference: Heathrow, Brussels and others run the same kind of WebTrak, so assume the same limits. Use it for manual spot checks only.
- San Francisco (peer-reviewed, Rindfleisch et al., JASA 155(3), 2024): AEDT vs two monitors, over 200,000 trajectories in 12 months. "AEDT underestimated LAmax by -3.09 dB" on average. Arrivals to 28L/28R were -3.6 dB (regulatory mode, SD ±2.3) and -2.7 dB (actual-performance mode, SD ±1.5). https://pubs.aip.org/asa/jasa/article/155/3/1928/3270390/A-large-scale-validation-study-of-aircraft-noise. Inference: add about +3 dB to approach estimates.
- UK CAA CAP 1736 (Edinburgh, 2018) compares calculated and measured levels per type, including B737-800 and A319/A320 at Gatwick and Stansted monitors 6.5 km and 12 km from start of roll. It also documents a pre-2018 noise-to-flight time-sync error that assigned A319-level events to other types. https://www.caa.co.uk/publication/download/17151. Inference: when matching NMT events to ADS-B, verify clock sync first.
- Ben Gurion: the IAA runs a TOPSONIC monitoring and track-keeping system with stations in Be'erot Yitzhak, Rosh HaAyin, Tzafria, Beit Dagan, Holon (3), Bat Yam, Mishmar HaShiv'a, Or Yehuda, Rishon LeZion (3), Tel Aviv, Bnei Atarot and Truman. Departing planes must meet a "predetermined maximal noise threshold". I found no public data or viewer. https://www.iaa.gov.il/en/environment-and-sustainability/noise-and-air-quality-monitoring-system/. Inference: ask the IAA Environmental Protection Branch. Their Tel Aviv, Holon and Or Yehuda monitors are the closest match to Overhead's users.
- Inference: the most useful validation is our own. Put a calibrated (or iPhone-calibrated) sound level meter on a Ramat Gan balcony for a week and log 1 s LAeq with timestamps. Match peaks to our own ADS-B tracks and fit two numbers: the mode A offset and the margin M.

## 5. Worked numbers

ANP 2.3 NPD plus Doc 29 eqs. 4-8a, 4-15, 4-18 and 4-19, wings level, ground about 30 m. All values are outdoor LAmax, inference by arithmetic.

- B738 departure at 3.8 km slant (ISR725 geometry: 3.5 km horizontal, 4,925 ft, β ≈ 23°): NPD 51.4 to 54.8, ΔI -0.2, Λ -1.0, so 50 to 54 dBA (force-balance 13,900 lb to MaxClimb 17,600 lb). That is about +2 to +6 dB over daytime L90 and +10 to +14 at night: noticed, and clearly audible indoors with a window open (about 40 to 44 dBA inside).
- A320 approach at 3.8 km slant (same geometry): about 40 dBA for A320-232 at 4,900 lb (39.6 at the 2,000 lb floor), 40.6 for A320-211, and 40.6 for a B738 on approach. With the SFO +3 dB arrival bias, about 43 dBA. That is below daytime background and near night background: "barely noticed".
- Same B738 climb thrust, still 3.8 km slant, but only 2,000 ft high (β ≈ 9°): Λ rises to 3.5 dB, giving about 50 dBA. Low passes lose several dB.
- B738 at 10,000 ft directly overhead (slant 3.0 km, β = 90°, Λ = 0, ΔI = 0): about 59 dBA climbing at MaxClimb (about 18,600 lb), about 47 dBA level/cruising at about 6,100 lb. The climbing case is louder than ISR725, even though the old rule's 10,000 ft cut-off would drop it a little higher up.
- Cessna 172 at 1,500 ft and 2 km horizontal (slant 2.05 km, β ≈ 12°, Λ -2.6): about 41.5 dBA at 60 percent thrust and 42.7 at 100 percent. Audible at night, lost in daytime traffic.
- For reference at the old-rule edge: A320 approach 2.8 km horizontal at 3,000 ft gives about 43 dBA. B738 climb 2.8 km horizontal at 9,000 ft gives about 55 dBA. B738 climb 6 km horizontal at 6,000 ft gives about 45 dBA.

## Recommendation for Overhead

Everything here is inference unless cited.

Model to implement:

- Replace the 2.8 km / 10,000 ft gate with the section 3 pipeline: proxy by ICAO code, then thrust from ADS-B force balance, then NPD LAmax at slant distance, plus ΔI minus Λ plus the type delta.
- Show a card when the predicted peak `LAmax - LA90(hour) ≥ M`.
- Starting parameters:
  - M = 0 dB (start at +1, end at -3)
  - LA90 = 48 / 45 / 40 dBA for day / evening / night
  - mode A bias +3 dB (SFO study)
  - weights: ANP stage-2 default for departures, 0.9·MLW for arrivals
  - K = 0.95
  - minimum distance 30 m
  - prediction horizon 120 s
- Show the card lead time using sound delay (d/343 s). The audible peak follows the visual closest point by about 10 s at 3 to 4 km.
- Keep one tunable "sensitivity" in settings that shifts M by ±5 dB ("only loud planes" / "everything I might hear"). A user's own hearing and home vary more than any model term.

Data files and licenses:

- EASA ANP legacy 2.3 ZIP (`ANP2.3_NPD_data.csv`, `ANP2.3_Aircraft.csv`, `ANP2.3_Jet_engine_coefficients.csv`, `ANP2.3_Aerodynamic_coefficients.csv`, `ANP2.3_Default_weights.csv`). Public download https://www.easa.europa.eu/en/downloads/138164/en. Doc 29 5th ed G1: legacy data "are not subject to the ANP terms and conditions".
  - No explicit open license is stated. Ownership of the data stays with manufacturers in the current terms, and it is unclear whether that carries over to legacy data.
  - So keep the derived tables server-side and do not redistribute the raw CSVs in the app bundle or a public repo.
  - Note: this research file quotes a few NPD rows. If the repo goes public, consider removing those rows.
- EASA "ANP Aircraft Substitutions" xlsx (https://www.easa.europa.eu/en/downloads/138165/en). Same footing as above: public, no license stated.
- Do not use the current registered EASA database (neo, 787-9, E2 data). Its clause 6(a) limits use to airport contour modelling without manufacturer consent, and 6(d)/6(g) forbid sharing and publishing. https://www.easa.europa.eu/en/downloads/116585/en
- Equations: Doc 29 (public PDF on ECAC). Implementing published equations needs no license.

Open risks:

- Newer types use proxies plus certified-level deltas: A20N -6.7 / -3.5, A21N -3.7 / -0.7, B789 +3.2 / +2.8 vs 787-8. These are rough, and the A320neo family is a large share of TLV traffic.
- Thrust inference: ADS-B gives ground speed, not airspeed (wind error in sinγ), and an unknown weight. Acceleration during climb is hidden, and so are derates. Expect ±3 dB on departures.
- Lateral attenuation and NPDs assume soft, flat ground. Urban hard surfaces, building shielding, street canyons and wind direction can each move levels by several dB. Doc 29 says hard-ground adjustments are "still under development".
- Ambient: a single city-wide L90 by hour is crude. A flat on a main road can sit 5 to 10 dB above a quiet side street. A per-user offset (or an opt-in on-device ambient measurement) is the eventual fix.
- The detectability-to-dBA conversion (M ≈ 0) is my own derivation from AEDT and Sneddon et al. It needs a balcony measurement to confirm.
- Public NMT data is threshold-censored (NOMOS) or licensed for viewing only (WebTrak). Ben Gurion data is not public, so validation in Israel depends on our own measurements or an IAA data request.

## Sources

Standards and models
- https://www.ecac-ceac.org/images/documents/ECAC-CEAC-DOC_29_5th_Edition-REPORT_ON_STANDARD_METHOD_OF_COMPUTING_NOISE_CONTOURS_AROUND_CIVIL_AIRPORTS-Volume_2-TECHNICAL_GUIDE.pdf (Doc 29 5th ed Vol 2, May 2026)
- https://www.ecac-ceac.org/images/documents/ECAC-Doc_29_4th_edition_Dec_2016_Volume_2.pdf (Doc 29 4th ed Vol 2)
- https://ntlrepository.blob.core.windows.net/lib/59000/59400/59497/AEDT2b_TechManual.pdf (FAA AEDT 2b Technical Manual, audibility section 10.1.5)

EASA ANP database
- https://www.easa.europa.eu/en/domains/environment/policy-support-and-research/aircraft-noise-and-performance-anp-data
- https://www.easa.europa.eu/en/downloads/138164/en (ANP 2.3 tables)
- https://www.easa.europa.eu/en/downloads/138159/en (ANP 2.3 release note)
- https://www.easa.europa.eu/en/downloads/138165/en (substitution table)
- https://www.easa.europa.eu/en/downloads/143284/en (EASA verified ANP types)
- https://www.easa.europa.eu/en/downloads/116585/en (ANP Terms and Conditions, Issue 3)
- https://www.easa.europa.eu/en/anp-data-request

Perception and ambient
- https://ince.publisher.ingentaconnect.com/content/ince/ncej/2003/00000051/00000005/art00003 (Sneddon, Pearsons, Fidell 2003)
- https://ntrs.nasa.gov/api/citations/20210013192/downloads/ATWG_SPR21_v4.5.21.pdf (Begault, NASA, 2021)
- https://www.easa.europa.eu/sites/default/files/dfu/Background_noise_report.pdf (SINTEF A6631 for EASA, 2008)
- https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=20012HG5.TXT (EPA 550/9-79-100)
- https://pmc.ncbi.nlm.nih.gov/articles/PMC5800248/ (Locher et al. 2018)
- https://web.archive.org/web/2015/http://www.infrastructure.gov.au/aviation/environmental/transparent_noise/expanding/4.aspx (DOTARS Expanding Ways, chapter 4)
- https://www.infrastructure.gov.au/sites/default/files/migrated/aviation/environmental/transparent_noise/files/GuidanceMaterial.pdf (Australian guidance, 2003)

Validation and monitoring
- https://pubs.aip.org/asa/jasa/article/155/3/1928/3270390/A-large-scale-validation-study-of-aircraft-noise (Rindfleisch et al., JASA 2024)
- https://www.rivm.nl/bibliotheek/rapporten/2023-0429.pdf (RIVM PAMV, 2023)
- https://news.schiphol.com/improved-noise-measurements-in-the-area-around-schiphol/
- https://www.airservicesaustralia.com/community/environment/aircraft-noise/webtrak/
- https://www.caa.co.uk/publication/download/17151 (UK CAA CAP 1736)
- https://www.iaa.gov.il/en/environment-and-sustainability/noise-and-air-quality-monitoring-system/
