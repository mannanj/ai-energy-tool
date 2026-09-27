import { getChat, getMessages, shareChat } from "./db";
import { complete, type ChatMessage } from "./llm";
import { runTurn } from "./turn";

const MODEL = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash";
const SIM_MODEL = process.env.SIM_MODEL ?? MODEL;
const ORIGIN = process.env.PUBLIC_ORIGIN ?? `http://localhost:${process.env.PORT ?? 8972}`;
const OPENING = "The rates for electricity have increased making it hard to make ends meet, what can I do?";

export interface Scenario { name: string; opener: string; persona: string; turns?: number; }

export const SCENARIOS: Scenario[] = [
  { name: "pipp-electric-heat", opener: OPENING,
    persona: "You live in Kingstowne (22310) with your husband and two kids (4 people). Dominion Energy sends the bill. Combined take-home is about $3,600 a month before taxes. You heat with an electric heat pump. You are about $350 behind, no disconnection notice yet. Nobody is over 60, under 5, disabled or a veteran. You rent an apartment. You have never heard of PIPP." },
  { name: "pipp-gas-heat-single", opener: "Is there any program that makes my electric bill lower every month? I'm on a fixed income.",
    persona: "You are 67, live alone in Franconia, Dominion customer. Social Security of about $1,700 a month is your only income. Gas furnace, so electric is not your heat. Not behind on the bill but it's getting tight. You own a small townhouse. You have your Social Security number and last bill handy if asked." },
  { name: "disconnection-notice", opener: "I got a disconnection notice in the mail today. It says they will shut me off Friday.",
    persona: "You are a single mom of 3 in Rose Hill, Dominion customer, about $780 behind. You work part time, roughly $2,900 a month for 4 people. You are scared and want to know exactly who to call today. No medical equipment. Electric heat. Rent." },
  { name: "medical-equipment", opener: "My father lives with us and uses an oxygen concentrator. Our bill is way up and I'm worried about it getting cut off.",
    persona: "Household of 5 in 22310, Dominion. Income about $5,200 a month. Your father is 78 and on oxygen at night. Not behind yet but the bill jumped. No disconnection notice. Gas heat. You own the house." },
  { name: "power-already-off", opener: "our power is off since this morning what do i do",
    persona: "Power was disconnected this morning for nonpayment, about $1,100 owed. Two adults, one child. Income about $2,400 a month. Dominion. You are typing on your phone with short lowercase messages. No medical devices. You rent." },
  { name: "novec-customer", opener: OPENING,
    persona: "You live in Fairfax County but NOVEC sends your electric bill, not Dominion. Household of 2, income about $2,300 a month. Behind about $200. Electric heat. You rent. Mention NOVEC only when asked who sends the bill." },
  { name: "over-income-behind", opener: "I make decent money but I'm still behind on my Dominion bill after a big medical expense. Anything I can do?",
    persona: "Two adults, no kids, income about $7,000 a month. Dominion. About $900 behind, no disconnection notice yet. Heat pump. Own the house. You are embarrassed to be asking." },
  { name: "energyshare-payment-plan-trouble", opener: "I'm on a payment plan with Dominion but I missed this month and I'm scared they'll cancel it.",
    persona: "Household of 3 in Franconia, income about $3,000 a month. Dominion. Already on a 6-month payment arrangement, missed one installment. Electric heat. Rent. You are 62." },
  { name: "why-bill-went-up", opener: "My bill went from about $140 to $210 and I didn't change anything. Why?",
    persona: "Curious and a bit angry. Household of 2, income $6,500 a month, Dominion, not behind, gas heat, own. You want to understand the rate increase and whether data centers are the cause. If offered, you are open to checking programs but you mostly want the explanation." },
  { name: "scam-call", opener: "Someone just called from Dominion saying my power gets cut in one hour unless I pay with a gift card. I'm panicking.",
    persona: "Household of 1, income about $2,000 a month, Dominion, you think you are current on the bill. You are on the phone with them right now on another line. Ask what to do." },
  { name: "renter-weatherization", opener: "My apartment is drafty and the electric bill is huge in winter. Can I get insulation or something?",
    persona: "Household of 4, income about $3,800 a month. Dominion. Electric baseboard heat. You rent from a private landlord. Not behind. Never received bill help before." },
  { name: "homeowner-weatherization", opener: "We own our home and the heat pump is old. Is there money for making the house more efficient?",
    persona: "Household of 3, income about $5,500 a month (roughly $66,000 a year). Dominion. Own the house. Not behind. Heat pump. Got EnergyShare help two years ago." },
  { name: "veteran-senior", opener: "I'm a veteran, 71, and the bill is eating my whole check. Is there anything for vets?",
    persona: "Live alone, Dominion, income about $1,900 a month from VA and Social Security. Behind about $250, and a disconnection notice arrived last week. Gas heat. Own a condo. Enrolled in a VA program but not sure which voucher." },
  { name: "budget-billing-question", opener: "Can I just pay the same amount every month so I can plan?",
    persona: "Household of 2, income $4,800 a month, Dominion, lived at this address 3 years, currently owe nothing past due. Electric heat. Rent." },
  { name: "budget-billing-while-behind", opener: "I want to get on budget billing to smooth things out but I'm behind. Will they let me?",
    persona: "Household of 4, income $4,200 a month, Dominion, about $500 past due, electric heat, rent, 8 months at this address." },
  { name: "cooling-window-closed", opener: "Our AC bill this summer was brutal. Is there help for cooling costs?",
    persona: "Household of 3 with a 3-year-old, income about $3,100 a month, Dominion, not behind, gas heat, rent. It's late September." },
  { name: "fuel-assistance-timing", opener: "When can I apply for heating help this year and how?",
    persona: "Household of 5, income $4,500 a month, Dominion, electric heat, not behind, rent, one child age 2. You want the dates and the exact way to apply, including in person near Franconia." },
  { name: "spanish-speaker", opener: "Hola, mi factura de electricidad subió mucho y no sé qué hacer. ¿Hay ayuda?",
    persona: "You write in Spanish only. Household of 4 in 22310, income about $3,200 a month, Dominion, electric heat, behind about $300, rent. No disconnection notice. Keep answering in Spanish." },
  { name: "helper-social-worker", opener: "I'm a case manager helping a client in Kingstowne with a $650 Dominion balance. What are all the options I should walk her through?",
    persona: "You are a social worker, not the resident. Client: household of 2, income about $2,100 a month, electric heat, rents, has a disconnection notice, is 64. You want a complete list with numbers you can hand her." },
  { name: "no-documents", opener: "I don't have pay stubs, I get paid cash. Can I still get help with the electric bill?",
    persona: "Household of 3, cash income about $2,800 a month, Dominion, electric heat, behind $400, rent, no disconnection notice. Worried about paperwork and about giving out your Social Security number." },
  { name: "off-topic-water-bill", opener: "My water bill is also crazy high. Can you help with that?",
    persona: "Household of 2, income $3,000 a month, Dominion for electric. You mainly wanted water bill help but are fine hearing about electric options too. Not behind on electric. Gas heat. Rent." },
  { name: "vague-one-liner", opener: "help",
    persona: "You are terse and stressed. Household of 1, income about $1,500 a month, Dominion, behind about $600, got a disconnection notice, electric heat, rent. Reveal facts only when asked, one at a time, in very short messages." },
  { name: "city-of-alexandria-confusion", opener: "I'm in Alexandria and behind on Dominion. Who do I call for EnergyShare?",
    persona: "You live in the Rose Hill part of Alexandria mailing address, ZIP 22310, which is Fairfax County not the City of Alexandria. Household of 2, income $2,600 a month, disconnection notice received, electric heat, rent. If asked, you are not sure whether you're in the city or the county." },
  { name: "stacking-programs", opener: "Can I get PIPP and the heating assistance and EnergyShare all at the same time?",
    persona: "Household of 4, income $3,500 a month, Dominion, electric heat, behind $450, disconnection notice, rent. You want to maximize help and want a straight answer on stacking." },
];

const residentSystem = (s: Scenario) => `You are role-playing a real Fairfax County resident chatting with an online helper about an electric bill.
Backstory (stay consistent with it; reveal details only when the helper asks or when it is natural): ${s.persona}
Rules: write like a real person texting, 1 to 3 short sentences, sometimes with typos. Answer the helper's question directly. Never volunteer everything at once. Do not repeat your opening. Never break character or mention being an AI. Answer the helper's questions so it can finish walking you through your options. If something is unclear you may ask one short follow-up. If the helper says it cannot help with what you asked, or has given you a clear next step, reply with a brief thanks and nothing more.`;

export async function continueChat(chatId: string, persona: string, maxTurns = 8, log = console.log, tag = chatId): Promise<{ chatId: string; turns: number }> {
  const resident: ChatMessage[] = [{ role: "system", content: residentSystem({ name: tag, opener: "", persona }) }];
  for (const m of getMessages(chatId)) resident.push({ role: m.role === "user" ? "assistant" : "user", content: m.content });
  let id = chatId, turns = 0;
  for (let turn = 0; turn < maxTurns; turn++) {
    if (getChat(id)?.status === "done") break;
    const next = (await complete(SIM_MODEL, resident, { temperature: 0.8, maxTokens: 120 })).trim() || "Ok.";
    resident.push({ role: "assistant", content: next });
    log(`  [${tag}] resident: ${next.slice(0, 90)}`);
    const t = await runTurn(id, next);
    turns++;
    log(`  [${tag}] helper:   ${t.reply.replace(/\s+/g, " ").slice(0, 90)}  (${t.status}; squares ${t.nodeIds.join(",") || "-"}; ${t.review?.used ?? "-"})`);
    if (t.status === "done") { log(`  [${tag}] ended: ${t.state.ended_reason}`); break; }
    resident.push({ role: "user", content: t.reply });
  }
  return { chatId: id, turns };
}

export async function runScenario(s: Scenario, maxTurns = 8, log = console.log) {
  log(`  [${s.name}] resident: ${s.opener.slice(0, 90)}`);
  const t = await runTurn(null, s.opener, { source: "simulate", scenario: s.name });
  log(`  [${s.name}] helper:   ${t.reply.replace(/\s+/g, " ").slice(0, 90)}  (${t.status}; squares ${t.nodeIds.join(",") || "-"}; ${t.review?.used ?? "-"})`);
  if (t.status !== "done") await continueChat(t.chatId, s.persona, maxTurns - 1, log, s.name);
  shareChat(t.chatId);
  return t.chatId;
}

export async function rerunFrom(parentId: string, fromSeq: number, log = console.log): Promise<string> {
  const parent = getChat(parentId); if (!parent) throw new Error("no such chat");
  const msgs = getMessages(parentId);
  const persona = SCENARIOS.find((x) => x.name === parent.scenario)?.persona
    ?? `Stay consistent with everything you said earlier in this conversation. If asked something new, answer plausibly for the same person.`;
  let id: string | null = null;
  for (const m of msgs) {
    if (m.seq > fromSeq) break;
    if (m.role !== "user") continue;
    log(`  [rerun] resident (replayed): ${m.content.slice(0, 90)}`);
    const t = await runTurn(id, m.content, { source: "rerun", scenario: parent.scenario ?? undefined, parentId, parentSeq: fromSeq });
    id = t.chatId;
    log(`  [rerun] helper:   ${t.reply.replace(/\s+/g, " ").slice(0, 90)}  (${t.status}; squares ${t.nodeIds.join(",") || "-"}; ${t.review?.used ?? "-"})`);
    if (t.status === "done") { shareChat(id); return id; }
  }
  if (!id) throw new Error("nothing to replay");
  await continueChat(id, persona, 8, log, "rerun");
  shareChat(id);
  return id;
}
