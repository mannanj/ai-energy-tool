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

## To do

13. Red line from each helper bubble to the square it came from, kept as things move.
14. Reader tools: deterministic math (income vs threshold, household size) so "we make 7k a month" maps to No; check the other scenarios and judge them.
15. Inline trace in the inspector only: which tool ran, what it computed, and how long each step took (read, tools, write, review).
16. Re-run the example chats after 14 and 15.
17. Review the golden chats and propose how to make the resident experience useful; better answers; the tools needed.
18. Top right: sign out moves into a menu under the user's avatar; the panel handle moves to the far right, vertically centered.
