import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { resumenCarritosInvitado } from '../../guest/resumenInvitado';
import { AvisoSinGuardar } from '../AvisoSinGuardar';
import { ArbolQuodoms } from './ArbolQuodoms';
import { PanelQuodomsActivos, type ItemActivo } from './PanelQuodomsActivos';
import { abiertoDe } from '../../quodom/quodomAbierto';
import { nombreRubro } from '../../quodom/rubros';
import { PanelVacio } from './PanelVacio';
import { useQuodomsEnArmado } from '../../quodom/useQuodomsEnArmado';
import { useArrastreActivo } from '../../quodom/useArrastreActivo';
import { AvisoAgregado } from './AvisoAgregado';
import { DestinoCompacto } from './DestinoCompacto';
import { useEsMovil } from './useEsMovil';
import { useHojaDeslizable } from './useHojaDeslizable';
import { CuerpoQuodomAbierto } from './CuerpoQuodomAbierto';
import { useTieneDireccion } from '../../quodom/useTieneDireccion';
import { DialogoProveedores } from '../../quodom/DialogoProveedores';
import './BarraQuodomInferior.css';

// A guest cart left over after a declined ('cancelar') migration, or one
// simply never logged into, stays in localStorage (spec §6). Once logged in,
// the tree only lists server Quodoms, so without this it becomes unreachable
// except by typing /quodom?rubro=<id> or signing out.
// Labelled distinctly ('sin guardar') so it doesn't read as a server Quodom.
/** Cuánto tiene que quedarse el producto arrastrado sobre la barra para que la
 *  hoja se abra sola: pasar de largo no la abre. */
export const ESPERA_ABRIR_MS = 800;

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
  const [params] = useSearchParams();
  const enPantalla = Number(params.get('rubro')) || null;
  const [invitados, setInvitados] = useState<ItemActivo[]>(itemsCarritosInvitado);
  const [abierto, setAbierto] = useState(false);
  // El abierto de cada rubro vive en localStorage: sin suscribirse, el resumen
  // de la barra cerrada no se repintaría al cambiarlo desde el árbol.
  const [, setVersion] = useState(0);
  const contenedor = useRef<HTMLDivElement>(null);
  const fila = useRef<HTMLDivElement>(null);
  const arrastrando = useArrastreActivo();
  const esMovil = useEsMovil();
  // Quién abrió la hoja. Una que abrió el arrastre se vuelve a cerrar al
  // terminarlo: abierta tapa la lista de la que vino el usuario, y en escritorio
  // el panel cerrado también sigue cerrado después de soltar. Una que abrió el
  // usuario a mano no se toca.
  const abiertaPorArrastre = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const altoHoja = useCallback(() => panel.current?.offsetHeight || window.innerHeight * 0.4, []);
  const cambiarConGesto = useCallback((a: boolean) => { abiertaPorArrastre.current = false; setAbierto(a); }, []);
  const hoja = useHojaDeslizable({ abierta: abierto, onCambio: cambiarConGesto, alto: altoHoja });
  const tieneDireccion = useTieneDireccion(!!user);
  // Como en el panel de escritorio: vive acá y no en la tarjeta, porque el envío
  // saca al Quodom del árbol y el diálogo se iría con él.
  const [proveedoresDe, setProveedoresDe] = useState<string | null>(null);

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
    // Tocar afuera NO la cierra (2026-10-21, lo pidió el usuario): abierta ocupa
    // la mitad de abajo y la de arriba es para usar el catálogo — tocar `+` y ver
    // la línea aparecer en el Quodom. Se cierra con la flecha o deslizando.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto]);

  // Abierta, el catálogo le reserva abajo su alto además del de la barra: si
  // no, los últimos productos quedan tapados por la hoja y no hay cómo llegar.
  useEffect(() => {
    const el = panel.current;
    if (!abierto || !el || typeof ResizeObserver === 'undefined') return;
    const raiz = document.documentElement;
    const medir = () => raiz.style.setProperty('--alto-hoja', el.offsetHeight + 'px');
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    medir();
    return () => { ro.disconnect(); raiz.style.removeProperty('--alto-hoja'); };
  }, [abierto]);

  // Abrirla a mano acomoda el catálogo: las subcategorías suben hasta debajo
  // del nav (lo pidió el usuario), así lo que queda a la vista arriba de la
  // hoja es lo que se usa para buscar. Corre después del efecto de arriba, con
  // el espacio de la hoja ya reservado al pie, que es lo que deja scrollear
  // hasta ahí en una página corta. No si la abrió un arrastre: movería la
  // página debajo del dedo.
  useEffect(() => {
    if (!abierto || abiertaPorArrastre.current) return;
    const tabs = document.querySelector('.subtabs');
    if (!tabs) return;
    const nav = document.querySelector('.appbar')?.getBoundingClientRect().height ?? 0;
    const top = window.scrollY + tabs.getBoundingClientRect().top - nav - 8;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, [abierto]);

  // Con el producto quieto sobre la barra un rato, la hoja se abre sola para
  // soltarlo en un Quodom puntual. Se mide con el hit-test del arrastre, porque
  // el fantasma que sigue al dedo no deja llegar los eventos a la barra.
  useEffect(() => {
    if (!arrastrando || !esMovil || abierto) return;
    let espera: ReturnType<typeof setTimeout> | null = null;
    const mover = (e: PointerEvent) => {
      const bajo = document.elementFromPoint(e.clientX, e.clientY);
      const encima = !!bajo && !!contenedor.current?.contains(bajo);
      if (encima && espera === null) {
        espera = setTimeout(() => {
          abiertaPorArrastre.current = true;
          setAbierto(true);
        }, ESPERA_ABRIR_MS);
      } else if (!encima && espera !== null) {
        clearTimeout(espera);
        espera = null;
      }
    };
    window.addEventListener('pointermove', mover);
    return () => {
      window.removeEventListener('pointermove', mover);
      if (espera !== null) clearTimeout(espera);
    };
  }, [arrastrando, esMovil, abierto]);

  useEffect(() => {
    if (arrastrando || !abiertaPorArrastre.current) return;
    abiertaPorArrastre.current = false;
    setAbierto(false);
  }, [arrastrando]);

  // El alto real de la barra, para que el contenido le reserve justo eso: con
  // el texto en dos renglones mide más que los 72px fijos de antes.
  useEffect(() => {
    const el = fila.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const raiz = document.documentElement;
    const medir = () => raiz.style.setProperty('--alto-barra', el.offsetHeight + 'px');
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    medir();
    return () => { ro.disconnect(); raiz.style.removeProperty('--alto-barra'); };
  }, []);

  const enArmado = ramas.reduce((n, r) => n + r.quodoms.length, 0);
  const total = enArmado + invitados.length;

  // La barra está siempre, con Quodoms o sin ellos y desde el primer momento: es
  // la única entrada al panel en celular. Antes esperaba la primera respuesta,
  // y con Render dormido eso era medio minuto sin barra —el usuario no entendía
  // qué hacía para que apareciera—. Mientras carga dice eso, y no "ninguno".
  const cargando = list === null;

  // A qué Quodom suma **el rubro que estoy mirando**. Antes listaba el abierto
  // de todos los rubros, así que en celular decía "Sumando a: Limpieza" todo el
  // tiempo, incluso navegando Pinturería: el dato era cierto y la respuesta a la
  // pregunta que nadie hizo. El rubro de la pantalla es el que manda, igual que
  // en el panel de escritorio.
  const rama = enPantalla === null ? null : ramas.find(r => r.idrubro === enPantalla);
  const abiertoAcá = rama?.quodoms.find(q => q.id === abiertoDe(rama.idrubro)) ?? null;

  const etiqueta = (() => {
    if (cargando) return { prefijo: null, texto: 'Cargando tus Quodoms…' };
    if (enPantalla !== null) {
      // El nombre sale de la rama; si ese rubro no tiene rama (retirado, o la
      // lista de rubros no cargó), del catálogo local.
      const nombre = rama?.nombre ?? nombreRubro(enPantalla);
      if (abiertoAcá) return { prefijo: 'Sumando a:', texto: abiertoAcá.descripcion || abiertoAcá.nro };
      return { prefijo: nombre + ' ·', texto: 'elegís el Quodom al agregar' };
    }
    if (total === 0) return { prefijo: null, texto: 'Ningún Quodom en armado' };
    return { prefijo: null, texto: total === 1 ? '1 Quodom en armado' : total + ' Quodoms en armado' };
  })();

  // Durante el gesto la hoja sigue al dedo desde donde estaba: abierta, baja
  // con él; cerrada, arranca escondida detrás de la barra y sube.
  function desplazamientoHoja(): number {
    const d = hoja.desplazamiento;
    return abierto ? Math.max(0, d) : Math.max(0, altoHoja() + d);
  }

  return (
    <div className="barra-quodom-wrap" ref={contenedor}>
      <AvisoAgregado ramas={ramas} className="barra-quodom-agregado" />
      {(abierto || hoja.arrastrando) && (
        <div
          ref={panel}
          className={'barra-quodom-panel' + (hoja.arrastrando ? ' barra-quodom-panel-moviendo' : '')}
          id="barra-quodom-panel"
          role="region"
          aria-label="Quodoms activos"
          style={hoja.arrastrando ? { transform: 'translateY(' + desplazamientoHoja() + 'px)' } : undefined}
        >
          {/* Lo que se agarra para bajarla: el contenido scrollea, así que el
              gesto de cerrar necesita un lugar propio. Tocarla también la
              cierra, de una (lo pidió el usuario): es donde va el dedo. */}
          <div
            className="barra-quodom-manija"
            data-testid="barra-manija"
            aria-hidden="true"
            onPointerDown={hoja.onPointerDown}
            onClick={() => { if (!hoja.consumirClic()) setAbierto(false); }}
          />
          {cargando
            ? <p className="barra-quodom-cargando">Cargando tus Quodoms…</p>
            : total === 0 && <PanelVacio />}
          {ramas.length > 0 && (
            <ArbolQuodoms
              ramas={ramas}
              onCambio={refresh}
              renderAbierto={q => (
                <CuerpoQuodomAbierto q={q} tieneDireccion={tieneDireccion} onCambio={refresh} onCotizar={x => setProveedoresDe(x.id)} />
              )}
            />
          )}
          {invitados.length > 0 && (
            <PanelQuodomsActivos items={invitados} onNavegar={() => setAbierto(false)} />
          )}
          {!user && invitados.length > 0 && (
            <AvisoSinGuardar onNavegar={() => setAbierto(false)} />
          )}
        </div>
      )}
      {/* Mientras se arrastra, la barra es donde se suelta: lo mismo que la
          pestaña del panel oculto en escritorio. Sigue aunque la hoja se abra
          (sola o a mano): quedarse quieto sobre el destino antes de soltar es lo
          natural, y abrirse la hoja no puede llevárselo de abajo del dedo. Está
          a la vista, así que no es un duplicado escondido del árbol. En
          escritorio no se monta (ver useEsMovil). */}
      {user && arrastrando && esMovil && (
        <DestinoCompacto arrastrando={arrastrando} ramas={ramas} className="barra-quodom-soltar" />
      )}
      <div className="barra-quodom-fila" ref={fila}>
      <button
        type="button"
        className="barra-quodom"
        data-testid="barra-toggle"
        aria-expanded={abierto}
        aria-controls={abierto ? 'barra-quodom-panel' : undefined}
        onPointerDown={hoja.onPointerDown}
        onClick={() => { if (!hoja.consumirClic()) setAbierto(a => !a); }}
      >
        {total > 0 && <span className="barra-quodom-count">{total}</span>}
        {/* Abierta, el destino ya está a la vista en la tarjeta blanca de la
            hoja: repetirlo acá le saca lugar al catálogo. */}
        <span className="barra-quodom-label">
          {abierto ? (
            <span className="barra-quodom-destino">Mis Quodoms</span>
          ) : (
            <>
              {etiqueta.prefijo && <span className="barra-quodom-prefijo">{etiqueta.prefijo}</span>}
              <span className="barra-quodom-destino">{etiqueta.texto}</span>
            </>
          )}
        </span>
        <span className="barra-quodom-arrow" aria-hidden="true">{abierto ? '⌄' : '⌃'}</span>
      </button>
      </div>
      {proveedoresDe && (
        <DialogoProveedores
          idquodom={proveedoresDe}
          onCerrar={() => setProveedoresDe(null)}
          onEnviado={() => { window.dispatchEvent(new Event('quodom:changed')); refresh(); }}
          onEnviadoSinProveedor={() => setProveedoresDe(null)}
        />
      )}
    </div>
  );
}
