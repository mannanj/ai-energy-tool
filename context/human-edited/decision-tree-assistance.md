# Decision tree: "Rates went up, I can't make ends meet" → assistance programs

Source of truth: the team doc (`team-docs/Project Civic-Signal-2.pdf`, "Decision Trees", pp. 15–16).
This file is the cleaned, machine-friendly version the app reads. When the team updates the PDF,
update this file to match. Every leaf needs a source link and a "last checked" date before launch.

## Nesting fixes vs the PDF (2026-09-26)

1. "What assistance programs do I qualify for?" was an empty sibling. It is the **parent** of every program branch.
2. "Do I qualify for PIPP?" appeared twice (as branch header and as its own child). Branch header is now the program, **PIPP**; "Do I qualify" is one child.
3. The eligibility items were a flat list of questions with no answers. A tree needs **question → yes/no → outcome**, so each question now has an income/threshold or a yes/no and what happens on each answer.
4. EnergyShare "qualify" list mixed *situations that make you eligible* (any one is enough) with the *voucher-program rule*, which only applies to the **extra $500** for veterans/disabled, not to EnergyShare itself.
5. LIHEAP is in the resident questions and the resources table but missing from the tree. Added as a stub.
6. The SSN question is kept as **"do you have"** only. The app never collects SSNs.

## Tree

**Entry:** "The rates for electricity have increased making it hard to make ends meet, what can I do?"

- **Safety check first (always, before anything below):** Do you have a disconnection notice, or is your power already off?
  - Yes → jump to the *Disconnection* tree (urgent path). Come back here afterwards.
  - No → continue.

- **What assistance programs do I qualify for?**
  Ask the screener once, then evaluate every program:
  1. Who is your electric company? (Dominion / APCo-AEP / other)
  2. How many people live in your household?
  3. Roughly what is your household's monthly income (all adults)?
  4. Do you own or rent?
  5. Is your account active, and are you behind on it? (roughly how much)
  6. Are you 60 or older, a veteran, or living with a disability? (optional, unlocks extras)

  - **PIPP — Percentage of Income Payment Program** (state program, Dominion & APCo customers)
    - *What it is:* pay a reduced bill each month; 1/12 of your old balance is forgiven each on-time month; after 12 on-time months the past-due balance is gone.
    - *Do I qualify?* All of these must be true:
      - Dominion or APCo/AEP customer → No → not eligible; see EnergyShare / LIHEAP.
      - Household income at or below the PIPP limit for your household size → **[TEAM: fill in the current table from dss.virginia.gov/relief/pipp + date checked]** → No → not eligible.
      - Active electric account → No → contact Dominion first.
      - Can provide: proof of income for the last 30 days for all adults 18+, a current electric bill, and SSNs for all household members → any No → explain what's missing and where to get it.
    - *How to apply:* Option 1: online through CommonHelp. Option 2: paper application to your local Department of Social Services (Fairfax: **[TEAM: office, address, phone]**).
    - *Staying enrolled:* re-verify income yearly; report income/household changes; stay current on payments. Missed or partial payments or failing to re-verify can remove you.
    - Source: https://www.dss.virginia.gov/relief/pipp/ — last checked: **[date]**

  - **EnergyShare** (Dominion's own program, year-round, no income limit)
    - *What it is:* help paying your energy bill, plus free home energy upgrades.
    - *Do I qualify?* Must live in Dominion's service area **and** at least one of:
      - received a disconnection notice
      - need service reconnected
      - need help keeping a payment plan
      - received a budget-billing removal notice
    - *Extras:* 60+ may get help more often. Veterans and people with disabilities may get an **extra $500**, but only if enrolled in an approved voucher program through VA Dept. of Veterans Services or DARS Center for Independent Living.
    - *How it works:* a local agency reviews the application; if approved, payment goes straight to Dominion.
    - *Amounts & windows:* Heating Oct 1 – May 31, up to $6,000. Cooling Jun 1 – Sep 30, up to $3,000. **[TEAM: verify these figures; they look high for a single household]**
    - *How to apply:* call 2-1-1 or visit 211virginia.org to find your local EnergyShare agency.
    - Source: https://www.dominionenergy.com/energyshare-va — last checked: **[date]**

    - **EnergyShare free home energy upgrades**
      - *What:* free home energy assessment; a contractor recommends weatherization and ways to use less.
      - *Upgrades may include:* LED bulbs, low-flow showerheads and aerators, attic/floor insulation, heat pump or AC tune-up, air and duct sealing, water heater and pipe wrap.
      - *Do I qualify?* Dominion customer **and** have already received bill-payment help.
      - *How to apply:* call 888-366-8280, choose the Income and Age Qualifying option.

  - **LIHEAP / Virginia Energy Assistance** (federal, via VA DSS) — **[TEAM: fill in]**
    - Seasonal components (fuel assistance in fall, crisis assistance in winter, cooling in summer), income-based.
    - Apply via CommonHelp or local DSS. Use the VA DSS page, not liheap.org.
    - Source: https://www.dss.virginia.gov/benefit/ea/ — last checked: **[date]**

- **Nothing matched?** Offer: Dominion payment plan (up to 6 months, no fee, 1-866-366-4357), budget billing, Fairfax County Coordinated Services Planning 703-222-0880 **[verify]**, and 2-1-1.

## Every path ends with a next step
Each *leaf* of the tree ends in something concrete: a phone number, a link, or "here's what to bring".
Individual replies don't have to. A screener question ends with the question; an explanation can end
with "want to check if you qualify?". The rule is no dead ends, not a link on every message.
