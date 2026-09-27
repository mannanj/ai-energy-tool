/** Archive every chat except the newest N (default 3). Archived chats keep their links but leave the gallery and the inspector list.
 *  bun scripts/archive.ts [--keep 3] */
import { archiveAllBut } from "../lib/db";
const a = process.argv.slice(2); const keep = a.includes("--keep") ? Number(a[a.indexOf("--keep") + 1]) : 3;
const r = archiveAllBut(keep);
console.log(`archived ${r.archived} chats; kept ${r.kept.join(", ")}`);
