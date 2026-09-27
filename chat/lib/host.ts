export interface SqlDriver {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | null;
  run(sql: string, params?: unknown[]): void;
}

export interface Host {
  sql: SqlDriver;
  dir: string;
  readFile(path: string): string | null;
  writeFile(path: string, text: string): void;
  exists(path: string): boolean;
  mtime(path: string): number;
  resolve(...parts: string[]): string;
}

let current: Host | null = null;
export function setHost(h: Host): void { current = h; }
export function host(): Host {
  if (!current) throw new Error("no host: call setHost() before using the chat library");
  return current;
}
export const hasHost = () => !!current;

if (!current && (globalThis as { Bun?: unknown }).Bun) await import("./host-" + "bun");
