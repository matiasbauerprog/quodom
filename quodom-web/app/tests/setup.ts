import '@testing-library/jest-dom/vitest';

import { beforeEach } from 'vitest';

// La caché de rubros vive a nivel de módulo: sin este reinicio, un test que
// mockea /categorias hereda la respuesta de otro y el resultado depende del orden.
// El import es dinámico a propósito: uno estático cargaría rubrosDisponibles (y
// con él el api/categorias real) antes de que cada archivo registre sus vi.mock.
beforeEach(async () => {
  const { reiniciarCacheRubros } = await import('../src/quodom/rubrosDisponibles');
  reiniciarCacheRubros();
});
