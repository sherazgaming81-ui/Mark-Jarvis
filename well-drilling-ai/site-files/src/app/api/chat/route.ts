import { NextRequest } from "next/server";
import { buildMessages, offlineAnswer } from "@/lib/ai/brain";
import { fetchCompletion, readStream, resolveAttempts, type Attempt } from "@/lib/ai/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The site assistant endpoint.
 *
 * POST { messages: [{role, content}, ...] }  → text/event-stream
 *
 * The wire format is deliberately simple so the widget never has to know which
 * provider answered:
 *
 *   data: {"type":"start","provider":"Groq","model":"llama-3.3-70b-versatile"}
 *   data: {"type":"delta","text":"Most residential wells..."}
 *   data: {"type":"done","fallback":false}
 *
 * Any failure that is not the visitor's fault (provider down, rate limit, bad
 * key) moves to the next provider; if the whole chain fails the offline
 * knowledge base answers instead, so the chat always says something useful.
 */

type IncomingMessage = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 20;
const MAX_CHARS = 1500;
const MAX_TOTAL_CHARS = 12_000;
const ATTEMPT_TIMEOUT_MS = 30_000;

/* ----------------------------- rate limiting ----------------------------- */

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 30; // messages per window per IP — generous for one visitor

const globalForLimits = globalThis as typeof globalThis & {
  __chatRateLimit?: Map<string, number[]>;
};
const hits = (globalForLimits.__chatRateLimit ??= new Map<string, number[]>());

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const times = (hits.get(ip) ?? []).filter((time) => time > cutoff);
  if (times.length >= RATE_MAX) {
    hits.set(ip, times);
    return true;
  }
  times.push(now);
  hits.set(ip, times);
  if (hits.size > 2000) {
    for (const [key, value] of hits) {
      if (!value.some((time) => time > cutoff)) hits.delete(key);
    }
  }
  return false;
}

/* -------------------------------- helpers -------------------------------- */

const encoder = new TextEncoder();
const event = (payload: unknown) => encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches from some browsers omit it
  try {
    const host = new URL(origin).host;
    return host === request.headers.get("host") || host === request.headers.get("x-forwarded-host");
  } catch {
    return false;
  }
}

function parseMessages(body: unknown): IncomingMessage[] | null {
  if (!body || typeof body !== "object") return null;
  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;

  const cleaned: IncomingMessage[] = [];
  let total = 0;

  for (const entry of messages.slice(-MAX_MESSAGES)) {
    if (!entry || typeof entry !== "object") return null;
    const role = (entry as { role?: unknown }).role;
    const content = (entry as { content?: unknown }).content;
    // The visitor can only ever be a user or an assistant turn; "system" is
    // ours to set, and a client-supplied one is dropped, not honoured.
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") return null;
    const text = content.trim().slice(0, MAX_CHARS);
    if (!text) continue;
    total += text.length;
    if (total > MAX_TOTAL_CHARS) return null;
    cleaned.push({ role, content: text });
  }

  if (!cleaned.some((message) => message.role === "user")) return null;
  return cleaned;
}

/** Answer straight from the offline knowledge base, streamed like a provider. */
function offlineStream(history: IncomingMessage[]): Response {
  const answer = offlineAnswer(history);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(event({ type: "start", provider: "offline", model: "knowledge-base" }));
      // Deliver in small pieces so the widget renders it like a live answer.
      const words = answer.split(" ");
      for (let index = 0; index < words.length; index += 3) {
        controller.enqueue(event({ type: "delta", text: words.slice(index, index + 3).join(" ") + " " }));
        await new Promise((resolve) => setTimeout(resolve, 45));
      }
      controller.enqueue(event({ type: "done", fallback: true }));
      controller.close();
    },
  });
  return new Response(stream, { headers: streamHeaders("offline", "knowledge-base") });
}

function streamHeaders(provider: string, model: string): Record<string, string> {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "X-AI-Provider": provider,
    "X-AI-Model": sanitizeHeader(model),
  };
}

const sanitizeHeader = (value: string) => value.replace(/[^\w./:-]/g, "_").slice(0, 120);

/* --------------------------------- routes -------------------------------- */

/** Lets the owner check, without exposing keys, that the brain is wired up. */
export async function GET() {
  const attempts = resolveAttempts();
  return Response.json(
    {
      ok: true,
      providers: [...new Set(attempts.map((attempt) => attempt.provider))],
      models: attempts.map((attempt) => `${attempt.provider}/${attempt.model}`),
      mode: attempts.length ? "live" : "offline knowledge base",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "This request is not allowed." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "Send the chat as JSON." }, { status: 415 });
  }

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) {
    return Response.json(
      { error: "You've sent quite a few messages. Please call (904) 477-9809 or try again in a few minutes." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  let parsed: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 60_000) return Response.json({ error: "That message is too long." }, { status: 413 });
    parsed = JSON.parse(raw);
  } catch {
    return Response.json({ error: "We couldn't read that message. Please try again." }, { status: 400 });
  }

  const history = parseMessages(parsed);
  if (!history) {
    return Response.json(
      { error: "Please send a question for the assistant." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const attempts = resolveAttempts();
  if (attempts.length === 0) {
    return offlineStream(history);
  }

  const messages = buildMessages(history);
  const failures: string[] = [];
  const clientSignal = request.signal;

  for (const attempt of attempts) {
    if (clientSignal.aborted) {
      return new Response(null, { status: 499 });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("timeout")), ATTEMPT_TIMEOUT_MS);
    const relayAbort = () => controller.abort(clientSignal.reason);
    clientSignal.addEventListener("abort", relayAbort, { once: true });

    try {
      const upstream = await fetchCompletion(attempt as Attempt, messages, controller.signal);

      const stream = new ReadableStream<Uint8Array>({
        async start(streamController) {
          streamController.enqueue(
            event({ type: "start", provider: attempt.label, model: attempt.model }),
          );
          try {
            await readStream(upstream.body as ReadableStream<Uint8Array>, {
              onDelta: (text) => streamController.enqueue(event({ type: "delta", text })),
              onDone: () => {},
            });
            streamController.enqueue(event({ type: "done", fallback: false }));
          } catch (error) {
            // The provider died mid-answer. Keep whatever was already streamed
            // and close cleanly — the widget shows the partial reply plus a note.
            streamController.enqueue(
              event({
                type: "error",
                message: error instanceof Error ? error.message.slice(0, 160) : "stream failed",
              }),
            );
            streamController.enqueue(event({ type: "done", fallback: false }));
          } finally {
            clearTimeout(timer);
            clientSignal.removeEventListener("abort", relayAbort);
            streamController.close();
          }
        },
        cancel() {
          clearTimeout(timer);
          controller.abort(new Error("client left"));
        },
      });

      return new Response(stream, { headers: streamHeaders(attempt.provider, attempt.model) });
    } catch (error) {
      clearTimeout(timer);
      clientSignal.removeEventListener("abort", relayAbort);
      const reason = error instanceof Error ? error.message : "unknown error";
      failures.push(`${attempt.provider}/${attempt.model}: ${reason}`);
      console.warn(`[chat] ${attempt.provider} failed → trying next. ${reason}`);
    }
  }

  console.error("[chat] every provider failed:\n" + failures.join("\n"));
  return offlineStream(history);
}
