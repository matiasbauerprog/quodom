import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Cambiar de pantalla deja al usuario arriba de todo. Sin esto Historial abría
 * scrolleado (heredaba el scroll del catálogo) con el título cortado.
 *
 * Sólo con el `pathname`: elegir una subcategoría o abrir la ventana de un
 * Quodom cambia la búsqueda (`?sub`, `?quodom`) y no puede mandar a nadie
 * arriba. Y no con Atrás/Adelante (`POP`), donde el navegador restaura solo
 * dónde estaba uno.
 */
export function VolverArriba(): null {
  const { pathname } = useLocation();
  const tipo = useNavigationType();
  useEffect(() => {
    if (tipo === 'POP') return;
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo el cambio de pantalla
  }, [pathname]);
  return null;
}
