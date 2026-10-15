import { Link } from 'react-router-dom';
import './AvisoPuntoAproximado.css';

/**
 * "Las distancias son desde el centro de la localidad", cuando la dirección no
 * salió del mapa (`preciso === false`).
 *
 * Es **una sola copia** para las dos pantallas que muestran distancias —el
 * selector del envío y el historial del Quodom enviado—, igual que
 * `FilaProveedor`. La promesa del feature es que la pantalla nunca muestra una
 * distancia medida desde otro lugar que el que nombra, y con dos copias de la
 * frase alcanza con corregir una para romperla en la otra: eso ya había pasado,
 * el historial mostraba "0,4 km" sin decir nunca desde dónde, y 0,4 km del
 * centro de Villa Ballester pueden ser 3 km de la casa del comprador.
 *
 * Va con un `Link` y **no con un `href`**: un ancla recarga el documento entero
 * en medio de un envío y se lleva el Quodom a medio mandar.
 */
export function AvisoPuntoAproximado() {
  return (
    <p className="aviso-aprox">
      Tu dirección no está ubicada con precisión — las distancias son desde el centro de la localidad.{' '}
      <Link to="/direcciones">Revisá tu dirección</Link>
    </p>
  );
}
