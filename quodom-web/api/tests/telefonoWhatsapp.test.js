// quodom-web/api/tests/telefonoWhatsapp.test.js
const { analizarTelefono } = require('../src/helpers/telefonoWhatsapp');

describe('analizarTelefono', () => {
  // Un celular argentino necesita el 9 y NO el 15, o WhatsApp no abre el chat
  // aunque el comercio sí lo tenga. Es el modo de falla más caro del feature:
  // el número está bien y el link igual no funciona.
  it('convierte un celular con 15 al formato que abre WhatsApp', () => {
    const r = analizarTelefono('011 15-5481-2951');
    expect(r.e164).toBe('+5491154812951');
    expect(r.esFijo).toBe(false);
  });

  it('convierte otro celular con 15', () => {
    expect(analizarTelefono('011 15-2403-4527').e164).toBe('+5491124034527');
  });

  it('deja un fijo sin el 9 y lo marca como fijo', () => {
    const r = analizarTelefono('011 4767-0915');
    expect(r.e164).toBe('+541147670915');
    expect(r.esFijo).toBe(true);
  });

  it('interpreta un número ya en formato internacional', () => {
    expect(analizarTelefono('+54 11 4767-0915').e164).toBe('+541147670915');
  });

  it('interpreta un celular del interior', () => {
    const r = analizarTelefono('0351 15-555-4444');
    expect(r.e164.startsWith('+549351')).toBe(true);
    expect(r.esFijo).toBe(false);
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

  // Un fijo puede tener WhatsApp Business, así que sirve: lo que lleva es el
  // aviso, no la prohibición.
  it('un fijo sirve para WhatsApp, con aviso', () => {
    const r = analizarTelefono('011 4767-0915');
    expect(r.sirveWhatsapp).toBe(true);
    expect(r.esFijo).toBe(true);
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
