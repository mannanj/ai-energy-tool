import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const lib = (f: string) => resolve(import.meta.dir, "../lib", f);
interface Mutant { file: string; find: string; replace: string; why: string }
const MUTANTS: Mutant[] = [
  { file: "tree.ts", find: '/^(either|any|all|always)$/i', replace: '/^(either)$/i', why: "ride-along synonyms" },
  { file: "tree.ts", find: 'if (!l) return label == null;', replace: 'if (!l) return true;', why: "unlabeled fallback always taken" },
  { file: "tree.ts", find: 'if (isEither(e)) return true;', replace: 'if (isEither(e)) return false;', why: "ride-alongs dropped" },
  { file: "tree.ts", find: 'l.toLowerCase() === label.toLowerCase()', replace: 'l === label', why: "label match case-sensitive" },
  { file: "tree.ts", find: 'if (!hasLabels) return true;', replace: 'if (!hasLabels) return false;', why: "plain continuation broken" },
  { file: "tree.ts", find: 'export const isHole = (n: TreeNode) => !n.text.trim();', replace: 'export const isHole = (n: TreeNode) => !n.text;', why: "whitespace-only square not a hole" },
  { file: "tree.ts", find: 'e.source === e.target) continue;', replace: 'false) continue;', why: "dangling/self arrows kept" },
  { file: "tree.ts", find: 'unreachable: this.doc.nodes.filter((n) => !seen.has(n.id))', replace: 'unreachable: this.doc.nodes.filter((n) => seen.has(n.id))', why: "unreachable inverted" },
  { file: "tree.ts", find: 'if (ids.has(n.id)) errors.push', replace: 'if (false) errors.push', why: "duplicate ids allowed" },
  { file: "turn.ts", find: 'if (!r.onTopic) {', replace: 'if (false) {', why: "off-topic opener not declined" },
  { file: "turn.ts", find: 'else if (r.bye && !r.label) {', replace: 'else if (r.bye) {', why: "goodbye+answer loses the answer" },
  { file: "turn.ts", find: 's.misses >= 2 && fallback.length', replace: 's.misses >= 1 && fallback.length', why: "fallback on first miss" },
  { file: "turn.ts", find: 'if (r.offTopic) spoken.push(DECLINE_REPLY', replace: 'if (false) spoken.push(DECLINE_REPLY', why: "mid-chat off-topic ignored" },
  { file: "turn.ts", find: 'finish(leaves.some((n) => isHole(n)) ? "hole" : "answer")', replace: 'finish("answer")', why: "hole not recorded" },
  { file: "turn.ts", find: 'const leaves = targets.filter((n) => T.isLeaf(n.id));', replace: 'const leaves = targets.filter((n) => T.isLeaf(n.id)).slice(0, 1);', why: "only first leaf spoken" },
  { file: "turn.ts", find: 'if (first) s.misses = 0;', replace: '', why: "re-walk keeps stale misses" },
  { file: "turn.ts", find: 'const finish = (why: string) => { s.ended_reason = why; s.nodeId = null; };', replace: 'const finish = (why: string) => { s.ended_reason = why; };', why: "outcome keeps the old position" },
  { file: "turn.ts", find: 'if (math?.decided && math.label) {', replace: 'if (false) {', why: "re-walk asks what the facts already answer" },
  { file: "turn.ts", find: 'if (rewalk && r.bye && !r.onTopic) {', replace: 'if (false) {', why: "thanks after an outcome declined" },
  { file: "turn.ts", find: 'if (!cur) {', replace: 'if (false) {', why: "tree change crashes" },
  { file: "writer.ts", find: '...digits(conversation)]', replace: '...digits("")]', why: "resident's own numbers rejected" },
  { file: "writer.ts", find: 'return { ok: false, reason: "leaked tag" };', replace: 'return { ok: true };', why: "leaked tags pass" },
  { file: "writer.ts", find: 'reply.length > Math.max(900, facts.length * 2.2)', replace: 'false', why: "no length cap" },
];

const orig = new Map<string, string>();
let killed = 0; const survived: Mutant[] = [];
for (const m of MUTANTS) {
  const p = lib(m.file);
  if (!orig.has(p)) orig.set(p, readFileSync(p, "utf8"));
  const src = orig.get(p)!;
  if (!src.includes(m.find)) { console.log(`?? cannot apply (${m.why}): pattern not found in ${m.file}`); continue; }
  writeFileSync(p, src.replace(m.find, m.replace));
  const r = Bun.spawnSync(["bun", "test"], { cwd: resolve(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" });
  writeFileSync(p, src);
  const ok = r.exitCode === 0;
  if (ok) survived.push(m); else killed++;
  console.log(`${ok ? "SURVIVED" : "killed  "}  ${m.file}: ${m.why}`);
}
console.log(`\n${killed}/${killed + survived.length} mutants killed`);
if (survived.length) { console.log("survivors (tests do not detect these):"); for (const m of survived) console.log("  -", m.file, m.why); process.exit(1); }
