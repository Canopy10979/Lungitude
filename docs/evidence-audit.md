# Evidence audit — 2026-10-24

Original numerical values are preserved in `data/wa_cancers.json` under `unverified_or_corrected_values`.

- Removed all WA/US NCI incidence comparisons (including all-sites 441.2/453.4): a matching dated export was not verified.
- Corrected ACS 2026 kidney cases 1,550 → 1,560 and pancreas cases 1,220 → 1,560; filled previously missing deaths/cases from the ACS state table. These are estimates.
- Retained ALA 2025 Washington screening 15.8%, rank 37/51, US 18.2%, with the official report link.
- Removed unsourced early/late survival 65%/10%, CDC 13/40% obesity claim, fixed scan-duration claims, and numerical BCCHP age/income eligibility claims.
- Screening ages and intervals use explicitly dated USPSTF final recommendations. Cervical guidance is identified as USPSTF 2018; HRSA issued different updated guidance in 2026.
- Regional service-map date is unknown: marked unverified and removed from the primary results.
- Demo county prevalence values are fictional examples, never population evidence.
- Removed trained-AI assertions and student coaching by replacing the README; no trained lung-sound or skin model is supplied.
- Removed blanket privacy promises; shared results disclosure describes server processing, external providers, cache and study storage.
- PLCOm2012 and 1.51% are research context, not a diagnosis or an independent order to screen. No local clinical validation claimed.

- Optional county prevention percentages are suppressed unless a verified year is attached; current imports lack that provenance. Live CDC lookup is opt-in (`ALLOW_LIVE_COUNTY_STATS=1`), keeping manual county results usable without network.
- Removed definite clinic claims (“Can do the scan” / “Can order the scan”) and blanket no-cost insurance statements: the directory does not verify service availability or coverage.
- Removed billing-code suggestions from the doctor note to keep it focused on patient-reported observations.
- Experimental PDR, pulse, exhale-time and color thresholds are catalogued as unverified clinical cutoffs in `data/wa_cancers.json`; they are engineering heuristics, not accuracy claims.

## Each removed incidence comparison

All values below were originally labeled 2019–2023 age-adjusted incidence per 100,000. They are **unverified**, retained in the JSON audit record and set to null in display fields because a matching dated NCI export was not verified.

| Cancer/site | Original WA rate | Original US rate |
| --- | ---: | ---: |
| all_sites | 441.2 | 453.4 |
| Lung and bronchus | 46.7 | 51.8 |
| Breast (female) | 139.9 | 133.0 |
| Colon and rectum | 34.3 | 36.9 |
| Prostate | 106.9 | 119.9 |
| Urinary bladder | 19.8 | 18.7 |
| Kidney and renal pelvis | 15.7 | 17.9 |
| Melanoma of the skin | 26.7 | 23.8 |
| Leukemia | 14.7 | 14.5 |
| Non-Hodgkin lymphoma | 18.7 | 18.5 |
| Pancreas | 13.6 | 13.9 |
| Liver and bile duct | 8.5 | 8.7 |

## Other removed or qualified statements

| Original statement | Disposition and reason |
| --- | --- |
| Early/late lung survival 65% / 10% | Removed: exact population, stage definition and reference years were not verified. |
| “13 kinds” and “about 40%” obesity-associated cancer statistics | Removed from results: the specific cited release/denominator was not verified in this revision. |
| BCCHP ages 21–64 and income 250–300% of poverty | Removed as an eligibility promise: requirements vary by service and must be confirmed with the program. |
| No-cost screening coverage promise | Replaced with plan-specific verification; selected age/smoking rules cannot establish coverage. |
| Scan takes less than a minute / needs no needles | Removed: service details were not verified and are not necessary for the guide. |
| Clinic “Can do the scan” / “Can order the scan” | Replaced: general directory results do not verify service availability. |
| Supplied county-to-provider screening map | Hidden in main results: publication date and present service coverage are unverified; original asset preserved. |
| County smoking/COPD/obesity/screening percentages | Suppressed without verified year/provenance. Unavailable values are not treated as zero. |
| “Nothing is stored” / blanket “photos never leave the phone” | Removed/qualified: caches, consented study records and research-image uploads exist. Shared results disclosure states actual flows. |
| AI trained on 126 patients / hears what a stethoscope hears / cancer-detection implications | Removed: training scripts exist, but no trained lung-sound or skin model is supplied and no clinical evaluation supports these claims. |
| 1.51% as a universal screening cutoff | Qualified as a published research reference, separate from USPSTF eligibility and clinician judgment. |
| Phone pulse, exhale, finger and color thresholds as clinical normality | Qualified as unvalidated experimental heuristics; thresholds recorded in the JSON evidence metadata. |
| Private-download/ZIP configuration and old test-count claims | Removed: not applicable to the public repository or current verified checks. |

Verified ACS 2026 figures retained for all sites and each cancer are linked to the state table. Corrected kidney cases **1,550 → 1,560** and pancreas cases **1,220 → 1,560**. Previously blank ACS values were filled only where the state table supplied them: kidney deaths 330, bladder deaths 400, melanoma deaths 210 and liver cases 990. Washington screening **15.8%, rank 37/51**, and national screening **18.2%** are retained with ALA 2025 attribution. USPSTF age/interval rules retain their individual recommendation years and links.
