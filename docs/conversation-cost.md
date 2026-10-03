# Estimating the cost of one conversation

A chat turn calls two paid models:

| Model | Role | Billed by | Per-call usage visible? |
|---|---|---|---|
| DeepSeek V4 Flash (`OPENROUTER_MODEL`) | writes the reply: up to 3 drafts, each reviewed, plus filler and simplify passes | OpenRouter, key `ai-energy-tool` | Yes, per generation in OpenRouter |
| Jev (`TYPESAFE_MODEL`, `jev-latest`) | reads the resident's message against the square's arrows | TypeSafe | Only in each response's `usage` field, which `chat/lib/judge.ts` currently discards |

Turns that the tools settle (yes/no, income math) skip Jev. Fixed lines such as the decline, the hole and the goodbye skip the writer.

## Rule of thumb

Measured on 2026-10-03 from a 14-reply WhatsApp chat (chat `2IH4h4rJHdbD`):

- About 3 writer calls per reply, about 870 input and 72 output tokens per call, and about half the input served from cache.
- Writer cost was **$0.0016 for the whole chat**, about $0.0001 per reply.
- Jev ran on 9 of the 14 replies at about 300 input and 20 output tokens per call (from its `usage` field). Its price comes from the TypeSafe account; it is not in the public docs.

Estimate = replies × 3 × writer price per call + Jev reads × Jev price per call.

## Exact numbers for a past conversation

1. **Find the time window.** Open the chat in the editor's chats tab, or fetch `/api/admin/chats` with the e2e cookie (`app/e2e/session-cookie.ts`). Note `created_at` and the time of the last message.
2. **List the generations.** Open openrouter.ai/logs signed in as the account owner and set the range to cover the window. The table pages 20 rows at a time (`?page=2`, `?page=3`, …). Each row links to a generation id `gen-…`. The `/api/v1/activity` endpoint needs a management key, and the per-key `/api/v1/key` only gives daily totals.
3. **Fetch each generation** with the project key:

   ```sh
   curl -s "https://openrouter.ai/api/v1/generation?id=$GEN" -H "Authorization: Bearer $OPENROUTER_API_KEY"
   ```

   Keep only rows whose `origin` matches the environment, for example `https://ai-energy-tool.mannanteam.workers.dev/` for production or `http://localhost:8971/` for local, and whose `created_at` falls inside the window.
4. **Sum the fields:**
   - `native_tokens_prompt`: input tokens.
   - `native_tokens_cached`: the part of the input read from cache.
   - `native_tokens_completion`: output tokens.
   - `native_tokens_reasoning`: should be 0, since reasoning is turned off.
   - `usage`: the cost in dollars.
5. **Add Jev.** Count the messages whose `trace.read.reader` is `jev-latest`. Multiply that count by about 300 input and 20 output tokens, or by the exact `usage` if it is ever recorded, at the TypeSafe account's price.

## What moves the cost

- **Provider routing.** OpenRouter spreads calls across providers. StreamLake charged about $0.00002 per call, while Alibaba, Relace and Novita charged 5 to 10 times more and made up about 60% of the cost of the measured chat. Pinning the provider in `chat/lib/llm.ts` would lower and steady the price.
- **Draft count.** Each extra writer attempt adds a call. Replies that pass review on the first try cost a third as much.
- **Cache hits.** The system prompt and the tree context repeat across calls, so cached reads grow over a chat.
