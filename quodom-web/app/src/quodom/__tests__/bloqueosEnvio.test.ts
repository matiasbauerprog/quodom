import { describe, it, expect } from 'vitest';
import { bloqueoDeEnvio, bloqueoDeEnvioPorLineas } from '../bloqueosEnvio';

// El mismo orden que el backend: si faltan las dos cosas, el aviso es el que
// la API iba a contestar, así el botón no promete algo que el servidor rechaza.
describe('bloqueoDeEnvio', () => {
  it('no bloquea un Quodom completo con dirección cargada', () => {
    expect(bloqueoDeEnvio({ porccompletado: 100, cantproductos: 3 }, true)).toBeNull();
  });

  it('bloquea por atributos cuando alguna línea quedó incompleta', () => {
    const b = bloqueoDeEnvio({ porccompletado: 66, cantproductos: 3 }, true);

    expect(b?.motivo).toBe('atributo');
    expect(b?.texto).toMatch(/falta/i);
  });

  it('bloquea por dirección cuando el usuario no tiene ninguna', () => {
    const b = bloqueoDeEnvio({ porccompletado: 100, cantproductos: 3 }, false);

    expect(b?.motivo).toBe('direccion');
    expect(b?.texto).toMatch(/dirección/i);
  });

  it('prioriza los atributos, igual que el backend', () => {
    expect(bloqueoDeEnvio({ porccompletado: 50, cantproductos: 2 }, false)?.motivo).toBe('atributo');
  });

  // Un Quodom vacío ya lo frena el backend con otro mensaje, y porccompletado
  // llega en 0: sin esta salida el aviso sería "faltan atributos" y no es eso.
  it('no inventa un bloqueo de atributos en un Quodom sin productos', () => {
    expect(bloqueoDeEnvio({ porccompletado: 0, cantproductos: 0 }, true)).toBeNull();
  });

  // `porccompletado` es opcional en el contrato: si no vino, no hay con qué
  // afirmar que falta algo, y el backend sigue siendo la red de contención.
  it('no bloquea por atributos si el dato no vino', () => {
    expect(bloqueoDeEnvio({ cantproductos: 2 }, true)).toBeNull();
  });
});

// El detalle tiene las líneas a mano, así que no necesita confiar en el
// porcentaje que calcula la vista: mira el atributo de cada una.
describe('bloqueoDeEnvioPorLineas', () => {
  const conMedida = { nombreAtributo1: 'LITROS', atributo1: '20 litros' };
  const sinMedida = { nombreAtributo1: 'LITROS', atributo1: null };
  const sinAtributos = { nombreAtributo1: null, atributo1: null };

  it('no bloquea cuando todas las líneas eligieron su atributo', () => {
    expect(bloqueoDeEnvioPorLineas([conMedida, sinAtributos], true)).toBeNull();
  });

  it('bloquea cuando una línea no eligió el atributo que declara', () => {
    expect(bloqueoDeEnvioPorLineas([conMedida, sinMedida], true)?.motivo).toBe('atributo');
  });

  it('cuenta en blanco como sin elegir', () => {
    expect(bloqueoDeEnvioPorLineas([{ nombreAtributo1: 'LITROS', atributo1: '  ' }], true)?.motivo).toBe('atributo');
  });

  it('mira también el segundo atributo', () => {
    expect(bloqueoDeEnvioPorLineas([{ ...conMedida, nombreAtributo2: 'COLOR', atributo2: null }], true)?.motivo).toBe('atributo');
  });

  it('bloquea por dirección cuando las líneas están completas', () => {
    expect(bloqueoDeEnvioPorLineas([conMedida], false)?.motivo).toBe('direccion');
  });

  it('no bloquea un Quodom vacío por atributos', () => {
    expect(bloqueoDeEnvioPorLineas([], true)).toBeNull();
  });
});
