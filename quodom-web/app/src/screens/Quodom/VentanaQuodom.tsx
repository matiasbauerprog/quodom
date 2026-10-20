import { useCallback } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { DetalleQuodom } from './DetalleQuodom';
import { PARAM_NOMBRAR, PARAM_VENTANA, hrefVentana, sinVentana } from '../../quodom/ventanaQuodom';
import './VentanaQuodom.css';

/**
 * El detalle de un Quodom encima de la pantalla actual, cuando la URL trae
 * `?quodom=<id>` (ver `ventanaQuodom.ts`). Va en el `Layout` para abrirse
 * desde cualquier pantalla sin que ninguna tenga que montarla.
 */
export function VentanaQuodom() {
  const location = useLocation();
  const navigate = useNavigate();
  const sp = new URLSearchParams(location.search);
  const id = sp.get(PARAM_VENTANA);
  const nombrar = sp.get(PARAM_NOMBRAR) === '1';
  const abiertaPorNosotros = !!(location.state as { ventanaQuodom?: boolean } | null)?.ventanaQuodom;

  // Abierta desde la app, cerrar es volver atrás: así el Atrás del celular y
  // la × dejan el historial igual. Abierta por un link pegado no hay a qué
  // volver, y se saca el parámetro.
  const cerrar = useCallback(() => {
    if (abiertaPorNosotros) navigate(-1);
    else navigate({ pathname: location.pathname, search: sinVentana(location.search) }, { replace: true });
  }, [abiertaPorNosotros, navigate, location.pathname, location.search]);

  // Se saca `nombrar` conservando el estado: sin él, cerrar ya no sabría que
  // la abrimos nosotros y dejaría una entrada de más en el historial.
  const nombrado = useCallback(() => {
    const p = new URLSearchParams(location.search);
    p.delete(PARAM_NOMBRAR);
    navigate({ pathname: location.pathname, search: '?' + p.toString() }, { replace: true, state: location.state });
  }, [navigate, location.pathname, location.search, location.state]);

  if (!id) return null;
  return <DetalleQuodom key={id} idquodom={id} nombrar={nombrar} onNombrado={nombrado} onCerrar={cerrar} />;
}

/**
 * La ruta `/quodom`. Un Quodom del servidor (`?id=`) ya no tiene pantalla
 * propia: los links viejos y las redirecciones del carrito de invitado abren
 * su ventana sobre el inicio. El carrito de invitado (`?rubro=`) sigue siendo
 * una pantalla, porque `?rubro=` en el inicio ya significa "mirando ese rubro".
 */
export function RutaQuodom() {
  const { search } = useLocation();
  const sp = new URLSearchParams(search);
  const id = sp.get('id');
  if (!id) return <DetalleQuodom />;
  return <Navigate to={hrefVentana({ pathname: '/', search: '' }, id, { nombrar: sp.get(PARAM_NOMBRAR) === '1' })} replace />;
}
