/**
 * Convierte "informacion para la ia/<Rubro>/*.xlsx" en una guía de texto por
 * rubro, que el Modo IA manda SÓLO para el rubro de la conversación.
 *
 * Los Excel son la fuente que se edita a mano; el texto generado es lo que lee
 * la API. El paso intermedio existe para que un cambio en las instrucciones se
 * vea en el diff de git: un .xlsx es binario y una instrucción que cambia sin
 * dejar rastro es una instrucción que nadie revisa.
 *
 * Correr `npm run guias` después de tocar cualquier planilla.
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ORIGEN = path.join(__dirname, '..', '..', '..', 'informacion para la ia');
const DESTINO = path.join(__dirname, '..', 'config', 'guias');

// La carpeta no siempre se llama igual que el rubro en `categorias`
// ("Pinturería" contra "Pintura"), así que la correspondencia va explícita.
const CARPETA_POR_RUBRO = {
  1: 'Limpieza',
  2: 'Librería',
  3: 'Papelera',
  5: 'Pinturería',
  7: 'Bebidas'
};

const ENCABEZADO_EJEMPLOS =
  'EJEMPLOS RESUELTOS DE REFERENCIA. Son casos concretos, no plantillas: recalculá siempre '
  + 'para lo que dijo el usuario, TAMBIÉN las cantidades de accesorios. Sirven para ver qué '
  + 'no puede faltar en un presupuesto de este rubro, no para copiar números.';

function hojaComoTexto(wb, nombre) {
  return XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, defval: '' })
    .map(fila => fila.map(c => String(c).trim()).filter(c => c !== ''))
    .filter(fila => fila.length > 0)
    .map(fila => fila.join(' | '))
    .join('\n');
}

/** Sólo los "Listado_*": los otros archivos replican el catálogo, que ya sale de la base. */
function esArchivoDeListado(nombre) {
  return /^listado/i.test(nombre) && /\.xlsx?$/i.test(nombre);
}

function construirGuia(carpeta) {
  const dir = path.join(ORIGEN, carpeta);
  const archivos = fs.readdirSync(dir).filter(esArchivoDeListado);
  const supuestos = [];
  const ejemplos = [];

  for (const archivo of archivos) {
    const wb = XLSX.readFile(path.join(dir, archivo));
    for (const hoja of wb.SheetNames) {
      const texto = hojaComoTexto(wb, hoja);
      if (texto === '') continue;
      if (/supuesto/i.test(hoja)) supuestos.push(texto);
      else if (/pendiente/i.test(hoja)) continue;  // notas de trabajo, no instrucciones
      else ejemplos.push(texto);
    }
  }

  const partes = [];
  if (supuestos.length) partes.push('SUPUESTOS Y REGLAS DE ESTE RUBRO:\n' + supuestos.join('\n'));
  if (ejemplos.length) partes.push(ENCABEZADO_EJEMPLOS + '\n\n' + ejemplos.join('\n\n'));
  return { texto: partes.join('\n\n'), archivos: archivos.length, ejemplos: ejemplos.length };
}

function generar() {
  fs.mkdirSync(DESTINO, { recursive: true });
  let total = 0;
  for (const [idrubro, carpeta] of Object.entries(CARPETA_POR_RUBRO)) {
    const dir = path.join(ORIGEN, carpeta);
    if (!fs.existsSync(dir)) {
      console.warn('  rubro ' + idrubro + ' (' + carpeta + '): no existe la carpeta, se saltea');
      continue;
    }
    const { texto, ejemplos } = construirGuia(carpeta);
    if (texto === '') {
      console.warn('  rubro ' + idrubro + ' (' + carpeta + '): sin contenido utilizable, se saltea');
      continue;
    }
    fs.writeFileSync(path.join(DESTINO, idrubro + '.txt'), texto + '\n', 'utf8');
    total += 1;
    const aviso = ejemplos < 2
      ? '   ojo: ' + ejemplos + ' ejemplo(s). Con uno solo el modelo copia su escala; conviene un segundo de otro tamaño.'
      : '';
    console.log('  rubro ' + idrubro + ' (' + carpeta + '): ' + texto.length + ' chars, ~'
      + Math.round(texto.length / 4) + ' tokens, ' + ejemplos + ' ejemplo(s).' + aviso);
  }
  console.log(total + ' guía(s) escritas en src/config/guias/');
}

if (require.main === module) generar();

module.exports = { generar, CARPETA_POR_RUBRO };
