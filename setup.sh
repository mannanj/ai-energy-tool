#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")" && pwd)
APP="$ROOT/app"
CHAT="$ROOT/chat"
VARS="$APP/.dev.vars"
CHAT_ENV="$CHAT/.env"
OWN_CONFIG="$APP/wrangler.own.jsonc"
GRAPH="https://graph.facebook.com/v25.0"
LOCAL_PORT=8971
WEBHOOK_PORT=8975
RUN_DIR="${TMPDIR:-/tmp}/ai-energy-tool-setup"
mkdir -p "$RUN_DIR"

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
say() { printf '%s\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*"; }
fail() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }
has() { command -v "$1" >/dev/null 2>&1; }

ask() {
  local prompt=$1 default=${2:-} answer
  if [ -n "$default" ]; then read -r -p "$prompt [$default]: " answer; else read -r -p "$prompt: " answer; fi
  printf '%s' "${answer:-$default}"
}

ask_secret() {
  local prompt=$1 current=${2:-} answer
  if [ -n "$current" ]; then read -r -s -p "$prompt (Enter keeps the saved one): " answer; else read -r -s -p "$prompt: " answer; fi
  printf '\n' >&2
  printf '%s' "${answer:-$current}"
}

yes_no() {
  local answer
  read -r -p "$1 [Y/n]: " answer
  [[ -z "$answer" || "$answer" =~ ^[Yy] ]]
}

open_page() {
  say "Opening $1"
  if has open; then open "$1"; elif has xdg-open; then xdg-open "$1" >/dev/null 2>&1; else say "Open this in your browser: $1"; fi
}

pause() { read -r -p "${1:-Press Enter to continue}" _; }

get_var() {
  [ -f "$2" ] || return 0
  { grep -E "^$1=" "$2" || true; } | tail -1 | cut -d= -f2-
}

set_var() {
  local file=$3
  touch "$file"
  K="$1" V="$2" awk 'BEGIN { k = ENVIRON["K"]; v = ENVIRON["V"]; done = 0 }
    index($0, k "=") == 1 { if (!done) print k "=" v; done = 1; next }
    { print }
    END { if (!done) print k "=" v }' "$file" > "$file.tmp"
  mv "$file.tmp" "$file"
  chmod 600 "$file"
}

random_secret() { openssl rand -hex "${1:-32}"; }

step_tools() {
  bold "1. Tools"
  if [ "$(uname)" = "Darwin" ] && ! has brew; then
    warn "Homebrew is not installed. It is the easiest way to get cloudflared and python3 on a Mac."
    yes_no "Install Homebrew now?" && /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  fi
  if ! has bun; then
    yes_no "bun is missing. Install it from bun.sh?" || fail "bun is required."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
  fi
  if ! has cloudflared; then
    if has brew && yes_no "cloudflared (for the public WhatsApp webhook tunnel) is missing. Install with Homebrew?"; then brew install cloudflared
    else warn "Install cloudflared later: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"; fi
  fi
  has python3 || warn "python3 is missing; only the end-to-end browser tests need it."
  has openssl || fail "openssl is required to generate secrets."
  say "bun $(bun --version), cloudflared $(cloudflared --version 2>/dev/null | head -1 | awk '{print $3}'), python3 $(python3 --version 2>/dev/null | awk '{print $2}')"
}

step_install() {
  bold "2. Packages"
  (cd "$APP" && bun install)
  (cd "$CHAT" && bun install)
  if has python3 && yes_no "Install Playwright for the browser tests (optional)?"; then
    python3 -m pip install --user playwright && python3 -m playwright install chromium webkit
  fi
}

step_local_files() {
  bold "3. Local config files"
  [ -f "$VARS" ] || cp "$APP/.dev.vars.example" "$VARS"
  [ -f "$CHAT_ENV" ] || cp "$CHAT/.env.example" "$CHAT_ENV"
  [ -f "$APP/.env.development" ] || cp "$APP/.env.development.example" "$APP/.env.development"
  [ -f "$APP/.env.production" ] || cp "$APP/.env.production.example" "$APP/.env.production"
  chmod 600 "$VARS" "$CHAT_ENV"

  local secret password
  secret=$(get_var SESSION_SECRET "$VARS")
  if [ -z "$secret" ] || [ "$secret" = "long-random-string" ]; then set_var SESSION_SECRET "$(random_secret)" "$VARS"; fi
  password=$(get_var WORKSPACE_PASSWORD "$VARS")
  if [ -z "$password" ] || [ "$password" = "choose-a-shared-password" ]; then
    set_var WORKSPACE_PASSWORD "$(random_secret 12)" "$VARS"
    say "Generated a team password (WORKSPACE_PASSWORD in app/.dev.vars)."
  fi
  if [ -z "$(get_var WHATSAPP_VERIFY_TOKEN "$VARS")" ]; then set_var WHATSAPP_VERIFY_TOKEN "$(random_secret 16)" "$VARS"; fi

  local user first last email
  user=$(get_var DEV_USER "$VARS")
  if [ -z "$user" ] || [[ "$user" == *"you@example.com"* ]]; then
    say "Local dev signs every request in as you, so the editor opens without a password."
    first=$(ask "Your first name")
    last=$(ask "Your last name")
    email=$(ask "Your email")
    set_var DEV_USER "$first $last <$email>" "$VARS"
  fi
  say "Wrote app/.dev.vars, app/.env.development, app/.env.production, chat/.env (all gitignored)."
}

step_openrouter() {
  bold "4. OpenRouter (writes every reply; DeepSeek V4 Flash, well under a cent per chat)"
  local key
  key=$(get_var OPENROUTER_API_KEY "$VARS")
  [[ "$key" == sk-or-v1-your-key ]] && key=""
  if [ -z "$key" ]; then
    say "Sign in, add a few dollars of credit, and create a key. Setting a credit limit on the key is a good idea."
    open_page "https://openrouter.ai/settings/keys"
  fi
  while true; do
    key=$(ask_secret "OpenRouter API key (sk-or-v1-...)" "$key")
    [ -n "$key" ] || { warn "Skipped. Replies will fail until you add a key: ./setup.sh openrouter"; return; }
    if curl -fsS -o /dev/null -H "Authorization: Bearer $key" https://openrouter.ai/api/v1/key; then say "Key works."; break; fi
    warn "OpenRouter rejected that key. Try again, or press Enter on an empty prompt to skip."
    key=""
  done
  set_var OPENROUTER_API_KEY "$key" "$VARS"
  set_var OPENROUTER_API_KEY "$key" "$CHAT_ENV"
}

step_typesafe() {
  bold "5. TypeSafe Jev (reads each message into typed choices and reviews the wording)"
  say "Optional: without it, DeepSeek reads the messages instead and replies are checked by code only."
  local key
  key=$(get_var TYPESAFE_API_KEY "$VARS")
  [[ "$key" == apikey_... ]] && key=""
  if [ -z "$key" ]; then
    yes_no "Set up a TypeSafe key now?" || { warn "Skipped. Add it later: ./setup.sh typesafe"; return; }
    open_page "https://typesafe.ai"
  fi
  key=$(ask_secret "TypeSafe API key (apikey_...)" "$key")
  [ -n "$key" ] || return 0
  set_var TYPESAFE_API_KEY "$key" "$VARS"
  set_var TYPESAFE_API_KEY "$key" "$CHAT_ENV"
}

step_local_db() {
  bold "6. Local build and database"
  (cd "$APP" && bun run build && bunx wrangler d1 migrations apply ai-energy-tool --local)
}

step_meta() {
  bold "7. Meta (Facebook) WhatsApp app"
  say "You need your own Meta developer app with the WhatsApp product. Its free test number"
  say "can message up to 5 phone numbers you verify. Claude Code can do the clicking for you: see"
  say "'Claude Code stack' in README.md and ask it to run the meta-whatsapp-setup skill."
  say ""
  say "  a. developers.facebook.com → My Apps → Create app → use case 'Connect with customers through WhatsApp'."
  say "     Pick or create a business portfolio when asked."
  say "  b. In the app: WhatsApp → API Setup. Note the test number's 'Phone number ID' and"
  say "     'WhatsApp Business Account ID'. Add your own phone under 'To' and confirm the code."
  say "  c. App settings → Basic: note the App ID and the App secret."
  say "  d. Token: the API Setup page's temporary token lasts 24 hours. For a lasting one,"
  say "     business.facebook.com → Settings → Users → System users → Add (Admin) → Assign assets"
  say "     (the app, full control; the WhatsApp account, full control) → Generate token"
  say "     with whatsapp_business_messaging and whatsapp_business_management, expiry Never."
  yes_no "Open the Meta developer dashboard?" && open_page "https://developers.facebook.com/apps/"
  pause "Press Enter when you have those values ready "

  local app_id app_secret phone_id waba_id token
  app_id=$(ask "App ID" "$(get_var WHATSAPP_APP_ID "$VARS")")
  app_secret=$(ask_secret "App secret" "$(get_var WHATSAPP_APP_SECRET "$VARS")")
  phone_id=$(ask "Phone number ID" "$(get_var WHATSAPP_PHONE_NUMBER_ID "$VARS")")
  waba_id=$(ask "WhatsApp Business Account ID" "$(get_var WHATSAPP_BUSINESS_ACCOUNT_ID "$VARS")")
  token=$(ask_secret "Access token" "$(get_var WHATSAPP_TOKEN "$VARS")")

  local number
  number=$(curl -fsS -G "$GRAPH/$phone_id" --data-urlencode "fields=display_phone_number,verified_name" -H "Authorization: Bearer $token" 2>/dev/null) \
    || fail "Meta did not accept the token for that phone number ID. Check both and run ./setup.sh meta again."
  say "Token works for: $number"
  curl -fsS -o /dev/null -G "$GRAPH/$app_id" --data-urlencode "access_token=$app_id|$app_secret" \
    || fail "The App ID and App secret do not match. Run ./setup.sh meta again."
  say "App ID and secret match."

  set_var WHATSAPP_APP_ID "$app_id" "$VARS"
  set_var WHATSAPP_APP_SECRET "$app_secret" "$VARS"
  set_var WHATSAPP_PHONE_NUMBER_ID "$phone_id" "$VARS"
  set_var WHATSAPP_BUSINESS_ACCOUNT_ID "$waba_id" "$VARS"
  set_var WHATSAPP_TOKEN "$token" "$VARS"
  say "Saved to app/.dev.vars."
}

point_webhook() {
  local callback=$1 app_id app_secret verify waba token
  app_id=$(get_var WHATSAPP_APP_ID "$VARS")
  app_secret=$(get_var WHATSAPP_APP_SECRET "$VARS")
  verify=$(get_var WHATSAPP_VERIFY_TOKEN "$VARS")
  waba=$(get_var WHATSAPP_BUSINESS_ACCOUNT_ID "$VARS")
  token=$(get_var WHATSAPP_TOKEN "$VARS")
  [ -n "$app_id" ] && [ -n "$app_secret" ] && [ -n "$waba" ] && [ -n "$token" ] || fail "Meta values are missing. Run ./setup.sh meta first."
  say "Pointing the Meta webhook at $callback"
  curl -fsS -X POST "$GRAPH/$app_id/subscriptions" \
    --data-urlencode "object=whatsapp_business_account" \
    --data-urlencode "callback_url=$callback" \
    --data-urlencode "verify_token=$verify" \
    --data-urlencode "fields=messages" \
    --data-urlencode "access_token=$app_id|$app_secret" >/dev/null \
    || fail "Meta could not verify $callback. Is the Worker running and reachable?"
  curl -fsS -X POST "$GRAPH/$waba/subscribed_apps" -H "Authorization: Bearer $token" >/dev/null \
    || fail "Could not subscribe the app to the WhatsApp Business Account."
  local display
  display=$(curl -fsS -G "$GRAPH/$(get_var WHATSAPP_PHONE_NUMBER_ID "$VARS")" --data-urlencode "fields=display_phone_number" -H "Authorization: Bearer $token" \
    | sed -E 's/.*"display_phone_number":"([^"]*)".*/\1/')
  say "Webhook verified. Message $display from a phone you added as a recipient:"
  say "  https://wa.me/$(printf '%s' "$display" | tr -cd '0-9')"
}

wait_for_worker() {
  local url=$1 tries=${2:-90}
  for _ in $(seq "$tries"); do
    [ "$(curl -s "$url/api/whatsapp?hub.mode=ping" 2>/dev/null)" = "forbidden" ] && return 0
    sleep 1
  done
  return 1
}

step_whatsapp_local() {
  bold "WhatsApp against your laptop"
  has cloudflared || fail "cloudflared is required. Run ./setup.sh tools."
  say "Only /api/whatsapp goes through the tunnel; the editor and every other path stay on this machine."
  local wrangler_log="$RUN_DIR/wrangler.log" tunnel_log="$RUN_DIR/cloudflared.log" wrangler_pid relay_pid tunnel_pid url
  (cd "$APP" && exec bunx wrangler dev --port "$LOCAL_PORT") >"$wrangler_log" 2>&1 &
  wrangler_pid=$!
  trap 'kill $wrangler_pid ${relay_pid:-} ${tunnel_pid:-} 2>/dev/null || true' EXIT INT TERM
  wait_for_worker "http://localhost:$LOCAL_PORT" || { tail -20 "$wrangler_log"; fail "wrangler dev did not start."; }
  WORKER="http://localhost:$LOCAL_PORT" PORT="$WEBHOOK_PORT" bun -e '
    Bun.serve({
      port: Number(process.env.PORT),
      hostname: "127.0.0.1",
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname !== "/api/whatsapp") return new Response("not found", { status: 404 });
        const headers = new Headers(req.headers);
        headers.delete("host");
        return fetch(process.env.WORKER + url.pathname + url.search, { method: req.method, headers, body: req.body });
      },
    });
  ' >"$RUN_DIR/relay.log" 2>&1 &
  relay_pid=$!
  wait_for_worker "http://localhost:$WEBHOOK_PORT" 20 || { cat "$RUN_DIR/relay.log"; fail "The webhook relay did not start."; }
  cloudflared tunnel --no-autoupdate --url "http://localhost:$WEBHOOK_PORT" >"$tunnel_log" 2>&1 &
  tunnel_pid=$!
  for _ in $(seq 60); do
    url=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$tunnel_log" | head -1 || true)
    [ -n "$url" ] && break
    sleep 1
  done
  [ -n "$url" ] || { tail -20 "$tunnel_log"; fail "cloudflared did not print a tunnel address."; }
  wait_for_worker "$url" 90 || { tail -20 "$tunnel_log"; fail "The tunnel at $url never reached the Worker."; }
  point_webhook "$url/api/whatsapp"
  say ""
  say "Editor: http://localhost:$LOCAL_PORT   Worker log: $wrangler_log"
  say "Press Ctrl-C to stop. The webhook keeps pointing at this tunnel until you run this again or deploy."
  wait "$wrangler_pid"
}

own_config() {
  APP_ORIGIN_VALUE=$1 DATABASE_ID=$2 EMAIL_FROM_VALUE=$3 bun -e '
    const fs = require("fs");
    const c = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    c.d1_databases[0].database_id = process.env.DATABASE_ID;
    c.vars.APP_ORIGIN = process.env.APP_ORIGIN_VALUE;
    if (process.env.EMAIL_FROM_VALUE) c.vars.EMAIL_FROM = process.env.EMAIL_FROM_VALUE;
    else { c.vars.EMAIL_PROVIDER = "console"; delete c.send_email; }
    fs.writeFileSync(process.argv[2], JSON.stringify(c, null, 2) + "\n");
  ' "$APP/wrangler.jsonc" "$OWN_CONFIG"
}

step_cloudflare() {
  bold "Deploy to your own Cloudflare account"
  say "Uses Workers, Durable Objects, D1 and R2. The Workers Paid plan (\$5/month) is the safe choice;"
  say "Email Sending needs a domain on Cloudflare."
  (cd "$APP" && { bunx wrangler whoami 2>/dev/null | grep -q "associated with the email" || bunx wrangler login; })

  local db_id
  db_id=$(cd "$APP" && bunx wrangler d1 list --json 2>/dev/null | bun -e 'const l = JSON.parse(await Bun.stdin.text()); console.log((l.find((d) => d.name === "ai-energy-tool") || {}).uuid || "")')
  if [ -z "$db_id" ]; then
    (cd "$APP" && bunx wrangler d1 create ai-energy-tool >/dev/null)
    db_id=$(cd "$APP" && bunx wrangler d1 list --json | bun -e 'const l = JSON.parse(await Bun.stdin.text()); console.log(l.find((d) => d.name === "ai-energy-tool").uuid)')
  fi
  say "D1 database: $db_id"
  (cd "$APP" && { bunx wrangler r2 bucket list 2>/dev/null | grep -q "ai-energy-tool-files" || bunx wrangler r2 bucket create ai-energy-tool-files; })

  local email_from origin
  say "Magic sign-in links need a sender address on a domain onboarded to Cloudflare Email Sending."
  say "Leave it empty to show the link on the sign-in page instead (anyone with the team password can then sign in)."
  email_from=$(ask "Sender, e.g. AI Energy Tool <no-reply@yourdomain.com>" "")
  origin=$(get_var DEPLOYED_ORIGIN "$VARS")
  own_config "${origin:-https://example.invalid}" "$db_id" "$email_from"

  (cd "$APP" && bun run build && bunx wrangler d1 migrations apply ai-energy-tool --remote -c "$OWN_CONFIG")
  local out
  out=$(cd "$APP" && bunx wrangler deploy -c "$OWN_CONFIG" 2>&1 | tee /dev/stderr)
  origin=$(printf '%s' "$out" | grep -oE 'https://[a-zA-Z0-9.-]+\.workers\.dev' | head -1)
  [ -n "$origin" ] || fail "Could not read the deployed address from wrangler's output."
  set_var DEPLOYED_ORIGIN "$origin" "$VARS"
  own_config "$origin" "$db_id" "$email_from"
  (cd "$APP" && bunx wrangler deploy -c "$OWN_CONFIG" >/dev/null)

  bun -e '
    const keep = ["WORKSPACE_PASSWORD", "SESSION_SECRET", "OPENROUTER_API_KEY", "TYPESAFE_API_KEY", "WHATSAPP_TOKEN", "WHATSAPP_APP_SECRET", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"];
    const text = require("fs").readFileSync(process.argv[1], "utf8");
    const out = {};
    for (const line of text.split("\n")) { const i = line.indexOf("="); const k = line.slice(0, i); if (i > 0 && keep.includes(k) && line.slice(i + 1)) out[k] = line.slice(i + 1); }
    process.stdout.write(JSON.stringify(out));
  ' "$VARS" | (cd "$APP" && bunx wrangler secret bulk -c "$OWN_CONFIG")

  if [ -f "$ROOT/context/team-docs/civic-signal-sources.pdf" ]; then
    (cd "$APP" && bunx wrangler r2 object put ai-energy-tool-files/trees/civic-signal.pdf --file ../context/team-docs/civic-signal-sources.pdf --remote -c "$OWN_CONFIG" >/dev/null) || true
  fi
  say "Live at $origin (team password: WORKSPACE_PASSWORD in app/.dev.vars)."
  if [ -n "$(get_var WHATSAPP_APP_ID "$VARS")" ] && yes_no "Point the WhatsApp webhook at this deployment?"; then
    point_webhook "$origin/api/whatsapp"
  fi
}

step_claude() {
  bold "Claude Code stack (skills, MCP servers, browser control)"
  if ! has claude; then
    yes_no "Claude Code is missing. Install it?" || { warn "Skipped. See https://code.claude.com"; return; }
    curl -fsSL https://claude.ai/install.sh | bash
    export PATH="$HOME/.local/bin:$PATH"
  fi
  say "Cloudflare's official plugin (github.com/cloudflare/skills): Workers, Durable Objects, D1, R2, wrangler"
  say "and Agents skills, plus the Cloudflare MCP servers (API, docs, bindings, builds, observability)."
  claude plugin marketplace add cloudflare/skills || true
  claude plugin install cloudflare@cloudflare --scope user || warn "Install it later inside Claude Code: /plugin install cloudflare@cloudflare"
  say "TypeSafe's plugin (github.com/typesafe-ai/skills): how to build with Jev."
  claude plugin marketplace add typesafe-ai/skills || true
  claude plugin install typesafe@typesafe-ai --scope user || warn "Install it later inside Claude Code: /plugin install typesafe@typesafe-ai"
  say ""
  say "The repo's .mcp.json adds Meta's WhatsApp Business MCP server for this folder; Claude Code asks to"
  say "approve it the first time you open the folder. All MCP servers sign in with OAuth, no keys pasted."
  yes_no "Open the Cloudflare sign-up page (free account; say no if you have one)?" && open_page "https://dash.cloudflare.com/sign-up"
  say ""
  say "Next, inside Claude Code in this folder:"
  say "  1. /mcp → sign in to cloudflare-api, cloudflare-docs, cloudflare-bindings, cloudflare-builds,"
  say "     cloudflare-observability and whatsapp_business_tools (each opens a browser login)."
  say "  2. Browser control: install Claude in Chrome (https://claude.ai/chrome), then run /chrome."
  say "     For control of desktop apps, use computer use in the Claude desktop app."
  say "  3. Ask: \"run the meta-whatsapp-setup skill\". It drives the Meta pages in your browser and stops"
  say "     for you to paste secrets into ./setup.sh meta."
}

run_all() {
  step_tools
  step_install
  step_local_files
  step_openrouter
  step_typesafe
  step_local_db
  yes_no "Set up the Claude Code stack (Cloudflare and TypeSafe skills, MCP servers)?" && step_claude
  if yes_no "Set up WhatsApp (Meta) now?"; then
    step_meta
    yes_no "Start the local Worker and connect WhatsApp to it now?" && step_whatsapp_local
  fi
  bold "Done"
  say "Editor:   cd app && bunx wrangler dev --port $LOCAL_PORT   → http://localhost:$LOCAL_PORT"
  say "WhatsApp: ./setup.sh whatsapp"
  say "Deploy:   ./setup.sh cloudflare"
}

case "${1:-all}" in
  all) run_all ;;
  tools) step_tools ;;
  install) step_install ;;
  files) step_local_files ;;
  openrouter) step_openrouter ;;
  typesafe) step_typesafe ;;
  db) step_local_db ;;
  meta) step_meta ;;
  whatsapp) step_whatsapp_local ;;
  cloudflare) step_cloudflare ;;
  claude) step_claude ;;
  *) say "usage: ./setup.sh [all|tools|install|files|openrouter|typesafe|db|claude|meta|whatsapp|cloudflare]"; exit 1 ;;
esac
