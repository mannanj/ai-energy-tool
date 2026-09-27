import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { setHost, type SqlDriver } from "./host";

const dir = import.meta.dir;
const dbPath = resolve(dir, "..", process.env.DB_PATH ?? "./data/chats.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });
const db = new Database(dbPath, { create: true });
db.run("PRAGMA journal_mode = WAL");

const sql: SqlDriver = {
  all: (q, p = []) => db.query(q).all(...(p as never[])) as never,
  get: (q, p = []) => (db.query(q).get(...(p as never[])) as never) ?? null,
  run: (q, p = []) => { db.query(q).run(...(p as never[])); },
};

setHost({
  sql, dir,
  readFile: (p) => { try { return readFileSync(p, "utf8"); } catch { return null; } },
  writeFile: (p, t) => writeFileSync(p, t),
  exists: (p) => existsSync(p),
  mtime: (p) => Bun.file(p).lastModified,
  resolve: (...parts) => resolve(...parts),
});
