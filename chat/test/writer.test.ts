import { describe, expect, test } from "bun:test";
import { codeCheck } from "../lib/writer";

const facts = "Call Dominion at 866-366-4357 or sign in at dominionenergy.com. For 4 people the limit is $4,018/mo. Apply at commonhelp.virginia.gov.";
describe("codeCheck", () => {
  test("accepts a faithful rewording", () => {
    expect(codeCheck(facts, "You can call Dominion at **866-366-4357** or use dominionenergy.com. With 4 people the limit is $4,018 a month.", "").ok).toBe(true);
  });
  test("rejects a number not in the square", () => {
    expect(codeCheck(facts, "Call 703-222-0880 for help.", "").reason).toMatch(/number not in square/);
  });
  test("allows a number the resident said", () => {
    expect(codeCheck(facts, "Since you make $3,600 a month you are under the limit.", "we make about $3,600 a month").ok).toBe(true);
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
