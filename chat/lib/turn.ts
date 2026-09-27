import { addMessage, createChat, getChat, getMessages, getState, setState, type Chat } from "./db";
import { read as defaultRead, readerName, translate, type Read, type Option } from "./judge";
export type Reader = (text: string, said: string, options: Option[], first: boolean) => Promise<Read>;
import { writeReviewed, type Draft, type Review } from "./writer";
import { activePrompt } from "./prompts";
import { DECLINE_REPLY, HOLE_REPLY, Tree, fetchWorkerTree, isHole, loadTree, workerEnabled, type TreeNode } from "./tree";

const MODEL = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash";
export const READER = readerName;

let cached: { tree: Tree; source: string; path: string; mtime: number } | null = null;
export function tree(): Tree {
  if (workerEnabled() && cached?.source === "worker") return cached.tree;
  const { doc, source, path } = loadTree();
  const mtime = Bun.file(path).lastModified;
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

export interface State { nodeId: string | null; path: string[]; done: boolean; ended_reason?: string; language?: string; misses?: number; }
export interface TurnResult { chatId: string; reply: string; verbatim: string; review: Review | null; status: "open" | "done"; state: State; nodeIds: string[]; read: unknown }

const NOT_HEARD = "Sorry, I didn't catch that. ";
const meaning = (targets: TreeNode[]) => targets.map((t) => (isHole(t) ? "(unfilled square)" : t.text.replace(/\s+/g, " ").slice(0, 160))).join(" | ");

export const TREE_CHANGED = "The tree behind this chat changed since it started, so I can't continue it. Start a new chat and I'll go from the top.";

export async function runTurn(chatId: string | null, text: string, opts: { source?: string; scenario?: string; parentId?: string; parentSeq?: number; verbatimOnly?: boolean; reader?: Reader } = {}): Promise<TurnResult> {
  const read = opts.reader ?? defaultRead;
  const T = await ensureTree();
  let chat: Chat | null = chatId ? getChat(chatId) : null;
  if (!chat) chat = createChat({ model: MODEL, systemPrompt: `tree ${T.doc.tree.id} updated ${T.doc.tree.updatedAt} (${treeSource()}); reader ${READER()}; writer ${MODEL}; prompt ${activePrompt().id} ${activePrompt().title}`, source: opts.source, scenario: opts.scenario, parentId: opts.parentId, parentSeq: opts.parentSeq, treeUpdatedAt: T.doc.tree.updatedAt });
  const s: State = { nodeId: null, path: [], done: false, ...getState<Partial<State>>(chat.id) };
  if (!Array.isArray(s.path)) s.path = [];
  addMessage(chat.id, "user", text);

  if (chat.status === "done" || s.done) {
    const reply = "This chat has ended. Start a new chat and I'll go from the top.";
    addMessage(chat.id, "assistant", reply);
    return { chatId: chat.id, reply, verbatim: reply, review: null, status: "done", state: s, nodeIds: [], read: null };
  }

  const first = s.nodeId == null;
  const cur = first ? T.root : T.node(s.nodeId!);
  if (!cur) {
    s.done = true; s.ended_reason = "tree_changed"; setState(chat.id, s, "done");
    addMessage(chat.id, "assistant", TREE_CHANGED, null, { verbatim: TREE_CHANGED });
    return { chatId: chat.id, reply: TREE_CHANGED, verbatim: TREE_CHANGED, review: null, status: "done", state: s, nodeIds: [], read: null };
  }
  const opts_ = T.options(cur.id).map((o) => ({ label: o.label, meaning: meaning(o.targets) }));
  const r = await read(text, cur.text, first ? [] : opts_, first);
  if (r.language && r.language !== "other") s.language = r.language;

  const spoken: string[] = []; const nodeIds: string[] = [];
  const say = (n: TreeNode) => { nodeIds.push(n.id); s.path.push(n.id); spoken.push(isHole(n) ? HOLE_REPLY : n.text.trim()); };
  const finish = (why: string) => { s.done = true; s.ended_reason = why; };

  if (first) {
    if (!r.onTopic) { spoken.push(DECLINE_REPLY); finish("off_topic"); }
    else { s.path.push(cur.id); nodeIds.push(cur.id); advance(T, T.select(cur.id, null), s, say, finish); }
  } else if (r.bye && !r.label) {
    spoken.push("Okay. If it gets tight, call 2-1-1 (24/7) for local help. Take care."); finish("resident_ended");
  } else if (opts_.length && r.label == null) {
    s.misses = (s.misses ?? 0) + 1;
    const fallback = T.select(cur.id, null).filter((n) => !T.children(cur.id).some((e) => e.target === n.id && (e.label?.trim() && !/^(either|any|all|always)$/i.test(e.label))));
    if (r.offTopic) spoken.push(DECLINE_REPLY + "\n\nBack to your electric bill. " + cur.text.trim());
    else if (s.misses >= 2 && fallback.length) advance(T, fallback, s, say, finish);
    else spoken.push(NOT_HEARD + cur.text.trim());
  } else {
    advance(T, T.select(cur.id, r.label), s, say, finish);
  }

  const verbatim = spoken.join("\n\n");
  let reply = verbatim; let rev: Review | null = null; let drafts: Draft[] = [];
  const fixed = [DECLINE_REPLY, HOLE_REPLY, TREE_CHANGED, "Okay. If it gets tight, call 2-1-1 (24/7) for local help. Take care."];
  const isFixed = fixed.includes(verbatim.trim()) || spoken.every((x) => fixed.includes(x.trim()));
  if (!opts.verbatimOnly && verbatim.trim() && !isFixed) {
    const kind = s.done ? "answer" : "step";
    try {
      const history = getMessages(chat.id).map((m) => ({ role: m.role, content: m.content }));
      const out = await writeReviewed(verbatim, history, kind, history.map((m) => m.content).join("\n"));
      drafts = out.drafts; rev = { ...out, drafts: undefined } as Review;
      if (rev.used === "written" && rev.written) reply = rev.written;
    } catch (e) { rev = { used: "verbatim", code_ok: false, reason: "writer error: " + (e as Error).message }; }
  }
  setState(chat.id, s, s.done ? "done" : "open");
  addMessage(chat.id, "assistant", reply, nodeIds.join(","), { verbatim, review: rev, drafts });
  return { chatId: chat.id, reply, verbatim, review: rev, status: s.done ? "done" : "open", state: s, nodeIds, read: r.raw ?? r };
}

function advance(T: Tree, targets: TreeNode[], s: State, say: (n: TreeNode) => void, finish: (why: string) => void) {
  if (!targets.length) { say({ id: "__dead_end__", text: "" } as TreeNode); finish("dead_end"); s.nodeId = null; return; }
  const steps = targets.filter((n) => !T.isLeaf(n.id));
  const leaves = targets.filter((n) => T.isLeaf(n.id));
  for (const n of leaves) say(n);
  if (steps.length) {
    const next = steps[0];
    say(next); s.nodeId = next.id;
  } else {
    s.nodeId = null; finish(leaves.some((n) => isHole(n)) ? "hole" : "answer");
  }
}
