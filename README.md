# AI Energy Tool

A helper that answers residents' electric-bill questions by walking a decision tree the team edits together.
Residents reach it on the web or on WhatsApp.

| Folder | What |
|---|---|
| `app/` | the tree editor and the production backend, one Cloudflare Worker: pages, sign-in, live editing (Durable Objects + Yjs), chats, the WhatsApp webhook. See `app/README.md`. |
| `chat/` | the chat engine (tree walker, Jev reader, DeepSeek writer). The Worker imports it; `bun server.ts` also runs it on its own for simulations. See `chat/README.md`. |
| `context/` | the source material the tree was built from |
| `docs/` | data model, cost per conversation, reviews |

## Start here

```bash
git clone https://github.com/mannanj/ai-energy-tool && cd ai-energy-tool
./setup.sh
```

The script asks before each step, opens each sign-up page in your browser, checks every key you paste, and
writes them to gitignored files (`app/.dev.vars`, `chat/.env`). Run one step again with
`./setup.sh <step>`:

| Step | What it does |
|---|---|
| `tools` | installs bun, cloudflared (Homebrew on a Mac), checks python3 and openssl |
| `install` | `bun install` in `app/` and `chat/`, Playwright for the browser tests if you want it |
| `files` | creates the local config files, generates the session secret, team password and webhook verify token, asks your name and email for local sign-in |
| `openrouter` | opens the OpenRouter keys page, checks the key |
| `typesafe` | opens TypeSafe, saves the Jev key (optional) |
| `db` | builds the pages and creates the local database |
| `claude` | installs Claude Code, Cloudflare's and TypeSafe's skill plugins, explains MCP sign-in and browser control |
| `meta` | walks through creating your own Meta WhatsApp app, checks the token, App ID and secret |
| `whatsapp` | runs the Worker locally behind a Cloudflare quick tunnel and points your Meta webhook at it |
| `cloudflare` | deploys to your own Cloudflare account (D1, R2, secrets, migrations) and can move the webhook there |

After setup, the editor runs with `cd app && bunx wrangler dev --port 8971` at http://localhost:8971.

## Accounts you need

| Service | Needed for | Cost | Sign up |
|---|---|---|---|
| OpenRouter | writing every reply (DeepSeek V4 Flash) | pay as you go; a chat is well under a cent (`docs/conversation-cost.md`) | https://openrouter.ai/settings/keys |
| TypeSafe | Jev: reading messages into the tree's choices, reviewing wording. Optional; without it DeepSeek reads and code checks | see typesafe.ai | https://typesafe.ai |
| Meta for Developers + a business portfolio | the WhatsApp app, test number and token | free test number, up to 5 recipients | https://developers.facebook.com/apps/ |
| WhatsApp on your phone | sending test messages | free | |
| Cloudflare | the quick tunnel needs **no account**. Deploying needs one: Workers, Durable Objects, D1, R2 | free account; Workers Paid ($5/month) is the safe choice for Durable Objects | https://dash.cloudflare.com/sign-up |
| A domain on Cloudflare Email Sending | emailing magic sign-in links in a deployment. Optional; without it the link shows on the sign-in page | | |
| Claude Code | the agent stack below. Optional | Claude subscription or API | https://code.claude.com |

**WhatsApp without deploying.** WhatsApp only needs a public HTTPS address for the webhook.
`./setup.sh whatsapp` runs the Worker on your laptop and opens a free `trycloudflare.com` tunnel to it, so
no Cloudflare account is involved. The tunnel address changes every run; the script re-points the webhook
each time. The tunnel reaches a small relay that forwards only `/api/whatsapp`, where Meta's signature is
checked, so the editor (which signs everyone in as `DEV_USER` locally) is never public.

**Use your own Meta app.** A Meta app has one webhook address. Pointing someone else's app at your laptop
takes their bot offline.

## Claude Code stack

`./setup.sh claude` sets this up; the repo also declares it, so Claude Code offers it when you open the
folder.

| Piece | What it gives the agent | Where it comes from |
|---|---|---|
| `cloudflare` plugin | Cloudflare's official skills (Workers, Durable Objects, D1, R2, wrangler, Agents SDK, best practices) and MCP servers: `cloudflare-api`, `cloudflare-docs`, `cloudflare-bindings`, `cloudflare-builds`, `cloudflare-observability` | `github.com/cloudflare/skills`, declared in `.claude/settings.json` |
| `typesafe` plugin | how to build with Jev and System One | `github.com/typesafe-ai/skills`, declared in `.claude/settings.json` |
| `whatsapp_business_tools` MCP | Meta's WhatsApp Business server: businesses, phone numbers, templates, webhooks, sending | `https://mcp.facebook.com/whatsapp_business_tools`, declared in `.mcp.json` |
| Claude in Chrome | drives your own Chrome, with your own Facebook sign-in, for the Meta pages that have no API | https://claude.ai/chrome, then `/chrome` in Claude Code |
| Computer use | controls desktop apps; in the Claude desktop app | Claude desktop app settings |
| `meta-whatsapp-setup` skill | step-by-step Meta setup for the agent to click through | `.claude/skills/meta-whatsapp-setup/` |

By hand, in a terminal:

```bash
claude plugin marketplace add cloudflare/skills && claude plugin install cloudflare@cloudflare --scope user
claude plugin marketplace add typesafe-ai/skills && claude plugin install typesafe@typesafe-ai --scope user
```

Then in Claude Code, `/mcp` signs in to each MCP server through your browser (OAuth; no keys are pasted).
To have the agent do the Meta clicking: start `./setup.sh meta` in a terminal, then ask Claude Code to
"run the meta-whatsapp-setup skill". It reads the IDs off the pages for you and stops when a secret is
on screen, so you paste secrets into the setup prompt yourself and they never enter the conversation.

## Rules for contributors

`AGENTS.md`: no code comments; names and structure carry the meaning, and anything more goes in the
folder's README. Never commit a key; every file that holds one is gitignored.
