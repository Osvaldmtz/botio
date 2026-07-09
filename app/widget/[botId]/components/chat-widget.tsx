'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const KALYO_PURPLE = '#6B4EFF';
const WELCOME_MESSAGE =
  '¡Hola! Soy Sofía de Kalyo 👋 Ayudamos a psicólogos a evaluar pacientes con 91+ pruebas clínicas validadas, todo desde el navegador. ¿Qué te gustaría saber primero: evaluaciones, precios, o cómo funciona la prueba gratis?';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

type Props = {
  botId: string;
};

function storageKey(botId: string, key: string): string {
  return `botio_widget_${botId}_${key}`;
}

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function ChatWidget({ botId }: Props) {
  const [sessionId, setSessionId] = useState('');
  const [, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMsgCountRef = useRef(0);

  useEffect(() => {
    const sid =
      localStorage.getItem(storageKey(botId, 'session_id')) ?? generateSessionId();
    localStorage.setItem(storageKey(botId, 'session_id'), sid);
    const conv = localStorage.getItem(storageKey(botId, 'conversation_id'));
    setSessionId(sid);
    if (conv) setConversationId(conv);
    setInitialized(true);
  }, [botId]);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  const loadHistory = useCallback(async () => {
    if (!sessionId) return;

    try {
      const res = await fetch(
        `/api/widget/${botId}?session_id=${encodeURIComponent(sessionId)}`,
      );
      if (!res.ok) return;
      const data = await res.json();

      if (data.conversation_id) {
        setConversationId(data.conversation_id);
        localStorage.setItem(storageKey(botId, 'conversation_id'), data.conversation_id);
      }

      const serverMsgs = (data.messages ?? []) as ChatMessage[];
      if (serverMsgs.length > 0) {
        setMessages(serverMsgs);
        lastMsgCountRef.current = serverMsgs.length;
      } else if (messages.length === 0) {
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: WELCOME_MESSAGE,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch (error) {
      console.error('[widget] poll failed', error);
    }
  }, [botId, sessionId, messages.length]);

  useEffect(() => {
    if (!initialized || !sessionId) return;
    void loadHistory();
  }, [initialized, sessionId, loadHistory]);

  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => void loadHistory(), 3000);
    return () => clearInterval(interval);
  }, [sessionId, loadHistory]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typing, scrollToBottom]);

  async function handleSend(e?: { preventDefault: () => void }) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending || !sessionId) return;

    const optimistic: ChatMessage = {
      id: `tmp_${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev.filter((m) => m.id !== 'welcome'), optimistic]);
    setInput('');
    setSending(true);
    setTyping(true);

    try {
      const res = await fetch(`/api/widget/${botId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: text }),
      });

      const data = await res.json();

      if (data.conversation_id) {
        setConversationId(data.conversation_id);
        localStorage.setItem(storageKey(botId, 'conversation_id'), data.conversation_id);
      }

      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            role: 'assistant',
            content: data.reply,
            created_at: new Date().toISOString(),
          },
        ]);
      } else {
        await loadHistory();
      }
    } catch (error) {
      console.error('[widget] send failed', error);
    } finally {
      setSending(false);
      setTyping(false);
    }
  }

  return (
    <div className="flex h-full min-h-[480px] flex-col bg-white">
      <header
        className="flex shrink-0 items-center gap-3 px-4 py-3 text-white shadow-sm"
        style={{ backgroundColor: KALYO_PURPLE }}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-lg">
          👩‍⚕️
        </div>
        <div>
          <p className="font-semibold leading-tight">Sofía de Kalyo</p>
          <p className="text-xs text-white/80">En línea · Asistente virtual</p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'rounded-br-sm text-white'
                  : 'rounded-bl-sm bg-gray-100 text-gray-800'
              }`}
              style={msg.role === 'user' ? { backgroundColor: KALYO_PURPLE } : undefined}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {typing ? (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-3 text-sm text-gray-500">
              Sofía está escribiendo…
            </div>
          </div>
        ) : null}
      </div>

      <form
        onSubmit={handleSend}
        className="flex shrink-0 gap-2 border-t border-gray-100 bg-white px-3 py-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu mensaje..."
          disabled={sending}
          className="flex-1 rounded-full border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-[#6B4EFF] focus:ring-1 focus:ring-[#6B4EFF]/30"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-full px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: KALYO_PURPLE }}
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
