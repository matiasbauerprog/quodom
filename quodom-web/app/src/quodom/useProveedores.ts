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

  async function enviarA(p: Proveedor) {
    if (!p.telefono) return;
    setOcupado(p.placeid);
    setErrorEnvio(null);
    try {
      const r = await quodom.whatsapp(idquodom, { proveedor: p.placeid, tel: p.telefono });
      openWhatsappLink(r.link);
      // Avisa antes de recargar: el Quodom ya pasó a ENVIADO, y la recarga es
      // una búsqueda paga que puede fallar sin que eso cambie lo que pasó.
      onEnviado?.();
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
    datos, cargando, error, avisoRecarga, errorEnvio, ocupado,
    preguntandoMotivo, setPreguntandoMotivo,
    enviarA, enviarSinProveedor, deshacer
  };
}
