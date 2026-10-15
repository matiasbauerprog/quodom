/**
 * Chequeo **manual** de la geocodificación inversa: punto → dirección.
 *
 * El hermano de `verificar-direcciones.js`, para el camino del pin arrastrable.
 * No es un test y no corre con la suite, por la misma razón: **ningún test sabe
 * qué dirección hay en -34.5468,-58.5562**. Los tests cubren la traducción de
 * formatos con fixtures; si el punto cae donde corresponde lo juzga una persona
 * mirando, y para eso cada línea deja el link al mapa.
 *
 * Usa la clave real y **cuesta una consulta por punto**.
 *
 * Correrlo:
 *   - después de tocar `lugarDeGeocoding.js` o `direccionDeGoogle.js`;
 *   - y la primera vez que la **Geocoding API** quede habilitada en el
 *     proyecto, porque los fixtures de `lugarDeGeocoding.test.js` se
 *     escribieron contra el formato documentado y no contra una respuesta
 *     medida: el 2026-10-15 la API devolvía `REQUEST_DENIED` ("This API is not
 *     activated on your API project"). Si algún campo no coincide, lo que hay
 *     que corregir son los fixtures.
 *
 *   node scripts/verificar-punto.js
 *   node scripts/verificar-punto.js -34.5468 -58.5562
 */
require('dotenv').config();
const { direccionDePunto } = require('../src/helpers/places');
const { lugarDeGeocoding, mejorResultado } = require('../src/helpers/lugarDeGeocoding');
const { direccionDeGoogle } = require('../src/helpers/direccionDeGoogle');

// Cuatro puntos de las zonas medidas, más uno en el agua: el último es el caso
// "moví el pin a la nada", que tiene que dar 404 y no una dirección inventada.
const PUNTOS = [
  ['Villa Ballester', -34.5468, -58.5562],
  ['Palermo (CABA)', -34.5889, -58.4306],
  ['Nueva Córdoba', -31.4350, -64.1888],
  ['Río de la Plata (sin dirección)', -34.8000, -57.5000]
];

async function unPunto(nombre, lat, lng) {
  process.stdout.write('\n=== ' + nombre + ' (' + lat + ', ' + lng + ') ===\n');
  try {
    const resultados = await direccionDePunto({ lat, lng });
    const mejor = mejorResultado(resultados);

    if (!mejor) {
      console.log('  sin dirección (el endpoint responde 404) — correcto si el punto es agua o campo');
      return;
    }

    console.log('  types de Google : ' + JSON.stringify(mejor.types));
    const d = direccionDeGoogle(lugarDeGeocoding(mejor));
    console.log('  calle / numero  : ' + (d.calle || '(vacío)') + ' / ' + (d.numero || '(vacío)'));
    console.log('  localidad       : ' + (d.localidad || '(vacío)'));
    console.log('  partido         : ' + (d.partido || '(vacío)'));
    console.log('  idprovincia     : ' + (d.idprovincia === null ? 'SIN MATCHEAR <-- revisar provinciasGoogle.js' : d.idprovincia));
    console.log('  cp              : ' + (d.cp || '(vacío)'));
    console.log('  formateada      : ' + d.direccion);
    console.log('  mirar el punto  : https://www.google.com/maps?q=' + lat + ',' + lng);
  } catch (e) {
    console.log('  FALLÓ: ' + e.message);
    if (/REQUEST_DENIED/.test(e.message)) {
      console.log('  -> Habilitar "Geocoding API" en la consola de Google (APIs y servicios > Biblioteca).');
    }
  }
}

async function main() {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.error('Falta GOOGLE_MAPS_API_KEY. Sin clave este script no consulta nada.');
    process.exit(1);
  }

  const [, , lat, lng] = process.argv;
  if (lat && lng) {
    await unPunto('a mano', Number(lat), Number(lng));
  } else {
    for (const [n, la, ln] of PUNTOS) await unPunto(n, la, ln);
  }
  console.log('');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
