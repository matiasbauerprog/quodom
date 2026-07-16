import { useEffect, useRef, useState } from 'react';
import { AppBarBack } from '../../components/layout/AppBarBack';
import { iaApi, type IaMessage, type IaResponse } from '../../api/ia';
import { ApiError } from '../../api/client';
import { MensajeChat } from './MensajeChat';
import './ModoIA.css';

const WELCOME = 'Hola. Contame tu proyecto y armo el presupuesto.';

type UiMessage = { role: 'user' | 'assistant'; text: string };

export function ModoIA() {
  const [messages, setMessages] = useState<UiMessage[]>([{ role: 'assistant', text: WELCOME }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [_lastProposal, setLastProposal] = useState<IaResponse | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  function resetChat() {
    if (!confirm('¿Empezar una nueva conversación?')) return;
    setMessages([{ role: 'assistant', text: WELCOME }]);
    setInput('');
    setLastProposal(null);
  }

  async function send() {
    const text = input.trim();
    if (busy || text.length < 2) return;

    const next: UiMessage[] = [...messages, { role: 'user', text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const history: IaMessage[] = next
        .filter(m => !(m === next[0] && m.text === WELCOME))
        .map(m => ({ role: m.role, text: m.text }));
      const reply = await iaApi.chat(history);
      if (reply.type === 'proposal') {
        setLastProposal(reply);
        setMessages(m => [...m, { role: 'assistant', text: reply.text }]);
      } else {
        setMessages(m => [...m, { role: 'assistant', text: reply.text }]);
      }
    } catch (e) {
      const msg = e instanceof ApiError || e instanceof Error ? e.message : 'Hubo un problema. Probá de nuevo.';
      setMessages(m => [...m, { role: 'assistant', text: msg }]);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <>
      <AppBarBack title="Modo IA" rightSlot={
        <button type="button" className="mia-reset" aria-label="Nueva conversación" onClick={resetChat}>↺</button>
      } />
      <section className="container mia">
        <div className="mia-messages">
          {messages.map((m, i) => (<MensajeChat key={i} role={m.role} text={m.text} />))}
          {busy && <p className="mia-typing">Pensando…</p>}
          <div ref={bottomRef} />
        </div>
        <div className="mia-inputbar">
          <input
            className="input mia-input"
            placeholder="Escribí acá…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={500}
            disabled={busy}
          />
          <button
            className="btn btn-exito mia-send"
            onClick={send}
            disabled={busy || input.trim().length < 2}
          >
            {busy ? '…' : 'Enviar'}
          </button>
        </div>
      </section>
    </>
  );
}
