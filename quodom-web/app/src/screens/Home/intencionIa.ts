/**
 * Si lo que se escribió en el buscador se lee como un pedido para el Modo IA y
 * no como el nombre de un producto. Quienes probaron la app escribieron ahí
 * "quiero pintar mi casa" (2026-10-29): el buscador no encontraba nada y nadie
 * les ofrecía el asistente, que es lo que sabe contestar eso.
 *
 * Son reglas y no una consulta al modelo a propósito: el buscador responde
 * mientras se tipea, y preguntarle a Gemini en cada pausa costaría tokens y
 * demora en algo que hoy es instantáneo. Equivocarse es barato: lo único que
 * cambia es si el botón del asistente aparece destacado o discreto.
 */
export type Intencion = 'busqueda' | 'pedido';

// Una frase de este largo ya no es el nombre de un producto: los del catálogo
// llegan a cuatro ("Latex Interior Blanco Mate").
const PALABRAS_DE_FRASE = 5;

// Cómo empieza o qué trae un pedido. Sin tildes: el texto se normaliza antes.
const PEDIDO = new RegExp([
  '\\b(quiero|quisiera|necesito|necesitaria|tengo que|busco algo)\\b',
  '\\b(cuanto|cuantos|cuantas|como|cual|cuales)\\b',
  '\\b(recomenda|recomiend|aconseja|ayuda|sugeri)',
  // Lo que se va a hacer, no lo que se compra.
  '\\b(pintar|limpiar|armar|organizar|renovar|decorar|preparar|equipar|refaccionar)\\b',
  '\\b(fiesta|evento|cumpleanos|reunion|mudanza)\\b',
  // Una cantidad de algo que no es un producto: el tamaño del problema.
  '\\d+\\s*(m2|mts2|metros|ambientes?|personas|invitados|chicos|alumnos|empleados)\\b',
].join('|'));

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** `resultados`: cuántos productos encontró el buscador para ese texto. */
export function intencionIa(texto: string, resultados: number): Intencion {
  const t = normalizar(texto.trim());
  const palabras = t.split(/\s+/).filter(Boolean).length;
  if (t.includes('?')) return 'pedido';
  if (palabras >= PALABRAS_DE_FRASE) return 'pedido';
  if (PEDIDO.test(t)) return 'pedido';
  // Varias palabras que no son ningún producto: lo más claro de todo. Con una
  // sola puede ser un error de tipeo ("ladex"), y ahí el asistente no ayuda.
  if (resultados === 0 && palabras >= 2) return 'pedido';
  return 'busqueda';
}
