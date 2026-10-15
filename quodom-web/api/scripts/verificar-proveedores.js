/**
 * Chequeo MANUAL de los términos de búsqueda de proveedores. No es un test y no
 * corre con la suite.
 *
 * **Usa la clave de verdad y cuesta plata en cada corrida**: una consulta del
 * nivel caro —puntuación, reseñas y teléfono viajan en la misma máscara— por
 * cada rubro activo, más una barata para ubicar la localidad. Con los cinco
 * rubros de hoy son seis consultas pagas por corrida. No ponerlo en un loop ni
 * en CI: el gasto no tiene tope.
 *
 * Existe porque esto es lo único del feature que ningún test puede juzgar: si
 * buscar un rubro en Google devuelve proveedores de verdad o devuelve basura.
 * El orden, el teléfono, el punto y el endpoint tienen tests; esto no los puede
 * tener, porque la respuesta correcta la sabe una persona mirando la lista.
 *
 *   cd quodom-web/api && node scripts/verificar-proveedores.js "Villa Ballester, Buenos Aires"
 *
 * Conviene apuntar `DB_STORAGE` a una **copia** de la base antes de correrlo:
 * abre la base configurada y le corre `sync()`, así que con el valor por
 * defecto eso pasa sobre `quodom.sqlite`, que es la que se commitea y se
 * despliega (ver §6 de `claude.md` en la raíz, y el modo WAL).
 *
 * La localidad va **por parámetro** porque un término que anda en el conurbano
 * puede no andar en una ciudad del interior, y eso hay que poder probarlo sin
 * tocar código. Y lee `src/config/rubros.js` y `src/config/rubrosPlaces.js`, así
 * que **lo que se prueba es lo que corre en producción**: el ciclo de
 * calibración es editar el término, correr esto, mirar.
 *
 * Mirar, por cada rubro: que los comercios sean del rubro (y no kioscos, ni
 * cestos de basura en Papelera), que haya **al menos tres**, y cuántos salen
 * sin teléfono. Los renglones marcados con `*` son los cinco que el comprador
 * vería; los demás llegaron de Google y los descartó `rankearProveedores`, y
 * están impresos a propósito — el ruido que se filtra es justo lo que dice si
 * el término está bien elegido.
 */
require('dotenv').config();
const { RUBROS_ACTIVOS } = require('../src/config/rubros');
const { terminoDeRubro } = require('../src/config/rubrosPlaces');
const { buscarProveedores, puntoDeLocalidad } = require('../src/helpers/places');
const { candidatosConTelefono } = require('../src/helpers/telefonoWhatsapp');
const { rankear, distanciaKm } = require('../src/helpers/rankearProveedores');
const db = require('../src/helpers/db');

const USO = 'Uso: node scripts/verificar-proveedores.js "<localidad>"\n'
  + '  ej: node scripts/verificar-proveedores.js "Villa Ballester, Buenos Aires"';

function km(valor) {
  return (valor.toFixed(1) + ' km').padStart(8);
}

function puntuacion(p) {
  if (p.rating == null) return 'sin puntuación'.padEnd(20);
  return (p.rating.toFixed(1) + ' (' + p.resenas + ' reseñas)').padEnd(20);
}

// Las tres situaciones de teléfono que están medidas, en el mismo orden en que
// las decide `telefonoWhatsapp.js`: WhatsApp, sólo llamar, y nada.
function telefono(p) {
  if (p.telefono) return 'wa ' + p.telefono + (p.esFijo ? '  (fijo: puede no tener WhatsApp)' : '');
  if (p.telefonoVisible) return 'LLAMAR ' + p.telefonoVisible + '  <-- no recibe WhatsApp (0800 o tarifa especial)';
  return 'SIN TELÉFONO';
}

async function nombresDeRubro() {
  // Los nombres salen de la base real —la que se despliega— y no de una tabla
  // literal acá: si el seed renumeró los rubros, el término quedó apuntando a
  // otro rubro, y esto es lo único que lo deja ver.
  await db.ready;
  const filas = await db.Category.findAll({
    where: { idcategoriapadre: 0 },
    attributes: ['id', 'nombrecategoria']
  });
  return new Map(filas.map(f => [f.id, f.nombrecategoria]));
}

async function main() {
  const localidad = process.argv.slice(2).join(' ').trim();

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.error('Falta GOOGLE_MAPS_API_KEY en el entorno.');
    console.error('Este chequeo consulta Google de verdad y no tiene modo simulado: sin la clave no hay nada que mirar.');
    process.exit(1);
  }

  if (localidad === '') {
    console.error('Falta la localidad.\n' + USO);
    process.exit(1);
  }

  const nombres = await nombresDeRubro();

  // El centro de la localidad es el mismo punto que usa una dirección cargada a
  // mano (`puntoDelQuodom`, escalón 2), así que lo que se mide acá es el peor
  // caso de precisión del feature y no uno inventado para el script.
  const centro = await puntoDeLocalidad(localidad);
  if (!centro) {
    console.error('Google no ubicó "' + localidad + '". Probá con la provincia: "Tandil, Buenos Aires".');
    process.exit(1);
  }

  console.log('Localidad: ' + centro.nombre);
  console.log('Centro: ' + centro.lat + ', ' + centro.lng);
  console.log('Mapa: https://www.google.com/maps?q=' + centro.lat + ',' + centro.lng);
  console.log('Rubros activos: ' + RUBROS_ACTIVOS.join(', ') + '\n');

  // Lo que el feature aprendió de los compradores anteriores: pesa en el orden,
  // así que tiene que estar acá para que el ranking impreso sea el de producción.
  const reportados = await db.lugares_sinwhatsapp.findAll({ attributes: ['placeid'] });
  const sinWhatsapp = new Set(reportados.map(r => r.placeid));

  const flojos = [];

  for (const idrubro of RUBROS_ACTIVOS) {
    const nombre = nombres.get(idrubro) || '(rubro desconocido)';
    const termino = terminoDeRubro(idrubro);
    const rotulo = termino === null ? '(sin término)' : '"' + termino + '"';

    console.log('=== ' + idrubro + ' ' + nombre + ' — ' + rotulo + ' ===');

    if (termino === null) {
      // Un rubro activo sin término no busca nada y el popup sale vacío. El test
      // de `rubrosPlaces` ya lo atrapa, pero acá se ve con el rubro nombrado.
      console.log('  SIN TÉRMINO DE BÚSQUEDA — este rubro no va a ofrecer ningún proveedor.\n');
      flojos.push(idrubro + ' ' + nombre + ': sin término');
      continue;
    }

    try {
      const crudos = await buscarProveedores({ texto: termino, lat: centro.lat, lng: centro.lng });
      const ubicables = crudos.filter(c => c.lat != null && c.lng != null);

      if (ubicables.length === 0) {
        console.log('  Google no devolvió NINGÚN lugar ubicable: el término no sirve en esta zona.\n');
        flojos.push(idrubro + ' ' + nombre + ': 0 resultados');
        continue;
      }

      // El MISMO mapeo que corre en el endpoint (está en el helper, no copiado
      // acá): si fuera una copia, el día que una cambie este chequeo mostraría
      // una lista que no es la que ve el comprador, y es lo único que decide si
      // un término sirve.
      const conTelefono = candidatosConTelefono(ubicables, sinWhatsapp);

      const elegidos = rankear(conTelefono, centro);
      const enLista = new Set(elegidos.map(p => p.placeid));

      // Se imprime todo lo que llegó, ordenado por cercanía y con los elegidos
      // marcados: así se ve de un saque si el filtro está dejando afuera al
      // comercio correcto o si está tapando ruido.
      const todos = conTelefono
        .map(p => ({ ...p, distanciaKm: distanciaKm(centro, { lat: p.lat, lng: p.lng }) }))
        .sort((a, b) => a.distanciaKm - b.distanciaKm);

      todos.forEach(p => {
        console.log('  ' + (enLista.has(p.placeid) ? '*' : ' ') + ' '
          + km(p.distanciaKm) + '  ' + puntuacion(p) + '  '
          + p.nombre.slice(0, 38).padEnd(38) + '  ' + telefono(p)
          + (p.sinWhatsapp ? '  [reportado sin WhatsApp]' : ''));
      });

      const sinTel = elegidos.filter(p => p.sinTelefono).length;
      const soloLlamar = elegidos.filter(p => !p.telefono && p.telefonoVisible).length;
      console.log('  -> Google devolvió ' + crudos.length + ' (' + ubicables.length + ' ubicables); el comprador ve '
        + elegidos.length + ', de ellos ' + sinTel + ' sin teléfono y ' + soloLlamar + ' sólo para llamar.');

      if (elegidos.length < 3) {
        flojos.push(idrubro + ' ' + nombre + ': sólo ' + elegidos.length + ' proveedor(es)');
      }
    } catch (e) {
      console.log('  ERROR ' + (e.codigo || '') + ': ' + e.message);
      flojos.push(idrubro + ' ' + nombre + ': ' + (e.codigo || 'error'));
    }

    console.log('');
  }

  // Menos de tres es el umbral del que habla la spec: con uno o dos el selector
  // se ve roto aunque la búsqueda haya "funcionado".
  if (flojos.length === 0) {
    console.log('Los ' + RUBROS_ACTIVOS.length + ' rubros activos devolvieron al menos tres proveedores en ' + localidad + '.');
  } else {
    console.log('REVISAR en ' + localidad + ':');
    flojos.forEach(f => console.log('  - ' + f));
  }

  await db.sequelize.close();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
