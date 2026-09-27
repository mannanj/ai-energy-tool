import { getMessages, transcript } from "../lib/db";
import { READER } from "../lib/turn";
import { SCENARIOS, runScenario, type Scenario } from "../lib/simulate";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const MODEL = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash";
const SIM_MODEL = process.env.SIM_MODEL ?? MODEL;
const ORIGIN = process.env.PUBLIC_ORIGIN ?? `http://localhost:${process.env.PORT ?? 8972}`;

if (import.meta.main) {
  const args = process.argv.slice(2);
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
  const turns = args.includes("--turns") ? Number(args[args.indexOf("--turns") + 1]) : 8;
  if (args.includes("--list")) { for (const s of SCENARIOS) console.log(s.name); process.exit(0); }
  const todo = SCENARIOS.filter((s) => !only || s.name === only);
  const outDir = resolve(import.meta.dir, "../data/samples");
  mkdirSync(outDir, { recursive: true });
  const links: string[] = [];
  for (let i = 0; i < todo.length; i += 4) {
    await Promise.all(todo.slice(i, i + 4).map(async (s) => {
      try {
        const id = await runScenario(s, s.turns ?? turns);
        const link = `${ORIGIN}/c/${id}`;
        links.push(`- ${s.name}: ${link}`);
        const c = { ...createChatStub(id, s) };
        writeFileSync(resolve(outDir, `${s.name}.md`), transcript({ ...c, id } as never, getMessages(id)) + `\n\nShare link: ${link}\n`);
      } catch (e) { console.error(`  [${s.name}] FAILED: ${(e as Error).message}`); }
    }));
  }
  const index = `# Sample chats\n\nGenerated ${new Date().toISOString()}. Flow: the editor tree walked by code; reader ${READER()}; resident played by ${SIM_MODEL}.\nOpen a link while \`bun server.ts\` is running.\n\n${links.sort().join("\n")}\n`;
  writeFileSync(resolve(outDir, "README.md"), index);
  console.log("\n" + index);
}

function createChatStub(id: string, s: Scenario) {
  return { title: s.opener, model: MODEL, created_at: new Date().toISOString(), scenario: s.name };
}
