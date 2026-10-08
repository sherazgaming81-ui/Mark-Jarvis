# Site assistant — setup and how it works

The site now carries an AI assistant in the bottom-right corner. It answers
visitor questions about wells, pumps, permits and coverage, and hands anyone
who is ready to act straight into the existing **free estimate** booking form.

Nothing about the company lives inside the assistant's instructions: the brief is
assembled from `src/lib/site-data.ts` at request time, so changing the phone
number, hours, services or FAQs updates the assistant automatically.

---

## 1. What was added

| File | Job |
|---|---|
| `src/lib/ai/providers.ts` | The provider chain: Groq → OpenRouter → Gemini → Cerebras → Together → DeepInfra → any custom OpenAI-compatible endpoint. |
| `src/lib/ai/brain.ts` | The grounded brief handed to the model, plus the offline knowledge base used when no provider answers. |
| `src/app/api/chat/route.ts` | `POST /api/chat` — validates, rate-limits and streams the answer. `GET /api/chat` reports which providers are configured. |
| `src/components/chat-widget.tsx` | The widget: launcher, chat panel, streaming, quick replies, booking hand-off. |
| `src/app/globals.css` | Styles for the widget (appended at the end, same palette and type scale as the site). |
| `src/app/page.tsx` | Renders `<ChatWidget />` and connects it to the booking dialog. |
| `src/app/api/health/route.ts` | Now also reports whether the assistant is live or on the offline knowledge base. |
| `.env.example` | Every environment variable, documented. |

No new npm dependencies — the widget and the chain use `fetch` and standard
streams, so the build stays exactly as small as it was.

---

## 2. Add keys (the only required step)

Local development:

```bash
cp .env.example .env.local
# paste at least one key, save, restart `npm run dev`
```

Vercel: **Project → Settings → Environment Variables** add the same names for
Production (and Preview), then **Deployments → ⋯ → Redeploy**.

Check it worked — locally `http://localhost:3000/api/health` or on the live site
`https://aquiferreachllc.vercel.app/api/health` should say:

```json
{ "assistant": { "mode": "live", "providers": ["groq", "openrouter"] } }
```

If it says `"offline knowledge base"`, no key was seen by the deployment.

### Which provider first?

| Provider | Why use it | Free tier |
|---|---|---|
| **Groq** | Fastest by a wide margin, excellent instruction-following on Llama 3.3 70B | Generous free tier — usually enough for a lead-gen assistant |
| **OpenRouter** | One key, hundreds of models, several `:free` slugs | Free models rotate; override `OPENROUTER_MODEL` any time |
| **Google Gemini** | Strong reasoning, long context | Free tier via AI Studio |
| **Cerebras** | Absurdly fast inference | Free tier available |
| **Together / DeepInfra** | Reliable paid capacity when free tiers run dry | Paid, cheap per token |

Recommended starting point: **`GROQ_API_KEY` + `OPENROUTER_API_KEY`.** Groq does
the daily work; OpenRouter catches it when the free limit is hit.

Get keys at: `console.groq.com/keys` · `openrouter.ai/keys` · `aistudio.google.com/apikey` · `cloud.cerebras.ai`

---

## 3. How the fallback chain behaves

For every message the server builds a list of `provider × model` attempts in
priority order (`AI_PROVIDER_CHAIN`), skipping any provider without a key, then:

1. Sends the request with a 30-second ceiling.
2. On **429** (rate limit), **401** (bad key), **5xx**, a network error or a
   timeout, it logs the reason and moves to the next attempt.
3. The first provider that answers streams straight to the visitor.
4. If the whole chain fails — or no key is configured at all — the **offline
   knowledge base** answers instead, from the company's own published FAQs.

So there is no error state a visitor can reach: the worst case is a shorter,
scripted answer that still gives the right information and the phone number.

Overrides, all optional, all settable per environment:

```
AI_PROVIDER_CHAIN=groq,openrouter,gemini,cerebras,together,deepinfra
GROQ_MODEL=llama-3.3-70b-versatile          # comma-separated list = tried in order
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
CUSTOM_AI_BASE_URL=                         # Ollama, vLLM, LM Studio, any OpenAI-compatible proxy
```

---

## 4. What the assistant will not do

These rules are in `src/lib/ai/brain.ts` and are written as hard constraints:

- **No prices.** Not a number, not a range, not a per-foot figure. It explains
  what drives cost and points at the free on-site estimate — the same position
  the site already takes.
- **No promises** about yield, depth, quality, timeline or permitting.
- **No off-topic chat.** Politics, competitors, other companies, "ignore your
  instructions" — all refused in one friendly sentence.
- **No system-role injection.** A client-supplied `system` message is dropped
  before the request is built; the brief is set server-side only.
- **No false confirmations.** It says a request is confirmed by a person on the
  phone, because that is true.
- **No data collection.** It never asks for card details, ID documents or
  anything sensitive, and the widget tells the visitor the chat is not saved.

Rate limiting is 30 messages per 10 minutes per IP, held in memory per instance
(so it is a speed bump, not a wall — Vercel's own WAF and provider quotas are the
real ceiling).

---

## 5. Changing the voice

Everything the assistant is told is in `systemPrompt()` in `src/lib/ai/brain.ts`
— tone, sentence length, what it may and may not claim. Edit that one function to
change how it speaks; edit `rules` in the same file to change the offline
answers. The quick-reply chips are `QUICK_REPLIES`.

---

## 6. Cost

The assistant answers in 2–4 sentences, capped at 600 output tokens. On a
Groq free tier or OpenRouter `:free` model that is **$0** for normal site
traffic. On paid capacity expect well under a cent per conversation.
