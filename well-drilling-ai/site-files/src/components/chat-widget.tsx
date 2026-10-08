"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { bookingServices, business } from "@/lib/site-data";

/**
 * The site assistant widget.
 *
 * Talks to /api/chat, renders the streamed reply as it arrives, and hands the
 * visitor a direct route into the normal booking flow — the chat is a front
 * door, never a second booking system.
 *
 * Sentinels the model may emit are stripped before display:
 *   [[BOOK]]              → highlights the estimate button
 *   [[SERVICE:rock-wells]] → pre-selects that service when the visitor books
 */

type ChatTurn = { role: "user" | "assistant"; content: string; error?: boolean };

const GREETING = `Hi — I'm the assistant here. Ask me anything about wells, pumps or water for your property, or about booking the free on-site estimate. How can I help?`;

const SENTINEL = /\[\[(BOOK|SERVICE:([a-z0-9-]+))\]\]/gi;

function parseSentinels(raw: string): { text: string; book: boolean; service: string | null } {
  let book = false;
  let service: string | null = null;

  const text = raw
    .replace(SENTINEL, (_match, token: string, id?: string) => {
      if (token === "BOOK") book = true;
      else if (id) service = id;
      return "";
    })
    // Hide a half-written sentinel while the answer is still streaming.
    .replace(/\[\[[A-Za-z:0-9-]*$/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();

  return { text, book, service };
}

export function ChatWidget({ onBook }: { onBook: (serviceId?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([{ role: "assistant", content: GREETING }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [nudgeBook, setNudgeBook] = useState(false);
  const [serviceHint, setServiceHint] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const scrollToEnd = useCallback(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, []);

  useEffect(scrollToEnd, [turns, busy, scrollToEnd]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 220);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(focusTimer);
    };
  }, [open]);

  function closePanel() {
    abortRef.current?.abort();
    abortRef.current = null;
    setOpen(false);
    launcherRef.current?.focus();
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;

    const history: ChatTurn[] = [...turns, { role: "user", content: message }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setBusy(true);
    setNudgeBook(false);

    const controller = new AbortController();
    abortRef.current = controller;

    const updateLast = (updater: (previous: ChatTurn) => ChatTurn) =>
      setTurns((current) => {
        const next = [...current];
        next[next.length - 1] = updater(next[next.length - 1]);
        return next;
      });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: history
            .filter((turn) => turn.content.trim())
            .map((turn) => ({ role: turn.role, content: turn.content })),
        }),
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(
          (detail as { error?: string } | null)?.error ??
            `The assistant is unavailable right now. Please call ${business.phoneDisplay}.`,
        );
      }

      setProvider(response.headers.get("X-AI-Provider"));

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream.");

      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");

          const line = chunk.split("\n").find((part) => part.startsWith("data:"));
          if (!line) continue;

          try {
            const payload = JSON.parse(line.slice(5).trim()) as {
              type: string;
              text?: string;
              provider?: string;
              message?: string;
            };

            if (payload.type === "delta" && payload.text) {
              updateLast((turn) => ({ ...turn, content: turn.content + payload.text }));
            } else if (payload.type === "error" && payload.message) {
              updateLast((turn) => ({ ...turn, error: true }));
            } else if (payload.type === "done") {
              setNudgeBook(true);
            }
          } catch {
            // Ignore malformed frames; the next one will carry the text.
          }
        }
      }

      updateLast((turn) => {
        if (turn.content.trim()) return turn;
        return {
          ...turn,
          content: `Sorry — I lost that reply. Please try again, or call ${business.phoneDisplay}.`,
          error: true,
        };
      });
    } catch (error) {
      if (controller.signal.aborted) {
        setTurns((current) => current.filter((turn, index) => index !== current.length - 1 || turn.content));
      } else {
        updateLast(() => ({
          role: "assistant",
          content:
            error instanceof Error && error.message
              ? error.message
              : `Something went wrong on our side. Please call ${business.phoneDisplay}.`,
          error: true,
        }));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  // The model may point at a specific service; remember it for the booking form.
  const lastAssistant = [...turns].reverse().find((turn) => turn.role === "assistant" && turn.content);
  const suggestedService = lastAssistant ? parseSentinels(lastAssistant.content).service : null;

  useEffect(() => {
    if (suggestedService) setServiceHint(suggestedService);
  }, [suggestedService]);

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        className={`chat-launcher${open ? " is-open" : ""}${nudgeBook ? " is-nudging" : ""}`}
        aria-expanded={open}
        aria-controls="site-assistant"
        onClick={() => (open ? closePanel() : setOpen(true))}
      >
        <span className="chat-launcher-icon">
          <Icon name={open ? "close" : "message"} size={19} />
        </span>
        <span className="chat-launcher-label">{open ? "Close" : "Ask about your well"}</span>
      </button>

      {open && (
        <section
          id="site-assistant"
          className="chat-panel is-open"
          role="dialog"
          aria-label={`${business.name} assistant`}
          data-provider={provider ?? "offline"}
        >
        <header className="chat-head">
          <span className="chat-head-mark" aria-hidden="true">
            <Icon name="droplet" size={17} />
          </span>
          <div className="chat-head-text">
            <strong>Aquifer Reach Assistant</strong>
            <span>
              {busy ? "Typing…" : "Answers in seconds"}
              {process.env.NODE_ENV !== "production" && provider ? ` · ${provider}` : ""}
            </span>
          </div>
          <button type="button" className="chat-head-close icon-button" onClick={closePanel} aria-label="Close chat">
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions text">
          {turns.map((turn, index) => {
            const isLast = index === turns.length - 1;
            const { text } = parseSentinels(turn.content);
            const pending = busy && isLast && turn.role === "assistant" && !text;

            return (
              <div key={index} className={`chat-row chat-row-${turn.role}${turn.error ? " is-error" : ""}`}>
                {pending ? (
                  <p className="chat-bubble chat-typing" aria-label="Assistant is typing">
                    <i />
                    <i />
                    <i />
                  </p>
                ) : (
                  text && <p className="chat-bubble">{text}</p>
                )}
              </div>
            );
          })}
        </div>

        {turns.length <= 1 && (
          <div className="chat-chips">
            {["What does a well cost?", "Do you cover my area?", "How long does drilling take?"].map((chip) => (
              <button key={chip} type="button" onClick={() => send(chip)} disabled={busy}>
                {chip}
              </button>
            ))}
          </div>
        )}

        <div className="chat-actions">
          <button
            type="button"
            className={`button button-primary chat-book${nudgeBook ? " is-highlighted" : ""}`}
            onClick={() => {
              // Only a service the booking form actually offers is pre-selected.
              const known = bookingServices.some((service) => service.value === serviceHint);
              onBook(known && serviceHint ? serviceHint : "");
              setServiceHint(null);
              setNudgeBook(false);
              setOpen(false);
            }}
          >
            Book a free estimate
            <Icon name="arrow-up-right" size={16} />
          </button>
          <a className="chat-call" href={business.phoneHref}>
            <Icon name="phone" size={15} />
            {business.phoneDisplay}
          </a>
        </div>

        <form
          className="chat-input"
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
        >
          <label className="sr-only" htmlFor="chat-message">
            Your question
          </label>
          <input
            id="chat-message"
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about your property or a service…"
            maxLength={1500}
            autoComplete="off"
          />
          {busy ? (
            <button type="button" className="chat-send is-stop" onClick={() => abortRef.current?.abort()} aria-label="Stop the answer">
              <Icon name="close" size={16} />
            </button>
          ) : (
            <button type="submit" className="chat-send" disabled={!draft.trim()} aria-label="Send your question">
              <Icon name="arrow-right" size={17} />
            </button>
          )}
        </form>

          <p className="chat-disclosure">
            Automated assistant. Nothing in this chat is saved. For anything urgent, call{" "}
            <a href={business.phoneHref}>{business.phoneDisplay}</a>.
          </p>
        </section>
      )}
    </>
  );
}
