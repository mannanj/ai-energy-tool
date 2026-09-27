export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  TreeRoom: DurableObjectNamespace;
  EMAIL?: { send(msg: { to: string; from: { email: string; name?: string }; subject: string; text: string; html?: string }): Promise<void> };
  APP_ORIGIN: string;
  APP_NAME: string;
  EMAIL_PROVIDER: string;
  EMAIL_FROM: string;
  /** Dev only: origin of `next dev`, allowed for CORS with credentials. Empty in production. */
  DEV_ORIGIN: string;
  WORKSPACE_PASSWORD: string;
  SESSION_SECRET: string;
}
