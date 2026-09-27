import type { DerivedNode, NodeId, TreeDocument } from "@/types/tree";
import { extractLinks } from "./links";

/** Compute the tree view (depth, parents, children, numbering, roles) from squares + arrows only. */
export function deriveTree(doc: TreeDocument): Map<NodeId, DerivedNode> {
  const parents = new Map<NodeId, NodeId[]>();
  const children = new Map<NodeId, NodeId[]>();
  for (const n of doc.nodes) {
    parents.set(n.id, []);
    children.set(n.id, []);
  }
  for (const e of doc.edges) {
    if (!parents.has(e.target) || !children.has(e.source)) continue;
    parents.get(e.target)!.push(e.source);
    children.get(e.source)!.push(e.target);
  }
  // sort children by canvas position (left→right, then top→bottom) so numbering is stable and visual
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  for (const [, kids] of children) {
    kids.sort((a, b) => {
      const na = byId.get(a)!, nb = byId.get(b)!;
      return na.x - nb.x || na.y - nb.y;
    });
  }

  const out = new Map<NodeId, DerivedNode>();
  const visit = (id: NodeId, depth: number, number: string) => {
    if (out.has(id)) return; // cycle guard / diamond guard
    const node = byId.get(id)!;
    const links = extractLinks(node.text);
    const role = links.length && !node.text.trim().endsWith("?") && depth > 0
      ? "source"
      : node.isRoot || /\?\s*$/.test(node.text.trim()) ? "question" : "answer";
    out.set(id, { node, depth, parentIds: parents.get(id)!, childIds: children.get(id)!, links, role, number });
    children.get(id)!.forEach((c, i) => visit(c, depth + 1, `${number}.${i + 1}`));
  };
  visit(doc.tree.rootNodeId, 0, "1");
  // orphans (not reachable from root)
  let k = 1;
  for (const n of doc.nodes) if (!out.has(n.id)) visit(n.id, 0, `?${k++}`);
  return out;
}

/** Depth-first ordered list for the panel. */
export function orderedNodes(derived: Map<NodeId, DerivedNode>, rootId: NodeId): DerivedNode[] {
  const list: DerivedNode[] = [];
  const seen = new Set<NodeId>();
  const walk = (id: NodeId) => {
    if (seen.has(id)) return;
    seen.add(id);
    const d = derived.get(id);
    if (!d) return;
    list.push(d);
    d.childIds.forEach(walk);
  };
  walk(rootId);
  for (const d of derived.values()) if (!seen.has(d.node.id)) walk(d.node.id);
  return list;
}

export function toMarkdown(list: DerivedNode[]): string {
  return list
    .map((d) => `${"  ".repeat(d.depth)}- [${d.number}] ${d.node.text.trim() || "(empty)"}`)
    .join("\n");
}
