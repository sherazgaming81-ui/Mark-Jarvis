# Aquifer Reach — AI site assistant

The well-drilling site now has a **real chatbot with a real brain**: it answers
visitor questions about wells, pumps, permits and coverage, and hands anyone
ready to act straight into the existing **free estimate** booking form.

This folder is the complete, tested change — already built and run locally
(`npm run build` ✅, `npx tsc --noEmit` ✅, `eslint` ✅).

---

## 1. Apply it (3 commands)

```bash
cd demo-website-well-drilling           # your existing clone
git checkout -b ai-assistant
git apply /path/to/chatbot.patch        # applies all 9 files, zero conflicts on main
npm install && npm run build            # optional: verify locally
```

Then either merge to `main` (Vercel auto-deploys) or run `npx vercel --prod`.

> If you would rather not use the patch: every changed/new file also exists here
> under `site-files/`, with its exact path — copy them over the same paths in
> your clone.

**No new dependencies.** The widget and provider chain use `fetch` and standard
streams only, so `package.json` and `package-lock.json` are untouched.

---

## 2. Turn the brain on (one step)

Add at least one key. Local: `cp .env.example .env.local`. On Vercel:
**Project → Settings → Environment Variables** (Production *and* Preview), then
**Deployments → ⋯ → Redeploy**.

| Variable | Where to get it | Notes |
|---|---|---|
| `GROQ_API_KEY` | `console.groq.com/keys` | **Start here.** Fastest, generous free tier |
| `OPENROUTER_API_KEY` | `openrouter.ai/keys` | One key, hundreds of models, `:free` slugs |
| `GEMINI_API_KEY` | `aistudio.google.com/apikey` | Free tier, strong reasoning |
| `CEREBRAS_API_KEY` | `cloud.cerebras.ai` | Very fast, free tier |
| `TOGETHER_API_KEY` / `DEEPINFRA_API_KEY` | respective dashboards | Paid capacity for when free tiers run dry |

**Without any key the chatbot still works** — it answers from the built-in
offline knowledge base, built from the company's own published FAQs.

Verify after deploying:

```
https://aquiferreachllc.vercel.app/api/health   → {"assistant":{"mode":"live","providers":["groq"]}}
https://aquiferreachllc.vercel.app/api/chat     → list of configured providers/models
```

`"mode":"offline knowledge base"` means the deployment did not see a key.

---

## 3. Model routers, explained

You asked how the "routers" work. In practice you are choosing between three
different things, and the code supports all three at once:

| Kind | Examples | What it gives you |
|---|---|---|
| **Inference providers** | Groq, Cerebras | Same open models (Llama 3.3 70B) served extremely fast. Free tiers, no model menu. |
| **Model aggregators ("routers")** | OpenRouter | One key, hundreds of models, automatic provider routing, some models free. A single place to change model without changing code. |
| **First-party APIs** | Google Gemini, OpenAI, Anthropic | The strongest models, their own pricing and rate limits. |

This build uses **all three layers with automatic failover**, per message:

```
AI_PROVIDER_CHAIN = groq → openrouter → gemini → cerebras → together → deepinfra → (custom)
                                                                              ↓
                                                       offline knowledge base (last resort)
```

Every provider here speaks the same OpenAI-compatible streaming API, so one
request shape works everywhere. If a provider returns 429/401/5xx, stalls past
30 seconds, or is missing a key, the chain moves to the next `provider × model`
attempt without the visitor noticing anything. Each provider accepts a
comma-separated model list, e.g.:

```
GROQ_MODEL=llama-3.3-70b-versatile,llama-3.1-8b-instant
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free,deepseek/deepseek-chat-v3.1:free
```

Tested locally end-to-end: a deliberately broken primary provider logged
`[chat] groq failed → trying next` and the second provider streamed the answer;
with **every** provider broken the offline knowledge base replied instead.

---

## 4. What is in this folder

```
chatbot.patch                  the whole change as a git patch (9 files, applies on main)
site-files/                    the same files, path-for-path, for copy-paste
  src/lib/ai/providers.ts      provider chain + SSE parsing
  src/lib/ai/brain.ts          grounded system prompt + offline knowledge base
  src/app/api/chat/route.ts    POST /api/chat (streaming), GET /api/chat (status)
  src/components/chat-widget.tsx  the widget UI
  src/app/page.tsx             renders the widget, wires it to the booking dialog
  src/app/globals.css          widget styles (appended, same design tokens)
  src/app/api/health/route.ts  now reports assistant mode
  .env.example                 every variable, documented
  AI-SETUP.md                  full setup + behaviour documentation
```

---

## 5. Why this is safe to put in front of a client

- **No invented facts.** The whole brief is generated from `src/lib/site-data.ts`
  at request time — change the phone number or an FAQ and the assistant changes
  with it. Nothing about the business is hard-coded in the AI layer.
- **No prices, ever.** Not a number, not a range. It explains what drives cost
  and points at the free on-site estimate, matching the site's existing position.
- **No promises** about yield, depth, quality, timeline or permitting.
- **No topic drift** and no obedience to "ignore your instructions" — the brief,
  not the visitor, sets the rules; client-supplied `system` messages are dropped
  server-side.
- **No dead ends.** Provider down, rate limited, misconfigured key → still
  answers; worst case is a shorter scripted reply with the phone number.
- **No data collection.** It never asks for card details or documents, the widget
  states that the chat is not saved, and rate limiting caps abuse at 30 messages
  per 10 minutes per IP.

---

## 6. Notes

- Chat style, safety rules and the offline answers live in
  `src/lib/ai/brain.ts` — that one file is the personality.
- The Vercel token shared for this work should be **rotated** in Vercel →
  Account → Tokens, and the sandbox could not reach `api.vercel.com` at all, so
  the deploy command has to run from your machine or your browser agent.
- Cost: answers are capped at 600 output tokens; on free tiers that is $0 for
  normal traffic, and well under a cent per conversation on paid capacity.
