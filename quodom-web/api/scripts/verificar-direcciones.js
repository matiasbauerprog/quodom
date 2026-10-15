/**
 * Chequeo MANUAL de la geocodificación. No es un test y no corre con la suite.
 *
 * Usa la clave de verdad y cuesta unas consultas por corrida. Existe porque
 * ningún test puede decir si una dirección real cae en el punto correcto: el
 * test no sabe dónde queda Mitre 450. Y ese es el riesgo central de la mitad A
 * — si el punto está mal, el selector de proveedores no falla, miente.
 *
 *   cd quodom-web/api && node scripts/verificar-direcciones.js
 *
 * Mirar, por cada caso: que la primera sugerencia sea la obvia, que la
 * provincia resuelva al id correcto, y que lat/lng caigan donde deben
 * (abrir el link de mapa que imprime y confirmar a ojo).
 */
require('dotenv').config();
const { sugerencias, detalleDireccion } = require('../src/helpers/places');
const { direccionDeGoogle } = require('../src/helpers/direccionDeGoogle');
const db = require('../src/helpers/db');

const CASOS = [
  'Avenida Corrientes 1234, CABA',
  'Bartolomé Mitre 450, San Isidro',
  'San Martín 1000, Rosario, Santa Fe',
  '25 de Mayo 100, Tandil',
  'Avenida San Martín 500, Ushuaia'
];

async function main() {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.error('Falta GOOGLE_MAPS_API_KEY en el entorno.');
    process.exit(1);
  }

  // La tabla de provincias es literal y los ids son los de la base. Ningún
  // test puede atrapar una renumeración del seed, porque la suite corre en
  // memoria; acá se compara contra la base real, que es la que se despliega.
  await db.ready;
  const filas = await db.provincia.findAll({ attributes: ['id', 'provincia'] });
  const porId = new Map(filas.map(f => [f.id, f.provincia]));
  console.log('Provincias en la base: ' + filas.length + ' (tienen que ser 24)\n');

  for (const caso of CASOS) {
    console.log('=== ' + caso + ' ===');
    const sesion = 'verif-' + Date.now();
    try {
      const opciones = await sugerencias({ q: caso, sesion });
      if (opciones.length === 0) { console.log('  SIN SUGERENCIAS\n'); continue; }

      opciones.slice(0, 3).forEach((o, i) => console.log('  ' + (i + 1) + '. ' + o.texto));

      const d = direccionDeGoogle(await detalleDireccion({ placeid: opciones[0].placeid, sesion }));
      console.log('  -> calle: ' + d.calle + ' ' + d.numero + (d.numero === '' ? '  <-- SIN ALTURA' : ''));
      console.log('  -> localidad: ' + d.localidad + (d.partido ? ' (partido: ' + d.partido + ')' : ''));
      console.log('  -> provincia: ' + d.idprovincia + ' = ' + (porId.get(d.idprovincia) || '(ninguna)')
        + (d.idprovincia === null ? '  <-- REVISAR: no matcheó' : ''));
      console.log('  -> cp: ' + (d.cp || '(vacío)'));
      console.log('  -> punto: ' + d.lat + ', ' + d.lng);
      console.log('  -> mapa: https://www.google.com/maps?q=' + d.lat + ',' + d.lng);
    } catch (e) {
      console.log('  ERROR ' + (e.codigo || '') + ': ' + e.message);
    }
    console.log('');
  }

  await db.sequelize.close();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
