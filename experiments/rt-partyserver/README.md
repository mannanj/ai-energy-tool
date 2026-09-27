# Real-time experiment: partyserver + Yjs on a Durable Object

Deployed as `aet-rt-experiment` on the account. See `../../research/realtime-recommendation.md` for results.

```bash
bun install
bun run dev                      # wrangler dev on :8788 (pick another port if busy)
HOST=localhost:8788 bun run test  # two clients + persistence check
HOST=aet-rt-experiment.mannanteam.workers.dev node test/two-clients.mjs   # against live
```
