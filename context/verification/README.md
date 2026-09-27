# Verification reports

Two independent reviewers (Claude Sonnet agents, no web access) checked every `[src: …]`-tagged
claim in `../decision-tree-assistance.md` against the saved copies in `../sources/`, on 2026-09-26.

- `part1-step0-A-B-F.md` — Step 0, screener + income table, Branch A, Branch B, Branch F, "Nothing matched".
- `part2-C-D-E.md` — Branch C, C2, Branch D, Branch E, Open items.

The reports describe the tree **as it was before corrections**. Every CONTRADICTED and NOT FOUND
row was acted on the same evening:

| Finding | Action taken |
|---|---|
| Salvation Army Fairfax number was the fax line | Changed to voice 703-385-8700 |
| Catholic Charities phone/email not on their page | Changed to 703-841-3830 / info@ccda.net |
| United Community "east of Telegraph" ZIP limit unsourced | Removed; county-wide area quoted from source |
| State EA manual income table (05/25) differs from 2026 computation | Both columns shown; assistant uses the lower; open item 1 |
| Six Dominion pages captured only collapsed headings | Recaptured with accordions expanded (`.txt` = full DOM text, `.html` saved) |
| Dominion scams URL was a 404 | Recaptured from dominionenergy.com/safety/scams; wording still CHECK |
| Alexandria DFS office was marked CHECK though in source | Address, phone, hours added as VERIFIED |
| Budget Billing 4th condition, Crisis one-time/homeowner caveats omitted | Added |
| Two EnergyShare agencies omitted | Lorton CAP added; Alexandria City DCHS noted as City-only |
| ECHO/ACCA exclusion unsourced | Marked UNVERIFIED, assistant told not to mention |
| 211virginia.org and CHP not captured (sites down) | Marked CHECK / UNVERIFIED; open item 8 |

A fresh verification pass on the corrected tree has not been run yet.
