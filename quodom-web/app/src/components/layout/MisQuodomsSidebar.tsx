import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import type { Quodom } from '../../api/types';
import { LineasQuodomSidebar } from './LineasQuodomSidebar';
import { ArbolQuodoms, cuentaProductos } from './ArbolQuodoms';
import { RotuloRubro } from './RotuloRubro';
import { TarjetaDestino } from './TarjetaDestino';
import { AvisoSinGuardar } from '../AvisoSinGuardar';
import { PanelVacio } from './PanelVacio';
import { resumenCarritosInvitado, type ResumenInvitado } from '../../guest/resumenInvitado';
import { bloqueoDeEnvio, conFaltaConcreta, type FaltaAtributo } from '../../quodom/bloqueosEnvio';
import { useQuodomsEnArmado } from '../../quodom/useQuodomsEnArmado';
import { useTieneDireccion } from '../../quodom/useTieneDireccion';
import { useArrastreActivo } from '../../quodom/useArrastreActivo';
import { DialogoProveedores } from '../../quodom/DialogoProveedores';
import { NotificacionesQuodom } from '../Notificaciones/NotificacionesQuodom';
import { guardarPanel, usePanelCerrado } from './panelLateral';
import { abiertoDe } from '../../quodom/quodomAbierto';
import type { ArrastreActivo } from '../../quodom/useArrastreActivo';
import type { RamaRubro } from './ArbolQuodoms';
import type { Agregado } from '../../quodom/agregarProducto';
import { nombreRubro } from '../../quodom/rubros';

/**
 * With the panel closed the tree isn't visible, so adding something — with +,
 * the destination dialog or a drop — left no trace on screen. This says what
 * went in and where, under the tab, for a few seconds. Open, the tree already
 * shows it and the notice isn't mounted.
 */
function AvisoAgregado({ ramas }: { ramas: RamaRubro[] }) {
  const [ultimo, setUltimo] = useState<Agregado | null>(null);
  useEffect(() => {
    const oir = (e: Event) => setUltimo((e as CustomEvent<Agregado>).detail);
    window.addEventListener('quodom:agregado', oir);
    return () => window.removeEventListener('quodom:agregado', oir);
  }, []);
  useEffect(() => {
    if (!ultimo) return;
    const t = setTimeout(() => setUltimo(null), 3500);
    return () => clearTimeout(t);
  }, [ultimo]);
  if (!ultimo) return null;

  const q = ramas.find(r => r.idrubro === ultimo.idrubro)?.quodoms.find(x => x.id === ultimo.idquodom);
  const destino = q
    ? q.descripcion || q.nro
    : ultimo.idquodom === null
      ? 'tu carrito de ' + nombreRubro(ultimo.idrubro)
      : 'tu Quodom de ' + nombreRubro(ultimo.idrubro);
  return (
    <p className="mq-sidebar-agregado" role="status" aria-label={'Agregado: ' + ultimo.nombre + ' a ' + destino}>
      <span className="mq-sidebar-agregado-ok" aria-hidden="true">✓</span>
      <span><strong>{ultimo.nombre}</strong> agregado a {destino}</span>
    </p>
  );
}

/**
 * With the panel closed, the only drop target left: a small box under the tab.
 * It goes to the open Quodom of the product's rubro — the same one `+` would
 * use — or, with none open, to a new one. It's only mounted closed: open, the
 * tree has the real targets, and a hidden duplicate would still be in the DOM. Being a `data-destino`/`data-nuevo` like the
 * tree's, the drop goes through the same path and the panel stays closed.
 */
function DestinoCompacto({ arrastrando, ramas }: { arrastrando: ArrastreActivo; ramas: RamaRubro[] }) {
  const { idrubro, nombreRubro } = arrastrando;
  const id = abiertoDe(idrubro);
  const abierto = ramas.find(r => r.idrubro === idrubro)?.quodoms.find(q => q.id === id);
  if (abierto) {
    return (
      <div className="mq-sidebar-soltar" data-destino={abierto.id} data-rubro={idrubro}>
        Soltá para sumar a <strong>{abierto.descripcion || abierto.nro}</strong>
      </div>
    );
  }
  return (
    <div className="mq-sidebar-soltar" data-nuevo={idrubro} data-rubro={idrubro}>
      Soltá para crear un Quodom de <strong>{nombreRubro}</strong>
    </div>
  );
}
import './MisQuodomsSidebar.css';

export function MisQuodomsSidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const tieneDireccion = useTieneDireccion(!!user);
  const [invitado, setInvitado] = useState<ResumenInvitado[]>(resumenCarritosInvitado);
  // De qué Quodom está abierto el selector de proveedores. Vive acá y no en la
  // tarjeta porque el envío lo pasa a ENVIADO y lo saca del árbol: dibujado
  // adentro, el diálogo se desmontaría justo cuando el comprador va por el
  // segundo proveedor.
  const [proveedoresDe, setProveedoresDe] = useState<string | null>(null);
  // Qué línea frena el envío de cada Quodom, para nombrarla en el motivo. La
  // reportan las listas abiertas, que son las únicas que tienen las líneas.
  const [faltas, setFaltas] = useState<Record<string, FaltaAtributo | null>>({});
  const { list, ramas, refresh } = useQuodomsEnArmado(user?.id);
  const arrastrando = useArrastreActivo();
  const panelCerrado = usePanelCerrado();

  // Devolver `prev` cuando no cambió nada es lo que corta el ciclo: la lista
  // reporta en un efecto, así que un objeto nuevo en cada pasada volvería a
  // renderizar al padre para siempre.
  const reportarFalta = useCallback((idquodom: string, falta: FaltaAtributo | null) => {
    setFaltas(prev => {
      const antes = prev[idquodom] ?? null;
      if (antes?.producto === falta?.producto && antes?.atributo === falta?.atributo) return prev;
      return { ...prev, [idquodom]: falta };
    });
  }, []);

  // Los carritos de invitado se releen siempre: sobreviven a un login que
  // canceló la migración, así que también hay que mostrarlos con sesión.
  useEffect(() => {
    const releer = () => setInvitado(resumenCarritosInvitado());
    releer();
    window.addEventListener('quodom:changed', releer);
    window.addEventListener('storage', releer);
    return () => {
      window.removeEventListener('quodom:changed', releer);
      window.removeEventListener('storage', releer);
    };
  }, [user?.id]);

  const hayInvitado = invitado.length > 0;

  // Cotizar ya no manda el Quodom: abre el selector de proveedores, que es el
  // que envía. Hasta que el comprador elija (o use "enviar sin elegir"), el
  // Quodom sigue en CREADO.
  function enviar(q: Quodom) {
    setProveedoresDe(q.id);
  }

  // El estado lo cambia el backend al dar el link: este aviso hace que el árbol
  // y la barra inferior lo suelten, en vez de seguir mostrándolo activo.
  function avisarEnviado() {
    window.dispatchEvent(new Event('quodom:changed'));
    refresh();
  }

  // Sin sesión ya se ven los carritos de invitado, así que "ingresá para ver
  // tus Quodoms" dejó de ser cierto: el vacío es el mismo mensaje para los dos.
  const vacio = !hayInvitado && (!user || (list !== null && !ramas.some(r => r.quodoms.length > 0)));

  // "3 en armado · 2 rubros": lo que antes había que contar a ojo recorriendo
  // la lista entera, que es justo lo que no se puede hacer cuando no entra.
  const enArmado = ramas.reduce((n, r) => n + r.quodoms.length, 0) + invitado.length;
  const rubrosConAlgo = new Set([
    ...ramas.filter(r => r.quodoms.length > 0).map(r => r.idrubro),
    ...invitado.map(r => r.idrubro)
  ]).size;

  return (
    <aside className="mq-sidebar" aria-label="Mis Quodoms">
      <header className="mq-sidebar-cab">
        <div className="mq-sidebar-marca">
          <div className="mq-sidebar-fila">
            <h2 className="mq-sidebar-title">Mis Quodoms</h2>
            {/* Sólo se ve con el panel cerrado (lo decide el CSS, por
                `data-panel-cerrado`): es lo que queda arriba a la derecha, y
                tocarlo lo vuelve a abrir al ancho original. */}
            <button
              type="button"
              className="mq-sidebar-abrir"
              aria-label="Abrir Mis Quodoms"
              onClick={() => guardarPanel(null)}
            >Mis Quodoms</button>
            <NotificacionesQuodom />
          </div>
          <span className="mq-sidebar-regla" aria-hidden="true" />
          {enArmado > 0 && (
            <span className="mq-sidebar-resumen">
              {enArmado} en armado{rubrosConAlgo > 1 && ' · ' + rubrosConAlgo + ' rubros'}
            </span>
          )}
        </div>
        {/* Arriba y no al pie: al pie repetía el título y se iba de pantalla en
            cuanto la lista crecía, que es cuando más hace falta. */}
        {user && <Link to="/mis-quodoms" className="mq-sidebar-vertodos">Ver historial →</Link>}
        {panelCerrado && <AvisoAgregado ramas={ramas} />}
        {user && arrastrando && panelCerrado && <DestinoCompacto arrastrando={arrastrando} ramas={ramas} />}
      </header>

      {/* Mientras se arrastra, el panel dice qué se está arrastrando y a dónde
          puede ir: el borde verde solo no alcanza para explicar la regla. */}
      {arrastrando && (
        <p className="mq-sidebar-arrastre" role="status">
          Soltá <strong>{arrastrando.nombre}</strong> en un Quodom de {arrastrando.nombreRubro}, o creá uno nuevo.
        </p>
      )}

      {vacio && <PanelVacio />}

      {/* Un carrito de invitado se dibuja como el Quodom que todavía no es: la
          misma tarjeta del destino, con el chip "Sin guardar" en vez del verde. */}
      {invitado.map(r => (
        <section key={'g:' + r.idrubro} className="mq-sidebar-rama">
          <RotuloRubro nombre={r.nombreRubro} />
          <TarjetaDestino
            nombre={r.descripcion}
            chip={{ texto: 'Sin guardar', tono: 'alerta' }}
            cuenta={cuentaProductos(r.cantproductos)}
            onActivar={() => navigate('/quodom?rubro=' + r.idrubro)}
          >
            <LineasQuodomSidebar modo="invitado" idrubro={r.idrubro} onChange={refresh} />
          </TarjetaDestino>
        </section>
      ))}

      {ramas.length > 0 && (
        <ArbolQuodoms
          ramas={ramas}
          onCambio={refresh}
          renderAbierto={q => {
            // El bloqueo lo decide el resumen (es el que coincide con lo que va
            // a contestar el backend); las líneas sólo le ponen nombre.
            const bloqueo = conFaltaConcreta(bloqueoDeEnvio(q, tieneDireccion), faltas[q.id] ?? null);
            return (
              <>
                <LineasQuodomSidebar
                  modo="servidor"
                  idquodom={q.id}
                  onChange={refresh}
                  onFalta={falta => reportarFalta(q.id, falta)}
                />
                <div className="mq-sidebar-enviar">
                  {bloqueo ? (
                    <p className="mq-sidebar-motivo">
                      <span className="mq-sidebar-icono" aria-hidden="true">!</span>
                      <span>
                        {bloqueo.texto}{' '}
                        {bloqueo.motivo === 'direccion'
                          ? <Link to="/direcciones/nuevo">{bloqueo.accion}</Link>
                          : <span>{bloqueo.accion}</span>}
                      </span>
                    </p>
                  ) : (
                    <p className="mq-sidebar-motivo mq-sidebar-motivo-listo">
                      <span className="mq-sidebar-icono mq-sidebar-icono-ok" aria-hidden="true">✓</span>
                      <span>Listo para pedir presupuesto.</span>
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn btn-block btn-whatsapp"
                    disabled={!!bloqueo}
                    onClick={() => { if (!bloqueo) enviar(q); }}
                  >
                    Cotizar por WhatsApp
                  </button>
                </div>
              </>
            );
          }}
        />
      )}

      {!user && hayInvitado && <AvisoSinGuardar />}

      {proveedoresDe && (
        <DialogoProveedores
          idquodom={proveedoresDe}
          onCerrar={() => setProveedoresDe(null)}
          onEnviado={avisarEnviado}
          onEnviadoSinProveedor={() => setProveedoresDe(null)}
        />
      )}
    </aside>
  );
}
