import { useEffect, useState } from 'react';
import { users as usersApi } from '../api/users';

/**
 * Si el usuario tiene alguna dirección cargada, que es lo que el envío
 * necesita (define a qué proveedores les llega el pedido).
 *
 * Arranca en `true` y se queda en `true` si la consulta falla: el backend es
 * el que decide, y un `false` optimista trabaría el botón con un motivo que
 * puede ser falso. Mira la lista y no la dirección por defecto, porque el
 * backend también acepta cualquiera cuando no hay ninguna marcada.
 */
export function useTieneDireccion(logueado: boolean): boolean {
  const [tiene, setTiene] = useState(true);
  const [nonce, setNonce] = useState(0);

  // El sidebar vive en el Layout y no se desmonta al ir a cargar la dirección,
  // así que al volver seguiría con la respuesta vieja.
  useEffect(() => {
    const onCambio = () => setNonce(n => n + 1);
    window.addEventListener('direcciones:changed', onCambio);
    return () => window.removeEventListener('direcciones:changed', onCambio);
  }, []);

  useEffect(() => {
    if (!logueado) { setTiene(true); return; }
    let vivo = true;
    usersApi.getDirecciones()
      .then(ds => { if (vivo) setTiene(Array.isArray(ds) && ds.length > 0); })
      .catch(() => { if (vivo) setTiene(true); });
    return () => { vivo = false; };
  }, [logueado, nonce]);

  return tiene;
}
