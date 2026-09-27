import { archiveAllBut } from "../lib/db";
const a = process.argv.slice(2); const keep = a.includes("--keep") ? Number(a[a.indexOf("--keep") + 1]) : 3;
const r = archiveAllBut(keep);
console.log(`archived ${r.archived} chats; kept ${r.kept.join(", ")}`);
