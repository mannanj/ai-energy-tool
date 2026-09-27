# Requests, 2026-09-27

Every request from today, in order. Done items name the commit.

## Done

1. Validate the data structure against real code, files and tests, not docs. Findings in the session. `0ea7a50`
2. Remove all code comments. `0ea7a50`
3. Commit locally; no remote by choice. "Push to prod" = `wrangler deploy` from `app/`.
4. Canvas badge shows the tree name and tree controls (squares, history, copy tree); the squares/arrows/labels counter is gone; the panel header lost the name, count and tabs. `eb84b63`
5. Chat label on the canvas aligned with its bubble and prefixed "Chat:". `a2c809e`
6. Grid: lines, not dots; later made more visible. `a2c809e`, `f35b3b1`
7. New chat box: no persona picker, your own typed first message, saved like any chat, reply box on open chats, "Start new chat". `b57abe2`, `6825a39`
8. System prompt accordion above the new chat box: version history, AI-generated titles, editable titles, switch versions. `6825a39`
9. Chats list header "History (n)"; archived toggle removed; only unarchived chats show. `6825a39`
10. Panel button is a generic panel icon; tabs Chat / Tree / History at the top of the panel. `f35b3b1`
11. Chat backend in Cloudflare with feature parity: ChatStore Durable Object, same origin and sign-in as the editor, gold chats seeded, prompt versions shared. `f35b3b1`

## Waiting on you

12. Two Worker secrets so prod can call the models. Run from `app/`:
    `wrangler secret put OPENROUTER_API_KEY` and `wrangler secret put TYPESAFE_API_KEY` (paste the values from `chat/.env`).

## Done, continued

13. Blue line from each helper bubble to the square it came from; follows drags.
14. Reader tools: facts extraction (household, income, utility), yes/no detection, income math against the square's limits; the reader model is skipped when a tool decides. Unit tests added; 34 tests, 20/20 mutants.
15. Inline trace under each helper reply in the inspector: tools, what they computed, read, write drafts, and milliseconds per step.
16. Gold chats re-run locally through the Worker: over-income now answers on the first "No, we make 7k".
18. Sign out in a menu under the avatar; panel handle at the right middle. `c47e246`
19. Panel tabs look like page tabs; selected bordered, others green links. `5c7282f`
20. Chats panel flattened: no card box, no dividers, left aligned.
21. Regression fixed: chats draw on the canvas whenever the Chat tab is open; picking one filters to it.
22. Minimap removed for now (it drew under the bubbles and looked half white). Add back later.

## To do

17. Review the golden chats and propose how to make the resident experience useful; better answers; the tools needed.
23. Hover a chat or message in the panel: its bubbles on the canvas grow with a faint outline, and the same the other way from the canvas. Click jumps the canvas to it, zoomed out enough to see the squares around it.
