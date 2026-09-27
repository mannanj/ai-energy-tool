import { nanoid } from "nanoid";
import type { TreeDocument, TreeNode, TreeEdge } from "@/types/tree";

export const NODE_W = 240;
export const NODE_H = 120;
export const ROOT_PLACEHOLDER = "Enter the top level question";
export const TOP_LEVEL_QUESTION =
  "The rates for electricity have increased making it hard to make ends meet, what can I do?";

const now = () => new Date().toISOString();

export function mkNode(treeId: string, partial: Partial<TreeNode> & { x: number; y: number }): TreeNode {
  const t = now();
  return {
    id: nanoid(10),
    treeId,
    text: "",
    width: NODE_W,
    height: NODE_H,
    isRoot: false,
    createdAt: t,
    updatedAt: t,
    ...partial,
  };
}

export function mkEdge(treeId: string, source: string, target: string, label?: string): TreeEdge {
  return { id: nanoid(10), treeId, source, target, label, createdAt: now() };
}

/** Empty canvas: one required root square. */
export function emptyDocument(name = "Rates went up"): TreeDocument {
  const treeId = nanoid(8);
  const root = mkNode(treeId, { x: 0, y: 0, isRoot: true, width: 360, height: 120 });
  const t = now();
  return {
    version: 1,
    tree: { id: treeId, name, rootNodeId: root.id, createdAt: t, updatedAt: t },
    nodes: [root],
    edges: [],
  };
}

/** The Fairfax / Dominion tree from context/decision-tree-assistance.md, top two levels. */
export function exampleDocument(): TreeDocument {
  const doc = emptyDocument("Rates went up (example)");
  const T = doc.tree.id;
  const root = doc.nodes[0];
  root.text = TOP_LEVEL_QUESTION;

  const step0 = mkNode(T, {
    x: 0, y: 220, width: 360,
    text: "Step 0, always first: Do you have a disconnection notice, is your power already off, or does anyone in your home use medical equipment that needs electricity?",
  });
  const urgent = mkNode(T, {
    x: -420, y: 440, height: 150,
    text: "Urgent path. Dominion Energy 866-366-4357 for a payment plan. 2-1-1 Virginia, dial 2-1-1, 24/7. Medical equipment form: demedical@domenergy.com",
  });
  const screener = mkNode(T, {
    x: 0, y: 440, width: 360, height: 170,
    text: "Screener, one at a time: Dominion or NOVEC? How many people in your home? Total monthly income before taxes? Electric heat or other? Behind on the bill, how much? Anyone 60+, 5 or under, disabled, or a veteran? Own or rent?",
  });
  const income = mkNode(T, {
    x: 0, y: 680, width: 360, height: 130,
    text: "Is household income at or under 150% of the federal poverty level? (1 person $1,956/mo, 4 people $4,018/mo, state manual 05/25) https://www.dss.virginia.gov/relief/ea/",
  });
  const cols = [-800, -500, -200, 100, 400, 700];
  const branches = [
    "Branch A: Breathing room from Dominion (any income). Payment plan up to 6 months, Budget Billing. Call 866-366-4357 or dominionenergy.com",
    "Branch B1: PIPP. Pay 10% of income (electric heat) or 6% (other). Apply at commonhelp.virginia.gov. Fairfax DFS 703-324-7500",
    "Branch B2: Virginia Energy Assistance (Fuel opens Oct 13 to Nov 13, Crisis Nov 1 to mid-March, Cooling Jun 15 to Aug 17). commonhelp.virginia.gov or 833-522-5582",
    "Branch C: EnergyShare (no income limit, need disconnection notice or similar). Heating up to $600, Cooling up to $300. Call 2-1-1 or United Community 703-768-7106",
    "Branch D: Local help near 22310. Coordinated Services Planning 703-222-0880. Koinonia 703-971-1991",
    "Branch E: Use less electricity. Weatherization via CHP 888-229-3714. https://www.dhcd.virginia.gov",
  ].map((text, i) => mkNode(T, { x: cols[i], y: 900, width: 280, height: 150, text }));
  const nothing = mkNode(T, {
    x: 1000, y: 900, width: 280, height: 150,
    text: "Nothing matched? Dominion 866-366-4357, CSP 703-222-0880, 2-1-1 Virginia. Fuel Assistance opens Oct 13, 2026.",
  });

  doc.nodes.push(step0, urgent, screener, income, ...branches, nothing);
  doc.edges.push(
    mkEdge(T, root.id, step0.id),
    mkEdge(T, step0.id, urgent.id, "Yes"),
    mkEdge(T, step0.id, screener.id, "No"),
    mkEdge(T, screener.id, income.id),
    mkEdge(T, income.id, branches[0].id, "Either"),
    mkEdge(T, income.id, branches[1].id, "Yes"),
    mkEdge(T, income.id, branches[2].id, "Yes"),
    mkEdge(T, income.id, branches[3].id, "Either"),
    mkEdge(T, income.id, branches[4].id, "Either"),
    mkEdge(T, income.id, branches[5].id, "Either"),
    mkEdge(T, income.id, nothing.id),
  );
  return doc;
}
