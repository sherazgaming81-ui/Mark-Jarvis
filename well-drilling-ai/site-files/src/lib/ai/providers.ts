/**
 * Provider chain for the site assistant.
 *
 * Every provider below speaks the same OpenAI-compatible streaming API, so one
 * request shape works everywhere and the chain can try them in order. The first
 * provider that accepts the request wins; anything that 4xx/5xx's, times out or
 * is rate-limited is skipped and the next one is tried. If everything fails the
 * route answers from the offline knowledge base instead, so the widget never
 * shows a dead end.
 *
 * Nothing here reads keys at import time — configuration is resolved per call so
 * that a deployment can rotate keys without a rebuild.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type Attempt = {
  provider: string;
  label: string;
  url: string;
  key: string;
  model: string;
  headers: Record<string, string>;
};

type ProviderDef = {
  label: string;
  url: string;
  keyEnv: string;
  modelEnv: string;
  defaultModels: string[];
  extraHeaders?: (key: string) => Record<string, string>;
};

/**
 * Default order is speed-first, then breadth, then free-tier depth:
 * Groq is the fastest and has a generous free tier; OpenRouter carries a large
 * catalogue (including free models); Gemini, Cerebras, Together and DeepInfra
 * are the bench. Override entirely with AI_PROVIDER_CHAIN.
 */
export const PROVIDER_DEFS: Record<string, ProviderDef> = {
  groq: {
    label: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    keyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_MODEL",
    defaultModels: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  },
  openrouter: {
    label: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    keyEnv: "OPENROUTER_API_KEY",
    modelEnv: "OPENROUTER_MODEL",
    // Free models on OpenRouter rotate; override OPENROUTER_MODEL to any slug
    // you like (a comma-separated list is fine — each is tried in order).
    defaultModels: [
      "meta-llama/llama-3.3-70b-instruct:free",
      "deepseek/deepseek-chat-v3.1:free",
      "qwen/qwen3-235b-a22b:free",
    ],
    extraHeaders: (key) => ({
      // Optional but recommended by OpenRouter for attribution.
      "HTTP-Referer": process.env.SITE_URL || "https://aquiferreachllc.vercel.app",
      "X-Title": "Aquifer Reach LLC",
    }),
  },
  gemini: {
    label: "Google Gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    keyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    // Verified live against this key: 2.5-flash, flash-latest and flash-lite all
    // exist in the account's model list. Anything that 404s falls through.
    defaultModels: ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"],
  },
  cerebras: {
    label: "Cerebras",
    url: "https://api.cerebras.ai/v1/chat/completions",
    keyEnv: "CEREBRAS_API_KEY",
    modelEnv: "CEREBRAS_MODEL",
    defaultModels: ["llama-3.3-70b"],
  },
  together: {
    label: "Together AI",
    url: "https://api.together.xyz/v1/chat/completions",
    keyEnv: "TOGETHER_API_KEY",
    modelEnv: "TOGETHER_MODEL",
    defaultModels: ["meta-llama/Llama-3.3-70B-Instruct-Turbo"],
  },
  deepinfra: {
    label: "DeepInfra",
    url: "https://api.deepinfra.com/v1/openai/chat/completions",
    keyEnv: "DEEPINFRA_API_KEY",
    modelEnv: "DEEPINFRA_MODEL",
    defaultModels: ["meta-llama/Llama-3.3-70B-Instruct"],
  },
  custom: {
    label: "Custom endpoint",
    url: "",
    keyEnv: "CUSTOM_AI_KEY",
    modelEnv: "CUSTOM_AI_MODEL",
    defaultModels: [],
  },
};

const DEFAULT_CHAIN = "groq,openrouter,gemini,cerebras,together,deepinfra";

function modelList(def: ProviderDef): string[] {
  const raw = process.env[def.modelEnv];
  if (raw && raw.trim()) {
    return raw.split(",").map((model) => model.trim()).filter(Boolean);
  }
  return def.defaultModels;
}

/** Every (provider × model) pair we are able to try, in priority order. */
export function resolveAttempts(): Attempt[] {
  const chain = (process.env.AI_PROVIDER_CHAIN || DEFAULT_CHAIN)
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);

  const attempts: Attempt[] = [];
  for (const id of chain) {
    const def = PROVIDER_DEFS[id];
    if (!def) continue;

    const key = process.env[def.keyEnv]?.trim();
    if (!key) continue;

    const url = id === "custom" ? process.env.CUSTOM_AI_BASE_URL?.trim() : def.url;
    if (!url) continue;

    for (const model of modelList(def)) {
      attempts.push({
        provider: id,
        label: def.label,
        url,
        key,
        model,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          ...(def.extraHeaders ? def.extraHeaders(key) : {}),
        },
      });
    }
  }
  return attempts;
}

/** True when at least one provider is configured (used for health checks). */
export function hasLiveProvider(): boolean {
  return resolveAttempts().length > 0;
}

export type StreamHandlers = {
  onDelta: (text: string) => void;
  onDone: () => void;
};

/**
 * Fire one streaming completion request. Throws (with a readable message) when
 * the provider rejects the attempt, so the caller can move to the next one.
 * The caller owns the AbortSignal, which keeps the timeout alive for the whole
 * stream rather than only the initial connection.
 */
export async function fetchCompletion(
  attempt: Attempt,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<Response> {
  const response = await fetch(attempt.url, {
    method: "POST",
    headers: attempt.headers,
    signal,
    body: JSON.stringify({
      model: attempt.model,
      messages,
      stream: true,
      temperature: 0.4,
      max_tokens: 600,
    }),
  });

  if (!response.ok || !response.body) {
    // Read a little of the error so the server log says something useful.
    const detail = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}${detail ? ` — ${detail.slice(0, 180)}` : ""}`);
  }
  return response;
}

/**
 * Parse an OpenAI-style SSE stream and hand each text delta to the caller.
 * Providers differ slightly (some omit role-only chunks, some send a final
 * usage chunk), so every shape is tolerated.
 */
export async function readStream(
  body: ReadableStream<Uint8Array>,
  handlers: StreamHandlers,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n");
    while (boundary !== -1) {
      const line = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 1);
      boundary = buffer.indexOf("\n");

      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      try {
        const parsed = JSON.parse(payload) as {
          choices?: { delta?: { content?: string }; message?: { content?: string }; text?: string }[];
        };
        const choice = parsed.choices?.[0];
        const text = choice?.delta?.content ?? choice?.message?.content ?? choice?.text ?? "";
        if (text) handlers.onDelta(text);
      } catch {
        // Ignore keep-alives and provider-specific noise.
      }
    }
  }
  handlers.onDone();
}
