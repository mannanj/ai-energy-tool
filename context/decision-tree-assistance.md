# Decision tree: "The rates for electricity have increased making it hard to make ends meet, what can I do?"

Scope: Fairfax County residents, Dominion Energy electric customers, built around ZIP 22310 (Franconia / Rose Hill / Kingstowne, Franconia District).
Researched and written 2026-09-26, then checked claim by claim by two independent reviewers against the saved sources (reports in `verification/`). Corrections from that review are folded in below. The team's original tree is kept at `human-edited/decision-tree-assistance.md`.

## How to read this file

- Every fact carries a source tag like `[src: dss-pipp.pdf]`. The file is in `context/sources/`, saved from the official page on 2026-09-26. Each has a `.txt` beside it for searching. `sources/MANIFEST.md` maps each file to its URL and fetch time. Open the file to check the claim.
- Status marks: **VERIFIED** = the saved source contains this fact and an independent reviewer confirmed it. **CHECK** = from a secondary page (2-1-1 listing, VirginiaNavigator, a nonprofit's own site) or computed by us; confirm before launch. **UNVERIFIED** = we could not find a source; the assistant must not state it as fact.
- Phone numbers and links are copied exactly. The assistant quotes them verbatim.
- Dates below assume today is between 2026-09-26 and 2027-06-14. Seasonal windows must be re-checked each program year.

## Step 0: Is this urgent?

Ask first, always: **"Do you have a disconnection notice, is your power already off, or does anyone in your home use medical equipment that needs electricity?"**

- Yes → go to the *Disconnection* tree (urgent path). Until that tree exists, the assistant gives these two verbatim: Dominion Energy 866-366-4357 for a payment plan `[src: dominion-energy-assistance.pdf]` VERIFIED, and 2-1-1 Virginia, available 24/7, dial 2-1-1 `[src: dominion-energy-assistance.pdf]` VERIFIED. For medical equipment: Dominion has a medical equipment request form that needs a physician's statement and must be renewed each year; forms go to demedical@domenergy.com `[src: dominion-medical-conditions.pdf]` VERIFIED. Then say a person at 2-1-1 can find the local agency that pays bills to stop a shutoff.
- No → continue.

**Scam check, one line, only if they mention a call, text, or visit demanding immediate payment:** "You can always verify your account and balance by signing in at dominionenergy.com or calling the number printed on your bill. Do not pay anyone who calls you." `[src: dominion-scams.pdf]` VERIFIED for the sign-in advice. The specific "no gift cards, no wire, no threats of shutoff within the hour" wording is in Dominion press releases, not captured; CHECK before using it.

## Step 1: The screener (ask one at a time)

1. **Who sends your electric bill, Dominion Energy or NOVEC?** NOVEC serves part of Fairfax County `[src: novec-about.pdf]` VERIFIED; which streets in 22310 is UNVERIFIED. If NOVEC → PIPP and EnergyShare do not apply; skip to Branch B2 (state Energy Assistance) and Branch D (local help). NOVEC's own payment options: not researched, UNVERIFIED.
2. **How many people live in your home?**
3. **Roughly what is everyone's total income per month, before taxes?** Compare to the table below.
4. **Do you heat with electricity, or with gas/oil/something else?** (decides the PIPP percentage)
5. **Are you behind on the bill? Roughly how much?**
6. **Is anyone in the home 60 or older, 5 or younger, disabled, or a veteran?** (unlocks Cooling Assistance, EnergyShare extras)
7. **Do you own or rent?** (weatherization and equipment replacement need the owner)

Never ask for a Social Security number, account number, or documents. Ask only whether they *have* them.

### Income limit: 150% of the federal poverty level (PIPP, Fuel, Crisis, Cooling)

Two tables exist and they do not agree. The assistant should use the **lower** (state manual) numbers when screening and say "you may be close to the limit, apply anyway" for anyone between the two.

| Household size | State manual, monthly (in force now) | Computed from 2026 HHS guidelines, monthly |
|---|---|---|
| 1 | $1,956 | $1,995 |
| 2 | $2,643 | $2,705 |
| 3 | $3,331 | $3,415 |
| 4 | $4,018 | $4,125 |
| 5 | $4,706 | $4,835 |
| 6 | $5,393 | $5,545 |
| 7 | $6,081 | $6,255 |
| 8 | $6,768 | $6,965 |

- Left column: Virginia DSS Energy Assistance manual, Transmittal 16-1 dated 05/25, "maximum monthly countable income for each household size" `[src: dss-ea-manual.pdf]` VERIFIED. These are 150% of the **2025** guidelines. The manual had not been updated for 2026 when saved.
- Right column: 2026 HHS poverty guidelines ($15,960 for one person, +$5,680 each additional) `[src: hhs-poverty-guidelines-2026.pdf]` VERIFIED for the base numbers; ×1.5 ÷12 is our arithmetic, CHECK. DSS normally adopts the new guidelines for the program year that opens in October; confirm with Fairfax DFS 703-324-7500 in October 2026 which table applies.

If under the limit → candidate for **every** program in Branch B. Over it → Branch A, Branch C (if they have a disconnection notice), Branch D, Branch E.

## Branch A: Get breathing room from Dominion right now (any income)

- **Payment plan.** Split the past-due balance into equal monthly payments, up to 6 months. A down payment is required. A 1.5% late payment charge applies to the remaining past-due balance. Call 866-366-4357 or sign in at dominionenergy.com. `[src: dominion-energy-assistance.pdf]` VERIFIED
- **Extend your due date.** "Sign in to ask for more time to pay your bill." `[src: dominion-energy-assistance.pdf]` VERIFIED. The detail "must be scheduled before the next bill is due" is not on the saved page, CHECK.
- **Budget Billing.** Same payment every month, based on the average of your past 12 months of bills. No fees. You need 12 months of billing history at your current address, must not owe more than your current bill, and any previous balance must be paid in full first. Recalculated every 12 months; if you overpay, the difference is credited to next year's amount. Moving unenrolls you and the full balance comes due. Sign in at dominionenergy.com or call 866-366-4357. `[src: dominion-budget-billing.pdf]` VERIFIED
  - If they are behind → Budget Billing is not available yet. Payment plan first, Budget Billing later.
- Off-peak / time-of-use plans: not researched, UNVERIFIED.

Next step: "Call 866-366-4357 and ask for a payment arrangement. Have your account number ready." Then continue to Branch B or C.

## Branch B: Income-based programs (household at or under the table)

A household can apply to all that fit. DSS lists PIPP as a related program beside Energy Assistance `[src: dss-energy-assistance.pdf]` VERIFIED. Whether the same household can hold PIPP and Fuel Assistance and EnergyShare in one year is UNVERIFIED; ask DFS.

### B1. PIPP, Percentage of Income Payment Program (year-round; Dominion and Appalachian Power customers only)

- *What it does:* your monthly electric payment becomes 10% of gross monthly household income if you heat with electricity, 6% if you heat with something else. Example on Dominion's page: $1,000 monthly income with electric heat → $100 PIPP payment. Minimum PIPP amount is $10. Each on-time month, 1/12 of the past-due balance you had at enrollment is credited. 12 months of on-time payments and the past-due balance is gone. `[src: dss-pipp.pdf]` `[src: dominion-pipp.pdf]` VERIFIED
- *Until enrollment is complete you still owe the normal bill.* `[src: dominion-pipp.pdf]` VERIFIED
- *Qualify?* All three `[src: dss-pipp.pdf]` VERIFIED:
  - Dominion Energy or APCo/AEP customer → No → not eligible; go to B2, D.
  - Household income at or below 150% of the federal poverty level (table above) → No → Branch A, C, D.
  - Active electric account → No → call Dominion 866-366-4357 first.
- *Documents they will need (ask only "do you have"):* proof of income for the last 30 days for all adults over 18, a current electric bill, Social Security numbers for all household members, plus anything else the local office requests. `[src: dss-pipp.pdf]` VERIFIED
- *How to apply:* online through CommonHelp (commonhelp.virginia.gov `[src: dss-ea-manual.pdf]` VERIFIED for the URL), or a paper application to the local Department of Social Services `[src: dss-pipp.pdf]` VERIFIED. In Fairfax County that is the Department of Family Services (DFS). "You cannot apply for PIPP by phone." `[src: fairfax-energy-assistance.pdf]` VERIFIED
- *Staying in:* re-verify income each year, report changes in income or household size, stay current on payments. Missed or partial payments or failing to re-verify may cause removal. `[src: dss-pipp.pdf]` VERIFIED
- *Questions:* Fairfax DFS 703-324-7500, TTY 711, Mon–Fri 8 a.m.–4:30 p.m. `[src: fairfax-energy-assistance.pdf]` VERIFIED. Dominion 866-DOM-HELP (866-366-4357) for PIPP account issues `[src: dominion-pipp.pdf]` VERIFIED.
- Next step: "Apply at commonhelp.virginia.gov. If you want help with the form, call 703-324-7500 or walk into the Alexandria office (below)."

### B2. Virginia Energy Assistance Program (federal LIHEAP money, run by Virginia DSS and Fairfax DFS)

The Virginia program page is dss.virginia.gov/relief/ea `[src: dss-energy-assistance.pdf]` VERIFIED. Do not send people to liheap.org; that is a national site, not Virginia's (our guidance, not a source statement).

| Part | What it pays | Window | Status on 2026-09-26 |
|---|---|---|---|
| **Fuel Assistance** | supplements the cost of your primary heat source; paid January through April or until the benefit is used up | second Tuesday in October through second Friday in November. For 2026: **Oct 13 – Nov 13** | opens in 17 days. Everyone under the limit should apply. |
| **Crisis Assistance** | no heat or about to lose heat: heating equipment repair or replacement (replacement is for homeowners only), a one-time security deposit, heating fuel, primary-heat utility bills | equipment and deposits Nov 1 to mid-March; fuel and bills from the first business day in January to mid-March | closed until Nov 1 |
| **Cooling Assistance** | electric bill for cooling equipment, AC repair or purchase, fans; household must include someone 60 or older, 5 or younger, or disabled per Social Security, Medicaid, or 100% VA | June 15 – August 17 | closed until June 15, 2027 |

Sources: `[src: dss-energy-assistance.pdf]` `[src: fairfax-energy-assistance.pdf]` `[src: dss-ea-manual.pdf]` VERIFIED for windows, components, Cooling's age/disability rule, "payments begin in January and continue through April." The Oct 13 / Nov 13, 2026 dates are our calendar arithmetic from the stated rule; an independent reviewer recomputed them and agrees. **Conflict:** the state page and manual say Crisis closes **March 15**; the Fairfax page says **March 16**. Say "mid-March" and tell people to apply early. "Electric heat counts as a primary heat source" is inferred, CHECK.

- *How to apply (Fuel, Crisis, Cooling):* `[src: fairfax-energy-assistance.pdf]` `[src: dss-energy-assistance.pdf]` VERIFIED
  - Online: commonhelp.virginia.gov
  - Phone: 833-5-CALL-VA (833-522-5582), Cooling, Fuel and Crisis only. State Enterprise Customer Service Center 855-635-4370, Mon–Fri 7 a.m.–6 p.m.
  - Mail: 12011 Government Center Parkway, Suite 232, Fairfax, VA 22035. Fax 703-653-1355. Email a photo of the completed form to DFSMycase@fairfaxcounty.gov.
  - In person at any of the four DFS Human Services Centers (Alexandria, Annandale, Fairfax, Reston). Closest to 22310: **Alexandria Human Services Center, Gerry Hyland Government Center (formerly South County Government Center), 8350 Richmond Highway, Alexandria, VA 22309, 703-324-7500, TTY 711, Mon–Fri 8 a.m.–4:30 p.m.** `[src: fairfax-dfs-offices.pdf]` VERIFIED
- Next step: "Fuel Assistance opens Oct 13. Apply at commonhelp.virginia.gov or call 833-522-5582. Have your bill and last 30 days of income handy."

## Branch C: EnergyShare, Dominion's own fund (no income limit, but you must be in trouble)

- *What it is:* a payment to your Dominion account made through a local agency. Heating: Oct. 1 – May 31, up to $600. Cooling: June 1 – Sep. 30, up to $300. `[src: dominion-energyshare.pdf]` `[src: dominion-energy-assistance.pdf]` VERIFIED. (The partner PDF's $6,000 and $3,000 are wrong.)
- *Qualify?* Live in Dominion's service area **and** at least one of: received a disconnection notice; need service reconnected; need help keeping your payment plan; received a Budget Billing removal notice. `[src: dominion-energyshare.pdf]` VERIFIED
  - None yet → not eligible today. Say so, route to A and D, and say to come back if a disconnection notice arrives.
- *Extras:* 60 or older may qualify for help more often. Military veterans and people with disabilities may qualify for an extra $500 if enrolled in an approved voucher program through the Virginia Department of Veterans Services or the Virginia Department for Aging and Rehabilitative Services' Centers for Independent Living. `[src: dominion-energyshare.pdf]` VERIFIED
- *How to apply:* call 2-1-1 to find the local EnergyShare agency. Dominion's agency list `[src: dominion-energyshare-agencies.pdf]` VERIFIED names these for Fairfax County:
  - **United Community**, 703-768-7106, 7511 Fordson Rd, Alexandria, VA 22306. Listed for "Fairfax." Its EnergyShare listing gives the service area as Alexandria City, Fairfax City, Fairfax County, Falls Church City. `[src: dominion-energyshare-agencies.pdf]` `[src: united-community-energyshare-vanavigator.pdf]` VERIFIED. (An earlier draft limited it to ZIPs east of Telegraph Road; no source says that. Removed.)
  - **The Salvation Army-Fairfax**, 703-385-8700 (voice; 703-385-6192 is the fax), 4915 Ox Road, Fairfax, VA 22030. Listed for Fairfax, Springfield, Herndon. Serves Fairfax County, City of Fairfax, Falls Church. Electric bill help; call for an appointment. `[src: dominion-energyshare-agencies.pdf]` `[src: 211-salvation-army-fairfax.pdf]` VERIFIED
  - **The Salvation Army-Alexandria**, 703-836-2427. Listed for "Fairfax County - (Rt 1-Corridor through Lorton)." Address UNVERIFIED. `[src: dominion-energyshare-agencies.pdf]` VERIFIED for the phone.
  - **Lorton Community Action Program**, 703-339-5161. Listed for Lorton. `[src: dominion-energyshare-agencies.pdf]` VERIFIED. Lorton is south of 22310; ask about coverage.
  - Alexandria Dept of Community and Human Services, 703-746-5700, is listed for the **City** of Alexandria only. 22310 is in the County, not the City. Do not send 22310 residents there unless they live in the City.
- Next step: "Call 2-1-1 and say you need EnergyShare. Or call United Community at 703-768-7106."

### C2. EnergyShare free home energy upgrades

- Free home energy assessment; a contractor visits and recommends weatherization tips and ways to use less. Upgrades may include LED light bulbs, low-flow showerheads and faucet aerators, attic and floor insulation, heat pump or AC tune-up, air and duct sealing, water heater and pipe wrap. `[src: dominion-energyshare.pdf]` VERIFIED
- *Qualify?* Dominion customer who has received bill payment help. `[src: dominion-energyshare.pdf]` VERIFIED
- *Apply:* call 888-366-8280 and select the Income and Age Qualifying option; you are connected with a contractor in your area. `[src: dominion-energyshare.pdf]` VERIFIED

## Branch D: Local emergency help in and around 22310 (any income, crisis-driven)

Offer this to anyone who is behind and did not fit B or C, and to everyone in C as a second option.

- **Fairfax County Coordinated Services Planning (CSP), 703-222-0880**, TTY 711, Mon–Fri 8 a.m.–4:30 p.m. The county's front door: specialists connect residents to "emergency food, shelter, clothing, healthcare, employment, financial assistance and other foundational needs." Multilingual specialists in Amharic, Cantonese, Farsi (Dari), Tagalog, Haitian Creole, Hindi, Italian, Kannada, Korean, Pashto, Punjabi, Somali, Spanish, Tamil, Urdu; interpreters for others. `[src: fairfax-csp.pdf]` VERIFIED. The page does not name utility bills specifically; that CSP refers utility cases to nonprofits is CHECK (secondary sources say yes).
- **Koinonia Foundation**, 6037 Franconia Rd, Alexandria, VA 22310, 703-971-1991. Serves Franconia, East Springfield, Newington, Kingstowne. Partial payment of rent or mortgage, utilities (electric, gas, water), some medical and prescription costs. Call for an appointment. Spanish available. `[src: 211-koinonia.pdf]` `[src: koinonia-emergency-assistance.pdf]` CHECK (2-1-1 listing and the nonprofit's own page; the ZIP list 22150, 22303, 22304, 22310, 22312, 22315 is from a web search summary, CHECK)
- **United Community**, 703-768-7106 (Branch C). Also runs rental and utility assistance, a food pantry, and case management. `[src: united-community-locations.pdf]` CHECK
- **Catholic Charities, Diocese of Arlington**, 200 North Glebe Road, Arlington, VA 22203, 703-841-3830, info@ccda.net. Emergency assistance once in a 12-month period and up to two times in ten years; must be able to communicate by email and phone and attend a Zoom video appointment; cannot help residents of Section 8, public, or subsidized housing. `[src: catholic-charities-utilities.pdf]` VERIFIED. (An earlier draft gave 703-443-2481 and EA@ccda.net; neither appears on the saved page. Removed.)
- **The Salvation Army-Fairfax**, 703-385-8700 (Branch C). VERIFIED
- Springfield's ECHO and Annandale's ACCA appear in the research notes as **not** covering 22310. No saved source; UNVERIFIED. Do not mention them.
- Next step: "Call 703-222-0880 first. If you are in Franconia or Kingstowne, also call Koinonia at 703-971-1991."

## Branch E: Use less electricity (longer-term)

- **EnergyShare upgrades** if they already got bill help (C2). VERIFIED
- **Weatherization Assistance Program (WAP)**, federal money through Virginia DHCD. The DHCD provider list names **CHP (Community Housing Partners) Energy Solutions Weatherization, (888) 229-3714** for Fairfax County, Fairfax City, and Falls Church. `[src: dhcd-wap-providers.pdf]` VERIFIED. Income limits effective 07/01/2026: 1 person $44,776; 2 people $58,554; 3 people $72,331; 4 people $86,109 per year (60% of state median income, well above the 150% FPL table). `[src: dhcd-wap-income-limits.pdf]` VERIFIED. What it installs and the renter rule: CHP's site was unreachable on 2026-09-26, so UNVERIFIED for now; DHCD's manual describes insulation, air sealing and heating/cooling work in general terms.
- Dominion's "Why is my bill high" page (dominionenergy.com/virginia/save-energy/why-is-my-bill-high), from the partner resource list. Not captured, CHECK.
- Next step: "Call CHP at 888-229-3714 and ask about weatherization for your address."

## Branch F: "Why did my bill go up?" (one short answer, then back to the tree)

The Virginia State Corporation Commission approved new Dominion rates on November 25, 2025. For a typical residential customer that means about $11.24 more per month in 2026 and a further $2.36 in 2027. The SCC also created a new GS-5 rate class for customers demanding 25 megawatts or more, "including data centers," so the biggest users carry more of the cost. `[src: scc-dominion-biennial-review-2025.pdf]` VERIFIED. Fuel charges and riders also move; not researched, UNVERIFIED.

Then: "Rates are set by the state, not something you can appeal on your own bill. What you can do is lower what you owe each month. Want to check whether you qualify for a program?"

## Nothing matched?

- Dominion payment arrangement 866-366-4357 (Branch A)
- Coordinated Services Planning 703-222-0880 (Branch D)
- 2-1-1 Virginia, dial 2-1-1, 24/7 `[src: dominion-energy-assistance.pdf]` VERIFIED. The website 211virginia.org was down (Cloudflare 522) when we tried to save it; the address comes from the partner docs, CHECK.
- Fuel Assistance opens Oct 13, 2026 (Branch B2) for anyone under the income table.

## Open items for the team

1. **Income table.** The state manual (05/25) still carries 2025-based limits. Ask Fairfax DFS 703-324-7500 in October which table the 2026-27 year uses, then delete the other column.
2. **Crisis Assistance end date.** State says Mar 15, county says Mar 16. One call to 703-324-7500.
3. **EnergyShare coverage of 22310.** United Community's stated area is county-wide. Confirm by phone (703-768-7106) that they take Franconia and Kingstowne residents, and ask whether Lorton Community Action Program (703-339-5161) does.
4. **Koinonia ZIP list.** Confirm 22310 coverage and hours at 703-971-1991.
5. **NOVEC** payment and assistance options, in case a resident is on NOVEC.
6. **Stacking.** Can one household hold PIPP + Fuel Assistance + EnergyShare in the same year? Ask DFS.
7. **Disconnection tree (urgent path).** Content drafted in `claude-chats/2026-09-23-disconnection-notice-resource-tree-*.md`. The Dominion medical page `[src: dominion-medical-conditions.pdf]` confirms the form and the demedical@domenergy.com address; the direct form URL was not captured.
8. **Two sources still missing.** CHP weatherization page and 211virginia.org were both down on 2026-09-26; retry and add to `sources/`.
9. **Scam wording.** Dominion's scams page accordions did not render to text; get the exact "we never ask for gift cards" wording from dominionenergy.com/safety/scams or a 2026 Dominion press release and cite it.

## Every path ends with a next step

Each leaf ends in a phone number, a link, or "here's what to bring." Individual replies do not have to. A screener question ends with the question; an explanation can end with "want to check if you qualify?" The rule is no dead ends.
