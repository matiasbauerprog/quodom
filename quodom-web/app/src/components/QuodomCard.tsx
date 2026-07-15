import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Quodom } from '../api/types';
import { quodom as quodomApi } from '../api/quodom';
import { ApiError } from '../api/client';
import './QuodomCard.css';

type Variant = 'sidebar' | 'page';

const HOURS_72 = 72 * 60 * 60 * 1000;

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return dd + '/' + mm + '/' + yy;
}

function estadoInfo(q: Quodom): { code: 'creado' | 'enviado' | 'vencido'; label: string; detail?: string } {
  if (q.estado === 'CREADO') return { code: 'creado', label: 'En armado', detail: (q.cantproductos ?? 0) + ' productos · ' + (q.porccompletado ?? 0) + '% completo' };
  const enviadoDate = q.fechaenvio ? new Date(q.fechaenvio).getTime() : 0;
  const vencido = enviadoDate > 0 && (Date.now() - enviadoDate) > HOURS_72;
  if (vencido) return { code: 'vencido', label: 'VENCIDO', detail: 'Pasaron las 72hs y se venció tu pedido.' };
  return { code: 'enviado', label: 'ENVIADO', detail: 'Enviado el ' + formatDate(q.fechaenvio) };
}

function ZigZag() {
  return (
    <svg className="qc-zigzag" viewBox="0 0 8 60" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 0 L8 6 L0 12 L8 18 L0 24 L8 30 L0 36 L8 42 L0 48 L8 54 L0 60" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function QuodomCard({ quodom, variant = 'sidebar', onChange }: { quodom: Quodom; variant?: Variant; onChange?: () => void }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const info = estadoInfo(quodom);
  const fechaDisplay = quodom.estado === 'ENVIADO' ? formatDate(quodom.fechaenvio) : formatDate(quodom.createdAt);

  async function openDetail() { navigate('/quodom?id=' + encodeURIComponent(quodom.id)); }

  async function onRepetir(e: React.MouseEvent) {
    e.stopPropagation();
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await quodomApi.repetir(quodom.id);
      onChange?.();
      navigate('/quodom?id=' + encodeURIComponent(r.idquodom));
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
    <article className={'qc qc-' + variant + ' qc-estado-' + info.code} onClick={openDetail} role="button" tabIndex={0}>
      <button className="qc-menu" aria-label="Acciones" onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}>
        <span /><span /><span />
      </button>
      {menuOpen && (
        <div className="qc-menu-panel" onClick={e => e.stopPropagation()}>
          {(info.code === 'enviado' || info.code === 'vencido') && (
            <button className="qc-menu-item" onClick={onRepetir}>Repetir</button>
          )}
          <button className="qc-menu-item qc-menu-danger" onClick={onEliminar}>Eliminar</button>
          <button className="qc-menu-item" onClick={e => { e.stopPropagation(); setMenuOpen(false); }}>Cancelar</button>
        </div>
      )}

      <div className="qc-left">
        <div className="qc-fecha">{fechaDisplay}</div>
        <div className="qc-nombre">{quodom.descripcion || quodom.nro}</div>
      </div>

      <div className="qc-zigzag-wrap"><ZigZag /></div>

      <div className="qc-right">
        {info.code === 'vencido' && (
          <>
            <div className="qc-estado-label qc-estado-vencido-label">
              <span className="qc-vencido-x" aria-hidden="true">×</span> VENCIDO
            </div>
            <div className="qc-detail">{info.detail}</div>
            <button className="qc-action" onClick={onRepetir} disabled={busy}>{busy ? '…' : '¡Repetilo!'}</button>
          </>
        )}
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
            <button className="qc-action" onClick={e => { e.stopPropagation(); openDetail(); }}>Continuar</button>
          </>
        )}
        {err && <div className="qc-err">{err}</div>}
      </div>
    </article>
  );
}
