// quodom-web/api/tests/telefonoWhatsapp.test.js
const { analizarTelefono } = require('../src/helpers/telefonoWhatsapp');

describe('analizarTelefono', () => {
  // Un celular argentino necesita el 9 y NO el 15, o WhatsApp no abre el chat
  // aunque el comercio sí lo tenga. Es el modo de falla más caro del feature:
  // el número está bien y el link igual no funciona.
  it('convierte un celular con 15 al formato que abre WhatsApp', () => {
    const r = analizarTelefono('011 15-5481-2951');
    expect(r.e164).toBe('+5491154812951');
  });

  it('convierte otro celular con 15', () => {
    expect(analizarTelefono('011 15-2403-4527').e164).toBe('+5491124034527');
  });

  // Un número que viene SIN el 15 se pasa sin el 9. Nada se afirma sobre si es
  // fijo o celular: ver abajo, no se puede saber.
  it('deja un número sin 15 en el formato sin el 9', () => {
    const r = analizarTelefono('011 4767-0915');
    expect(r.e164).toBe('+541147670915');
  });

  it('interpreta un número ya en formato internacional', () => {
    expect(analizarTelefono('+54 11 4767-0915').e164).toBe('+541147670915');
  });

  it('interpreta un celular del interior', () => {
    const r = analizarTelefono('0351 15-555-4444');
    expect(r.e164.startsWith('+549351')).toBe(true);
  });

  // MEDIDO en Córdoba el 2026-10-15: Rex publica 0800-777-7739, y tiene 453
  // reseñas, o sea que es un proveedor que el comprador quiere. Un 0800 NO
  // recibe WhatsApp y tampoco es un fijo común: es un número de atención. Si se
  // lo trata como teléfono normal, el usuario toca WhatsApp, se va, y no abre —
  // el mismo modo de falla silencioso que este helper existe para evitar.
  it('marca un 0800 como no apto para WhatsApp', () => {
    const r = analizarTelefono('0800-777-7739');
    expect(r.sirveWhatsapp).toBe(false);
  });

  it('un celular sí sirve para WhatsApp', () => {
    expect(analizarTelefono('011 15-5481-2951').sirveWhatsapp).toBe(true);
  });

  it('un número sin 15 también sirve para WhatsApp', () => {
    expect(analizarTelefono('011 4767-0915').sirveWhatsapp).toBe(true);
  });

  // MEDIDO el 2026-10-15 sobre los 21 teléfonos que Google devolvió en Villa
  // Ballester: libphonenumber clasifica FIXED_LINE a TODOS los que vienen sin
  // el 15, y los 21 son MOBILE válidos si se les agrega el 15 — incluidos
  // 4767-0915 y 4720-2211, los prefijos "de fijo clásico". O sea que
  // FIXED_LINE, en un número argentino sin el 15, no es un dato: es lo que la
  // biblioteca asume por defecto.
  //
  // Y la mayoría de los comercios publica su celular sin el 15, así que el
  // aviso "puede no tener WhatsApp" salía en 22 de 25 renglones. Un aviso que
  // no podemos sostener, puesto en casi todos, no avisa: se lee como "ningún
  // proveedor sirve". El usuario se entera tocando, y para registrarlo ya
  // existe el reporte de "no se envió".
  it('no afirma que un número sea fijo, porque no se puede saber', () => {
    expect(analizarTelefono('011 4767-0915').esFijo).toBeUndefined();
    expect(analizarTelefono('011 15-5481-2951').esFijo).toBeUndefined();
    expect(analizarTelefono('0800-777-7739').esFijo).toBeUndefined();
  });

  // Review Focus 2: Google no tiene el teléfono de todos los comercios.
  it('devuelve null cuando no hay teléfono', () => {
    expect(analizarTelefono(null)).toBeNull();
    expect(analizarTelefono('')).toBeNull();
    expect(analizarTelefono(undefined)).toBeNull();
  });

  it('devuelve null cuando el texto no es un teléfono interpretable', () => {
    expect(analizarTelefono('consultar por mail')).toBeNull();
  });

  // Conserva lo que Google dio, para mostrarlo tal cual al usuario: el link usa
  // el E.164 pero en pantalla se lee mejor el formato local.
  it('conserva el original para mostrarlo', () => {
    expect(analizarTelefono('011 4767-0915').original).toBe('011 4767-0915');
  });
});
