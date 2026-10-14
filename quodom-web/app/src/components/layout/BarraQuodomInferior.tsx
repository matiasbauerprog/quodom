import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { quodom as quodomApi } from '../../api/quodom';
import type { Quodom } from '../../api/types';
import { resumenCarritosInvitado } from '../../guest/resumenInvitado';
import { AvisoSinGuardar } from '../AvisoSinGuardar';
import { ArbolQuodoms } from './ArbolQuodoms';
import { PanelQuodomsActivos, type ItemActivo } from './PanelQuodomsActivos';
import { abiertoDe, sanearAbiertos } from '../../quodom/quodomAbierto';
import { ramasDeQuodoms } from '../../quodom/ramas';
import { rubrosDisponibles } from '../../quodom/rubrosDisponibles';
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
  // `null` = todavía no hay datos (distinto de una lista vacía: "cargó y no hay nada").
  const [list, setList] = useState<Quodom[] | null>(null);
  // null = no se pudo saber qué rubros hay: se muestra todo sin filtrar.
  const [disponibles, setDisponibles] = useState<number[] | null>(null);
  const [invitados, setInvitados] = useState<ItemActivo[]>(itemsCarritosInvitado);
  const [abierto, setAbierto] = useState(false);
  const [nonce, setNonce] = useState(0);
  // El abierto de cada rubro vive en localStorage: sin suscribirse, el resumen
  // de la barra cerrada no se repintaría al cambiarlo desde el árbol.
  const [, setVersion] = useState(0);
  const contenedor = useRef<HTMLDivElement>(null);
  // Sólo se aplica la respuesta del pedido más reciente.
  const requestIdRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const cargar = () => {
      setInvitados(itemsCarritosInvitado());
      if (!user) { setList([]); return; }
      const requestId = ++requestIdRef.current;
      // Los rubros sólo esconden los retirados: si fallan, el árbol sale sin
      // filtrar en vez de desaparecer. Mismo criterio que MisQuodomsSidebar.
      Promise.allSettled([quodomApi.misQuodom(), rubrosDisponibles()])
        .then(([quodoms, rubros]) => {
          if (!alive || requestId !== requestIdRef.current) return;
          if (quodoms.status === 'rejected') throw quodoms.reason;
          const d = quodoms.value;
          setList(d);
          setDisponibles(rubros.status === 'fulfilled' ? rubros.value : null);
          // Sólo tras una carga buena: con una lista vacía por error cerraría
          // todos los Quodoms que el usuario tenía abiertos.
          sanearAbiertos(d.filter(q => q.estado === 'CREADO').map(q => q.id));
        })
        .catch(() => {
          if (!alive || requestId !== requestIdRef.current) return;
          // Un refresco puede fallar de forma transitoria: sólo se vacía si
          // todavía no había nada bueno que mostrar.
          setList(prev => (prev === null ? [] : prev));
        });
    };
    cargar();
    const releer = () => setVersion(v => v + 1);
    window.addEventListener('quodom:changed', cargar);
    window.addEventListener('storage', cargar);
    window.addEventListener('quodom:abierto', releer);
    return () => {
      alive = false;
      window.removeEventListener('quodom:changed', cargar);
      window.removeEventListener('storage', cargar);
      window.removeEventListener('quodom:abierto', releer);
    };
  // Depend on the user's id (a primitive), not the `user` object itself.
  }, [user?.id, nonce]);

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

  const todos = list ?? [];
  const ramas = ramasDeQuodoms(todos, disponibles ?? todos.map(q => q.idrubro));
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
            <ArbolQuodoms ramas={ramas} onCambio={() => setNonce(n => n + 1)} />
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
        aria-expanded={abierto}
        aria-controls="barra-quodom-panel"
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
