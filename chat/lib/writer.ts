import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { complete, type ChatMessage } from "./llm";

const MODEL = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash";
const RULES = (() => { try { return readFileSync(resolve(import.meta.dir, "../../context/system-prompt.md"), "utf8"); } catch { return ""; } })();
const API = "https://api.typesafe.ai/v1/systemone";

export interface Review { used: "written" | "verbatim"; code_ok: boolean; covers?: number; adds_nothing?: number; tone?: number; plain?: number; reason?: string; written?: string; attempts?: number; passed?: boolean; simplified?: boolean }
export interface Draft { stage: "write" | "simplify" | "verbatim"; text: string; review: Omit<Review, "written"> }

const digits = (t: string) => {
  const out = new Set((t.match(/\d[\d,.\-() ]{5,}\d|\b\d{3,}\b|\$\s?\d[\d,]*/g) ?? []).map((x) => x.replace(/\D/g, "")).map((x) => (x.length === 11 && x.startsWith("1") ? x.slice(1) : x)).filter((x) => x.length >= 3));
  for (const m of t.matchAll(/\$?\s?(\d+(?:\.\d+)?)\s?k\b/gi)) out.add(String(Math.round(Number(m[1]) * 1000)));
  return out;
};
const links = (t: string) => new Set((t.match(/[a-z0-9.-]+\.(?:gov|org|com|net)\b[^\s)*]*/gi) ?? []).map((x) => x.toLowerCase().replace(/[.,*]+$/, "")));

export function codeCheck(facts: string, reply: string, conversation: string): { ok: boolean; reason?: string } {
  const fd = new Set([...digits(facts), ...digits(conversation)]), fl = new Set([...links(facts), ...links(conversation)]);
  for (const d of digits(reply)) if (![...fd].some((f) => f.includes(d) || d.includes(f))) return { ok: false, reason: "number not in square: " + d };
  for (const l of links(reply)) if (![...fl].some((f) => f.includes(l.split("/")[0]))) return { ok: false, reason: "link not in square: " + l };
  if (/\[src:|\bVERIFIED\b|\bUNVERIFIED\b|\bCHECK\b/.test(reply)) return { ok: false, reason: "leaked tag" };
  if (reply.length > Math.max(900, facts.length * 2.2)) return { ok: false, reason: "too long" };
  return { ok: true };
}

export async function write(facts: string, history: ChatMessage[], kind: "step" | "answer" | "decline", feedback = ""): Promise<string> {
  const sys = [
    RULES.trim(),
    "",
    "## This turn",
    "You are given FACTS: the exact text of the square in the decision tree the conversation has reached. Write the helper's next message from it.",
    "- Say everything in FACTS that the person needs. Copy every phone number, link, email, dollar amount, date, percentage and program name exactly.",
    "- FACTS may carry the team's own labels and notes: things like \"Step 0, always first:\", \"Branch A:\", \"Screener, one at a time:\", \"(state manual 05/25)\", or source tags. Never repeat those. They are instructions to you, not words for the person.",
    "- Start with the substance. No opener, no sympathy line, no restating what they said.",
    "- Add nothing that is not in FACTS: no program facts, no numbers, no links, no promises, no extra options. You may add warmth, one short acknowledgement of what the person just said, and plain-word explanations of words in FACTS.",
    kind === "step" ? "- FACTS ends in a question or asks for information. Your message must end by asking exactly that, and nothing else. One question per message." : "",
    kind === "answer" ? "- FACTS is the outcome. Give it clearly with the next step, then stop. Do not ask a question." : "",
    "- 2 to 6 short sentences, or a short list. Plain words. Never ask for account numbers or Social Security numbers.",
    "- Reply in the language the person is writing in.",
    "",
    feedback ? "- Your previous attempt was rejected: " + feedback + " Fix exactly that." : "",
    "",
    "FACTS:",
    facts,
  ].filter(Boolean).join("\n");
  const messages: ChatMessage[] = [{ role: "system", content: sys }, ...history.slice(-8)];
  return (await complete(MODEL, messages, { temperature: 0.4, maxTokens: 500 })).trim();
}

export async function writeReviewed(facts: string, history: ChatMessage[], kind: "step" | "answer" | "decline", saidByResident = "", attempts = 3): Promise<Review & { drafts: Draft[] }> {
  const drafts: Draft[] = [];
  const keep = (stage: Draft["stage"], r: Review) => { const { written, ...rest } = r; drafts.push({ stage, text: written ?? "", review: rest }); };
  const finish = async (r: Review): Promise<Review & { drafts: Draft[] }> => {
    if ((r.plain ?? 1) >= 0.5 || !r.written) return { ...r, drafts };
    const plainText = await simplify(r.written, facts);
    const r2 = await review(facts, plainText, kind, saidByResident);
    keep("simplify", r2);
    if (r2.code_ok && (r2.plain ?? 1) >= (r.plain ?? 0)) return { ...r2, used: "written", attempts: r.attempts, simplified: true, drafts };
    return { ...r, drafts };
  };
  let best: Review | null = null; let feedback = "";
  for (let i = 1; i <= attempts; i++) {
    const written = await write(facts, history, kind, feedback);
    const r = await review(facts, written, kind, saidByResident);
    r.attempts = i; keep("write", r);
    if (r.passed) return finish({ ...r, used: "written" });
    if (r.code_ok && (!best || !best.code_ok || score(r) > score(best))) best = r;
    else if (!best) best = r;
    feedback = r.code_ok
      ? `${(r.covers ?? 1) < 0.6 ? "it left out part of FACTS; say every point. " : ""}${(r.adds_nothing ?? 1) < 0.6 ? "it added something not in FACTS; add nothing. " : ""}${(r.tone ?? 1) < 0.5 ? (kind === "step" ? "it did not end by asking what FACTS asks. " : "it asked a question instead of stopping. ") : ""}${(r.plain ?? 1) < 0.5 ? "it had filler, a sympathy opener, or a copied team label; start with the substance. " : ""}`.trim()
      : `${r.reason}; use only numbers and links that appear in FACTS.`;
  }
  if (best!.code_ok) return finish({ ...best!, used: "written", reason: `best of ${attempts} (${best!.reason ?? ""})` });
  keep("verbatim", { used: "verbatim", code_ok: true, reason: "every attempt invented a number or link", written: facts });
  return { ...best!, used: "verbatim", drafts };
}

export async function simplify(text: string, facts: string): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: "Rewrite the message in plain, direct language. Remove every filler phrase, sympathy opener, restatement of what the person said, and any team label (like \"Step 0\" or \"Branch A\"). Keep every phone number, link, email, dollar amount, date, percentage, program name and question exactly as written. Keep the same language. Output only the rewritten message.\n\nFor reference, the facts it must still contain:\n" + facts },
    { role: "user", content: text },
  ];
  return (await complete(MODEL, messages, { temperature: 0.2, maxTokens: 500 })).trim() || text;
}
const score = (r: Review) => Math.min(r.covers ?? 0, r.adds_nothing ?? 0, r.tone ?? 0, r.plain ?? 1);

export async function review(facts: string, written: string, kind: "step" | "answer" | "decline", saidByResident = ""): Promise<Review> {
  const c = codeCheck(facts, written, saidByResident);
  if (!c.ok || !written) return { used: "verbatim", code_ok: false, reason: c.reason ?? "empty", written, passed: false };
  if (!process.env.TYPESAFE_API_KEY) return { used: "written", code_ok: true, reason: "no reviewer key; code check only", written, passed: true };
  const res = await fetch(API, {
    method: "POST", headers: { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.TYPESAFE_MODEL ?? "jev-latest", state: { facts, reply: written }, questions: {
      covers: { type: "noul", instructions: "Does `reply` convey every substantive point in `facts` (each program, number, contact, condition, and the question if `facts` asks one)? Rewording is fine; leaving a point out is not.", criteria: { true: "Every point in facts is present in reply", false: "At least one point from facts is missing" } },
      adds_nothing: { type: "noul", instructions: "Is `reply` free of program facts, numbers, contacts, dates, eligibility claims, or promises that are NOT in `facts`? Plain-word explanation of the same facts is fine.", criteria: { true: "Nothing new was added", false: "Reply states something factual that facts does not" } },
      plain: { type: "noul", instructions: "Is `reply` free of filler: no sympathy opener (\"I hear you\", \"I understand\"), no throat-clearing (\"let's start with\", \"great question\"), and no team labels copied from `facts` such as \"Step 0\", \"Branch A\", \"Screener\"?", criteria: { true: "Direct and plain, starts with substance", false: "Has filler, a sympathy opener, or a copied team label" } },
      tone: { type: "noul", instructions: kind === "step" ? "Does `reply` end by asking what `facts` asks, and ask nothing else? (Rewording is fine.)" : "Does `reply` give the outcome in `facts` and stop, without asking a new question?", criteria: { true: "Yes", false: "No, it asks something different, adds another question, or asks when it should not" } },
    } }),
  });
  if (!res.ok) return { used: "written", code_ok: true, reason: `reviewer error ${res.status}; code check only`, written, passed: true };
  const a = (await res.json()).answers as Record<string, { noul: number }>;
  const covers = a.covers?.noul ?? 0, adds = a.adds_nothing?.noul ?? 0, tone = a.tone?.noul ?? 0, plain = a.plain?.noul ?? 1;
  const ok = covers >= 0.6 && adds >= 0.6 && tone >= 0.5 && plain >= 0.5;
  return { used: ok ? "written" : "verbatim", code_ok: true, covers, adds_nothing: adds, tone, plain, reason: ok ? undefined : `review under the bar (covers ${covers.toFixed(2)}, adds_nothing ${adds.toFixed(2)}, tone ${tone.toFixed(2)}, plain ${plain.toFixed(2)})`, written, passed: ok };
}
