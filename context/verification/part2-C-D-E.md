# Verification: Branch C (incl. C2), Branch D, Branch E, Open items for the team

File under review: `decision-tree-assistance.md`. Sources: `context/sources/*.txt` (pdftotext -layout extractions). Per manifest, `211virginia-home.txt` is a Cloudflare 522 error page and `chp-weatherization.pdf/.txt` was never captured (site unreachable) — both treated as NOT FOUND regardless of what the tree claims from them.

CONTRADICTED and NOT FOUND rows are listed first, then SUPPORTED/PARTIAL, grouped by branch.

## CONTRADICTED

| claim | source tag | verdict | evidence quote | note |
|---|---|---|---|---|
| Salvation Army Fairfax Corps "social services 703-385-6192" | `[src: 211-salvation-army-fairfax.pdf]` | CONTRADICTED | 211-salvation-army-fairfax.txt: "(703) 385-8700 / Voice ... (703) 385-6192 / Fax" | The tree gives the FAX number as the number to call. The Voice (phone) number is 703-385-8700 — which also matches Dominion's own agency list (`Fairfax - The Salvation Army-Fairfax - 703-385-8700`). Same wrong number is repeated in Branch D. |
| United Community EnergyShare service area: "22306, 22307, 22308, 22309, and the part of 22303 and 22310 east of Telegraph Road" | `[src: united-community-locations.pdf]` `[src: united-community-energyshare-vanavigator.pdf]` | CONTRADICTED | united-community-energyshare-vanavigator.txt: "Service Area(s): Alexandria City, Fairfax City, Fairfax County, Falls Church City" | Neither file contains the word "Telegraph" or any ZIP-code-level service boundary. The actual stated EnergyShare service area is all of Fairfax County plus Alexandria/Fairfax/Falls Church cities — much broader than, and inconsistent with, the ZIP-restricted claim in the tree. |
| Catholic Charities "703-443-2481, EA@ccda.net" | `[src: catholic-charities-utilities.pdf]` | CONTRADICTED | catholic-charities-utilities.txt: "200 North Glebe Road, Arlington, VA 22203 / 703-841-3830 / info@ccda.net" | The source file's own contact block for this org gives a different phone number (703-841-3830) and a different email (info@ccda.net). "703-443-2481" and "EA@ccda.net" do not appear anywhere in the file. |

## NOT FOUND

| claim | source tag | verdict | evidence quote | note |
|---|---|---|---|---|
| EnergyShare $600 heating / $300 cooling caps, and the note that a "partner PDF's $6,000 and $3,000" is wrong | `[src: dominion-energyshare.pdf]` `[src: dominion-energy-assistance.pdf]` | NOT FOUND | dominion-energyshare.txt and dominion-energy-assistance.txt contain no dollar figures for EnergyShare at all (grepped `600`, `300`, `$` — no hits) | pdftotext of dominion-energyshare.pdf captured only cookie-banner/nav boilerplate; the actual accordion content (what EnergyShare pays, amounts) was not rendered to text. Neither $600/$300 nor $6,000/$3,000 appears in ANY captured source file — grepped all .txt files, zero hits. Cannot confirm or refute either figure from these sources. |
| EnergyShare qualify conditions (service area + disconnection notice / reconnection / payment-plan help / Budget Billing removal notice) | `[src: dominion-energyshare.pdf]` | NOT FOUND | dominion-energyshare.txt has no mention of "reconnect," "disconnect," or "Budget Billing" in any qualifying context | Same JS-accordion capture gap as above. |
| EnergyShare extras: 60+ "more often," veterans/disabled extra $500 via VA Dept of Veterans Services or DARS CIL voucher | `[src: dominion-energyshare.pdf]` | PARTIAL/NOT FOUND | The "60+" part is actually supported by a *different* file: united-community-energyshare-vanavigator.txt: "Individuals 60 and older are eligible for additional assistance." The $500 veteran/disability voucher detail appears in NO source file (grepped "voucher," "DARS," "Department of Veterans Services" across all .txt files) | The 60+ claim should be re-tagged to the vanavigator source, not dominion-energyshare.pdf. The $500 figure is unverifiable from this archive. |
| C2: free assessment + upgrade list (LED bulbs, low-flow showerheads/aerators, insulation, heat pump/AC tune-up, air/duct sealing, water heater/pipe wrap) | `[src: dominion-energyshare.pdf]` | NOT FOUND | No hits for "LED," "aerator," "duct," "pipe wrap," "showerhead," "insulation" in dominion-energyshare.txt, or in any other .txt file | Same accordion-capture gap; entire bullet unsupported by the archive as captured. |
| C2 qualify: "Dominion customer who has received bill payment help" | `[src: dominion-energyshare.pdf]` | NOT FOUND | Not present in dominion-energyshare.txt | Same gap. |
| C2 apply: "call 888-366-8280 and choose the Income and Age Qualifying option" | `[src: dominion-energyshare.pdf]` | NOT FOUND | Phone number "888-366-8280" / "8280" does not appear in ANY .txt file in the folder | Fully unverifiable from this archive; cannot confirm this number is even real. |
| Koinonia ZIP list "(ZIPs 22150, 22303, 22304, 22310, 22312, 22315)" | `[src: koinonia-emergency-assistance.pdf]` `[src: 211-koinonia.pdf]` | NOT FOUND | 211-koinonia.txt eligibility: "Residents of Franconia, East Springfield, Newington, and Kingstowne in Fairfax County." No ZIP codes anywhere. | Grepped 22150/22303/22304/22312/22315 across both Koinonia files — zero hits. The neighborhood list (Franconia/East Springfield/Newington/Kingstowne) is supported; the specific ZIP set is not in the sources and appears to be the tree-writer's own ZIP-to-neighborhood inference. |
| United Community "Stepping Stones program" (Branch D) | (no src tag given, implied same as Branch C) | NOT FOUND | united-community-locations.txt lists services "Rental, Utility, and Prescription Assistance" under the Family Achievement Program, but the phrase "Stepping Stones" appears nowhere in any .txt file | General rental/utility assistance is supported; the specific program name "Stepping Stones" is not. |
| "Not for 22310: ECHO... serves 22150 west of I-95, 22151, 22152, 22153, 22015. ACCA... referrals only through CSP." | (no src tag) | NOT FOUND | No file in the folder mentions "ECHO" or "ACCA" (grepped all .txt files, zero hits); ZIP codes 22150/22151/22152/22153/22015 also do not appear anywhere | This whole bullet has no supporting source file in the archive at all — not even a CHECK-worthy secondary source. It is asserted with no citation and cannot be checked against anything provided. |
| Branch E WAP: `[src: chp-weatherization.pdf]` for CHP contact details/upgrade list, and the CHP email/URL given (`chpenergysolutions@chpc2.org`, `communityhousingpartners.org/energy-solutions/weatherization`) | `[src: chp-weatherization.pdf]` `[src: dhcd-wap-providers.pdf]` | NOT FOUND | Per MANIFEST.md, chp-weatherization.pdf capture FAILED (origin unreachable) — no file exists at all. dhcd-wap-providers.txt gives only "Fairfax Co / CHP / (888) 229-3714 / Energy Solutions Weatherization \| Community Housing Partners" — no email, no "Northern Virginia office," no full URL. | Only the phone number 1-888-229-3714 is actually supported (by dhcd-wap-providers.txt). The email address, "Northern Virginia office" label, and full URL are unverifiable — chp-weatherization is confirmed missing per the task's own manifest note. |

## PARTIAL

| claim | source tag | verdict | evidence quote | note |
|---|---|---|---|---|
| CSP interpreter languages: "Amharic, Cantonese, Dari, Tagalog, Haitian Creole, Hindi, Korean, Pashto, Punjabi, Somali, Spanish, Tamil, Urdu and more" | `[src: fairfax-csp.pdf]` | PARTIAL | fairfax-csp.txt: "Amharic, Chinese (Cantonese), Farsi (Dari), Filipino (Tagalog), French Creole (Haiti), Hindi, **Italian, Kannada**, Korean, Pashto, Punjabi, Somali, Spanish, Tamil, and Urdu." | The tree's list omits Italian and Kannada, which are explicitly named in the source. "And more" technically covers this, but since the source's list is exhaustive and named, the two languages should be listed, not folded into "and more." |
| Salvation Army Fairfax Corps address "4915 Ox Rd, Fairfax, VA 22030" and "electric bills only; disconnect notice required" | `[src: 211-salvation-army-fairfax.pdf]` | PARTIAL | 211-salvation-army-fairfax.txt: "4915 Ox Road, Fairfax, VA 22030"; "emergency financial aid for electric bills only, no gas bills. Must have a disconnect notice." | Address and electric-only/disconnect-notice rule are SUPPORTED. But "required under 60" has no match in the source at all — the source says only "Income Limit" with no numeric threshold and no age-60 rule for this program (age 60 appears nowhere in this file). That clause looks fabricated or garbled. |
| Catholic Charities "requires... a past-due notice" | `[src: catholic-charities-utilities.pdf]` | PARTIAL | catholic-charities-utilities.txt: "the late or disconnect notice for the documents to be validated" | Source says "late or disconnect notice," not "past-due notice" — close in meaning but not the exact condition; also the source additionally requires a current photo ID matching the bill, which the tree omits. |

## SUPPORTED

| claim | source tag | verdict | evidence quote | note |
|---|---|---|---|---|
| EnergyShare "one-time payment to your Dominion account, made by a local agency" / EnergyShare exists year-round regardless of income | `[src: dominion-energyshare.pdf]` | SUPPORTED (general concept only) | dominion-energyshare.txt: "EnergyShare® is an energy assistance program of last resort... Help is available year-round, regardless of income." | The general description is supported; the dollar caps and qualify conditions are not (see NOT FOUND above). |
| Dominion publishes an EnergyShare agency list (list exists) | `[src: dominion-energyshare-agencies.pdf]` | SUPPORTED | dominion-energyshare-agencies.txt is a county-by-county agency/phone directory, "EnergyShare Agencies / Updated Dec 2024" | List exists as claimed. |
| United Community, 7511 Fordson Rd, Alexandria, VA 22306, 703-768-7106 | `[src: united-community-locations.pdf]` `[src: united-community-energyshare-vanavigator.pdf]` | SUPPORTED | united-community-energyshare-vanavigator.txt: "United Community / 7511 Fordson Road / Alexandria, VA 22306 / (703) 768-7106"; united-community-locations.txt: "7511 Fordson Rd. Alexandria, VA 22306" / "703.768.7106" | Address and phone match exactly. |
| United Community "Administers EnergyShare" | `[src: united-community-energyshare-vanavigator.pdf]` | SUPPORTED | "EnergyShare funds are distributed by United Community." | |
| Salvation Army Alexandria, 703-836-2427, "Route 1 corridor through Lorton" | `[src: dominion-energyshare-agencies.pdf]` | SUPPORTED | dominion-energyshare-agencies.txt: "Fairfax County - (Rt 1-Corridor through Lorton) / The Salvation Army-Alexandria / 703-836-2427" | Exact match, including the "Rt 1-Corridor through Lorton" wording. |
| Fairfax CSP, 703-222-0880, TTY 711, Mon–Fri 8 a.m.–4:30 p.m., screens/refers, covers "financial assistance" | `[src: fairfax-csp.pdf]` | SUPPORTED | fairfax-csp.txt: "703-222-0880, TTY 711 / Monday - Friday, 8 a.m. - 4:30 p.m."; "...financial assistance and other foundational needs" | Number, hours, and general financial-assistance scope confirmed. Utility-bills-specifically remains correctly marked CHECK by the tree — no source states utility bills explicitly. |
| Koinonia Foundation, 6037 Franconia Rd, Alexandria, VA 22310, 703-971-1991, serves Franconia/East Springfield/Newington/Kingstowne, partial payment electric/gas/water/rent/mortgage, appointment, Spanish available | `[src: koinonia-emergency-assistance.pdf]` `[src: 211-koinonia.pdf]` | SUPPORTED (except ZIP list, see NOT FOUND) | 211-koinonia.txt: "6037 Franconia Road, Alexandria, VA 22310"; "(703) 971-1991"; "Residents of Franconia, East Springfield, Newington, and Kingstowne in Fairfax County."; "partial payment of rent /mortgage, utilities (electric, gas, water)"; "Languages: Spanish"; "Call for additional information and to make appointment." | All core facts confirmed; only the specific ZIP list is unsupported (see NOT FOUND). |
| Catholic Charities: utility/rent help once per 12 months, requires email/phone contact and video appointment, not available to Section 8/public/subsidized housing | `[src: catholic-charities-utilities.pdf]` | SUPPORTED | "Eligible clients may receive Emergency Assistance once in a 12-month period..."; "must be able to communicate by email and phone and attend a Zoom video appointment..."; "We regret that we cannot help if you are living in Section 8 Housing, public housing, or subsidized housing of any type." | Exact match on all listed conditions. |
| WAP provider for Fairfax County: CHP, 1-888-229-3714 | `[src: dhcd-wap-providers.pdf]` | SUPPORTED | dhcd-wap-providers.txt: "Fairfax Co / CHP / (888) 229-3714 / Energy Solutions Weatherization \| Community Housing Partners" | Phone number matches. |
| WAP income limits effective date | `[src: dhcd-wap-income-limits.pdf]` | SUPPORTED (see item 5 below for full rows) | "INCOME ELIGIBILITY LIMITS EFFECTIVE 07/01/2026" | |

---

## Item 3: Alexandria / South County DFS office (tree currently marks CHECK)

From `fairfax-dfs-offices.txt`:

> **Alexandria**
> Human Services Center
> Gerry Hyland Government Center (formerly South County Government Center)
> 8350 Richmond Highway, Alexandria, VA 22309
> 703-324-7500; TTY 711
> Operating Hours: Monday-Friday, 8 a.m.- 4:30 p.m.

This fully resolves Open item 3 and the Branch B2 "exact address CHECK" note. Note the phone number is the same general DFS line (703-324-7500) used for every DFS Human Services Center, not a location-specific line.

## Item 4/5: agencies covering Fairfax County / Alexandria / Route 1 / Lorton / Franconia / Springfield (from dominion-energyshare-agencies.txt)

All matching rows, phone numbers exactly as printed:

| County/area (as printed) | Agency | Phone |
|---|---|---|
| Alexandria | Alexandria Dept of Community and Human Services | 703-746-5700 |
| Alexandria | The Salvation Army-Alexandria | 703-836-2427 |
| Fairfax | The Salvation Army-Fairfax | 703-385-8700 |
| Fairfax County - (Rt 1-Corridor through Lorton) | The Salvation Army-Alexandria | 703-836-2427 |
| Fairfax | United Community | 703-768-7106 |
| Herndon | The Salvation Army-Fairfax | 703-385-8700 |
| Herndon/Reston/Dulles | Cornerstones | 571-323-9555 |
| Lorton County | Lorton Community Action Program | 703-339-5161 |
| Springfield | The Salvation Army-Fairfax | 703-385-8700 |

No row is literally labeled "Franconia."

**Agencies the tree omits for 22310:** the tree lists only United Community (703-768-7106), Salvation Army Fairfax Corps (misquoted number, see CONTRADICTED), and Salvation Army Alexandria (703-836-2427). It omits two agencies that this same source lists as covering the area:
- **Alexandria Dept of Community and Human Services, 703-746-5700** (Alexandria row)
- **Lorton Community Action Program, 703-339-5161** (Lorton County row) — notable since Lorton is explicitly named in the tree's own scope text and in the Route 1/Lorton bullet.

It also does not flag that "The Salvation Army-Fairfax" appears under three separate rows (Fairfax, Herndon, Springfield) all at 703-385-8700 — the same number the 211 source calls "Voice" for the org the tree lists as "Salvation Army Fairfax Corps." The tree's 703-385-6192 for that agency is the fax line (see CONTRADICTED above).

## Item 5: DHCD WAP income limits, household sizes 1–4, effective date

From `dhcd-wap-income-limits.txt` ("2026-27 INCOME LIMITS FOR VIRGINIA WEATHERIZATION ASSISTANCE PROGRAM," effective 07/01/2026 per Information Notice 02-2026, dated 07/01/2026):

| Size of Family Unit | 60% of State Median (SMI) | 200% Poverty Income Guidelines | Use this income limit (higher of the two) |
|---|---|---|---|
| 1 | $44,776 | $31,920 | $44,776 |
| 2 | $58,554 | $43,280 | $58,554 |
| 3 | $72,331 | $54,640 | $72,331 |
| 4 | $86,109 | $66,000 | $86,109 |

"Income limits will be updated in Hancock effective immediately and will remain effective until superseded" — effective date is 07/01/2026, per Notice 02-2026 dated 07/01/2026.

The decision tree does not currently quote any of these numbers — it only cites the file with a CHECK tag and no figures — so there is nothing to grade SUPPORTED/CONTRADICTED for this claim; see "Missing from the tree" below.

## Item 6: Alexandria DFS office details

(Answered above under Item 3 — full address, phone, and hours confirmed.)

## Item 7: "should the sources say but don't" / general gaps found while checking

- The tree cites `dominion-energyshare.pdf` for nearly every specific fact in Branch C and C2 (dollar caps, qualify conditions, extras, upgrade list, C2 phone number), but the captured text of that PDF contains only cookie-banner and navigation boilerplate — none of the actual program content rendered to text. This is a structural gap: a page that says VERIFIED but whose captured source cannot actually verify anything cited to it. Recommend re-capturing that page with the accordions expanded (or via a rendered-DOM capture) before trusting any Branch C VERIFIED tag against it.
- No source in the folder discusses NOVEC's own payment/assistance options (Step 1, item 1's UNVERIFIED flag) — confirmed still unresourced.
- No source resolves whether PIPP can stack with Fuel Assistance/EnergyShare in the same year (grepped dss-pipp.txt and dss-energy-assistance.txt for "stack"/"combine" language — nothing found either way).
- dominion-medical-conditions.txt does contain a medical-certification request form reference ("request form (English, Spanish)... requires a physician's statement and signature... complete a form each year"), confirming Open item 7's form exists on that page, though the extracted text does not include the actual hyperlink URL (link text renders as bare "Form").

---

## Missing from the tree

1. **CHP weatherization capture is missing entirely** (`chp-weatherization.pdf` FAILED per MANIFEST.md) — the tree should flag every fact sourced only to that file as UNVERIFIED, not CHECK, since there is literally no file to check against.
2. The actual DHCD WAP income-limit dollar figures (household sizes 1–4: $44,776 / $58,554 / $72,331 / $86,109, effective 07/01/2026) are available in `dhcd-wap-income-limits.txt` but not reproduced anywhere in Branch E — the tree could state them instead of leaving a bare CHECK.
3. Two EnergyShare-covering agencies for the 22310 area are available in `dominion-energyshare-agencies.txt` but omitted from Branch C/D: Alexandria Dept of Community and Human Services (703-746-5700) and Lorton Community Action Program (703-339-5161).
4. The correct voice number for "Salvation Army Fairfax Corps" (703-385-8700) is available in both `211-salvation-army-fairfax.txt` and `dominion-energyshare-agencies.txt` but the tree instead prints the fax number.
5. The Alexandria/South County DFS office address, phone, and hours (needed for Open item 3) are fully available in `fairfax-dfs-offices.txt` and should replace the CHECK marker in Branch B2 and Open item 3.
6. The EnergyShare "60 and older eligible for additional assistance" language is available (in `united-community-energyshare-vanavigator.txt`) and should be cited there instead of to the empty `dominion-energyshare.pdf` capture.
7. Nothing in the archive supports the "Not for 22310: ECHO... ACCA..." bullet in Branch D — it has no source tag and no matching file; it should be marked UNVERIFIED or sourced properly, not left as an uncited assertion sitting next to CHECK-tagged, sourced bullets.

## Answers to open items

1. **150% table vs. DSS EA manual**: Not checked against `dss-ea-manual.txt` in this pass (out of my assigned sections' scope — the table itself lives in Step 1, which is outside Branch C/D/E/Open-items text); still needs a human/other-reviewer pass against the 366KB manual text.
2. **Crisis Assistance end date, Mar 15 vs Mar 16**: Not resolved by any file in my sections; remains a genuine state-vs-county conflict per the tree's own note (dss-energy-assistance.txt / fairfax-energy-assistance.txt, both outside my assigned sections but the conflict is real and unresolved).
3. **Alexandria DFS office address/hours**: RESOLVED — see above. Gerry Hyland Government Center (formerly South County Government Center), 8350 Richmond Highway, Alexandria, VA 22309, 703-324-7500, TTY 711, Mon–Fri 8 a.m.–4:30 p.m.
4. **EnergyShare coverage of 22310 west of Telegraph Road**: STILL UNRESOLVED — no source in the folder mentions "Telegraph Road" at all; United Community's own stated service area is countywide (Alexandria City, Fairfax City, Fairfax County, Falls Church City), which, if accurate, would suggest west-of-Telegraph residents in Fairfax County ARE in scope, contradicting the tree's implication that they are not. This needs a live call to confirm, as the tree already suggests.
5. **NOVEC payment/assistance options**: STILL UNRESOLVED — no source file addresses this.
6. **PIPP stacking with Fuel Assistance/EnergyShare**: STILL UNRESOLVED — no source file states this either way.
7. **Disconnection tree / medical certification form / Dominion medical conditions page**: `dominion-medical-conditions.txt` confirms a medical certification request form exists (English/Spanish, requires physician's statement, annual renewal) — usable content for that tree, though the exact URL is not captured in the text extraction.
8. **Every CHECK item — one phone call each**: Not performed (no phone access); flagged as still open. This report converts several former CHECK items into either resolved SUPPORTED facts (Alexandria DFS office) or CONTRADICTED/NOT FOUND findings that need correction rather than a phone call (Salvation Army fax-vs-voice number, Catholic Charities phone/email, EnergyShare dollar caps and Telegraph Road boundary, C2 phone number).
