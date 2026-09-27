# Golden chats: what is wrong and what to build

Written 2026-09-27 after re-running the three gold chats through the Worker with traces on.

## What the traces show

- The helper is slow. Every reply takes 5 to 20 seconds, almost all of it in the writer: 3 or 4 DeepSeek drafts plus a Jev review of each. Reading the resident's message takes 0.2 seconds. Residents will leave.
- The writer still invents. In the PIPP rerun it wrote "EnergyShare: since you're under the income limit, you may qualify" (EnergyShare has no income limit). In the other rerun it leaked "Branch A", "Branch B1" team labels. The reviewer let both through because "best of 3" is taken when no draft passes.
- The tree asks seven questions in one square ("Dominion or NOVEC? How many people? Income? Heat type? Behind how much? Anyone 60+? Own or rent?"). The helper asks one, the resident answers one, and the walker moves on. So household size and heat type never get collected, and the income question cannot be answered with math unless the resident volunteers the size.
- The income square has Yes and Either arrows but no No arrow, and lists only the 1-person and 4-person limits. The helper guessed the 2-person figure ($1,956, wrong; the interpolated figure is $2,643).
- The answer squares are six leaves dumped at once. A resident who said "we make 7k" gets a wall of five programs with nine phone numbers.
- Every chat ends after the leaf. There is no "which of these do you want to start with", no follow-through, no summary the resident can keep.

## Proposal, in order of payoff

1. Speed: one draft, not three. Write once, run the code check (numbers and links) and one Jev review. Only if the review fails, retry once. Stream the reply to the resident while the review runs, and swap to verbatim only when a check fails. Target under 4 seconds.
2. Tools own the facts. The tools now extract household, income and utility from every message. Add heat type, disconnection notice, arrears amount, own/rent, age 60+/disabled/veteran, ZIP. Store them in the chat's `facts`. When a square asks for a fact the chat already has, skip the question. When the math tool needs a fact it does not have, the helper asks for exactly that fact and nothing else.
3. Split the screener square into one square per question in the editor, and add the No arrow on the income square. The tools then drive the walk, and Jev only reads free-text answers.
4. Compute the resident's numbers, not the table's. "Your household of 2 is under the $2,643 limit" and "PIPP would cap your bill at about $360 a month (10% of $3,600)". These are the two calculations residents care about, and the math tool can do both from the facts.
5. One program at a time. After the leaf, rank the programs by fit (urgent first, then income-limited ones the resident qualifies for, then any-income ones) and present the best one with its single next step. Offer "want the next option?" instead of the wall.
6. End with a card: what we learned about you, the program to call first, the number, the deadline. The share link already exists; make the resident-facing page show this summary at the top.
7. Guard the writer harder. Reject any draft containing "Branch", "Step 0", "Screener", "[src", and any eligibility claim ("since you qualify", "you may qualify") for a program whose square does not say so. These are string checks, free and instant.
8. Keep the panel traces. They found all of the above in one afternoon. Add cost per turn next to the milliseconds.

## Tools the agent needs, concretely

| Tool | Input | Output | Status |
|---|---|---|---|
| facts | resident message | household, income/month, utility | built |
| yes/no | resident message | Yes / No / unsure | built |
| income limit | square text, facts | under/over, limit used | built |
| PIPP estimate | income, heat type | capped bill | to build |
| arrears plan | amount behind, months | monthly payment | to build |
| dates | today, square text | is this program open now | to build |
| ZIP lookup | ZIP | county yes/no, nearest CSP office | to build |
