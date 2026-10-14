import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { quodom as quodomApi } from '../../api/quodom';
import { ApiError } from '../../api/client';
import { openWhatsappLink } from '../../utils/whatsapp';
import type { Quodom } from '../../api/types';
import { LineasQuodomSidebar } from './LineasQuodomSidebar';
import { ArbolQuodoms, cuentaProductos } from './ArbolQuodoms';
import { RotuloRubro } from './RotuloRubro';
import { TarjetaDestino } from './TarjetaDestino';
import { AvisoSinGuardar } from '../AvisoSinGuardar';
import { resumenCarritosInvitado, type ResumenInvitado } from '../../guest/resumenInvitado';
import { bloqueoDeEnvio, conFaltaConcreta, type FaltaAtributo } from '../../quodom/bloqueosEnvio';
import { useQuodomsEnArmado } from '../../quodom/useQuodomsEnArmado';
import { useTieneDireccion } from '../../quodom/useTieneDireccion';
import { useArrastreActivo } from '../../quodom/useArrastreActivo';
import './MisQuodomsSidebar.css';

export function MisQuodomsSidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const tieneDireccion = useTieneDireccion(!!user);
  const [invitado, setInvitado] = useState<ResumenInvitado[]>(resumenCarritosInvitado);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [errEnviar, setErrEnviar] = useState<string | null>(null);
  // Qué línea frena el envío de cada Quodom, para nombrarla en el motivo. La
  // reportan las listas abiertas, que son las únicas que tienen las líneas.
  const [faltas, setFaltas] = useState<Record<string, FaltaAtributo | null>>({});
  const { list, ramas, refresh } = useQuodomsEnArmado(user?.id);
  const arrastrando = useArrastreActivo();

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

  async function enviar(q: Quodom) {
    if (enviando) return;
    setEnviando(q.id); setErrEnviar(null);
    try {
      const r = await quodomApi.whatsapp(q.id);
      openWhatsappLink(r.link);
      // El estado lo cambia el backend al dar el link: este aviso hace que el
      // árbol y la barra inferior lo suelten, en vez de seguir mostrándolo activo.
      window.dispatchEvent(new Event('quodom:changed'));
      refresh();
    } catch (e) {
      setErrEnviar(e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo enviar.');
    } finally { setEnviando(null); }
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
          <h2 className="mq-sidebar-title">Mis Quodoms</h2>
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
      </header>

      {/* Mientras se arrastra, el panel dice qué se está arrastrando y a dónde
          puede ir: el borde verde solo no alcanza para explicar la regla. */}
      {arrastrando && (
        <p className="mq-sidebar-arrastre" role="status">
          Soltá <strong>{arrastrando.nombre}</strong> en un Quodom de {arrastrando.nombreRubro}, o creá uno nuevo.
        </p>
      )}

      {vacio && (
        <div className="mq-sidebar-empty">
          <p className="mq-sidebar-empty-titulo">Armá tu primer Quodom</p>
          <ol className="mq-sidebar-pasos">
            <li><span className="mq-sidebar-paso-n">1</span><span>Elegí un rubro en el catálogo.</span></li>
            <li><span className="mq-sidebar-paso-n">2</span><span>Tocá + en un producto, o arrastralo hasta acá.</span></li>
            <li><span className="mq-sidebar-paso-n">3</span><span>Cotizá el Quodom por WhatsApp.</span></li>
          </ol>
          {!user && <Link to="/login" className="btn btn-block">Ingresar</Link>}
        </div>
      )}

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
                    disabled={enviando === q.id || !!bloqueo}
                    onClick={() => { if (!bloqueo) enviar(q); }}
                  >
                    {enviando === q.id ? 'Cotizando…' : 'Cotizar por WhatsApp'}
                  </button>
                </div>
              </>
            );
          }}
        />
      )}

      {errEnviar && <p className="mq-sidebar-err" role="alert">{errEnviar}</p>}

      {!user && hayInvitado && <AvisoSinGuardar />}
    </aside>
  );
}
