import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ESTADO_VENTANA, hrefVentana } from '../../quodom/ventanaQuodom';
import { iaApi, type IaMessage, type IaProposalItem } from '../../api/ia';
import { ApiError } from '../../api/client';
import { agregarAlServidor } from '../../quodom/agregarProducto';
import { DialogoDestino } from '../../quodom/DialogoDestino';
import { useDestinoLote } from '../../quodom/useDestinoLote';
import { nombreRubro } from '../../quodom/rubros';
import { useAuth } from '../../auth/AuthContext';
import { AvisoLogin } from '../../components/AvisoLogin';
import { MensajeChat } from './MensajeChat';
import { PropuestaEditable } from './PropuestaEditable';
import './ModoIA.css';

const WELCOME = 'Hola. Contame tu proyecto y armo el presupuesto.';

type UiMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; proposal?: IaProposalItem[]; idrubro?: number };

function descripcionIa() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return 'Presupuesto IA — ' + now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
    + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
}

function agregarItemAlQuodom(idquodom: string, it: IaProposalItem) {
  return agregarAlServidor(idquodom, {
    idproducto: it.idproducto,
    cantidad: it.cantidad,
    nombreProducto: it.nombreProducto,
    ...(it.atributo1 ? { atributo1: it.atributo1 } : {}),
    ...(it.atributo2 ? { atributo2: it.atributo2 } : {})
  });
}

/** `preguntaInicial`: lo que el usuario escribió en el buscador antes de que
 *  le ofreciéramos el asistente. Con sesión se manda sola; sin sesión queda
 *  escrita para cuando entre. */
export function PanelConversacion({ preguntaInicial }: { preguntaInicial?: string } = {}) {
  const { user } = useAuth();
  const location = useLocation();
  const [agregadoEn, setAgregadoEn] = useState<string | null>(null);
  const [necesitaLogin, setNecesitaLogin] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([{ role: 'assistant', text: WELCOME }]);
  const [input, setInput] = useState(preguntaInicial ?? '');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const lote = useDestinoLote<IaProposalItem>({ agregarItem: agregarItemAlQuodom, descripcion: descripcionIa });
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, busy]);

  function resetChat() {
    if (!confirm('¿Empezar una nueva conversación?')) return;
    setMessages([{ role: 'assistant', text: WELCOME }]);
    setInput('');
  }

  // Una sola vez por montaje: el doble efecto de StrictMode la mandaría dos veces.
  const inicialHecha = useRef(false);
  useEffect(() => {
    if (!preguntaInicial || inicialHecha.current) return;
    inicialHecha.current = true;
    if (user) void send(preguntaInicial);
    else setNecesitaLogin(true);
  }, []);

  async function send(textoDado?: string) {
    if (!user) { setNecesitaLogin(true); return; }
    const text = (textoDado ?? input).trim();
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
      // El campo nunca se deshabilita —deshabilitar un input le saca el foco, y
      // había que volver con el mouse en cada vuelta de la conversación—, pero
      // si se mandó con el botón el foco quedó ahí: se lo devolvemos.
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  // Va al Quodom abierto del rubro, igual que el "+" de una tarjeta. Si el rubro
  // no tiene ninguno abierto no crea nada como efecto secundario: pregunta a
  // cuál sumarla (DialogoDestino), con la opción de uno nuevo. Un rubro admite
  // varios Quodoms, así que no hay conflicto que resolver.
  async function confirmProposal(items: IaProposalItem[], idrubro: number) {
    setConfirming(true);
    try {
      const idquodom = await lote.resolver(idrubro, items);
      if (idquodom) setAgregadoEn(idquodom);
    } catch (e) {
      const msg = e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo agregar al Quodom.';
      setMessages(m => [...m, { role: 'assistant', text: msg }]);
    } finally {
      setConfirming(false);
    }
  }

  async function elegirDestino(idquodom: string) {
    const id = await lote.elegir(idquodom);
    if (id) setAgregadoEn(id);
  }

  async function crearDestino() {
    const id = await lote.crear();
    if (id) setAgregadoEn(id);
  }

  return (
    <section className="mia" aria-label="Conversando">
      <header className="mia-header">
        <button type="button" className="mia-reset" aria-label="Nueva conversación" onClick={resetChat}>↺</button>
      </header>

      {agregadoEn && (
        <p className="mia-agregado">
          Agregado ✓ <Link to={hrefVentana(location, agregadoEn)} state={ESTADO_VENTANA}>ver Quodom</Link>
        </p>
      )}
      {necesitaLogin && <AvisoLogin onClose={() => setNecesitaLogin(false)} />}
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
          ref={inputRef}
        />
        <button
          className="btn btn-exito mia-send"
          onClick={() => void send()}
          disabled={busy || confirming || input.trim().length < 2}
        >
          {busy ? '…' : 'Enviar'}
        </button>
      </div>
      {lote.destino && (
        <DialogoDestino
          nombreRubro={nombreRubro(lote.destino.idrubro)}
          candidatos={lote.destino.candidatos}
          onElegir={elegirDestino}
          onCrear={crearDestino}
          onCancelar={lote.cancelar}
          ocupado={lote.ocupado}
          error={lote.error}
        />
      )}
    </section>
  );
}
