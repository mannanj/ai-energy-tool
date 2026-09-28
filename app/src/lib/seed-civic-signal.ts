import type { SourceRef, TreeDocument, TreeNode } from "@/types/tree";
import { emptyDocument, mkEdge, mkNode, stableId } from "./seed";

export const CIVIC_SIGNAL_TREE_ID = "civic-signal";
export const CIVIC_SIGNAL_TREE_NAME = "Civic Signal decision tree (from PDF)";
export const CIVIC_SIGNAL_PDF_KEY = "trees/civic-signal.pdf";

const PAD = 4;
const at = (page: number, x: number, y: number, w: number, h: number): SourceRef => ({ page, x: x - PAD, y: y - PAD, w: w + 2 * PAD, h: h + 2 * PAD });

const TODO = "TODO, not in the source docs yet:";

interface Row { q: string; qSrc: SourceRef[]; a: string; aSrc: SourceRef[]; children?: { text: string; src: SourceRef[] }[] }
interface Concern { name: string; src: SourceRef[]; rows: Row[]; general: { text: string; src: SourceRef[] } | null }

const outage = [at(5, 209, 78, 311, 25), at(5, 209, 116, 205, 12)];

const concerns: Concern[] = [
  {
    name: "Power loss",
    src: [at(1, 152, 200, 53, 12)],
    rows: [
      { q: "Extended outage or emergency?", qSrc: [at(1, 152, 220, 78, 24)],
        a: "Emergency resources. Report an outage: Dominion Energy 1-866-366-4357 (report form, outage map). NOVEC 1-703-335-0500 (Outage Center).", aSrc: [at(1, 250, 220, 50, 24), ...outage] },
      { q: "Temporary outage?", qSrc: [at(1, 152, 300, 86, 12)],
        a: "Status and reporting. Dominion outage map and report form, or NOVEC's Outage Center. Dominion 1-866-366-4357, NOVEC 1-703-335-0500.", aSrc: [at(1, 250, 300, 48, 24), ...outage] },
    ],
    general: { text: `General info on power loss in Fairfax County. ${TODO} no page or contact for general outage information.`, src: [at(1, 152, 497, 68, 36)] },
  },
  {
    name: "Pending connection or disconnection",
    src: [at(1, 348, 200, 170, 12)],
    rows: [
      { q: "New customer?", qSrc: [at(1, 348, 220, 71, 12)],
        a: `Resources on how to establish an electricity account. ${TODO} Dominion and NOVEC start-service pages.`, aSrc: [at(1, 446, 220, 83, 36)] },
      { q: "Moving?", qSrc: [at(1, 348, 300, 39, 12)],
        a: `Resources on transferring and/or disconnecting service. ${TODO} Dominion and NOVEC move or stop-service pages.`, aSrc: [at(1, 446, 300, 83, 48)] },
      { q: "Received a disconnection notice?", qSrc: [at(1, 348, 392, 63, 36)],
        a: "Steps on responding to the notice. Virginia disconnection rules: https://law.lis.virginia.gov/admincode/title20/agency5/chapter330/section40/ Then ask: do you need help paying the bill? If yes, go to Assistance programs.", aSrc: [at(1, 446, 392, 85, 72), at(4, 77, 473, 453, 25)] },
    ],
    general: { text: `General info on establishing electricity service in Fairfax County. ${TODO} which utility serves which address, deposits, what to bring.`, src: [at(1, 348, 765, 88, 48)] },
  },
  {
    name: "Assistance programs",
    src: [at(1, 544, 200, 95, 12)],
    rows: [
      { q: "Poll on qualifications and the info needed for the available programs: which utility, household size, income, active account, proof of income, current bill, SSNs?", qSrc: [at(1, 544, 220, 85, 48), at(6, 198, 247, 316, 99)],
        a: "Where matched, output next steps and contact info for PIPP, EnergyShare, and/or LIHEAP. PIPP https://www.dss.virginia.gov/relief/pipp/ EnergyShare https://www.dominionenergy.com/energyshare-va LIHEAP https://www.liheap.org/", aSrc: [at(1, 642, 220, 87, 60), at(4, 77, 510, 325, 41), at(4, 77, 565, 425, 25), at(4, 77, 601, 243, 38)],
        children: [
          { text: "What is PIPP? Pay your reduced bill in full and on time each month. Each month 1/12 of your old balance is forgiven. After 12 months of on-time payments your past-due balance is gone.", src: [at(6, 198, 174, 306, 72)] },
          { text: "How to apply for PIPP: online through CommonHelp, or a paper application to your local Department of Social Services. Documents: proof of income for the last 30 days for all adults 18+, a current electric bill, SSNs for all household members. Stay enrolled: re-verify income each year, report changes, stay current on payments.", src: [at(6, 198, 349, 330, 217)] },
          { text: "What is EnergyShare? Help for people having trouble paying energy bills, year-round, regardless of income. Heating Oct 1 to May 31, up to $6000. Cooling Jun 1 to Sep 30, up to $3000. Local agencies decide; payment goes straight to the energy company. Find your agency: call 2-1-1 or 211virginia.org", src: [at(6, 198, 581, 316, 88), at(7, 216, 276, 324, 187)] },
          { text: "Do I qualify for EnergyShare? Live in Dominion Energy's service area and have a disconnection notice, need reconnection, need help keeping a payment plan, or got a budget-billing removal notice. 60 or older may qualify more often. Veterans and people with disabilities may get an extra $500 through an approved voucher program.", src: [at(6, 198, 669, 289, 41), at(7, 252, 72, 280, 71), at(7, 234, 145, 290, 130)] },
        ] },
      { q: "Doesn't look like you qualify. Want info on reducing energy use?", qSrc: [at(1, 544, 300, 79, 48)],
        a: "Send to the energy efficiency queue. https://energy.virginia.gov/connect/energy-efficiency https://www.nbcwashington.com/news/consumer/how-to-lower-energy-bills-as-summer-approaches/3896488/ EnergyShare free home energy upgrades (must be a Dominion customer who got bill help): call 888-366-8280, Income and Age Qualifying option.", aSrc: [at(1, 642, 300, 76, 24), at(5, 77, 152, 456, 49), at(7, 216, 465, 313, 58), at(7, 216, 611, 281, 84)] },
      { q: "Have you experienced, or are you worried about, scams related to electricity service?", qSrc: [at(1, 544, 392, 84, 60)],
        a: `Resources on scams. Dominion: protect yourself from scams, report a scammer. ${TODO} the doc names the Dominion scam page but has no URL for it.`, aSrc: [at(1, 642, 392, 61, 24), at(4, 77, 687, 404, 12)] },
    ],
    general: { text: `General info on assistance programs available to Fairfax County residents. ${TODO} an overview page; the doc only has the three program links.`, src: [at(1, 544, 661, 85, 60)] },
  },
  {
    name: "Rate increases and higher bills",
    src: [at(2, 154, 200, 129, 12)],
    rows: [
      { q: "Do you need help paying your electricity bill?", qSrc: [at(2, 154, 220, 79, 36)],
        a: "Send to the Assistance programs queue.", aSrc: [at(2, 252, 220, 86, 24)] },
      { q: "Do you want to dispute an electricity bill?", qSrc: [at(2, 154, 300, 68, 36)],
        a: "Send steps and contact info on disputes. SCC utility complaints: https://www.scc.virginia.gov/consumers/public-utility/utility-complaints/", aSrc: [at(2, 252, 300, 70, 36), at(4, 77, 650, 453, 25)] },
      { q: "Do you want an explanation of items on your electricity bill?", qSrc: [at(2, 154, 392, 64, 48)],
        a: "Output a description of electricity and bill terms. Understand my bill: https://www.dominionenergy.com/yourbill Rate riders and tariffs: https://www.dominionenergy.com/virginia/rates-and-tariffs", aSrc: [at(2, 252, 392, 84, 36), at(4, 77, 326, 330, 12), at(4, 77, 449, 410, 12)] },
      { q: "Do you want to compare your use of electricity to similar neighbors?", qSrc: [at(2, 154, 497, 82, 48)],
        a: `Send steps on identifying your use of electricity and a summary of use in similar neighborhoods. Why is my bill high: https://www.dominionenergy.com/virginia/save-energy/why-is-my-bill-high Then ask: want ideas on reducing electricity use or making your home more efficient? ${TODO} a neighbor-comparison tool.`, aSrc: [at(2, 252, 497, 87, 156), at(4, 77, 350, 456, 25)] },
      { q: "Do you want information on increasing utility rates in Fairfax County?", qSrc: [at(2, 154, 661, 72, 60)],
        a: "Resources and trends in utility rates. https://www.fairfaxtimes.com/articles/fairfax-residents-utility-bills-set-to-rise-in-2026/article_7875a665-c056-4396-aca8-c65cfdbdb06c.html Then ask: want more on a particular trend, e.g. data centers? https://www.pcrehomes.com/blog/data-centers-fairfax-utility-bills/ https://annandaletoday.com/massive-energy-use-by-data-centers-could-lead-to-higher-electric-bills/ https://www.brookings.edu/articles/confronting-and-addressing-rising-energy-bills-linked-to-data-centers/", aSrc: [at(2, 252, 661, 83, 96), at(4, 209, 387, 325, 38), at(5, 77, 335, 453, 87)] },
      { q: "Do you want information on advocating for energy policy changes?", qSrc: [at(2, 154, 765, 82, 48)],
        a: `Send local advocacy resources. Solar United Neighbors (nonprofit). ${TODO} any other advocacy group, hearing, or SCC comment process.`, aSrc: [at(2, 252, 765, 47, 36), at(5, 77, 446, 299, 12)] },
    ],
    general: { text: "General info on electricity rates in Fairfax County. https://www.dominionenergy.com/virginia/rates-and-tariffs", src: [at(2, 154, 841, 78, 36), at(4, 77, 449, 410, 12)] },
  },
  {
    name: "Considering solar",
    src: [at(2, 350, 200, 80, 12)],
    rows: [
      { q: "Would you like information on how installing solar panels can change your electricity bills?", qSrc: [at(2, 350, 220, 86, 72)],
        a: "Resources on solar conversion in Fairfax County. https://www.fairfaxcounty.gov/environment-energy-coordination/going-solar https://www.fairfaxcounty.gov/environment-energy-coordination/two-programs-help-residents-go-solar", aSrc: [at(2, 448, 220, 86, 36), at(5, 77, 225, 456, 62)] },
      { q: "Would you like information on how many solar panels you need, costs, and current rebates?", qSrc: [at(2, 350, 300, 88, 84)],
        a: `Resources on current costs, rebates, and usage determination. https://switchtogether.com/en/solar/fairfaxcounty/home ${TODO} rebate amounts and a sizing guide.`, aSrc: [at(2, 448, 300, 83, 48), at(5, 209, 299, 265, 12)] },
      { q: "Have you been approached by a sales company, or are you considering letting someone else buy and own solar panels for your home?", qSrc: [at(2, 350, 392, 88, 96)],
        a: `Output the pros and cons of letting someone else own panels on your home or property. ${TODO} nothing on third-party ownership or leases in the docs.`, aSrc: [at(2, 448, 392, 84, 60)] },
    ],
    general: { text: "General info on solar conversion in Fairfax County. https://www.fairfaxcounty.gov/environment-energy-coordination/going-solar", src: [at(2, 350, 841, 84, 36), at(5, 209, 225, 324, 25)] },
  },
  {
    name: "Something else?",
    src: [at(2, 546, 200, 31, 12)],
    rows: [
      { q: "How can available resources address your unique concern?", qSrc: [at(2, 546, 220, 87, 48)],
        a: `${TODO} the PDF defines no output here. Suggested fallback: 2-1-1 Virginia (dial 2-1-1) and Fairfax County Coordinated Services Planning 703-222-0880.`, aSrc: [] },
    ],
    general: null,
  },
];

const W = 280, ROW_H = 220, COL_GAP = 320, CONCERN_GAP = 120;

export function civicSignalDocument(): TreeDocument {
  const doc = emptyDocument(CIVIC_SIGNAL_TREE_NAME);
  const T = doc.tree.id;
  const root = doc.nodes[0];
  root.text = "Citizen concern: what is going on with your electricity? Power loss, a pending connection or disconnection, assistance programs, rates and higher bills, solar, or something else?";
  root.sources = [at(1, 54, 128, 566, 44), at(1, 54, 200, 77, 12)];
  root.width = 420; root.height = 140;

  const add = (n: TreeNode) => { doc.nodes.push(n); return n; };
  const link = (a: TreeNode, b: TreeNode, label?: string) => doc.edges.push(mkEdge(T, a.id, b.id, label));

  const concernNodes = new Map<string, TreeNode>();
  const queueTargets: [TreeNode, string][] = [];
  let x = 0;
  for (const c of concerns) {
    const subcols = 2 + (c.rows.some((r) => r.children?.length) ? 1 : 0);
    const cn = add(mkNode(T, { x, y: 240, width: W, height: 90, text: c.name, sources: c.src }));
    concernNodes.set(c.name, cn);
    link(root, cn);
    let row = 0;
    for (const r of c.rows) {
      const y = 460 + row * ROW_H;
      const q = add(mkNode(T, { x, y, width: W, height: 150, text: r.q, sources: r.qSrc }));
      const a = add(mkNode(T, { x: x + COL_GAP, y, width: W, height: 190, text: r.a, sources: r.aSrc }));
      link(cn, q); link(q, a, "Yes");
      if (/Assistance programs queue/.test(r.a)) queueTargets.push([a, "Assistance programs"]);
      if (r.children) {
        r.children.forEach((ch, i) => {
          const child = add(mkNode(T, { x: x + 2 * COL_GAP, y: y + i * ROW_H, width: W, height: 200, text: ch.text, sources: ch.src }));
          link(a, child);
        });
        row += r.children.length;
      } else row += 1;
    }
    if (c.general) { const g = add(mkNode(T, { x, y: 460 + row * ROW_H, width: W, height: 150, text: c.general.text, sources: c.general.src })); link(cn, g, "General info"); }
    x += subcols * COL_GAP + CONCERN_GAP;
  }
  for (const [from, name] of queueTargets) { const to = concernNodes.get(name); if (to) link(from, to); }
  root.x = Math.round((x - CONCERN_GAP) / 2 - root.width / 2);

  const seen = new Map<string, number>();
  const ids = new Map<string, string>();
  for (const n of doc.nodes) { const k = seen.get(n.text) ?? 0; seen.set(n.text, k + 1); ids.set(n.id, stableId(n.text + (k ? "#" + k : ""))); }
  for (const n of doc.nodes) n.id = ids.get(n.id)!;
  for (const e of doc.edges) { e.source = ids.get(e.source)!; e.target = ids.get(e.target)!; e.id = stableId(e.source + ">" + e.target + ":" + (e.label ?? "")); }
  doc.tree.rootNodeId = ids.get(doc.tree.rootNodeId)!;
  return doc;
}
