import { db, getMessages, listChats } from "../lib/db";
import { fetchWorkerTree, workerEnabled, HOLE_REPLY, DECLINE_REPLY } from "../lib/tree";
import { codeCheck } from "../lib/writer";

if (!workerEnabled()) { console.error("WORKER_ORIGIN not set; this checks the live Worker tree"); process.exit(2); }
const live = await fetchWorkerTree();
const sq = new Map(live.nodes.map((n) => [n.id, n]));
console.log(`live tree ${live.tree.id} updated ${live.tree.updatedAt}: ${live.nodes.length} squares, ${live.edges.length} arrows`);
let checks = 0, fails = 0;
const fail = (m: string) => { fails++; console.log("FAIL " + m); };
for (const c of listChats({ sharedOnly: false })) {
  const msgs = getMessages(c.id);
  checks++; if (c.tree_updated_at !== live.tree.updatedAt) fail(`${c.scenario} ${c.id}: chat ran on tree ${c.tree_updated_at}, live is ${live.tree.updatedAt}`);
  let convo = "";
  for (const m of msgs) {
    if (m.role === "user") { convo += "\n" + m.content; continue; }
    const ids = m.node_id ? m.node_id.split(",") : [];
    const facts = ids.filter((id) => id !== live.tree.rootNodeId).map((id) => sq.get(id)?.text.trim() ?? `<missing ${id}>`).join("\n\n");
    if (ids.length) {
      checks++; for (const id of ids) if (!sq.has(id)) fail(`${c.scenario} #${m.seq}: square ${id} not in live tree`);
      checks++; const v = (m.verbatim ?? "").replace(/^Sorry, I didn't catch that\. /, "");
      if (v !== facts && v !== HOLE_REPLY) fail(`${c.scenario} #${m.seq}: FACTS given to the writer differ from the live square\n   writer got: ${v.slice(0, 80)}\n   live says:  ${facts.slice(0, 80)}`);
    } else {
      checks++; if (![DECLINE_REPLY, HOLE_REPLY].includes(m.verbatim ?? "") && !/didn't catch that|has ended|call 2-1-1/.test(m.verbatim ?? "")) fail(`${c.scenario} #${m.seq}: reply with no square is not a known fixed line: ${(m.verbatim ?? "").slice(0, 60)}`);
    }
    checks++; const cc = codeCheck(m.verbatim ?? "", m.content, convo); if (!cc.ok) fail(`${c.scenario} #${m.seq}: resident saw ${cc.reason}`);
    convo += "\n" + m.content;
  }
  console.log(`ok   ${c.scenario} ${c.id}: ${msgs.filter((m) => m.role === "assistant").length} replies traced to live squares`);
}
console.log(`${checks} checks, ${fails} failures`);
db.close();
process.exit(fails ? 1 : 0);
