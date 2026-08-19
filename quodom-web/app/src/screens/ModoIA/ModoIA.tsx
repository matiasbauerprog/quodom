import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBarBack } from '../../components/layout/AppBarBack';
import { iaApi, type IaMessage, type IaProposalItem } from '../../api/ia';
import { quodom as quodomApi } from '../../api/quodom';
import { quodomLines } from '../../api/quodom_lines';
import { ApiError } from '../../api/client';
import { DialogoNuevoRubro } from '../../quodom/DialogoNuevoRubro';
import { nombreRubro } from '../../quodom/rubros';
import { MensajeChat } from './MensajeChat';
import { PropuestaEditable } from './PropuestaEditable';
import './ModoIA.css';

const WELCOME = 'Hola. Contame tu proyecto y armo el presupuesto.';

type UiMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; proposal?: IaProposalItem[]; idrubro?: number };

type PendienteRubro = { idrubro: number; items: IaProposalItem[] };

export function ModoIA() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<UiMessage[]>([{ role: 'assistant', text: WELCOME }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pendiente, setPendiente] = useState<PendienteRubro | null>(null);
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
        setMessages(m => [...m, { role: 'assistant', text: reply.text, proposal: reply.items, idrubro: reply.idrubro }]);
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

  function descripcionIa() {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return 'Presupuesto IA — ' + now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
      + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
  }

  async function agregarItemsAlQuodom(idquodom: string, items: IaProposalItem[]) {
    for (const it of items) {
      await quodomLines.add({
        idquodom,
        idproducto: it.idproducto,
        cantidad: it.cantidad,
        nombreProducto: it.nombreProducto
      });
    }
    window.dispatchEvent(new Event('quodom:changed'));
  }

  // Reuses the same open-Quodom-of-the-rubro flow as the catalog: if there is
  // one already, add there; if not, ask before creating (DialogoNuevoRubro).
  async function confirmProposal(items: IaProposalItem[], idrubro: number) {
    setConfirming(true);
    try {
      const activo = await quodomApi.activoPorRubro(idrubro);
      if (!activo) {
        setPendiente({ idrubro, items });
        return;
      }
      await agregarItemsAlQuodom(activo.id, items);
      navigate('/quodom?id=' + encodeURIComponent(activo.id));
    } catch (e) {
      const msg = e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo agregar al Quodom.';
      setMessages(m => [...m, { role: 'assistant', text: msg }]);
    } finally {
      setConfirming(false);
    }
  }

  async function crearYConfirmar() {
    if (!pendiente) return;
    setConfirming(true);
    try {
      const created = await quodomApi.create({ descripcion: descripcionIa(), idrubro: pendiente.idrubro });
      await agregarItemsAlQuodom(created.idquodom, pendiente.items);
      setPendiente(null);
      navigate('/quodom?id=' + encodeURIComponent(created.idquodom));
    } catch (e) {
      const msg = e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo crear el Quodom.';
      setMessages(m => [...m, { role: 'assistant', text: msg }]);
    } finally {
      setConfirming(false);
    }
  }

  function cancelarPendiente() {
    setPendiente(null);
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
              {'proposal' in m && m.proposal && m.idrubro !== undefined && (
                <PropuestaEditable
                  items={m.proposal}
                  onConfirm={items => confirmProposal(items, m.idrubro as number)}
                  busy={confirming}
                />
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
        {pendiente && (
          <DialogoNuevoRubro
            nombreRubro={nombreRubro(pendiente.idrubro)}
            onConfirmar={crearYConfirmar}
            onCancelar={cancelarPendiente}
            ocupado={confirming}
          />
        )}
      </section>
    </>
  );
}
