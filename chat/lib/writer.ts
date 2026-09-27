/**
 * DeepSeek writes the helper's reply in its own voice from a square's text; Jev reviews it.
 * If the review fails (a fact dropped, a fact added, wrong shape) the square's verbatim text is sent instead.
 * Two guards: a code check that every number/link in the reply exists in the facts, then Jev's judgment.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { complete, type ChatMessage } from "./llm";

const MODEL = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash";
const RULES = (() => { try { return readFileSync(resolve(import.meta.dir, "../../context/system-prompt.md"), "utf8"); } catch { return ""; } })();
const API = "https://api.typesafe.ai/v1/systemone";

/** tone = "asks exactly what the square asks" for a step, "gives the outcome and stops" for an answer. */
export interface Review { used: "written" | "verbatim"; code_ok: boolean; covers?: number; adds_nothing?: number; tone?: number; reason?: string; written?: string }

const digits = (t: string) => new Set((t.match(/\d[\d,.\-() ]{5,}\d|\b\d{3,}\b|\$\s?\d[\d,]*/g) ?? []).map((x) => x.replace(/\D/g, "")).map((x) => (x.length === 11 && x.startsWith("1") ? x.slice(1) : x)).filter((x) => x.length >= 3));
const links = (t: string) => new Set((t.match(/[a-z0-9.-]+\.(?:gov|org|com|net)\b[^\s)*]*/gi) ?? []).map((x) => x.toLowerCase().replace(/[.,*]+$/, "")));

/** Numbers and links in the reply must come from the square, or be numbers the resident themselves said. */
export function codeCheck(facts: string, reply: string, saidByResident: string): { ok: boolean; reason?: string } {
  const fd = new Set([...digits(facts), ...digits(saidByResident)]), fl = links(facts);
  for (const d of digits(reply)) if (![...fd].some((f) => f.includes(d) || d.includes(f))) return { ok: false, reason: "number not in square: " + d };
  for (const l of links(reply)) if (![...fl].some((f) => f.includes(l.split("/")[0]))) return { ok: false, reason: "link not in square: " + l };
  if (/\[src:|\bVERIFIED\b|\bUNVERIFIED\b|\bCHECK\b/.test(reply)) return { ok: false, reason: "leaked tag" };
  if (reply.length > Math.max(900, facts.length * 2.2)) return { ok: false, reason: "too long" };
  return { ok: true };
}

export async function write(facts: string, history: ChatMessage[], kind: "step" | "answer" | "decline"): Promise<string> {
  const sys = [
    RULES.trim(),
    "",
    "## This turn",
    "You are given FACTS: the exact text of the square in the decision tree the conversation has reached. Write the helper's next message from it.",
    "- Say everything in FACTS. Copy every phone number, link, email, dollar amount, date, percentage and program name exactly.",
    "- Add nothing that is not in FACTS: no program facts, no numbers, no links, no promises, no extra options. You may add warmth, one short acknowledgement of what the person just said, and plain-word explanations of words in FACTS.",
    kind === "step" ? "- FACTS ends in a question or asks for information. Your message must end by asking exactly that, and nothing else. One question per message." : "",
    kind === "answer" ? "- FACTS is the outcome. Give it clearly with the next step, then stop. Do not ask a question." : "",
    "- 2 to 6 short sentences, or a short list. Plain words. Never ask for account numbers or Social Security numbers.",
    "- Reply in the language the person is writing in.",
    "",
    "FACTS:",
    facts,
  ].filter(Boolean).join("\n");
  const messages: ChatMessage[] = [{ role: "system", content: sys }, ...history.slice(-8)];
  return (await complete(MODEL, messages, { temperature: 0.4, maxTokens: 500 })).trim();
}

export async function review(facts: string, written: string, kind: "step" | "answer" | "decline", saidByResident = ""): Promise<Review> {
  const c = codeCheck(facts, written, saidByResident);
  if (!c.ok || !written) return { used: "verbatim", code_ok: false, reason: c.reason ?? "empty", written };
  if (!process.env.TYPESAFE_API_KEY) return { used: "written", code_ok: true, reason: "no reviewer key; code check only", written };
  const res = await fetch(API, {
    method: "POST", headers: { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.TYPESAFE_MODEL ?? "jev-latest", state: { facts, reply: written }, questions: {
      covers: { type: "noul", instructions: "Does `reply` convey every substantive point in `facts` (each program, number, contact, condition, and the question if `facts` asks one)? Rewording is fine; leaving a point out is not.", criteria: { true: "Every point in facts is present in reply", false: "At least one point from facts is missing" } },
      adds_nothing: { type: "noul", instructions: "Is `reply` free of program facts, numbers, contacts, dates, eligibility claims, or promises that are NOT in `facts`? Warmth and plain-word explanation of the same facts are fine.", criteria: { true: "Nothing new was added", false: "Reply states something factual that facts does not" } },
      tone: { type: "noul", instructions: kind === "step" ? "Does `reply` end by asking what `facts` asks, and ask nothing else? (Rewording is fine.)" : "Does `reply` give the outcome in `facts` and stop, without asking a new question?", criteria: { true: "Yes", false: "No, it asks something different, adds another question, or asks when it should not" } },
    } }),
  });
  if (!res.ok) return { used: "verbatim", code_ok: true, reason: `reviewer error ${res.status}`, written };
  const a = (await res.json()).answers as Record<string, { noul: number }>;
  const covers = a.covers?.noul ?? 0, adds = a.adds_nothing?.noul ?? 0, tone = a.tone?.noul ?? 0;
  const ok = covers >= 0.6 && adds >= 0.6 && tone >= 0.5;
  return { used: ok ? "written" : "verbatim", code_ok: true, covers, adds_nothing: adds, tone, reason: ok ? undefined : `review failed (covers ${covers.toFixed(2)}, adds_nothing ${adds.toFixed(2)}, tone ${tone.toFixed(2)})`, written };
}
