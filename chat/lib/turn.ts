import { addMessage, createChat, getChat, getMessages, getState, setState, type Chat } from "./db";
import { read as defaultRead, readerName, translate, type Read, type Option } from "./judge";
export type Reader = (text: string, said: string, options: Option[], first: boolean) => Promise<Read>;
import { withoutTeamLabel, writeReviewed, type Draft, type Review } from "./writer";
import { activePrompt } from "./prompts";
import { DECLINE_REPLY, HOLE_REPLY, Tree, fetchWorkerTree, isHole, loadTree, workerEnabled, type TreeNode } from "./tree";
import { host } from "./host";
import { extractFacts, incomeCheck, isTrick, yesNo, type Facts, type ToolRun } from "./tools";

const MODEL = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash";
export const READER = readerName;

let cached: { tree: Tree; source: string; path: string; mtime: number } | null = null;
export function tree(): Tree {
  if (workerEnabled() && cached?.source === "worker") return cached.tree;
  const { doc, source, path } = loadTree();
  const mtime = host().mtime(path);
  if (!cached || cached.path !== path || cached.mtime !== mtime) cached = { tree: new Tree(doc), source, path, mtime };
  return cached.tree;
}
export async function ensureTree(): Promise<Tree> {
  if (workerEnabled()) {
    try {
      const doc = await fetchWorkerTree();
      if (!cached || cached.source !== "worker" || cached.tree.doc.tree.updatedAt !== doc.tree.updatedAt || cached.tree.doc.nodes.length !== doc.nodes.length || cached.tree.doc.edges.length !== doc.edges.length) cached = { tree: new Tree(doc), source: "worker", path: "worker", mtime: 0 };
      return cached.tree;
    } catch (e) { if (cached) return cached.tree; console.error("Worker tree unavailable, using file:", (e as Error).message); }
  }
  return tree();
}
export const treeSource = () => (cached ?? (tree(), cached!)).source;

export interface State { nodeId: string | null; path: string[]; done: boolean; ended_reason?: string; language?: string; misses?: number; facts?: Facts; }
export interface Trace { tools: ToolRun[]; read?: { reader: string; ms: number; skipped?: boolean }; write?: { ms: number; attempts: number; used: string }; total_ms: number }
export interface TurnResult { chatId: string; reply: string; verbatim: string; review: Review | null; status: "open" | "done"; state: State; nodeIds: string[]; read: unknown; trace?: Trace }

const NOT_HEARD = "Sorry, I didn't catch that. ";
const meaning = (targets: TreeNode[]) => targets.map((t) => (isHole(t) ? "(unfilled square)" : t.text.replace(/\s+/g, " ").slice(0, 160))).join(" | ");

export const TREE_CHANGED = "The tree behind this chat changed, so I'll start again from the top. Tell me what's going on with your electric bill.";
export const GOODBYE = "Okay. If it gets tight, call 2-1-1 (24/7) for local help. Take care.";

export async function runTurn(chatId: string | null, text: string, opts: { source?: string; scenario?: string; parentId?: string; parentSeq?: number; verbatimOnly?: boolean; reader?: Reader } = {}): Promise<TurnResult> {
  const read = opts.reader ?? defaultRead;
  const T = await ensureTree();
  let chat: Chat | null = chatId ? getChat(chatId) : null;
  if (!chat) chat = createChat({ model: MODEL, systemPrompt: `tree ${T.doc.tree.id} updated ${T.doc.tree.updatedAt} (${treeSource()}); reader ${READER()}; writer ${MODEL}; prompt ${activePrompt().id} ${activePrompt().title}`, source: opts.source, scenario: opts.scenario, parentId: opts.parentId, parentSeq: opts.parentSeq, treeUpdatedAt: T.doc.tree.updatedAt });
  const s: State = { nodeId: null, path: [], ...getState<Partial<State>>(chat.id), done: false };
  if (!Array.isArray(s.path)) s.path = [];
  addMessage(chat.id, "user", text);

  const first = s.nodeId == null;
  const rewalk = first && s.path.length > 0;
  if (first) s.misses = 0;
  const cur = first ? T.root : T.node(s.nodeId!);
  if (!cur) {
    s.nodeId = null; s.ended_reason = "tree_changed"; setState(chat.id, s, "open");
    addMessage(chat.id, "assistant", TREE_CHANGED, null, { verbatim: TREE_CHANGED });
    return { chatId: chat.id, reply: TREE_CHANGED, verbatim: TREE_CHANGED, review: null, status: "open", state: s, nodeIds: [], read: null };
  }
  const opts_ = T.options(cur.id).map((o) => ({ label: o.label, meaning: meaning(o.targets) }));
  const t0 = Date.now();
  const trace: Trace = { tools: [], total_ms: 0 };
  const fx = extractFacts(text, s.facts ?? {}); s.facts = fx.facts; trace.tools.push(...fx.runs);
  let decided: { label: string | null } | null = null;
  if (!first && opts_.length) {
    const labels = opts_.map((o) => o.label);
    const math = incomeCheck(cur.text, s.facts, labels);
    if (math) { trace.tools.push(math); if (math.decided) decided = { label: math.label ?? null }; }
    if (!decided) {
      const yn = yesNo(text);
      const isYesNo = labels.some((l) => /^(yes|no)$/i.test(l));
      if (yn && isYesNo) {
        const has = labels.some((l) => l.toLowerCase() === yn.toLowerCase());
        trace.tools.push({ tool: "yes/no", ms: 0, input: text.slice(0, 40), result: `${yn}${has ? "" : " (no such arrow; taking the fallback)"}`, label: has ? yn : null, decided: true });
        decided = { label: has ? yn : null };
      }
    }
  }
  let r: Read;
  if (decided) { r = { label: decided.label, onTopic: true, offTopic: false, bye: false, language: s.language ?? "en" }; trace.read = { reader: "tools", ms: 0, skipped: true }; }
  else { const t1 = Date.now(); r = await read(text, cur.text, first ? [] : opts_, first); trace.read = { reader: READER(), ms: Date.now() - t1 }; }
  if (r.language && r.language !== "other") s.language = r.language;
  if (!first && r.label != null && isTrick(text)) { trace.tools.push({ tool: "guard", ms: 0, input: text.slice(0, 60), result: `instruction or trick, not an answer; ignoring reader label ${r.label}`, label: null, decided: true }); r = { ...r, label: null, bye: false }; }
  const decidedFallback = !!decided && decided.label == null;

  const spoken: string[] = []; const nodeIds: string[] = [];
  const say = (n: TreeNode) => { nodeIds.push(n.id); s.path.push(n.id); spoken.push(isHole(n) ? HOLE_REPLY : withoutTeamLabel(n.text.trim())); };
  const finish = (why: string) => { s.ended_reason = why; s.nodeId = null; };
  const go = (targets: TreeNode[]) => advance(T, targets, s, say, finish, trace.tools);

  if (first) {
    if (rewalk && r.bye && !r.onTopic) { spoken.push(GOODBYE); finish("resident_ended"); }
    else if (!r.onTopic && r.offTopic) { spoken.push(DECLINE_REPLY); finish("off_topic"); }
    else { s.path.push(cur.id); nodeIds.push(cur.id); go(T.select(cur.id, null)); }
  } else if (r.bye && !r.label) {
    spoken.push(GOODBYE); finish("resident_ended");
  } else if (opts_.length && r.label == null) {
    const fallback = T.select(cur.id, null).filter((n) => !T.children(cur.id).some((e) => e.target === n.id && (e.label?.trim() && !/^(either|any|all|always)$/i.test(e.label))));
    if (decidedFallback && fallback.length) go(fallback);
    else {
      const looksLikeAnswer = !/[?]|\b(can you|could you|would you|please|write|tell me|ignore|instructions|prompt|test mode|developer)\b/i.test(text) && text.trim().split(/\s+/).length <= 15;
      if (looksLikeAnswer) s.misses = (s.misses ?? 0) + 1;
      if (r.offTopic) spoken.push(DECLINE_REPLY + "\n\nBack to your electric bill. " + withoutTeamLabel(cur.text.trim()));
      else if ((s.misses ?? 0) >= 2 && fallback.length) go(fallback);
      else spoken.push(NOT_HEARD + withoutTeamLabel(cur.text.trim()));
    }
  } else {
    go(T.select(cur.id, r.label));
  }

  const verbatim = spoken.join("\n\n");
  let reply = verbatim; let rev: Review | null = null; let drafts: Draft[] = [];
  const fixed = [DECLINE_REPLY, HOLE_REPLY, TREE_CHANGED, GOODBYE];
  const isFixed = fixed.includes(verbatim.trim()) || spoken.every((x) => fixed.includes(x.trim()));
  if (!opts.verbatimOnly && verbatim.trim() && !isFixed) {
    const kind = s.nodeId == null ? "answer" : "step";
    const t2 = Date.now();
    try {
      const history = getMessages(chat.id).map((m) => ({ role: m.role, content: m.content }));
      const out = await writeReviewed(verbatim, history, kind, history.map((m) => m.content).join("\n"));
      drafts = out.drafts; rev = { ...out, drafts: undefined } as Review;
      if (rev.used === "written" && rev.written) reply = rev.written;
    } catch (e) { rev = { used: "verbatim", code_ok: false, reason: "writer error: " + (e as Error).message }; }
    trace.write = { ms: Date.now() - t2, attempts: drafts.length, used: rev?.used ?? "verbatim" };
  }
  const language = s.language ?? "en";
  if (!opts.verbatimOnly && language !== "en" && reply === verbatim && verbatim.trim()) {
    const t3 = Date.now();
    try { reply = await translate(verbatim, language); trace.tools.push({ tool: "translate", ms: Date.now() - t3, input: language, result: "translated the tree's own words" }); }
    catch (e) { trace.tools.push({ tool: "translate", ms: Date.now() - t3, input: language, result: "failed: " + (e as Error).message }); }
  }
  trace.total_ms = Date.now() - t0;
  setState(chat.id, s, "open");
  addMessage(chat.id, "assistant", reply, nodeIds.join(","), { verbatim, review: rev, drafts, trace });
  return { chatId: chat.id, reply, verbatim, review: rev, status: "open", state: s, nodeIds, read: r.raw ?? r, trace };
}

function advance(T: Tree, targets: TreeNode[], s: State, say: (n: TreeNode) => void, finish: (why: string) => void, tools: ToolRun[], hops = 0) {
  if (!targets.length) { say({ id: "__dead_end__", text: "" } as TreeNode); finish("dead_end"); s.nodeId = null; return; }
  const steps = targets.filter((n) => !T.isLeaf(n.id));
  const leaves = targets.filter((n) => T.isLeaf(n.id));
  for (const n of leaves) say(n);
  if (steps.length) {
    const next = steps[0];
    const labels = T.options(next.id).map((o) => o.label);
    const math = hops < 10 && labels.length ? incomeCheck(next.text, s.facts ?? {}, labels) : null;
    if (math?.decided && math.label) {
      tools.push(math); s.path.push(next.id);
      advance(T, T.select(next.id, math.label), s, say, finish, tools, hops + 1);
      return;
    }
    say(next); s.nodeId = next.id;
  } else {
    s.nodeId = null; finish(leaves.some((n) => isHole(n)) ? "hole" : "answer");
  }
}
