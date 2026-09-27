export interface ChatMessage { role: "system" | "user" | "assistant"; content: string; }

const API = "https://openrouter.ai/api/v1/chat/completions";

function headers() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set (see chat/.env)");
  return {
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.PUBLIC_ORIGIN ?? "http://localhost",
    "X-Title": "AI Energy Tool chat",
  };
}

export async function complete(model: string, messages: ChatMessage[], opts: { temperature?: number; maxTokens?: number } = {}): Promise<string> {
  const res = await fetch(API, {
    method: "POST", headers: headers(),
    body: JSON.stringify({ model, messages, temperature: opts.temperature ?? 0.4, max_tokens: opts.maxTokens ?? 1200, reasoning: { enabled: false } }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? "";
}

export async function* stream(model: string, messages: ChatMessage[], opts: { temperature?: number; maxTokens?: number } = {}): AsyncGenerator<string> {
  const res = await fetch(API, {
    method: "POST", headers: headers(),
    body: JSON.stringify({ model, messages, stream: true, temperature: opts.temperature ?? 0.4, max_tokens: opts.maxTokens ?? 1200, reasoning: { enabled: false } }),
  });
  if (!res.ok || !res.body) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const j = JSON.parse(payload);
        const delta = j.choices?.[0]?.delta?.content;
        if (delta) yield delta as string;
      } catch { }
    }
  }
}
