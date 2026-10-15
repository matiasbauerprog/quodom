import type { Proveedor } from '../api/types';
import './FilaProveedor.css';

type Props = {
  proveedor: Proveedor;
  /** Este renglón está trabajando: se deshabilitan sus botones. */
  ocupado: boolean;
  /** Se le está preguntando por qué no se envió. */
  preguntandoMotivo: boolean;
  /**
   * Si el renglón ofrece "No se envió". Por omisión sí, que es lo que hace
   * falta en el momento del envío: el comprador acaba de tocar el botón y vio
   * que WhatsApp no abrió. **El historial lo apaga**, porque ese botón escribe
   * `sin_whatsapp`, un dato global, permanente y sin fecha por place_id que
   * leen las listas de todos los demás compradores. Días después ya no es una
   * observación sino un recuerdo —el comercio puede haber activado WhatsApp— y
   * lo que el comprador suele querer decir ahí es que no le contestaron, que es
   * otra cosa. Un toque degradaría a ese comercio para todo el mundo.
   */
  permiteDeshacer?: boolean;
  onEnviar: () => void;
  onPreguntarMotivo: () => void;
  onDeshacer: (motivo: 'sin_whatsapp' | 'otro') => void;
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

/** "15/10 a las 14:30": cuándo se le mandó, para el que vuelve al Quodom al otro día. */
function cuando(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return dd + '/' + mm + ' a las ' + hh + ':' + mi;
}

/**
 * Un proveedor, con lo que se puede hacer con él. Lo dibujan el selector que
 * aparece al enviar y la sección del Quodom ya enviado: **un solo renglón para
 * los dos**, porque las tres situaciones de teléfono de acá abajo están medidas
 * contra la API de Google y una segunda copia se despega de la primera a la
 * primera corrección.
 *
 * - `telefono` es el número con el que se abre WhatsApp y `telefonovisible` el
 *   que se muestra y se llama. Un 0800 es un número válido que no recibe
 *   WhatsApp: llega con `telefono` en null y `telefonovisible` puesto, así que
 *   el renglón ofrece Llamar y no WhatsApp. Ofrecer WhatsApp ahí manda al
 *   comprador a un chat que nunca abre, y lo lee como que el comercio no tiene.
 * - `sintelefono` es que Google no tiene ningún número: ni WhatsApp ni Llamar,
 *   sólo el mapa, y el renglón lo dice.
 * - `esfijo` es un aviso y nunca un bloqueo: un fijo puede tener WhatsApp Business.
 */
export function FilaProveedor({
  proveedor: p, ocupado, preguntandoMotivo, permiteDeshacer = true,
  onEnviar, onPreguntarMotivo, onDeshacer
}: Props) {
  const contactado = !!p.contactadoen;
  const fecha = p.contactadoen ? cuando(p.contactadoen) : '';
  // El 0800 que no recibe WhatsApp igual se puede llamar: el número para llamar
  // es el visible cuando no hay uno de WhatsApp.
  const telLlamar = p.telefono || p.telefonovisible || null;

  return (
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
      {contactado && (
        <p className="dp-marca">Ya le mandaste este Quodom{fecha && ' el ' + fecha}.</p>
      )}

      <div className="dp-acciones-prov">
        {/* El contactado conserva su botón: "le mandé y no me contestaron, le
            mando otra vez" es el caso más común, y el backend no lo impide ni
            lo duplica (refresca la marca). Sin esto, el único camino de vuelta
            era "No se envió", que afirma algo falso sobre lo que pasó. */}
        {p.telefono && (
          <button
            type="button"
            className="btn btn-whatsapp dp-wa"
            onClick={onEnviar}
            disabled={ocupado}
          >
            {ocupado
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
        {contactado && permiteDeshacer && !preguntandoMotivo && (
          <button
            type="button"
            className="dp-deshacer"
            onClick={onPreguntarMotivo}
            disabled={ocupado}
          >
            No se envió
          </button>
        )}
      </div>

      {contactado && permiteDeshacer && preguntandoMotivo && (
        <div className="dp-motivos" role="group" aria-label="Por qué no se envió">
          <span className="dp-motivos-txt">¿Qué pasó?</span>
          <button
            type="button"
            className="dp-deshacer"
            onClick={() => onDeshacer('sin_whatsapp')}
            disabled={ocupado}
          >
            No tiene WhatsApp
          </button>
          <button
            type="button"
            className="dp-deshacer"
            onClick={() => onDeshacer('otro')}
            disabled={ocupado}
          >
            Otro motivo
          </button>
        </div>
      )}
    </article>
  );
}
