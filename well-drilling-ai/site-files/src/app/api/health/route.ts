import { resolveAttempts } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";

export async function GET() {
  const forwarding = Boolean(process.env.LEAD_WEBHOOK_URL?.trim());
  const attempts = resolveAttempts();
  return Response.json(
    {
      ok: true,
      leads: forwarding ? "webhook + memory" : "memory only",
      assistant: {
        mode: attempts.length ? "live" : "offline knowledge base",
        providers: [...new Set(attempts.map((attempt) => attempt.provider))],
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
