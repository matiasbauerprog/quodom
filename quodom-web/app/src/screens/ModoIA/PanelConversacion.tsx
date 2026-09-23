import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { iaApi, type IaMessage, type IaProposalItem } from '../../api/ia';
import { quodom as quodomApi } from '../../api/quodom';
import { ApiError } from '../../api/client';
import { agregarAlServidor } from '../../quodom/agregarProducto';
import { DialogoNuevoRubro } from '../../quodom/DialogoNuevoRubro';
import { DialogoConflictoRubro } from '../../guest/DialogoConflictoRubro';
import type { AccionRubro } from '../../guest/migrateGuestQuodom';
import type { Quodom } from '../../api/types';
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

type PendienteRubro = { idrubro: number; items: IaProposalItem[] };
type ConflictoIa = PendienteRubro & { quodomExistente: Quodom };

export function PanelConversacion() {
  const { user } = useAuth();
  const [agregadoEn, setAgregadoEn] = useState<string | null>(null);
  const [necesitaLogin, setNecesitaLogin] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([{ role: 'assistant', text: WELCOME }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pendiente, setPendiente] = useState<PendienteRubro | null>(null);
  const [conflicto, setConflicto] = useState<ConflictoIa | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, busy]);

  function resetChat() {
    if (!confirm('¿Empezar una nueva conversación?')) return;
    setMessages([{ role: 'assistant', text: WELCOME }]);
    setInput('');
  }

  async function send() {
    if (!user) { setNecesitaLogin(true); return; }
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
      // El campo nunca se deshabilita —deshabilitar un input le saca el foco, y
      // había que volver con el mouse en cada vuelta de la conversación—, pero
      // si se mandó con el botón el foco quedó ahí: se lo devolvemos.
      inputRef.current?.focus();
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
      await agregarAlServidor(idquodom, {
        idproducto: it.idproducto,
        cantidad: it.cantidad,
        nombreProducto: it.nombreProducto,
        ...(it.atributo1 ? { atributo1: it.atributo1 } : {}),
        ...(it.atributo2 ? { atributo2: it.atributo2 } : {})
      });
    }
    window.dispatchEvent(new Event('quodom:changed'));
  }

  // Sin Quodom abierto del rubro, pide confirmación antes de crearlo
  // (DialogoNuevoRubro). Con uno abierto, tampoco decide solo: antes sumaba ahí
  // en silencio y el usuario se encontraba la propuesta mezclada con lo que
  // venía armando. Un Quodom abierto por rubro sigue siendo la regla, así que
  // las salidas son integrar o reemplazar, no tener dos.
  async function confirmProposal(items: IaProposalItem[], idrubro: number) {
    setConfirming(true);
    try {
      const activo = await quodomApi.activoPorRubro(idrubro);
      if (!activo) {
        setPendiente({ idrubro, items });
        return;
      }
      setConflicto({ idrubro, items, quodomExistente: activo });
    } catch (e) {
      const msg = e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo agregar al Quodom.';
      setMessages(m => [...m, { role: 'assistant', text: msg }]);
    } finally {
      setConfirming(false);
    }
  }

  async function resolverConflicto(accion: AccionRubro | null) {
    if (!conflicto) return;
    if (!accion) { setConflicto(null); return; }
    setConfirming(true);
    try {
      let idquodom = conflicto.quodomExistente.id;
      if (accion === 'reemplazar') {
        // Reemplazar descarta el Quodom entero, no sólo sus líneas: el DELETE
        // se lleva cabecera y líneas mientras el estado sea CREADO. Se borra
        // antes de crear porque el backend no admite dos abiertos del rubro.
        await quodomApi.eliminar(conflicto.quodomExistente.id);
        const creado = await quodomApi.create({ descripcion: descripcionIa(), idrubro: conflicto.idrubro });
        idquodom = creado.idquodom;
      }
      await agregarItemsAlQuodom(idquodom, conflicto.items);
      setConflicto(null);
      setAgregadoEn(idquodom);
    } catch (e) {
      const msg = e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo agregar al Quodom.';
      setConflicto(null);
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
      setAgregadoEn(created.idquodom);
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
    <section className="mia" aria-label="Conversando">
      <header className="mia-header">
        <button type="button" className="mia-reset" aria-label="Nueva conversación" onClick={resetChat}>↺</button>
      </header>

      {agregadoEn && (
        <p className="mia-agregado">
          Agregado ✓ <Link to={'/quodom?id=' + encodeURIComponent(agregadoEn)}>ver Quodom</Link>
        </p>
      )}
      {necesitaLogin && <AvisoLogin />}
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
          onClick={send}
          disabled={busy || confirming || input.trim().length < 2}
        >
          {busy ? '…' : 'Enviar'}
        </button>
      </div>
      {conflicto && (
        <DialogoConflictoRubro
          conflicto={{
            idrubro: conflicto.idrubro,
            quodomExistente: conflicto.quodomExistente,
            lineasInvitado: conflicto.items.length
          }}
          descripcionEntrante={'el asistente te propuso ' + conflicto.items.length + ' producto(s)'}
          ocupado={confirming}
          // Acá el diálogo lo abrió el propio usuario al confirmar, así que
          // cancelar es una salida legítima: la propuesta sigue en pantalla.
          permitirCancelar
          etiquetaCancelar="Cancelar"
          onElegir={resolverConflicto}
        />
      )}

      {pendiente && (
        <DialogoNuevoRubro
          nombreRubro={nombreRubro(pendiente.idrubro)}
          onConfirmar={crearYConfirmar}
          onCancelar={cancelarPendiente}
          ocupado={confirming}
        />
      )}
    </section>
  );
}
