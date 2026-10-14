/**
 * El teléfono es lo único con lo que el proveedor puede responder un pedido,
 * así que tiene una sola forma: código de área fijo y ocho dígitos.
 *
 * El servidor valida lo mismo (patrón en `openapi.yaml` y `COD_AREA` en
 * users.controller); esto está para que el usuario se entere antes de guardar.
 */
export const COD_AREA = '011';
export const TELEFONO_DIGITOS = 8;

/** Lo que se tipea queda limpio: sin guiones, espacios ni el 15 de más. */
export function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, TELEFONO_DIGITOS);
}

export function telefonoCompleto(valor: string): boolean {
  return soloDigitos(valor).length === TELEFONO_DIGITOS;
}

/**
 * Lo guardado, para precargar el campo. Los números viejos traen el código de
 * área adentro (`01156956789`), y recortarlos a 8 mostraba `01156956`: un
 * número que no es el de nadie y que el usuario habría guardado como propio.
 * Mejor pedirlo de nuevo que inventarlo.
 */
export function telefonoGuardado(valor: string | null | undefined): string {
  const limpio = (valor ?? '').replace(/\D/g, '');
  return limpio.length === TELEFONO_DIGITOS ? limpio : '';
}
