import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBarBack } from '../../components/layout/AppBarBack';
import { iaApi, type IaMessage, type IaProposalItem } from '../../api/ia';
import { quodom as quodomApi } from '../../api/quodom';
import { quodomLines } from '../../api/quodom_lines';
import { ApiError } from '../../api/client';
import { MensajeChat } from './MensajeChat';
import { PropuestaEditable } from './PropuestaEditable';
import './ModoIA.css';

const WELCOME = 'Hola. Contame tu proyecto y armo el presupuesto.';

type UiMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; proposal?: IaProposalItem[] };

export function ModoIA() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<UiMessage[]>([{ role: 'assistant', text: WELCOME }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  function resetChat() {
    if (!confirm('¿Empezar una nueva conversación?')) return;
    setMessages([{ role: 'assistant', text: WELCOME }]);
    setInput('');
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
        setMessages(m => [...m, { role: 'assistant', text: reply.text, proposal: reply.items }]);
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

  async function confirmProposal(items: IaProposalItem[]) {
    setConfirming(true);
    try {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const descripcion = 'Presupuesto IA — ' + now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
        + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
      const created = await quodomApi.create({ descripcion });
      for (const it of items) {
        await quodomLines.add({
          idquodom: created.idquodom,
          idproducto: it.idproducto,
          cantidad: it.cantidad,
          nombreProducto: it.nombreProducto
        });
      }
      navigate('/quodom?id=' + encodeURIComponent(created.idquodom));
    } catch (e) {
      const msg = e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo crear el Quodom.';
      setMessages(m => [...m, { role: 'assistant', text: msg }]);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <>
      <AppBarBack title="Modo IA" rightSlot={
        <button type="button" className="mia-reset" aria-label="Nueva conversación" onClick={resetChat}>↺</button>
      } />
      <section className="container mia">
        <div className="mia-messages">
          {messages.map((m, i) => (
            <div key={i}>
              <MensajeChat role={m.role} text={m.text} />
              {'proposal' in m && m.proposal && (
                <PropuestaEditable items={m.proposal} onConfirm={confirmProposal} busy={confirming} />
              )}
            </div>
          ))}
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
            disabled={busy || confirming}
          />
          <button
            className="btn btn-exito mia-send"
            onClick={send}
            disabled={busy || confirming || input.trim().length < 2}
          >
            {busy ? '…' : 'Enviar'}
          </button>
        </div>
      </section>
    </>
  );
}
