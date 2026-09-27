import type { Env } from "./env";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function parseFrom(v: string) {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(v);
  return m ? { name: m[1] || undefined, email: m[2].trim() } : { email: v.trim() };
}

export async function sendMagicLink(env: Env, to: string, firstName: string, url: string): Promise<void> {
  const subject = `Sign in to ${env.APP_NAME}`;
  const text = `Hi ${firstName},\n\nClick to sign in to ${env.APP_NAME}. This link works once and expires in 20 minutes.\n\n${url}\n\nIf you didn't ask for this, ignore this email.`;
  const html = `<!doctype html><div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
<h2 style="margin:0 0 12px;font-size:18px">Sign in to ${esc(env.APP_NAME)}</h2>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5">Hi ${esc(firstName)}, click the button to sign in. The link works once and expires in 20 minutes.</p>
<p style="margin:0 0 12px"><a href="${esc(url)}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:6px;font-size:14px">Sign in</a></p>
<p style="margin:0;color:#666;font-size:12px;word-break:break-all">Or paste this into your browser:<br>${esc(url)}</p></div>`;

  if (env.EMAIL_PROVIDER === "console") {
    console.log(`\n─── email (NOT SENT, EMAIL_PROVIDER=console) ───\nTo: ${to}\nSubject: ${subject}\n\n${text}\n──────────\nMAGIC_LINK ${url}\n`);
    return;
  }
  if (env.EMAIL_PROVIDER !== "cloudflare" || !env.EMAIL) throw new Error("EMAIL binding missing or EMAIL_PROVIDER unknown");
  await env.EMAIL.send({ to, from: parseFrom(env.EMAIL_FROM), subject, text, html });
}
