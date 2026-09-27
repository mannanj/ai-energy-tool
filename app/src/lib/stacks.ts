import type { Chat, ChatMessage } from "./chats";

export interface Stack { id: string; key: string; chatId: string; squareId: string; firstSeq: number; messages: ChatMessage[] }
type DocLike = { nodes: { id: string }[]; tree: { rootNodeId: string } };

export function groupStacks(chat: Chat, doc: DocLike): Stack[] {
  const ids = new Set(doc.nodes.map((n) => n.id));
  const root = doc.tree.rootNodeId;
  const bySquare = new Map<string, Stack>(); const order: Stack[] = [];
  const add = (sid: string, msgs: ChatMessage[]) => {
    if (!msgs.length) return;
    let s = bySquare.get(sid);
    if (!s) {
      const key = `${chat.id}:${msgs[0].seq}`;
      s = { id: `b:${key}`, key, chatId: chat.id, squareId: sid, firstSeq: msgs[0].seq, messages: [] };
      bySquare.set(sid, s); order.push(s);
    }
    s.messages.push(...msgs);
  };
  let pending: ChatMessage[] = []; let last: string | null = null;
  for (const m of chat.messages) {
    if (m.role === "user") { pending.push(m); continue; }
    const sid: string = m.node_ids.find((x) => ids.has(x)) ?? (m.node_ids.length ? root : last ?? root);
    add(sid, [...pending, m]); pending = []; last = sid;
  }
  add(last ?? root, pending);
  return order;
}

export const stackOfSeq = (stacks: Stack[], seq: number) => stacks.find((s) => s.messages.some((m) => m.seq === seq)) ?? null;
