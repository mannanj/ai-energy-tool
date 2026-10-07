---
name: meta-whatsapp-setup
description: Drive the person's browser through Meta's developer and business pages to create their own WhatsApp app, test number, verified recipient and permanent system-user token for this repo, then hand off to ./setup.sh meta. Use when someone onboarding asks to set up WhatsApp, Meta, Facebook, the webhook, or "the meta-whatsapp-setup skill".
---

# Set up a person's own Meta WhatsApp app

The person runs `./setup.sh meta` in a terminal; you do the clicking in their browser. You never read,
copy, or type a secret (App secret, access token). When a page shows one, tell the person where it is
and let them paste it into the setup prompt themselves. IDs (App ID, Phone number ID, WhatsApp Business
Account ID) are not secret; read them off the page and tell the person.

## Browser

Use Claude in Chrome (`mcp__claude-in-chrome__*`, connect with `/chrome`) so the person's own Facebook
sign-in is used. In the Claude desktop app, the built-in browser or computer use also works. Load that
tool's skill before the first browser step. If no browser tool is available, read the steps below to the
person one at a time instead.

The person signs in to Facebook themselves, including any two-factor prompt. Stop and ask before anything
that costs money, verifies a business, or adds a real phone number.

## Steps

1. **Developer account.** Open https://developers.facebook.com/apps/. If it asks to register as a
   developer, let the person finish it (it needs their phone or a card).
2. **App.** Create app → use case **Connect with customers through WhatsApp** → name it (for example
   "AI Energy Tool – <their name>") → create or pick a business portfolio. Read the **App ID** off the
   dashboard.
3. **Test number.** WhatsApp → **API Setup**. Meta gives a free test number. Read the **Phone number ID**
   and **WhatsApp Business Account ID** shown under it.
4. **Recipients.** On the same page, under **To**, choose **Manage phone number list**, add the person's
   own WhatsApp number, and let them type the code WhatsApp sends them. The test number can reach up to
   5 numbers added this way.
5. **App secret.** App settings → **Basic** → App secret → **Show**. Meta asks for the Facebook password;
   the person types it. Tell them to paste the secret into the setup prompt, not into chat.
6. **Permanent token.** https://business.facebook.com/settings/system-users → **Add** → name
   `whatsapp-bot`, role **Admin**. Then **Assign assets**: the app (full control) and the WhatsApp
   account (full control). Then **Generate token** → pick the app → expiry **Never** → permissions
   `whatsapp_business_messaging` and `whatsapp_business_management`. Tell the person to copy the token
   straight into the setup prompt. The 24-hour token on the API Setup page also works for a first try.
7. **Publish** (optional, only for numbers beyond the 5 test recipients): App settings → Basic needs a
   privacy policy URL, then switch the app to **Live**. Ask first.

## Hand-off

When `./setup.sh meta` reports "Token works" and "App ID and secret match", run `./setup.sh whatsapp`
in a background shell. It starts the Worker, opens a Cloudflare quick tunnel, points the app's webhook at
it through the Graph API, and prints a `wa.me` link. Ask the person to message it from the phone they
added in step 4 and confirm the reply arrives. The webhook settings page in the dashboard is never needed;
`point_webhook` in `setup.sh` sets it.

## When it goes wrong

- "Meta could not verify …": the tunnel is not reaching the Worker. Check the log path `setup.sh` prints.
- Messages arrive but no reply: the recipient is not on the list from step 4, or `OPENROUTER_API_KEY` is
  missing from `app/.dev.vars`.
- "Object with ID … does not exist": the token was made for a different app or the assets in step 6 were
  not assigned.
