"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistantReply } from "@/core/assistant/reply";
import { useHomeAirport } from "./useHomeAirport";

// Assistente de viagem: o usuário escreve do jeito dele e recebe a resposta com os
// voos. A conversa fica só no navegador (sessionStorage); o servidor não guarda nada.

interface Message {
  id: number;
  role: "user" | "assistant";
  text?: string;
  reply?: AssistantReply;
  pending?: boolean;
  updating?: boolean;
  error?: string;
}

const STORAGE = "tv:assistente";
const EXAMPLES = [
  "quanto fica pra Lisboa dia 10/12?",
  "mês mais barato pra Madri em 2027",
  "2 semanas em Paris no 1º semestre",
  "para onde é mais barato ir em março?",
  "quais programas me levam pra Lisboa?",
];

let nextId = 1;

export function Assistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [home, setHome] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useHomeAirport(true, (code) => setHome(code));

  // conversa da sessão (só neste navegador)
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE) ?? "[]") as Message[];
      if (saved.length) {
        nextId = Math.max(...saved.map((m) => m.id)) + 1;
        setMessages(saved.map((m) => ({ ...m, pending: false, updating: false })));
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE, JSON.stringify(messages.slice(-20)));
    } catch {}
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const patch = (id: number, p: Partial<Message>) => setMessages((list) => list.map((m) => (m.id === id ? { ...m, ...p } : m)));

  const send = useCallback(
    async (raw: string) => {
      const value = raw.trim();
      if (!value) return;
      setText("");
      const previous = [...messages].reverse().find((m) => m.reply)?.reply?.parsed ?? null;
      const id = nextId++;
      setMessages((list) => [...list, { id: nextId++, role: "user", text: value }, { id, role: "assistant", pending: true }]);
      try {
        const res = await fetch("/api/assistente", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: value, previous, home }) });
        const reply = (await res.json()) as AssistantReply & { error?: string };
        if (!res.ok) throw new Error(reply.error ?? "Não consegui responder agora.");
        patch(id, { pending: false, reply, updating: !!reply.refresh });
        if (reply.refresh) {
          // busca mais preços nas fontes e responde de novo, com os dados novos
          try {
            await fetch(reply.refresh.url, { method: reply.refresh.method });
            const again = await fetch("/api/assistente", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ parsed: reply.parsed }) }).then((r) => r.json());
            patch(id, { reply: { ...again, summary: reply.summary, assumptions: reply.assumptions }, updating: false });
          } catch {
            patch(id, { updating: false });
          }
        }
      } catch (e) {
        patch(id, { pending: false, error: e instanceof Error ? e.message : "Não consegui responder agora." });
      }
    },
    [messages, home],
  );

  const reset = () => {
    setMessages([]);
    inputRef.current?.focus();
  };

  const pick = (field: "origem" | "destino" | undefined, code: string) => send(field === "origem" ? `e saindo de ${code}` : `e pra ${code}`);

  return (
    <section className={`assistant ${messages.length ? "has-chat" : ""}`} aria-label="Assistente de viagem">
      {messages.length > 0 && (
        <div className="assistant-chat" ref={listRef} aria-live="polite">
          {messages.map((m) =>
            m.role === "user" ? (
              <p key={m.id} className="bubble is-user">
                {m.text}
              </p>
            ) : (
              <div key={m.id} className="bubble is-bot">
                {m.pending ? (
                  <span className="typing" aria-label="Pensando">
                    <i />
                    <i />
                    <i />
                  </span>
                ) : m.error ? (
                  <p>{m.error}</p>
                ) : m.reply ? (
                  <Reply reply={m.reply} updating={!!m.updating} onSend={send} onPick={pick} />
                ) : null}
              </div>
            ),
          )}
        </div>
      )}

      <form
        className="assistant-bar"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden className="assistant-icon">
          <path d="M21 15.5v-2l-8-5V3.8a1.5 1.5 0 0 0-3 0v4.7l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5Z" fill="currentColor" />
        </svg>
        <input
          ref={inputRef}
          className="assistant-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={messages.length ? "Pergunte de novo ou ajuste: \"e se for em julho?\"" : "Para onde você quer ir? Ex.: Madri em 2027, 2 a 3 semanas"}
          aria-label="Escreva o que você procura"
          maxLength={300}
          autoComplete="off"
        />
        <button className="btn btn-primary" type="submit" disabled={!text.trim()}>
          Perguntar
        </button>
      </form>

      {messages.length === 0 ? (
        <div className="assistant-examples">
          {EXAMPLES.map((e) => (
            <button key={e} type="button" className="chip" onClick={() => send(e)}>
              {e}
            </button>
          ))}
        </div>
      ) : (
        <div className="assistant-foot">
          <span className="muted">Preços reais das fontes conectadas. A conversa fica só no seu navegador.</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
            Nova conversa
          </button>
        </div>
      )}
    </section>
  );
}

function Reply({ reply, updating, onSend, onPick }: { reply: AssistantReply; updating: boolean; onSend: (t: string) => void; onPick: (f: "origem" | "destino" | undefined, code: string) => void }) {
  const amb = reply.parsed.ambiguous[0];
  return (
    <div className="reply">
      {reply.summary && <p className="reply-summary">{reply.summary}</p>}
      {reply.text && <p className="reply-text">{reply.text}</p>}
      {reply.question?.options && (
        <div className="chip-row">
          {reply.question.options.map((o) => (
            <button key={o.code} type="button" className="chip" onClick={() => onPick(amb?.field, o.code)}>
              {o.label}
            </button>
          ))}
        </div>
      )}
      {reply.cards.length > 0 && (
        <ul className="reply-cards">
          {reply.cards.map((c, i) => {
            const inner = (
              <>
                <span className="reply-card-main">
                  <strong>{c.title}</strong>
                  <span className="muted">{c.subtitle}</span>
                  {(c.note || c.badge) && <span className="reply-card-note">{[c.badge, c.note].filter(Boolean).join(" · ")}</span>}
                </span>
                {c.price && <span className="reply-card-price">{c.price}</span>}
              </>
            );
            return <li key={i}>{c.href ? <Link className="reply-card" href={c.href}>{inner}</Link> : <div className="reply-card">{inner}</div>}</li>;
          })}
        </ul>
      )}
      {updating && (
        <p className="muted reply-updating">
          <span className="live-dot" aria-hidden /> Buscando preços atualizados nas fontes…
        </p>
      )}
      {reply.assumptions && <p className="muted reply-assumed">{reply.assumptions}</p>}
      <div className="reply-actions">
        {reply.link && (
          <Link className="btn btn-ghost btn-sm" href={reply.link.href}>
            {reply.link.label}
          </Link>
        )}
        {reply.suggestions.map((s) => (
          <button key={s} type="button" className="chip" onClick={() => onSend(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
