export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  FILES: R2Bucket;
  TreeRoom: DurableObjectNamespace;
  ChatStore: DurableObjectNamespace;
  EMAIL?: { send(msg: { to: string; from: { email: string; name?: string }; subject: string; text: string; html?: string }): Promise<void> };
  APP_ORIGIN: string;
  APP_NAME: string;
  EMAIL_PROVIDER: string;
  EMAIL_FROM: string;
  DEV_ORIGIN: string;
  DEV_USER?: string;
  WORKSPACE_PASSWORD: string;
  SESSION_SECRET: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  TYPESAFE_API_KEY?: string;
  TYPESAFE_MODEL?: string;
  SIM_MODEL?: string;
  WHATSAPP_TOKEN?: string;
  WHATSAPP_APP_SECRET?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
}
