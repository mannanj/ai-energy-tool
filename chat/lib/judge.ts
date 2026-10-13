import { complete, type ChatMessage } from "./llm";

const API = "https://api.typesafe.ai/v1/systemone";
const MODEL = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash";
export const jevEnabled = () => !!process.env.TYPESAFE_API_KEY;
export const readerName = () => (jevEnabled() ? (process.env.TYPESAFE_MODEL ?? "jev-latest") : MODEL);

export interface Read {
  label: string | null;
  onTopic: boolean;
  offTopic: boolean;
  bye: boolean;
  language: string;
  confidence?: number;
  raw?: unknown;
}

export interface Option { label: string; meaning: string; }

type Q = { type: "noul" | "choice"; instructions: unknown; criteria?: unknown };
type Ans = { type: string; noul?: number; choice?: string; confidence?: number; distribution?: Record<string, number> };

async function jev(state: unknown, questions: Record<string, Q>): Promise<Record<string, Ans>> {
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ state, model: process.env.TYPESAFE_MODEL ?? "jev-latest", questions }),
  });
  if (!res.ok) throw new Error(`TypeSafe ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { answers: Record<string, Ans> }).answers;
}

export async function read(text: string, said: string, options: Option[], first: boolean): Promise<Read> {
  const state = {
    context: "Online helper for Fairfax County residents about their Dominion Energy electric bill. The helper follows a fixed decision tree.",
    helper_just_said: first ? "(nothing yet; the tree starts from the question in `root_question`)" : said,
    root_question: first ? said : undefined,
    resident_message: text,
  };
  const crit: Record<string, string> = {};
  for (const o of options) crit[o.label] = o.meaning;
  crit["__none__"] = "The message does not answer with any of the options above (it is unclear, unrelated, or asks something else)";

  if (jevEnabled()) {
    try { return await readWithJev(state, options, crit, first); }
    catch (e) { console.error("Jev reader failed, using fallback:", (e as Error).message); }
  }
  return readWithLlm(text, said, options, crit, first);
}

async function readWithJev(state: Record<string, unknown>, options: Option[], crit: Record<string, string>, first: boolean): Promise<Read> {
  {
    const q: Record<string, Q> = {
      off_topic: { type: "noul", instructions: "Is `resident_message` about something other than an electric bill or electricity service (for example water, rent, internet, food, a joke, unrelated chat)?", criteria: { true: "About something else entirely", false: "About their electric bill, electricity, or answering the helper" } },
      bye: { type: "noul", instructions: "Is `resident_message` wrapping up the conversation (thanks, that's all, bye, ok I'll call them) rather than asking or answering anything?" },
      language: { type: "choice", instructions: "What language is `resident_message` written in?", criteria: { en: "English", es: "Spanish", ko: "Korean", vi: "Vietnamese", zh: "Chinese", ar: "Arabic", am: "Amharic", fr: "French", pt: "Portuguese", other: "Another language" } },
    };
    if (first) q.on_topic = { type: "noul", instructions: "Is `resident_message` a version of `root_question`, or otherwise about paying, lowering, or getting help with an electric bill, a shutoff, or a disconnection notice, or a general request for help that names no other topic?", criteria: { true: "Yes: an electric bill or electricity problem, or a general ask for help", false: "No, clearly about a different topic" } };
    if (options.length) q.label = { type: "choice", instructions: "The helper said `helper_just_said`. Which option does `resident_message` answer with? Short replies ('no', 'yes', 'gas', '2 people') answer what the helper asked.", criteria: crit };
    const a = await jev(state, q);
    const label = a.label?.choice && a.label.choice !== "__none__" ? a.label.choice : null;
    return { label, onTopic: first ? (a.on_topic?.noul ?? 0) >= 0.5 : true, offTopic: (a.off_topic?.noul ?? 0) >= 0.6, bye: (a.bye?.noul ?? 0) >= 0.6, language: a.language?.choice ?? "en", confidence: a.label?.confidence, raw: a };
  }
}

async function readWithLlm(text: string, said: string, options: Option[], crit: Record<string, string>, first: boolean): Promise<Read> {
  const sys = `You read one message from a resident chatting with an electric-bill helper. Return ONLY a JSON object:
{"label": one of ${JSON.stringify([...options.map((o) => o.label), null])}, "on_topic": true|false, "off_topic": true|false, "bye": true|false, "language": "en"|"es"|other}
- label: which option the message answers with. Options and meanings: ${JSON.stringify(crit)}. Use null if none.
- on_topic: is it about paying, lowering, or getting help with an electric bill, a shutoff, or a disconnection notice?
- off_topic: is it about something else entirely (water, rent, internet, jokes)?
- bye: is it wrapping up (thanks, bye, ok I'll call)?`;
  const messages: ChatMessage[] = [{ role: "system", content: sys }, { role: "user", content: `Helper just said: ${first ? "(nothing yet; root question: " + said + ")" : said}\n\nResident message: """${text}"""\n\nJSON:` }];
  const rawText = await complete(MODEL, messages, { temperature: 0, maxTokens: 200 });
  try {
    const j = JSON.parse(rawText.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    return { label: options.some((o) => o.label === j.label) ? j.label : null, onTopic: first ? !!j.on_topic : true, offTopic: !!j.off_topic, bye: !!j.bye, language: j.language ?? "en", raw: j };
  } catch { return { label: null, onTopic: !first, offTopic: false, bye: false, language: "en" }; }
}

export async function translate(text: string, lang: string): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: `Translate the message into the language with ISO code "${lang}". Keep every phone number, URL, email, date, dollar amount and **bold** marker exactly as written. Output only the translation.` },
    { role: "user", content: text },
  ];
  const t = (await complete(MODEL, messages, { temperature: 0, maxTokens: 900 })).trim();
  return t || text;
}
