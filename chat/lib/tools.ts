export interface Facts { household?: number; income_monthly?: number; utility?: "Dominion" | "NOVEC" }
export interface ToolRun { tool: string; ms: number; input?: string; result: string; label?: string | null; decided?: boolean }

const num = (s: string) => Number(s.replace(/[,$\s]/g, ""));

export function extractFacts(text: string, prev: Facts = {}): { facts: Facts; runs: ToolRun[] } {
  const t0 = Date.now();
  const f: Facts = { ...prev };
  const lower = text.toLowerCase();
  const notes: string[] = [];

  const hh = lower.match(/\b(\d{1,2})\s*(?:people|persons?|of us|in (?:my|our|the) (?:home|house|household|family)|person household|-person)\b/) ?? lower.match(/\b(?:household|family) of (\d{1,2})\b/);
  if (hh) { f.household = Number(hh[1]); notes.push(`household ${f.household}`); }
  else if (/\b(me and my (wife|husband|partner|spouse|mom|dad|mother|father|son|daughter|roommate)|my (wife|husband|partner|spouse) and (i|me))\b/.test(lower)) { f.household = 2; notes.push("household 2"); }
  else if (/\b(just me|only me|by myself|i live alone|live alone)\b/.test(lower)) { f.household = 1; notes.push("household 1"); }

  const money = lower.match(/\$?\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k)?\b(?:\s*(?:a|per|\/|each)\s*(month|mo|year|yr|week|wk|hour|hr))?/g) ?? [];
  for (const m of money) {
    const mm = m.match(/\$?\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k)?\b(?:\s*(?:a|per|\/|each)\s*(month|mo|year|yr|week|wk|hour|hr))?/)!;
    let v = num(mm[1]); if (mm[2]) v *= 1000;
    const unit = mm[3];
    const looksLikeIncome = /\b(income|make|earn|bring|take home|salary|paid|pay ?check|a month|per month|a year|per year|monthly|yearly|annual)\b/.test(lower) || mm[2] || m.includes("$");
    if (!looksLikeIncome || v < 200) continue;
    if (unit === "year" || unit === "yr" || (!unit && v > 30000)) v = v / 12;
    else if (unit === "week" || unit === "wk") v = v * 52 / 12;
    else if (unit === "hour" || unit === "hr") v = v * 40 * 52 / 12;
    if (/\b(behind|owe|bill|balance|past due|arrears)\b/.test(lower) && !/\b(income|make|earn|take home|salary|month)\b/.test(lower)) continue;
    f.income_monthly = Math.round(v); notes.push(`income $${f.income_monthly}/mo`);
    break;
  }

  if (/\bnovec\b/.test(lower)) { f.utility = "NOVEC"; notes.push("utility NOVEC"); }
  else if (/\bdominion\b/.test(lower)) { f.utility = "Dominion"; notes.push("utility Dominion"); }

  const runs: ToolRun[] = notes.length ? [{ tool: "facts", ms: Date.now() - t0, input: text.slice(0, 80), result: notes.join(", ") }] : [];
  return { facts: f, runs };
}

export function yesNo(text: string): "Yes" | "No" | null {
  const t = text.trim().toLowerCase();
  if (/\b(bye|goodbye|thanks|thank you|that'?s all|i'?ll call)\b/.test(t) || t.includes("?")) return null;
  if (/^(yes|yeah|yep|yup|ya|sure|correct|right|i do|we do|it is|that's right|true)\b/.test(t)) return "Yes";
  if (/^(no|nope|nah|not really|we don't|i don't|we do not|i do not|never|none)\b/.test(t)) return "No";
  return null;
}

interface Threshold { size: number; monthly: number }
function thresholds(squareText: string): Threshold[] {
  const out: Threshold[] = [];
  for (const m of squareText.matchAll(/(\d{1,2})\s*(?:person|people)\s*\$?\s?([\d,]+)(?:\.\d+)?\s*\/?\s*(mo|month)?/gi)) out.push({ size: Number(m[1]), monthly: num(m[2]) });
  return out.sort((a, b) => a.size - b.size);
}
function limitFor(th: Threshold[], size: number): number | null {
  if (!th.length) return null;
  const exact = th.find((t) => t.size === size); if (exact) return exact.monthly;
  if (th.length >= 2) { const a = th[0], b = th[th.length - 1]; const step = (b.monthly - a.monthly) / (b.size - a.size); return Math.round(a.monthly + step * (size - a.size)); }
  return null;
}

export function incomeCheck(squareText: string, facts: Facts, options: string[]): ToolRun | null {
  if (!/income/i.test(squareText) || !/\$\s?[\d,]{4,}/.test(squareText)) return null;
  const t0 = Date.now();
  const th = thresholds(squareText);
  if (!th.length) return null;
  if (facts.income_monthly == null) return { tool: "math", ms: Date.now() - t0, result: `income limit square (${th.map((t) => `${t.size}p $${t.monthly}`).join(", ")}) but no income stated`, decided: false };
  const size = facts.household ?? 1;
  const limit = limitFor(th, size);
  if (limit == null) return null;
  const under = facts.income_monthly <= limit;
  const label = under ? "Yes" : "No";
  const has = options.some((o) => o.toLowerCase() === label.toLowerCase());
  return { tool: "math", ms: Date.now() - t0, input: `$${facts.income_monthly}/mo, ${size} in home`, result: `$${facts.income_monthly} ${under ? "≤" : ">"} $${limit} limit for ${size}${facts.household == null ? " (size unknown, assumed 1)" : ""} → ${label}${has ? "" : " (no such arrow; taking the fallback)"}`, label: has ? label : null, decided: true };
}
