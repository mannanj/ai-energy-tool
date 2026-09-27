import { describe, expect, test } from "bun:test";
import { extractFacts, incomeCheck, yesNo } from "../lib/tools";

const SQUARE = "Is household income at or under 150% of the federal poverty level? (1 person $1,956/mo, 4 people $4,018/mo, state manual 05/25)";

describe("yesNo", () => {
  test("reads plain answers", () => {
    expect(yesNo("No, we make way more than that.")).toBe("No");
    expect(yesNo("yes I do")).toBe("Yes");
    expect(yesNo("Dominion Energy handles our bill")).toBeNull();
    expect(yesNo("No thanks, bye")).toBeNull();
    expect(yesNo("no? what do you mean")).toBeNull();
  });
});

describe("extractFacts", () => {
  test("household from 'me and my husband'", () => { expect(extractFacts("Just me and my husband.").facts.household).toBe(2); });
  test("household from a count", () => { expect(extractFacts("4 people live here").facts.household).toBe(4); });
  test("income 7k a month", () => { expect(extractFacts("No, we make way more than that. About 7k a month.").facts.income_monthly).toBe(7000); });
  test("income yearly is divided by 12", () => { expect(extractFacts("I make $60,000 a year").facts.income_monthly).toBe(5000); });
  test("a balance owed is not income", () => { expect(extractFacts("we are about $350 behind").facts.income_monthly).toBeUndefined(); });
  test("keeps earlier facts", () => { expect(extractFacts("Dominion", { household: 2 }).facts).toEqual({ household: 2, utility: "Dominion" }); });
});

describe("incomeCheck", () => {
  test("over the interpolated 2-person limit says No, falls back when no No arrow", () => {
    const r = incomeCheck(SQUARE, { household: 2, income_monthly: 7000 }, ["Yes"]);
    expect(r?.decided).toBe(true); expect(r?.label).toBeNull(); expect(r?.result).toContain("> $2,643".replace(",", ""));
  });
  test("under the limit says Yes", () => {
    const r = incomeCheck(SQUARE, { household: 4, income_monthly: 3600 }, ["Yes", "No"]);
    expect(r?.label).toBe("Yes");
  });
  test("income without household size is left to the reader unless certain", () => {
    expect(incomeCheck(SQUARE, { income_monthly: 3600 }, ["Yes"])?.decided).toBe(false);
    expect(incomeCheck(SQUARE, { income_monthly: 1500 }, ["Yes"])?.label).toBe("Yes");
    expect(incomeCheck(SQUARE, { income_monthly: 9000 }, ["Yes"])?.decided).toBe(true);
  });
  test("no income yet: not decided", () => { expect(incomeCheck(SQUARE, { household: 2 }, ["Yes"])?.decided).toBe(false); });
  test("not an income square", () => { expect(incomeCheck("Dominion or NOVEC?", { income_monthly: 1 }, ["Dominion"])).toBeNull(); });
});
