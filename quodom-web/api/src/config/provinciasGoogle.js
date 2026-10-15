/**
 * Las 24 provincias de Google contra el `id` de nuestra tabla `provincias`.
 *
 * Es una tabla literal y no un emparejamiento aproximado: con 24 valores
 * conocidos y fijos, adivinar es peor que enumerar. 22 coinciden palabra por
 * palabra con nuestra tabla; las únicas que difieren son CABA (que Google
 * nombra de tres formas distintas según el contexto) y Tierra del Fuego (que
 * lleva el nombre oficial largo).
 *
 * Si no matchea, devuelve null: sólo puede pasar con una dirección de otro
 * país, y una dirección sin `idprovincia` ya es válida en la base.
 */

// Minúsculas, sin acentos y sin espacios de más. Así una sola entrada por
// provincia alcanza, sin importar cómo venga escrita.
function normalizar(s) {
  if (typeof s !== 'string') return '';
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

const POR_NOMBRE = new Map(Object.entries({
  'buenos aires': 1,
  'ciudad autonoma de buenos aires': 2,
  'caba': 2,
  'capital federal': 2,
  'catamarca': 3,
  'chaco': 4,
  'chubut': 5,
  'cordoba': 6,
  'corrientes': 7,
  'entre rios': 8,
  'formosa': 9,
  'jujuy': 10,
  'la pampa': 11,
  'la rioja': 12,
  'mendoza': 13,
  'misiones': 14,
  'neuquen': 15,
  'rio negro': 16,
  'salta': 17,
  'san juan': 18,
  'san luis': 19,
  'santa cruz': 20,
  'santa fe': 21,
  'santiago del estero': 22,
  'tierra del fuego': 23,
  'tierra del fuego, antartida e islas del atlantico sur': 23,
  'tucuman': 24
}));

const IDS_PROVINCIA = new Set(POR_NOMBRE.values());

function idProvinciaDesdeGoogle(nombre) {
  const id = POR_NOMBRE.get(normalizar(nombre));
  return id === undefined ? null : id;
}

module.exports = { idProvinciaDesdeGoogle, IDS_PROVINCIA, normalizar };
