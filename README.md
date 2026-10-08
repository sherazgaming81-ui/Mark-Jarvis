# Mark-Jarvis

Working repo for **Symbiote Systems** — side-hustle build-outs.

## 📁 `lead-response-demo/` — Lead Response System (interactive demo)

A self-contained, offline HTML demo of the **Lead Response & Follow-Up System**: the productized service that catches every inbound lead, replies in seconds, qualifies it automatically, books viewings, notifies the owner on WhatsApp and follows up when a lead goes quiet.

**Built as the sales demo** — open it in front of a real-estate agency and let them watch their own "leads" get handled in real time.

### What's inside (one file, zero dependencies)

| View | What happens |
|---|---|
| 👤 **Customer view** | A live listing page + chat assistant "Sofia". A visitor answers 5 quick questions (name → budget → area → timeline → viewing slot). |
| 🏢 **Business view** | The same answers land instantly: pipeline (New → Qualified → Booked), live stats, WhatsApp owner-notification preview, and the follow-up engine log. |

### Demo controls

- **↻ Restart demo** — reset everything for the next run-through.
- **😴 Simulate quiet lead** — shows the automatic follow-up firing when a lead stops replying (the "nothing dies" moment).

### Run it

```bash
# any static server works, e.g.
python3 -m http.server 8000
# then open http://localhost:8000/lead-response-demo/
```

Or just double-click `index.html` — it works fully offline with no internet needed.

### Why this exists

The plan (October → December 2027 runway): **one niche (real estate), one offer, one demo, 300–500 targeted prospects, 3–5 demos, 1 paying client.**
This demo is that "one demo". Pilot pricing: PKR 15–25k setup → then PKR 30–50k setup + PKR 10–20k/month retainers.

---

*Interactive demo — nothing is sent or stored online.*
