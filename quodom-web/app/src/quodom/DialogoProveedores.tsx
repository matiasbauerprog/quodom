import { useCallback, useEffect, useState } from 'react';
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
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  // Qué renglón está trabajando: un placeid, o 'sin-proveedor' para el pie.
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await proveedores.delQuodom(idquodom);
      setDatos(r);
      setError(null);
    } catch (e) {
      setDatos(null);
      setError(e instanceof Error ? e.message : 'Falló la búsqueda.');
    } finally {
      setCargando(false);
    }
  }, [idquodom]);

  useEffect(() => { void cargar(); }, [cargar]);

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

  async function deshacer(p: Proveedor) {
    setOcupado(p.placeid);
    setErrorEnvio(null);
    try {
      // El motivo es opcional y el diálogo no lo pregunta: deshacer cuesta un
      // solo toque, que es lo que hace que el dato llegue.
      await proveedores.noEnviado(idquodom, p.placeid, undefined);
      await cargar();
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
            {/* Un ancla y no un Link del router: el diálogo se abre desde varias
                superficies, y el router no es suyo. */}
            <a href="/direcciones">Revisá tu dirección</a>
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
                    {p.sinwhatsapp && (
                      <p className="dp-nota">Otro usuario reportó que no tiene WhatsApp.</p>
                    )}
                    {contactado && <p className="dp-marca">Ya le mandaste este Quodom.</p>}

                    <div className="dp-acciones-prov">
                      {!contactado && p.telefono && (
                        <button
                          type="button"
                          className="btn btn-whatsapp dp-wa"
                          onClick={() => enviarA(p)}
                          disabled={ocupado === p.placeid}
                        >
                          {ocupado === p.placeid ? 'Abriendo WhatsApp…' : 'Enviar por WhatsApp'}
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
                      {contactado && (
                        <button
                          type="button"
                          className="dp-deshacer"
                          onClick={() => deshacer(p)}
                          disabled={ocupado === p.placeid}
                        >
                          No se envió
                        </button>
                      )}
                    </div>
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
