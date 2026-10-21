import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Quodom } from '../api/types';
import { quodom as quodomApi } from '../api/quodom';
import { ApiError } from '../api/client';
import { repetirPedido } from '../quodom/repetirPedido';
import { useAbrirQuodom } from '../quodom/ventanaQuodom';
import './QuodomCard.css';

type Variant = 'sidebar' | 'page';

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return dd + '/' + mm + '/' + yy;
}

/**
 * Dos estados y no tres. Hubo un **VENCIDO** que apareciía a las 72hs de
 * enviado ("Pasaron las 72hs y se venció tu pedido"), herencia de Quodom 1.0,
 * donde los vendedores tenían ese plazo para cotizar. Acá no hay vendedores ni
 * cotizaciones y **nada vence**: el pedido sale por WhatsApp y el proveedor
 * contesta cuando puede. No existía en el backend ni en el contrato —sólo en
 * este archivo—, así que a los tres días un pedido que estaba perfecto se leía
 * como fracasado, y el usuario lo reportó mirando su propio historial.
 */
function estadoInfo(q: Quodom): { code: 'creado' | 'enviado'; label: string; detail?: string } {
  if (q.estado === 'CREADO') return { code: 'creado', label: 'En armado', detail: (q.cantproductos ?? 0) + ' productos' };
  return { code: 'enviado', label: 'ENVIADO', detail: 'Enviado el ' + formatDate(q.fechaenvio) };
}

function ZigZag() {
  return (
    <svg className="qc-zigzag" viewBox="0 0 8 60" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 0 L8 6 L0 12 L8 18 L0 24 L8 30 L0 36 L8 42 L0 48 L8 54 L0 60" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * La tarjeta **no envía**. Tuvo un `enviable` que abría el selector de
 * proveedores acá adentro, y lo pasaba únicamente su test: ningún padre de
 * producción lo pasaba, así que el botón y el diálogo no se renderizaban nunca.
 * Se borró en vez de cablearlo porque ese montaje ponía el diálogo **dentro**
 * de la tarjeta, que es lo que `MisQuodomsSidebar` se reestructuró para evitar:
 * en Mis Quodoms, el `onChange` de después de un envío mueve la tarjeta de la
 * lista de armado a la de enviados, así que la tarjeta se desmonta y el diálogo
 * se cierra a mitad del flujo. Los dos caminos que envían son el pie del árbol
 * (`MisQuodomsSidebar`) y el detalle (`DetalleQuodom`).
 */
export function QuodomCard({ quodom, variant = 'sidebar', rubroLabel, onChange, expandido, onToggle, onAbrir }: {
  quodom: Quodom;
  variant?: Variant;
  rubroLabel?: string;
  onChange?: () => void;
  // Con `onToggle`, el cuerpo de la tarjeta despliega los productos en lugar
  // de navegar. La variante `page` no lo pasa y sigue navegando como siempre.
  expandido?: boolean;
  onToggle?: () => void;
  // Con `onAbrir`, tocar la tarjeta llama a esto en lugar de navegar al
  // detalle. Lo pasa el historial, que abre su ventana de sólo lectura: irse de
  // la pantalla para mirar un pedido y volver pierde el lugar en la lista, y la
  // pantalla de detalle es la de **editar**, que sobre un enviado no va.
  onAbrir?: () => void;
}) {
  const navigate = useNavigate();
  const abrirQuodom = useAbrirQuodom();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renombrando, setRenombrando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const info = estadoInfo(quodom);
  const fechaDisplay = quodom.estado === 'ENVIADO' ? formatDate(quodom.fechaenvio) : formatDate(quodom.createdAt);
  const nombre = quodom.descripcion || quodom.nro;
  const menuRef = useRef<HTMLDivElement>(null);
  const botonMenuRef = useRef<HTMLButtonElement>(null);
  // Enter, Escape y el blur que sigue al desmontar el campo: el que llega
  // primero decide, y los demás no vuelven a guardar ni guardan lo descartado.
  const nombreResuelto = useRef(false);

  // Un menú que sólo se cierra eligiendo algo obliga a elegir: tocar en
  // cualquier otro lado lo cierra (lo pidió el usuario).
  useEffect(() => {
    if (!menuOpen) return;
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || botonMenuRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  async function openDetail() { abrirQuodom(quodom.id); }

  // Continuar es "seguir sumando productos de este rubro": lo que hace falta a
  // continuación es el catálogo del rubro, no la ficha del Quodom.
  function seguirEnElRubro() { navigate('/?rubro=' + quodom.idrubro); }

  // Guarda con Enter y también al salir del campo: antes sólo Enter, y tocar
  // afuera dejaba el campo abierto sin guardar (lo reportó el usuario).
  async function guardarNombre() {
    if (nombreResuelto.current) return;
    nombreResuelto.current = true;
    const limpio = nombreNuevo.trim();
    if (!limpio || limpio === (quodom.descripcion ?? '')) { setRenombrando(false); return; }
    setBusy(true); setErr(null);
    try {
      await quodomApi.update(quodom.id, { descripcion: limpio });
      setRenombrando(false);
      onChange?.();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'No se pudo cambiar el nombre.');
      setRenombrando(false);
    } finally { setBusy(false); }
  }

  function activar() {
    // Con el menú abierto, tocar la tarjeta es "cerrar el menú", no abrir el
    // pedido; lo mismo mientras se escribe el nombre (el blur ya lo guarda).
    if (menuOpen) { setMenuOpen(false); return; }
    if (renombrando) return;
    if (onToggle) onToggle();
    else if (onAbrir) onAbrir();
    else openDetail();
  }

  async function onRepetir(e: React.MouseEvent) {
    e.stopPropagation();
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const id = await repetirPedido(quodom);
      onChange?.();
      abrirQuodom(id, { nombrar: true });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'No se pudo repetir.');
    } finally { setBusy(false); }
  }

  async function onEliminar(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen(false);
    if (!confirm('¿Eliminar este Quodom?')) return;
    setBusy(true); setErr(null);
    try {
      await quodomApi.eliminar(quodom.id);
      onChange?.();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'No se pudo eliminar.');
    } finally { setBusy(false); }
  }

  return (
    <article
      className={'qc qc-' + variant + ' qc-estado-' + info.code + (expandido ? ' qc-expandida' : '')}
      onClick={activar}
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activar(); }
      }}
      role="button"
      tabIndex={0}
      aria-expanded={onToggle ? !!expandido : undefined}
      aria-label={quodom.nro + ' · ' + nombre}
    >
      <button ref={botonMenuRef} className="qc-menu" aria-label="Acciones" aria-expanded={menuOpen} onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}>
        <span /><span /><span />
      </button>
      {menuOpen && (
        <div ref={menuRef} className="qc-menu-panel" onClick={e => e.stopPropagation()}>
          {info.code === 'enviado' && (
            <button className="qc-menu-item" onClick={onRepetir}>Repetir</button>
          )}
          {/* Un enviado no se renombra: el proveedor cotiza sobre lo que
              recibió, con ese nombre. El servidor también lo rechaza. */}
          {info.code === 'creado' && (
            <button
              className="qc-menu-item"
              onClick={e => {
                e.stopPropagation();
                setMenuOpen(false);
                setNombreNuevo(quodom.descripcion ?? '');
                nombreResuelto.current = false;
                setRenombrando(true);
              }}
            >Cambiar nombre</button>
          )}
          <button className="qc-menu-item qc-menu-danger" onClick={onEliminar}>Eliminar</button>
        </div>
      )}

      <div className="qc-left">
        {rubroLabel && <div className="qc-rubro">{rubroLabel}</div>}
        <div className="qc-fecha">{fechaDisplay}</div>
        {renombrando ? (
          <form className="qc-rename" onSubmit={e => { e.preventDefault(); e.stopPropagation(); guardarNombre(); }} onClick={e => e.stopPropagation()}>
            <input
              className="qc-rename-input"
              aria-label="Nombre del Quodom"
              value={nombreNuevo}
              autoFocus
              disabled={busy}
              onChange={e => setNombreNuevo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); nombreResuelto.current = true; setRenombrando(false); } }}
              onBlur={guardarNombre}
            />
          </form>
        ) : (
          <div className="qc-nombre">{nombre}</div>
        )}
      </div>

      <div className="qc-zigzag-wrap"><ZigZag /></div>

      <div className="qc-right">
        {info.code === 'enviado' && (
          <>
            <div className="qc-estado-label qc-estado-enviado-label">ENVIADO</div>
            <div className="qc-detail">{info.detail}</div>
            <button className="qc-action" onClick={onRepetir} disabled={busy}>{busy ? '…' : 'Repetir'}</button>
          </>
        )}
        {info.code === 'creado' && (
          <>
            <div className="qc-estado-label qc-estado-creado-label">EN ARMADO</div>
            <div className="qc-detail">{info.detail}</div>
            <div className="qc-acciones">
              <button className="qc-action" onClick={e => { e.stopPropagation(); seguirEnElRubro(); }}>Continuar</button>
            </div>
          </>
        )}
        {err && <div className="qc-err">{err}</div>}
      </div>
    </article>
  );
}
