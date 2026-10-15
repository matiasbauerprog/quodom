// quodom-web/api/src/helpers/rankearProveedores.js
/**
 * De la lista cruda que devuelve Places al puñado que se le muestra al comprador.
 *
 * Separada del cliente HTTP a propósito: **es la regla que más se va a ajustar**
 * cuando se vean resultados reales, y pegada al `fetch` cada ajuste necesitaría
 * simular una respuesta de Google. Acá se prueba con una tabla de comercios
 * inventados, instantáneo.
 *
 * Google no devuelve distancia ni deja filtrar por puntuación mínima, así que
 * las dos cosas son nuestras.
 */
const CUANTOS = 5;
const MIN_RESENAS = 3;
const PESO_PUNTUACION = 0.6;
const PESO_CERCANIA = 0.4;
const TOPE_KM = 50;

function distanciaKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180;
  const la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function puntaje(p) {
  const porEstrellas = (p.rating || 0) / 5;
  const porCerca = 1 - Math.min(p.distanciaKm, TOPE_KM) / TOPE_KM;
  const base = PESO_PUNTUACION * porEstrellas + PESO_CERCANIA * porCerca;
  // Un comercio que ya le falló a alguien por WhatsApp no se esconde, pero no
  // encabeza: es una observación nuestra, acumulada por el uso.
  return p.sinWhatsapp ? base - 1 : base;
}

function rankear(candidatos, centro, opciones = {}) {
  const cuantos = opciones.cuantos || CUANTOS;
  const minResenas = opciones.minResenas != null ? opciones.minResenas : MIN_RESENAS;

  const conDistancia = (candidatos || []).map(c => ({
    placeid: c.placeid,
    nombre: c.nombre,
    rating: c.rating != null ? c.rating : null,
    resenas: c.resenas || 0,
    distanciaKm: distanciaKm(centro, { lat: c.lat, lng: c.lng }),
    telefono: c.telefono || null,
    telefonoVisible: c.telefonoVisible || null,
    esFijo: !!c.esFijo,
    // Un 0800 es un teléfono real que no recibe WhatsApp: el llamador pasa
    // `telefono: null` pero sí `telefonoVisible`. Marcarlo "sin teléfono" sería
    // falso y escondería el botón Llamar, la única vía que ese comercio ofrece.
    sinTelefono: !c.telefono && !c.telefonoVisible,
    sinWhatsapp: !!c.sinWhatsapp,
    direccion: c.direccion || ''
  }));

  // Una puntuación de 5,0 con una reseña no es información. Pero el umbral no
  // puede borrar al comercio de barrio: medido, en Limpieza tienen 3 a 10.
  const confiables = conDistancia.filter(p => p.resenas >= minResenas && p.rating != null);
  const resto = conDistancia.filter(p => !confiables.includes(p));

  const ordenar = arr => arr.slice().sort((a, b) => puntaje(b) - puntaje(a));

  if (confiables.length >= 3) return ordenar(confiables).slice(0, cuantos);

  // Mostrar uno es peor que mostrar tres con poca reputación y la distancia a
  // la vista: el usuario decide, pero necesita entre qué elegir.
  const faltan = ordenar(resto.slice().sort((a, b) => a.distanciaKm - b.distanciaKm));
  return ordenar(confiables).concat(faltan).slice(0, Math.max(cuantos, 0));
}

module.exports = { rankear, distanciaKm };
