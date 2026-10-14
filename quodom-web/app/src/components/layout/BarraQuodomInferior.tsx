import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { resumenCarritosInvitado } from '../../guest/resumenInvitado';
import { AvisoSinGuardar } from '../AvisoSinGuardar';
import { ArbolQuodoms } from './ArbolQuodoms';
import { PanelQuodomsActivos, type ItemActivo } from './PanelQuodomsActivos';
import { abiertoDe } from '../../quodom/quodomAbierto';
import { useQuodomsEnArmado } from '../../quodom/useQuodomsEnArmado';
import './BarraQuodomInferior.css';

// A guest cart left over after a declined ('cancelar') migration, or one
// simply never logged into, stays in localStorage (spec §6). Once logged in,
// the tree only lists server Quodoms, so without this it becomes unreachable
// except by typing /quodom?rubro=<id> or signing out.
// Labelled distinctly ('sin guardar') so it doesn't read as a server Quodom.
function itemsCarritosInvitado(): ItemActivo[] {
  return resumenCarritosInvitado().map(r => ({
    key: 'g-' + r.idrubro,
    to: '/quodom?rubro=' + r.idrubro,
    nombreRubro: r.nombreRubro,
    descripcion: r.descripcion,
    cantproductos: r.cantproductos,
    sinGuardar: true
  }));
}

export function BarraQuodomInferior() {
  const { user } = useAuth();
  const { list, ramas, refresh } = useQuodomsEnArmado(user?.id);
  const [invitados, setInvitados] = useState<ItemActivo[]>(itemsCarritosInvitado);
  const [abierto, setAbierto] = useState(false);
  // El abierto de cada rubro vive en localStorage: sin suscribirse, el resumen
  // de la barra cerrada no se repintaría al cambiarlo desde el árbol.
  const [, setVersion] = useState(0);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const releerInvitados = () => setInvitados(itemsCarritosInvitado());
    releerInvitados();
    const releer = () => setVersion(v => v + 1);
    window.addEventListener('quodom:changed', releerInvitados);
    window.addEventListener('storage', releerInvitados);
    window.addEventListener('quodom:abierto', releer);
    return () => {
      window.removeEventListener('quodom:changed', releerInvitados);
      window.removeEventListener('storage', releerInvitados);
      window.removeEventListener('quodom:abierto', releer);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    const onClickFuera = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickFuera);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickFuera);
    };
  }, [abierto]);

  const enArmado = ramas.reduce((n, r) => n + r.quodoms.length, 0);
  const total = enArmado + invitados.length;

  if (list === null || total === 0) return null;

  // A qué Quodom suma cada rubro: sólo cuenta el abierto que sigue en la lista.
  const sumando = ramas.flatMap(r => {
    const q = r.quodoms.find(x => x.id === abiertoDe(r.idrubro));
    return q ? [{ idrubro: r.idrubro, texto: `${r.nombre} · ${q.descripcion || q.nro}` }] : [];
  });

  return (
    <div className="barra-quodom-wrap" ref={contenedor}>
      {abierto && (
        <div className="barra-quodom-panel" id="barra-quodom-panel" role="region" aria-label="Quodoms activos">
          {ramas.length > 0 && (
            <ArbolQuodoms ramas={ramas} onCambio={refresh} />
          )}
          {invitados.length > 0 && (
            <PanelQuodomsActivos items={invitados} onNavegar={() => setAbierto(false)} />
          )}
          {!user && invitados.length > 0 && (
            <AvisoSinGuardar onNavegar={() => setAbierto(false)} />
          )}
        </div>
      )}
      <button
        type="button"
        className="barra-quodom"
        data-testid="barra-toggle"
        aria-expanded={abierto}
        aria-controls={abierto ? 'barra-quodom-panel' : undefined}
        onClick={() => setAbierto(a => !a)}
      >
        <span className="barra-quodom-count">{total}</span>
        <span className="barra-quodom-label">
          {sumando.length === 0 ? (
            <span className="barra-quodom-nada">Ningún Quodom abierto</span>
          ) : (
            <>
              <span className="barra-quodom-prefijo">Sumando a:</span>
              {sumando.map(s => <span key={s.idrubro} className="barra-quodom-destino">{s.texto}</span>)}
            </>
          )}
        </span>
        <span className="barra-quodom-arrow" aria-hidden="true">{abierto ? '⌄' : '⌃'}</span>
      </button>
    </div>
  );
}
