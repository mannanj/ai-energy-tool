import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

interface Mutant { file: string; from: string; to: string; tier: "unit" | "e2e"; why: string }

const mutants: Mutant[] = [
  { tier: "unit", file: "src/lib/stacks.ts", from: "if (open && open.squareId === sid)", to: "if (open)", why: "every reply joins the first stack" },
  { tier: "unit", file: "src/lib/stacks.ts", from: "if (open && open.squareId === sid)", to: "if (false)", why: "every reply starts a new stack" },
  { tier: "unit", file: "src/lib/stacks.ts", from: "const visit = (visits.get(sid) ?? 0) + 1;", to: "const visit = 1;", why: "revisits not counted" },
  { tier: "unit", file: "src/lib/stacks.ts", from: "messages: [...msgs]", to: "messages: [...msgs].reverse()", why: "messages out of order in a stack" },
  { tier: "unit", file: "src/lib/stacks.ts", from: "?? (m.node_ids.length ? root : last ?? root)", to: "?? root", why: "square-less replies jump to the root" },
  { tier: "unit", file: "src/lib/stacks.ts", from: "add(last ?? root, pending);", to: "", why: "trailing user message dropped" },
  { tier: "unit", file: "src/lib/stacks.ts", from: "const key = `${chat.id}:${msgs[0].seq}`;", to: "const key = `${chat.id}:${sid}`;", why: "revisit stacks share a key" },
  { tier: "unit", file: "src/lib/chatSync.ts", from: "if (top - margin < container.scrollTop)", to: "if (false)", why: "never scrolls up" },
  { tier: "unit", file: "src/lib/chatSync.ts", from: "else if (bottom + margin > container.scrollTop + container.clientHeight)", to: "else if (false)", why: "never scrolls down" },
  { tier: "unit", file: "src/lib/chatSync.ts", from: "Math.max(0, top - margin)", to: "top - margin", why: "scrolls above zero" },
  { tier: "e2e", file: "src/lib/chats.ts", from: "get().select(chatId, true);", to: "get().select(chatId, false);", why: "bubble click drops the other chats" },
  { tier: "e2e", file: "src/lib/chats.ts", from: "setShared({ reveal: { chatId, seq: seq ?? null, n: (get().reveal?.n ?? 0) + 1 } });", to: "", why: "bubble click never reveals the message in the panel" },
  { tier: "e2e", file: "src/lib/chats.ts", from: "const current = get().current && ids.has(get().current!) ? get().current : null;", to: "const current = get().current;", why: "a vanished chat stays current" },
  { tier: "e2e", file: "src/lib/chats.ts", from: "const setShared = (patch: Partial<Shared>) => { set(patch); share(patch); };", to: "const setShared = (patch: Partial<Shared>) => { set(patch); };", why: "windows stop syncing" },
  { tier: "e2e", file: "src/components/panel/ChatsView.tsx", from: "useEffect(() => { if (scroller.current) scroller.current.scrollTop = 0; }, [current]);", to: "", why: "panel keeps the old scroll position on a new chat" },
  { tier: "e2e", file: "src/components/panel/ChatsView.tsx", from: "if (!reveal || reveal.chatId !== current || reveal.seq == null || !scroller.current) return;", to: "return;", why: "panel never scrolls to the revealed message" },
  { tier: "e2e", file: "src/components/panel/ChatsView.tsx", from: "window.addEventListener(\"focus\", again);", to: "", why: "no refresh on focus" },
  { tier: "e2e", file: "src/components/nodes/BubbleNode.tsx", from: "useEffect(() => { if (hot) scrollWithin(ref.current, ref.current?.parentElement ?? null); }, [hot]);", to: "", why: "hot message not scrolled into view in its stack" },
  { tier: "e2e", file: "src/components/nodes/BubbleNode.tsx", from: "onClick={(e) => { e.stopPropagation(); pick(chatId, m.seq); }}", to: "onClick={(e) => { e.stopPropagation(); pick(chatId); }}", why: "message click loses the seq" },
  { tier: "e2e", file: "src/components/canvas/TreeCanvas.tsx", from: "(col + (st.visit - 1) * shown.length) * BUBBLE_COL", to: "col * BUBBLE_COL", why: "revisit stacks pile onto the first visit" },
];

const only = process.argv[2] as "unit" | "e2e" | undefined;
const named = process.argv[3];
const run = (tier: Mutant["tier"]) => tier === "unit"
  ? spawnSync("bun", ["test"], { encoding: "utf8" })
  : spawnSync("python3", ["e2e/chat-sync.py"], { encoding: "utf8", env: { ...process.env, E2E_BROWSERS: process.env.E2E_BROWSERS ?? "chromium" } });

let survived = 0, killed = 0;
for (const m of mutants) {
  if (only && m.tier !== only) continue;
  if (named && !m.why.includes(named)) continue;
  const original = readFileSync(m.file, "utf8");
  if (!original.includes(m.from)) { console.log(`SKIP  ${m.file}: pattern not found (${m.why})`); survived++; continue; }
  writeFileSync(m.file, original.replace(m.from, m.to));
  try {
    const r = run(m.tier);
    const caught = r.status !== 0;
    console.log(`${caught ? "KILLED  " : "SURVIVED"} [${m.tier}] ${m.file}: ${m.why}`);
    if (!caught) survived++; else killed++;
  } finally { writeFileSync(m.file, original); }
}
console.log(`\n${killed} killed, ${survived} survived`);
process.exit(survived ? 1 : 0);
