import { describe, expect, test } from "bun:test";
import { Tree, validate, isHole, type TreeDocument } from "../lib/tree";

export function fixture(): TreeDocument {
  const n = (id: string, text: string, isRoot = false) => ({ id, text, x: 0, y: 0, width: 240, height: 120, isRoot });
  const e = (id: string, source: string, target: string, label?: string) => ({ id, source, target, label });
  return {
    version: 1, tree: { id: "t", name: "fixture", rootNodeId: "root", updatedAt: "2026-09-27T00:00:00Z" },
    nodes: [n("root", "The rates went up, what can I do?", true), n("q", "Do you have a notice?"), n("a", "Answer A"), n("b", "Answer B"), n("c", "Step C: how many people?"), n("d", "Ride-along D"), n("fb", "Nothing matched"), n("hole", ""), n("orphan", "Unreachable")],
    edges: [e("e0", "root", "q"), e("e1", "q", "a", "Yes"), e("e2", "q", "b", "Yes"), e("e3", "q", "c", "No"), e("e4", "q", "d", "Either"), e("e5", "q", "fb"), e("e6", "c", "hole", "any number"), e("e7", "c", "missing", "x"), e("e8", "c", "c", "loop")],
  };
}

describe("Tree", () => {
  const T = new Tree(fixture());
  test("root and continuation with no labels selects every child", () => {
    expect(T.root.id).toBe("root");
    expect(T.select("root", null).map((n) => n.id)).toEqual(["q"]);
  });
  test("options exclude Either and unlabeled arrows, group same label", () => {
    const o = T.options("q");
    expect(o.map((x) => x.label)).toEqual(["Yes", "No"]);
    expect(o[0].targets.map((t) => t.id)).toEqual(["a", "b"]);
  });
  test("picking a label takes its arrows plus ride-alongs, never the fallback", () => {
    expect(T.select("q", "yes").map((n) => n.id).sort()).toEqual(["a", "b", "d"]);
    expect(T.select("q", "No").map((n) => n.id).sort()).toEqual(["c", "d"]);
  });
  test("nothing matched takes the unlabeled fallback plus ride-alongs", () => {
    expect(T.select("q", null).map((n) => n.id).sort()).toEqual(["d", "fb"]);
  });
  test("leaves, holes, unreachable, dangling and self arrows", () => {
    const r = T.report();
    expect(r.holes).toEqual(["hole"]);
    expect(r.unreachable).toEqual(["orphan"]);
    expect(r.leaves.sort()).toEqual(["a", "b", "d", "fb", "hole", "orphan"]);
    expect(T.children("c").map((e) => e.id)).toEqual(["e6"]);
    expect(isHole(T.node("hole")!)).toBe(true);
    expect(T.isLeaf("c")).toBe(false);
  });
  test("ride-along synonyms and a whitespace-only hole", () => {
    const d = fixture(); d.edges[4].label = "any"; d.nodes[7].text = "   \n ";
    const T2 = new Tree(d);
    expect(T2.select("q", "No").map((n) => n.id).sort()).toEqual(["c", "d"]);
    expect(T2.options("q").map((o) => o.label)).toEqual(["Yes", "No"]);
    for (const l of ["all", "Always", "ANY"]) { d.edges[4].label = l; expect(new Tree(d).select("q", "Yes").some((n) => n.id === "d")).toBe(true); }
    expect(T2.report().holes).toEqual(["hole"]);
  });
  test("validate rejects garbage and duplicates, warns on holes and dangling arrows", () => {
    expect(validate(null).errors.length).toBe(1);
    expect(validate({ tree: {}, nodes: [], edges: [] }).errors).toContain("no root square");
    const d = fixture(); d.nodes.push({ ...d.nodes[1] });
    expect(validate(d).errors.some((x) => x.startsWith("duplicate"))).toBe(true);
    const v = validate(fixture());
    expect(v.errors).toEqual([]);
    expect(v.warnings.some((w) => w.includes("hole"))).toBe(true);
    expect(v.warnings.some((w) => w.includes("missing square"))).toBe(true);
    expect(() => new Tree(d)).toThrow(/bad tree/);
  });
});
