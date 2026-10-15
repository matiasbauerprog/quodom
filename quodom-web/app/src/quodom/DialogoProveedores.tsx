import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { proveedores } from '../api/proveedores';
import type { RespuestaProveedores } from '../api/proveedores';
import type { Proveedor } from '../api/types';
import { quodom } from '../api/quodom';
import { openWhatsappLink } from '../utils/whatsapp';
import './DialogoProveedores.css';

type Props = {
  idquodom: string;
  onCerrar: () => void;
  /** Avisa que el Quodom salió sin destinatario, para que quien abrió el diálogo cierre y refresque. */
  onEnviadoSinProveedor?: () => void;
};

/** El link al lugar en Maps: el place_id es lo único que lo identifica sin ambigüedad. */
function linkMaps(p: Proveedor): string {
  return 'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(p.nombre) + '&query_place_id=' + encodeURIComponent(p.placeid);
}

/** 0.4 → "0,4 km". La coma decimal es la de acá; un "0.4 km" se lee como otro número. */
function km(valor: number): string {
  return valor.toFixed(1).replace('.', ',') + ' km';
}

function puntuacion(valor: number): string {
  return valor.toFixed(1).replace('.', ',');
}

/**
 * Los proveedores cerca del Quodom, en el momento de enviarlo.
 *
 * La regla que manda acá: **una falla de la búsqueda no puede dejar al comprador
 * sin enviar**. "Enviar sin elegir proveedor" está en los tres estados —con
 * lista, con lista vacía y con la búsqueda caída— porque antes de este feature
 * el comprador siempre podía enviar, y eso no lo puede romper una API ajena.
 *
 * Las tres situaciones de teléfono están medidas contra la API de Google y son
 * distintas entre sí:
 * - `telefono` es el número con el que se abre WhatsApp y `telefonovisible` el
 *   que se muestra y se llama. Un 0800 es un número válido que no recibe
 *   WhatsApp: llega con `telefono` en null y `telefonovisible` puesto, así que
 *   el renglón ofrece Llamar y no WhatsApp. Ofrecer WhatsApp ahí manda al
 *   comprador a un chat que nunca abre, y lo lee como que el comercio no tiene.
 * - `sintelefono` es que Google no tiene ningún número: ni WhatsApp ni Llamar,
 *   sólo el mapa, y el renglón lo dice.
 * - `esfijo` es un aviso y nunca un bloqueo: un fijo puede tener WhatsApp Business.
 */
export function DialogoProveedores({ idquodom, onCerrar, onEnviadoSinProveedor }: Props) {
  const [datos, setDatos] = useState<RespuestaProveedores | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avisoRecarga, setAvisoRecarga] = useState<string | null>(null);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  // Qué renglón está trabajando: un placeid, o 'sin-proveedor' para el pie.
  const [ocupado, setOcupado] = useState<string | null>(null);
  // De qué renglón se está preguntando el motivo de "no se envió".
  const [preguntandoMotivo, setPreguntandoMotivo] = useState<string | null>(null);

  /**
   * `primera` separa la carga inicial de las recargas, y la diferencia no es
   * cosmética: cada llamada es una búsqueda **paga** a Google con tope de
   * 10/min. Si una recarga falla —el tope, un 503—, la lista que el comprador
   * ya tiene en pantalla se queda donde está y el fallo se cuenta como aviso.
   * Borrarla le saca los proveedores que todavía no contactó, y la atribución,
   * un segundo después de haberlos tenido delante.
   */
  const cargar = useCallback(async (primera = false) => {
    if (primera) setCargando(true);
    try {
      const r = await proveedores.delQuodom(idquodom);
      setDatos(r);
      setError(null);
      setAvisoRecarga(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falló la búsqueda.';
      if (primera) {
        setDatos(null);
        setError(msg);
      } else {
        setAvisoRecarga(msg);
      }
    } finally {
      if (primera) setCargando(false);
    }
  }, [idquodom]);

  useEffect(() => { void cargar(true); }, [cargar]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !ocupado) onCerrar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar, ocupado]);

  function cerrar() {
    if (ocupado) return;
    onCerrar();
  }

  async function enviarA(p: Proveedor) {
    if (!p.telefono) return;
    setOcupado(p.placeid);
    setErrorEnvio(null);
    try {
      const r = await quodom.whatsapp(idquodom, { proveedor: p.placeid, tel: p.telefono });
      openWhatsappLink(r.link);
      // Se recarga para que el renglón vuelva marcado: el contacto lo anota el
      // servidor, así que la marca sale de él y no de un estado local.
      await cargar();
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : 'No pudimos enviar el Quodom.');
    } finally {
      setOcupado(null);
    }
  }

  async function enviarSinProveedor() {
    setOcupado('sin-proveedor');
    setErrorEnvio(null);
    try {
      const r = await quodom.whatsapp(idquodom);
      openWhatsappLink(r.link);
      onEnviadoSinProveedor?.();
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : 'No pudimos enviar el Quodom.');
    } finally {
      setOcupado(null);
    }
  }

  /**
   * "No se envió" es una corrección, y por eso pregunta el motivo:
   * `sin_whatsapp` es el único dato propio que acumula el feature (por
   * place_id, sin límite de tiempo) y es lo que hace que la lista de una zona
   * mejore con el uso. Es un camino aparte de "Volver a enviar" justamente por
   * eso: si reintentar pasara por acá, cada reintento ensuciaría ese dato
   * diciendo que el comercio no tiene WhatsApp.
   */
  async function deshacer(p: Proveedor, motivo: 'sin_whatsapp' | 'otro') {
    setOcupado(p.placeid);
    setErrorEnvio(null);
    try {
      await proveedores.noEnviado(idquodom, p.placeid, motivo);
      // Con el 200 del propio noEnviado alcanza para liberar el renglón: volver
      // a preguntarle a Google es otra búsqueda paga que puede fallar por el
      // tope y dejar al comprador sin la lista que ya tenía.
      setDatos(d => d && ({
        ...d,
        proveedores: d.proveedores.map(x => x.placeid === p.placeid ? { ...x, contactadoen: null } : x)
      }));
      setPreguntandoMotivo(null);
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : 'No pudimos deshacer el envío.');
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="dp-backdrop" onClick={cerrar}>
      <section
        className="dp card hoja"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dp-titulo"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="dp-titulo" className="dp-titulo">
          {datos?.desde ? 'Proveedores cerca de ' + datos.desde : 'Proveedores cerca'}
        </h2>

        {datos && !datos.preciso && (
          <p className="dp-aprox">
            Tu dirección no está ubicada con precisión — las distancias son desde el centro de la localidad.{' '}
            {/* Un Link y no un href: un ancla recarga el documento entero en
                medio de un envío y se lleva el Quodom a medio mandar. */}
            <Link to="/direcciones">Revisá tu dirección</Link>
          </p>
        )}

        {avisoRecarga && (
          // No destructivo a propósito: la lista sigue en pantalla y esto sólo
          // avisa que no se pudo refrescar.
          <p className="dp-aviso" role="status">
            No pudimos actualizar la lista, así que seguís viendo la de hace un momento. {avisoRecarga}
          </p>
        )}

        {cargando && (
          // Esqueleto y no spinner: la forma de la lista ya se conoce, y un
          // spinner centrado la colapsa a una línea y la devuelve, que se lee
          // como una recarga de toda la pantalla.
          <ul className="dp-lista" aria-hidden="true">
            {[0, 1, 2].map(i => (
              <li key={i} className="dp-prov dp-prov-esqueleto">
                <span className="dp-linea esqueleto" />
                <span className="dp-linea dp-linea-corta esqueleto" />
                <span className="dp-boton-esqueleto esqueleto" />
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="dp-error" role="alert">No pudimos buscar proveedores cerca. {error}</p>
        )}

        {!cargando && !error && datos && datos.proveedores.length === 0 && (
          <p className="dp-vacio">No encontramos proveedores de este rubro cerca de tu dirección.</p>
        )}

        {!cargando && datos && datos.proveedores.length > 0 && (
          <ul className="dp-lista">
            {datos.proveedores.map(p => {
              const contactado = !!p.contactadoen;
              // El 0800 que no recibe WhatsApp igual se puede llamar: el número
              // para llamar es el visible cuando no hay uno de WhatsApp.
              const telLlamar = p.telefono || p.telefonovisible || null;
              return (
                <li key={p.placeid}>
                  <article className={'dp-prov' + (contactado ? ' dp-prov-contactado' : '')}>
                    <h3 className="dp-nombre">{p.nombre}</h3>
                    <p className="dp-datos">
                      {p.rating != null && <span className="dp-rating">{puntuacion(p.rating)}</span>}
                      {p.rating != null && p.resenas != null && (
                        <span className="dp-resenas">{p.resenas} {p.resenas === 1 ? 'reseña' : 'reseñas'}</span>
                      )}
                      <span className="dp-km">{km(p.distanciakm)}</span>
                    </p>
                    {p.direccion && <p className="dp-direccion">{p.direccion}</p>}

                    {p.sintelefono && (
                      <p className="dp-nota">Google no tiene el teléfono de este comercio.</p>
                    )}
                    {!p.sintelefono && p.esfijo && (
                      <p className="dp-nota">Es un teléfono fijo, puede no tener WhatsApp.</p>
                    )}
                    {/* El 0800: tiene teléfono, pero no uno que reciba WhatsApp.
                        Sin decirlo, la falta del botón se lee como un error nuestro. */}
                    {!p.sintelefono && !p.telefono && (
                      <p className="dp-nota">Este número no recibe WhatsApp.</p>
                    )}
                    {p.sinwhatsapp && (
                      <p className="dp-nota">Otro usuario reportó que no tiene WhatsApp.</p>
                    )}
                    {contactado && <p className="dp-marca">Ya le mandaste este Quodom.</p>}

                    <div className="dp-acciones-prov">
                      {/* El contactado conserva su botón: "le mandé y no me
                          contestaron, le mando otra vez" es el caso más común, y
                          el backend no lo impide ni lo duplica (refresca la marca).
                          Sin esto, el único camino de vuelta era "No se envió",
                          que afirma algo falso sobre lo que pasó. */}
                      {p.telefono && (
                        <button
                          type="button"
                          className="btn btn-whatsapp dp-wa"
                          onClick={() => enviarA(p)}
                          disabled={ocupado === p.placeid}
                        >
                          {ocupado === p.placeid
                            ? 'Abriendo WhatsApp…'
                            : contactado ? 'Volver a enviar' : 'Enviar por WhatsApp'}
                        </button>
                      )}
                      {telLlamar && (
                        <a className="dp-link" href={'tel:' + telLlamar.replace(/[^+\d]/g, '')}>
                          Llamar {p.telefonovisible || telLlamar}
                        </a>
                      )}
                      <a className="dp-link" href={linkMaps(p)} target="_blank" rel="noopener noreferrer">
                        Ver en Maps
                      </a>
                      {contactado && preguntandoMotivo !== p.placeid && (
                        <button
                          type="button"
                          className="dp-deshacer"
                          onClick={() => setPreguntandoMotivo(p.placeid)}
                          disabled={ocupado === p.placeid}
                        >
                          No se envió
                        </button>
                      )}
                    </div>

                    {contactado && preguntandoMotivo === p.placeid && (
                      <div className="dp-motivos" role="group" aria-label="Por qué no se envió">
                        <span className="dp-motivos-txt">¿Qué pasó?</span>
                        <button
                          type="button"
                          className="dp-deshacer"
                          onClick={() => deshacer(p, 'sin_whatsapp')}
                          disabled={ocupado === p.placeid}
                        >
                          No tiene WhatsApp
                        </button>
                        <button
                          type="button"
                          className="dp-deshacer"
                          onClick={() => deshacer(p, 'otro')}
                          disabled={ocupado === p.placeid}
                        >
                          Otro motivo
                        </button>
                      </div>
                    )}
                  </article>
                </li>
              );
            })}
          </ul>
        )}

        {errorEnvio && <p className="dp-error" role="alert">{errorEnvio}</p>}

        <div className="dp-pie">
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={enviarSinProveedor}
            disabled={ocupado === 'sin-proveedor'}
          >
            {ocupado === 'sin-proveedor' ? 'Abriendo WhatsApp…' : 'Enviar sin elegir proveedor'}
          </button>
          <button type="button" className="dp-cerrar" onClick={cerrar} disabled={!!ocupado}>Cerrar</button>
        </div>

        {/* La atribución es una exigencia de los términos de Google, no un adorno. */}
        {datos && <p className="dp-atribucion">{datos.atribucion}</p>}
      </section>
    </div>
  );
}
