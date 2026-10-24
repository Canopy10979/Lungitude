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
