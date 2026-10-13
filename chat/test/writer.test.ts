import { describe, expect, test } from "bun:test";
import { codeCheck, longestSentence, longSentences, MAX_SENTENCE_WORDS, withoutTeamLabel } from "../lib/writer";

const facts = "Call Dominion at 866-366-4357 or sign in at dominionenergy.com. For 4 people the limit is $4,018/mo. Apply at commonhelp.virginia.gov.";
describe("codeCheck", () => {
  test("accepts a faithful rewording", () => {
    expect(codeCheck(facts, "You can call Dominion at **866-366-4357** or use dominionenergy.com. With 4 people the limit is $4,018 a month.", "").ok).toBe(true);
  });
  test("rejects a number not in the square", () => {
    expect(codeCheck(facts, "Call 703-222-0880 for help.", "").reason).toMatch(/number not in square/);
  });
  test("allows a number already in the conversation, including $7k style", () => {
    expect(codeCheck(facts, "Since you make $3,600 a month you are under the limit.", "we make about $3,600 a month").ok).toBe(true);
    expect(codeCheck(facts, "At $7,000 a month you are over the limit.", "about $7k a month").ok).toBe(true);
    expect(codeCheck(facts, "You are under 150% of the poverty level.", "Helper: Is your income at or under 150% of the federal poverty level?").ok).toBe(true);
    expect(codeCheck(facts, "Since you make $3,600 a month you are under the limit.", "").ok).toBe(false);
  });
  test("rejects a link not in the square, ignoring bold markers", () => {
    expect(codeCheck(facts, "Go to **dominionenergy.com**.", "").ok).toBe(true);
    expect(codeCheck(facts, "Go to 211virginia.org.", "").reason).toMatch(/link not in square/);
  });
  test("normalizes a leading 1 on phone numbers", () => {
    expect(codeCheck(facts, "Call 1-866-366-4357.", "").ok).toBe(true);
  });
  test("rejects leaked tags and runaway length", () => {
    expect(codeCheck(facts, "Call 866-366-4357 [src: x.pdf]", "").reason).toBe("leaked tag");
    expect(codeCheck(facts, "Call 866-366-4357. " + "Plain words. ".repeat(120), "").reason).toBe("too long");
  });
});

describe("team labels", () => {
  test("rejects a reply that names a branch, in English or Spanish", () => {
    expect(codeCheck(facts, "Branch A: call Dominion at 866-366-4357.", "").reason).toBe("team label");
    expect(codeCheck(facts, "Rama B1: llame al 866-366-4357.", "").reason).toBe("team label");
    expect(codeCheck(facts, "A branch office can help. Call 866-366-4357.", "").ok).toBe(true);
  });
  test("strips the label at the start of a square", () => {
    expect(withoutTeamLabel("Branch B1: PIPP. Pay 10% of income.")).toBe("PIPP. Pay 10% of income.");
    expect(withoutTeamLabel("Step 0, always first: Do you have a disconnection notice?")).toBe("Do you have a disconnection notice?");
    expect(withoutTeamLabel("Screener, one at a time: Dominion or NOVEC?")).toBe("Dominion or NOVEC?");
    expect(withoutTeamLabel("Urgent path. Dominion Energy 866-366-4357.")).toBe("Dominion Energy 866-366-4357.");
    expect(withoutTeamLabel("Is household income at or under 150%?")).toBe("Is household income at or under 150%?");
  });
});

describe("longestSentence", () => {
  test("counts words in the longest sentence", () => {
    expect(longestSentence("Is your income under the limit? That is $1,956 a month for one person.")).toBe(8);
  });
  test("does not split on links, prices or phone numbers", () => {
    expect(longestSentence("Call 866-366-4357 or go to dominionenergy.com today. It is $4,018.50 a month.")).toBe(7);
  });
  test("treats list lines as separate sentences", () => {
    expect(longestSentence("Bring these:\n- a photo ID\n- your latest bill")).toBe(3);
  });
  test("flags the long sentence from the live test chat", () => {
    const reply = "That income is above the limit for most help programs, but Dominion has options open to any income. You can set up a payment plan for up to 6 months, or switch to Budget Billing to spread costs evenly.";
    expect(longestSentence(reply)).toBeGreaterThan(MAX_SENTENCE_WORDS);
  });
  test("ignores bullets and stray punctuation as words", () => {
    expect(longestSentence("- Call now — today.")).toBe(3);
  });
});

describe("longSentences", () => {
  test("returns only the sentences over the limit", () => {
    const long = "You may qualify for help paying your bill if your household income is at or under 150% of the federal poverty level.";
    expect(longSentences(`${long} That is $1,956 a month for one person.`)).toEqual([long]);
  });
});
