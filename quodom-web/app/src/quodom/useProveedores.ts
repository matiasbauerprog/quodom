import { useCallback, useEffect, useState } from 'react';
import { proveedores } from '../api/proveedores';
import type { RespuestaProveedores } from '../api/proveedores';
import type { Proveedor } from '../api/types';
import { quodom } from '../api/quodom';
import { openWhatsappLink } from '../utils/whatsapp';

type Opciones = {
  /** El Quodom salió, por cualquiera de los dos caminos: ya está en ENVIADO. */
  onEnviado?: () => void;
  /** Salió sin destinatario: el que lo abrió puede cerrar, no queda nada que elegir. */
  onEnviadoSinProveedor?: () => void;
};

/**
 * Los proveedores de un Quodom y lo que se puede hacer con ellos, compartido
 * por el selector que aparece al enviar y por la sección del Quodom ya
 * enviado. Está acá y no duplicado en los dos porque lo que vive en estas
 * funciones no es dibujo: es cuándo se le paga otra búsqueda a Google y qué
 * pasa cuando falla.
 */
export function useProveedores(idquodom: string, { onEnviado, onEnviadoSinProveedor }: Opciones = {}) {
  const [datos, setDatos] = useState<RespuestaProveedores | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  // Qué renglón está trabajando: un placeid, o 'sin-proveedor' para el pie.
  const [ocupado, setOcupado] = useState<string | null>(null);
  // De qué renglón se está preguntando el motivo de "no se envió".
  const [preguntandoMotivo, setPreguntandoMotivo] = useState<string | null>(null);

  /**
   * La búsqueda, **una sola vez por apertura**. Cada llamada se le paga a
   * Google y tiene tope de 10/min por usuario, así que acá no hay recargas: lo
   * que cambia después de enviar o de deshacer es un valor que ya se conoce, y
   * se parchea sobre la lista que está en pantalla (ver `enviarA` y `deshacer`).
   */
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

  async function enviarA(p: Proveedor) {
    if (!p.telefono) return;
    setOcupado(p.placeid);
    setErrorEnvio(null);
    try {
      const r = await quodom.whatsapp(idquodom, { proveedor: p.placeid, tel: p.telefono });
      openWhatsappLink(r.link);
      // Avisa antes de tocar el estado local: el Quodom ya pasó a ENVIADO y eso
      // no lo cambia nada de lo que siga.
      onEnviado?.();
      // Si el renglón tenía abierta la pregunta de "¿qué pasó?", el reintento
      // que funcionó la contesta. Dejarla abierta pone "No tiene WhatsApp"
      // —global, permanente y sin forma de deshacerse— bajo el toque siguiente.
      setPreguntandoMotivo(null);
      // El renglón se marca acá y NO volviendo a preguntarle al servidor: el
      // valor nuevo es "lo contacté ahora", que ya se sabe. La recarga costaba
      // una segunda búsqueda **paga** por envío (2 por el primero, 3 desde el
      // detalle del Quodom) y, cuando fallaba por el tope de 10/min, dejaba al
      // proveedor que acababa de recibirlo mostrándose como no contactado, así
      // que el comprador le mandaba otra vez. Es el mismo razonamiento que
      // `deshacer` ya aplicaba en el caso espejo.
      const ahora = new Date().toISOString();
      setDatos(d => d && ({
        ...d,
        proveedores: d.proveedores.map(x => x.placeid === p.placeid ? { ...x, contactadoen: ahora } : x)
      }));
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
      onEnviado?.();
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

  return {
    datos, cargando, error, errorEnvio, ocupado,
    preguntandoMotivo, setPreguntandoMotivo,
    enviarA, enviarSinProveedor, deshacer
  };
}
