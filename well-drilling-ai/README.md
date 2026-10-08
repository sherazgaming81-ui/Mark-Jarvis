# Aquifer Reach — AI site assistant

The well-drilling site now has a **real chatbot with a real brain**: it answers
visitor questions about wells, pumps, permits and coverage, and hands anyone
ready to act straight into the existing **free estimate** booking form.

**Status: built, tested, and verified.** Not deployed yet — see §3 for the one
command that does it.

---

## 1. Verified in this session

| Check | Result |
|---|---|
| `npm run build` / `npx tsc --noEmit` / `eslint` | ✅ clean (Next.js 16.3.5) |
| Patch applies to a **fresh clone** of your repo + builds | ✅ (9 files, no conflicts) |
| **Gemini API key** — live call to Google's API | ✅ **valid**, returned the model list |
| Provider chain resolves with your 3 keys | ✅ `live` mode, 8 provider×model attempts |
| 8 of 8 attempts fail → offline brain answers | ✅ tested in a **production** build (`next start`) |
| Provider chain moves on when one fails | ✅ `[chat] gemini failed → trying next` → next provider streamed |
| Offline knowledge base, 16 real questions | ✅ **16/16 pass** |
| Sentinel parsing (booking / service hand-off) | ✅ 5/5 unit tests |
| Input validation: empty body → 400, wrong type → 415, rate limit 30/10min | ✅ |

Two real bugs were found and fixed by that testing: plural words like
*"permits"* and *"smells"* were missing the offline answer, and an emergency
question was being shadowed by the pump answer. Both fixed and re-tested.

**Not verified from here:** Groq and OpenRouter keys could not be called —
this sandbox's network allows only GitHub, npm and PyPI, so `api.groq.com`,
`openrouter.ai` and `api.vercel.com` are unreachable. Their keys are
format-checked and covered by the fallback chain: if either is rejected, the
chain moves to Gemini and then to the offline answer, so a bad key can never
produce a broken chat.

---

## 2. Why I could not deploy it myself

The sandbox has a hard network allowlist (GitHub, npm, PyPI). Everything else is
cut at TLS:

```
api.vercel.com            HTTP:000     ← deploy blocked
api.groq.com              HTTP:000     ← Groq blocked
openrouter.ai             HTTP:000     ← OpenRouter blocked
generativelanguage.googleapis.com      HTTP:000  (worked only via the browsing tool,
                                                  which cannot POST)
vercel.com / google.com   HTTP:000
```

There are also no stored Vercel credentials in this environment (`~/.vercel`,
`~/.config/vercel`, `VERCEL_TOKEN` — all absent), and your agent's earlier
deploys went through the Chrome session, which I don't have. So: the deploy step
is yours or your browser agent's — everything up to that point is done.

---

## 3. Deploy it — pick one

### Option A — run the script (fastest)

```bash
# inside your site repo, or pass the path:
VERCEL_PROJECT=<exact-vercel-project-name> bash deploy.sh /path/to/demo-website-well-drilling
```

`deploy.sh` (sitting next to this README) applies the patch, builds locally,
links to the **existing Vercel project by name**, pushes the three API keys to
Production env vars, deploys with `--prod`, and prints the health check. It
needs `npx vercel login` once; it never prints your keys.

### Option B — git push (if the repo is connected to Vercel)

```bash
cd demo-website-well-drilling
git apply /path/to/chatbot.patch
git checkout -b ai-assistant && git add -A && git commit -m "Add AI site assistant"
git push origin ai-assistant      # preview deploy
# merge to main for production
```

### Option C — Vercel dashboard

Upload/commit the files, then **Settings → Environment Variables** and add:

```
GROQ_API_KEY        = gsk_...
GEMINI_API_KEY      = AQ.Ab8...
OPENROUTER_API_KEY  = sk-or-v1-...
OPENROUTER_MODEL    = meta-llama/llama-3.3-70b-instruct:free,deepseek/deepseek-chat-v3.1:free,qwen/qwen3-235b-a22b:free
AI_PROVIDER_CHAIN   = gemini,groq,openrouter
```

then **Deployments → ⋯ → Redeploy** (env vars only apply to new builds).

### Verify

```
https://aquiferreachllc.vercel.app/api/health
→ {"ok":true,"leads":"memory only","assistant":{"mode":"live","providers":["gemini","groq","openrouter"]}}
```

`"mode":"live"` = keys reached the deployment. `"offline knowledge base"` = no
key was seen. `/api/chat` (GET) lists every provider×model attempt.

---

## 4. What is in this folder

```
chatbot.patch     the whole change as a git patch (9 files, applies cleanly on main)
deploy.sh         one-command deploy: patch → build → link → env vars → --prod
site-files/       the same files path-for-path, for copy-paste instead of the patch
  src/lib/ai/providers.ts        provider chain + SSE parsing
  src/lib/ai/brain.ts            grounded system prompt + offline knowledge base
  src/app/api/chat/route.ts      POST /api/chat (streaming) · GET (status)
  src/components/chat-widget.tsx the widget UI
  src/app/page.tsx               renders the widget, wires it to booking
  src/app/globals.css            widget styles (appended, same design tokens)
  src/app/api/health/route.ts    now reports assistant mode
  .env.example                   every variable, documented
  AI-SETUP.md                    full setup + behaviour documentation
```

No new dependencies — `fetch` and standard streams only, so `package.json` is
untouched and the bundle stays as light as it was.

---

## 5. Model routers (how the chain works)

Three kinds of service, all used at once:

| Kind | In this build | What it gives you |
|---|---|---|
| **Inference providers** | Groq | Same open models (Llama 3.3 70B) at very high speed, generous free tier |
| **Aggregators ("routers")** | OpenRouter | One key, hundreds of models, `:free` slugs as configured |
| **First-party APIs** | Google Gemini | Strong reasoning, free tier, 1M-token context |

```
AI_PROVIDER_CHAIN = gemini → groq → openrouter   (your keys, set in .env.local)
                    ↓ any 429 / 401 / 5xx / timeout / missing key
                    next provider × model attempt
                    ↓ all failed
                    offline knowledge base (built from the company's own FAQs)
```

Each provider takes a comma-separated model list, all tried in order:

```
GROQ_MODEL=llama-3.3-70b-versatile,llama-3.1-8b-instant
GEMINI_MODEL=gemini-2.5-flash,gemini-flash-latest,gemini-2.5-flash-lite   ← verified to exist on your key
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free,...
```

Free-model slugs rotate; override `OPENROUTER_MODEL` any time from
`openrouter.ai/models` (filter: price = free). Same for Groq — list whatever
`GET https://api.groq.com/openai/v1/models` reports for your key.

---

## 6. Why this is safe in front of a real client

- **No invented facts.** The brief is generated from `src/lib/site-data.ts` at
  request time — change the phone number or an FAQ and the assistant changes with
  it. Nothing about the business is hard-coded in the AI layer.
- **No prices, ever.** Not a number, not a range. It explains what drives cost
  and points at the free on-site estimate, matching the site's existing position.
- **No promises** about yield, depth, quality, timeline or permitting.
- **No topic drift**, and "ignore your instructions" doesn't work — a
  client-supplied `system` message is dropped server-side; the brief is ours.
- **No dead ends.** Provider down / rate limited / bad key / no key → still
  answers. Worst case is a shorter scripted reply with the phone number.
- **No data collection.** Never asks for card details or documents, the widget
  says the chat is not saved, and abuse is capped at 30 messages / 10 min / IP.

---

## 7. ⚠️ Do this today

1. **Rotate the three API keys.** They were pasted into a chat, so treat them as
   exposed:
   - Groq → `console.groq.com/keys` (delete + create new)
   - Google AI Studio → `aistudio.google.com/apikey`
   - OpenRouter → `openrouter.ai/keys`
   Then update them wherever they are used (Vercel env vars, `.env.local`).
2. **Rotate the Vercel token** shared earlier (`vcp_...`): Vercel → Account →
   Tokens → delete. It was never needed here and the API was unreachable anyway.
3. The keys currently sit in `demo-website-well-drilling/.env.local` in this
   workspace (git-ignored — verified with `git check-ignore`). They are **not**
   in `chatbot.patch` and **not** in this repo.
