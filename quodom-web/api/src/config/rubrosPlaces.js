// quodom-web/api/src/config/rubrosPlaces.js
/**
 * Con qué texto se busca cada rubro en Google Places.
 *
 * **Se busca por texto y no por tipo de Places**, y eso está medido, no supuesto
 * (sondeo del 2026-10-15 sobre Villa Ballester): `paint_store` no existe —Google
 * devuelve 400—, `book_store` devuelve kioscos, y `liquor_store` trae ruido. El
 * texto gana en los cinco rubros activos.
 *
 * **Esta tabla es la perilla de calibración del feature.** El ciclo es: cambiar
 * un término, correr `node scripts/verificar-proveedores.js "<localidad>"`, y
 * mirar qué devuelve. El script lee este mismo archivo, así que lo que se prueba
 * es lo que corre en producción.
 *
 * Vive en código y no en la base por lo mismo que `config/rubros.js`: la base se
 * commitea y corre en WAL, así que un cambio de datos no se revisa en el diff ni
 * sobrevive con seguridad a un reseed. Un cambio de código sí.
 *
 * Los rubros apagados no tienen término: cuando se activen, se les mide el suyo
 * antes de encenderlos, y el test de este archivo lo exige.
 */
const TERMINOS = {
  1: 'artículos de limpieza',          // Ángel, JB, La Jabonería, Fusión Química
  2: 'librería',                       // Santa Inés, Koky, El Chalet, Tríada
  3: 'papelera artículos de papelería', // Witpel, Papelera Buenos Aires, Italia
  5: 'pinturería',                     // Le Bleu, San Andrés, Devoto, Balcarce
  7: 'distribuidora de bebidas'        // BMG, SCR, Fullescabio
};

function terminoDeRubro(idrubro) {
  const t = TERMINOS[Number(idrubro)];
  return t === undefined ? null : t;
}

module.exports = { terminoDeRubro, TERMINOS };
