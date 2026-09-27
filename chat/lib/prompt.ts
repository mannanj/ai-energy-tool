/**
 * Builds the assistant's system prompt: rules (context/system-prompt.md) + the sourced decision tree
 * (context/decision-tree-assistance.md) + today's date. Nothing else. No web search, no database.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../..");
export const RULES_PATH = resolve(ROOT, "context/system-prompt.md");
export const TREE_PATH = process.env.TREE_FILE ? resolve(process.env.TREE_FILE) : resolve(ROOT, "context/decision-tree-assistance.md");

export function loadRules(): string {
  return readFileSync(RULES_PATH, "utf8");
}

export function loadTree(): string {
  const raw = readFileSync(TREE_PATH, "utf8");
  // Drop the team's internal to-do list; it is not resident-facing knowledge.
  const cut = raw.indexOf("## Open items for the team");
  return cut > 0 ? raw.slice(0, cut).trimEnd() : raw;
}

export function todayLine(d = new Date()): string {
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" });
}

export function buildSystemPrompt(date = new Date()): string {
  return [
    loadRules().trim(),
    "",
    "## How to use the tree below",
    "- The tree is your only source of program facts. A fact marked VERIFIED can be stated. A fact marked CHECK can be stated with \"confirm with the agency\". A fact marked UNVERIFIED must not be stated as fact.",
    "- Never show the reader the source tags like [src: file.pdf] or the words VERIFIED / CHECK / UNVERIFIED. They are for you, not for them.",
    "- Keep each reply short: two to five short sentences, or a short list. One question per reply.",
    "- Follow the order of the tree: Step 0 (urgent?) first, then the screener one question at a time, then the branch that fits.",
    "- Do not ask a screener question whose answer the person already gave.",
    "- When you give a phone number or link, copy it exactly from the tree.",
    "",
    `Today is ${todayLine(date)}.`,
    "",
    "---",
    "",
    "# The decision tree (your entire knowledge base)",
    "",
    loadTree(),
  ].join("\n");
}
