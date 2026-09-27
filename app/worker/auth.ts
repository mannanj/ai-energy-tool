/**
 * Two cookies, both HMAC-signed and self-contained, so the WebSocket route can check them
 * without a database read.
 *   aet_gate     "the shared workspace password was entered in this browser"   30 days
 *   aet_session  who this person is (id, name, email, color)                    30 days
 * Magic-link tokens live in D1, hashed, single use.
 */
import type { Env } from "./env";

export const GATE_COOKIE = "aet_gate";
export const SESSION_COOKIE = "aet_session";
const GATE_TTL_S = 30 * 24 * 3600;
const SESSION_TTL_S = 30 * 24 * 3600;
const TOKEN_TTL_MIN = 20;

export interface SessionUser { id: string; firstName: string; lastName: string; email: string; color: string; exp: number }

const enc = new TextEncoder();
const b64u = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function key(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function sign(payload: object, secret: string): Promise<string> {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const sig = b64u(await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body)));
  return `${body}.${sig}`;
}
export async function verify<T extends { exp: number }>(token: string | undefined, secret: string): Promise<T | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(secret), unb64u(sig), enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(unb64u(body))) as T;
    return payload.exp > Date.now() / 1000 ? payload : null;
  } catch {
    return null;
  }
}

export function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.get("Cookie") ?? "";
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return undefined;
}

export function setCookie(name: string, value: string, maxAgeS: number, secure: boolean): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeS}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}
export const clearCookie = (name: string) => `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;

export async function gateCookie(env: Env, secure: boolean) {
  return setCookie(GATE_COOKIE, await sign({ g: 1, exp: Math.floor(Date.now() / 1000) + GATE_TTL_S }, env.SESSION_SECRET), GATE_TTL_S, secure);
}
export async function hasGate(req: Request, env: Env) {
  return !!(await verify<{ exp: number }>(readCookie(req, GATE_COOKIE), env.SESSION_SECRET));
}
export async function sessionCookie(env: Env, user: Omit<SessionUser, "exp">, secure: boolean) {
  const payload: SessionUser = { ...user, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S };
  return setCookie(SESSION_COOKIE, await sign(payload, env.SESSION_SECRET), SESSION_TTL_S, secure);
}
export async function getSession(req: Request, env: Env): Promise<SessionUser | null> {
  return verify<SessionUser>(readCookie(req, SESSION_COOKIE), env.SESSION_SECRET);
}

/** Constant-time-ish compare for the shared password. */
export function passwordMatches(given: string, expected: string): boolean {
  if (!expected) return false;
  const a = enc.encode(given), b = enc.encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/* ---------- users + magic links (D1) ---------- */

const COLORS = ["#e11d48", "#d97706", "#059669", "#0284c7", "#7c3aed", "#db2777", "#0d9488", "#ea580c", "#4f46e5", "#65a30d"];
const now = () => new Date().toISOString();
const plus = (min: number) => new Date(Date.now() + min * 60_000).toISOString();

async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface DbUser { id: string; email: string; first_name: string; last_name: string; color: string }

export async function upsertUser(db: D1Database, firstName: string, lastName: string, email: string): Promise<DbUser> {
  const addr = email.trim().toLowerCase();
  const existing = await db.prepare("SELECT id, email, first_name, last_name, color FROM user WHERE email = ?").bind(addr).first<DbUser>();
  if (existing) {
    if (existing.first_name !== firstName || existing.last_name !== lastName) {
      await db.prepare("UPDATE user SET first_name = ?, last_name = ? WHERE id = ?").bind(firstName, lastName, existing.id).run();
    }
    return { ...existing, first_name: firstName, last_name: lastName };
  }
  const id = crypto.randomUUID();
  const count = (await db.prepare("SELECT COUNT(*) AS c FROM user").first<{ c: number }>())?.c ?? 0;
  const color = COLORS[count % COLORS.length];
  await db.prepare("INSERT INTO user (id, email, first_name, last_name, color, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, addr, firstName, lastName, color, now()).run();
  return { id, email: addr, first_name: firstName, last_name: lastName, color };
}

export async function createLoginToken(db: D1Database, userId: string): Promise<string> {
  const bytes = new Uint8Array(24); crypto.getRandomValues(bytes);
  const token = b64u(bytes);
  await db.prepare("INSERT INTO login_token (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256(token), userId, now(), plus(TOKEN_TTL_MIN)).run();
  return token;
}

/** Burn the token first so two clicks cannot both win. */
export async function consumeLoginToken(db: D1Database, token: string): Promise<DbUser | null> {
  const hash = await sha256(token);
  const burn = await db.prepare("UPDATE login_token SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?")
    .bind(now(), hash, now()).run();
  if (!burn.meta.changes) return null;
  const row = await db.prepare("SELECT u.id, u.email, u.first_name, u.last_name, u.color FROM login_token t JOIN user u ON u.id = t.user_id WHERE t.token_hash = ?")
    .bind(hash).first<DbUser>();
  if (row) await db.prepare("UPDATE user SET last_seen = ? WHERE id = ?").bind(now(), row.id).run();
  return row ?? null;
}
