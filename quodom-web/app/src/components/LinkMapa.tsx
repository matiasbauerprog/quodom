/**
 * "Ver en el mapa" para una dirección que tiene coordenadas.
 *
 * Existe porque **la única forma de detectar una geocodificación equivocada es
 * mirarla**: una dirección mal ubicada no da error, da una dirección que se ve
 * perfecta y un punto que está en otro lado. Sin esto, el usuario no tiene con
 * qué darse cuenta, y el error recién se nota cuando el selector de proveedores
 * le ofrece cinco comercios alrededor del lugar equivocado.
 *
 * Es un link a Google Maps y no un mapa incrustado a propósito: mostrar un mapa
 * adentro necesita el SDK de Maps en el navegador, con su clave expuesta y su
 * costo por carga. El link no cuesta nada y alcanza para confirmar.
 *
 * Cuando no hay coordenadas no muestra nada, y esa ausencia también informa: esa
 * dirección no va a servir para buscar proveedores cerca.
 */
import './LinkMapa.css';

export function LinkMapa({ lat, lng }: { lat?: number | null; lng?: number | null }) {
  if (lat == null || lng == null) return null;

  return (
    <a
      className="link-mapa"
      href={'https://www.google.com/maps?q=' + lat + ',' + lng}
      target="_blank"
      rel="noopener noreferrer"
    >
      Ver en el mapa
    </a>
  );
}
