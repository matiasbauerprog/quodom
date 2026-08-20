# Elegir entre productos parecidos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cuando un renglón de la lista subida corresponda a varios productos del catálogo, el usuario elija entre ellos en vez de que la IA elija uno en silencio.

**Architecture:** La respuesta del modelo gana una tercera lista, `ambiguas`, con hasta tres candidatos por renglón y cuál sugiere; el servidor resuelve nombre y rubro de cada candidato contra el catálogo y los valida como ya valida los ids. La pantalla muestra esas líneas en un bloque propio arriba de los grupos, y a medida que el usuario elige, cada línea baja al grupo de su rubro. Los grupos pasan a ser lo que trajo el servidor más lo que el usuario resolvió, así que esa combinación se calcula en la pantalla.

**Tech Stack:** Express + Sequelize + SQLite (JavaScript) en `quodom-web/api`; React + Vite + TypeScript en `quodom-web/app`. Tests: Jest + supertest (API, SQLite real en memoria, `callGemini` mockeado), Vitest + testing-library (front).

**Spec:** `docs/superpowers/specs/2026-08-20-lista-alternativas-design.md`

## Global Constraints

- **UI en español, código e identificadores en inglés.** Los textos que ve el usuario van verbatim como los escribe este plan: los tests matchean sobre ellos.
- **Nada se descarta en silencio.** Toda línea de la entrada termina en un grupo, en `ambiguas`, o en `noEncontrados`. El chequeo de cobertura que ya existe sigue valiendo, ahora contando también las ambiguas.
- **Nunca se confía en el modelo.** Un `idproducto` candidato que no esté en el catálogo activo se descarta, igual que ya se hace con los ids de `items`.
- **Un Quodom pertenece a un solo rubro** y agregar productos nunca crea uno como efecto secundario: si no hay uno abierto de ese rubro, se pide confirmación primero. Esa lógica ya existe en `GrupoRubro` y no se toca.
- **El sugerido es una recomendación, no una preselección.** Mientras el usuario no elija, la línea ambigua no entra a ningún Quodom.
- **Tope de tres candidatos** por línea ambigua.
- **El chat no se toca.** `PropuestaEditable` es compartido con `PanelConversacion`: se sigue usando tal cual, sin agregarle props ni ramas.
- HTML semántico: `role="alert"` para avisos, `button` real para cada candidato, `fieldset`/`legend` no hacen falta porque cada candidato es una acción, no un campo.
- Mobile-first; usar las variables CSS que ya existen (`var(--color-acento)`, `var(--color-texto)`, `var(--font-prompt)`, `var(--sp-2)`, `var(--radius-hoja-tl)`, `var(--radius-hoja-br)`) en vez de literales.
- API tests con SQLite real en memoria; sólo se mockea `callGemini`. Nunca mockear la base.
- **Este proyecto no tiene `clearMocks` en la config de vitest**: el historial de llamadas de un mock se arrastra entre bloques `describe` del mismo archivo. Un `expect(...).not.toHaveBeenCalled()` en un `describe` nuevo necesita su propio `mockClear`.
- Preferir ediciones in-place a truncar y reescribir: reescribir un archivo que Vite está sirviendo puede hacer que cachee un módulo vacío (CLAUDE.md §7).
- No commitear `quodom-web/api/quodom.sqlite`. Este plan no cambia el schema.

## File Structure

**Crear:**
- `app/src/screens/ListaIA/LineasAmbiguas.tsx` — el bloque "Tenés que elegir". Presentacional: recibe las líneas y avisa qué eligió el usuario.
- `app/src/screens/ListaIA/__tests__/LineasAmbiguas.test.tsx`

**Modificar:**
- `api/src/controllers/lista.controller.js` — el esquema, la regla del prompt, la validación de candidatos y la separación en la salida.
- `api/tests/lista.controller.test.js`
- `app/src/api/lista.ts` — los tipos nuevos.
- `app/src/screens/ListaIA/GrupoRubro.tsx` — vuelve a ser editable si le llegan productos nuevos después de confirmar, y muestra el aviso de pendientes.
- `app/src/screens/ListaIA/__tests__/GrupoRubro.test.tsx`
- `app/src/screens/ListaIA/PanelLista.tsx` — el estado de lo resuelto y la combinación de grupos.
- `app/src/screens/ListaIA/__tests__/PanelLista.test.tsx`
- `app/src/screens/ListaIA/ListaIA.css` — estilos del bloque nuevo.

**Sin tocar:** `api/src/routes/ia.route.js` (el endpoint devuelve lo que le da el controller, sin mirarlo), `helpers/catalogoActivo.js`, `helpers/listaEntrada.js`, `CargarLista.tsx`, `NoEncontrados.tsx`, `PropuestaEditable.tsx`, `PanelConversacion.tsx`.

---

### Task 1: El servidor devuelve las ambiguas

**Files:**
- Modify: `quodom-web/api/src/controllers/lista.controller.js`
- Test: `quodom-web/api/tests/lista.controller.test.js`

**Interfaces:**
- Produces: `procesarLista(entrada)` ahora resuelve a
  `{ res: true, grupos, ambiguas, noEncontrados, lineasIgnoradas }`, donde
  `ambiguas` es `Array<{ textoOriginal, cantidad, sugerido, candidatos: Array<{ idproducto, nombreProducto, idrubro, rubro }> }>`.

- [ ] **Step 1: Write the failing tests**

En `quodom-web/api/tests/lista.controller.test.js`, agregar al final del archivo:

```js
describe('procesarLista (líneas ambiguas)', () => {
  it('devuelve la línea en ambiguas y no en ningún grupo', async () => {
    callGemini.mockResolvedValueOnce({
      items: [],
      ambiguas: [{ textoOriginal: '3 platos', cantidad: 3, sugerido: 8002, candidatos: [8001, 8002] }],
      noEncontrados: []
    });

    const out = await procesarLista({ tipo: 'texto', texto: '3 platos' });

    expect(out.grupos).toEqual([]);
    expect(out.noEncontrados).toEqual([]);
    expect(out.ambiguas).toEqual([{
      textoOriginal: '3 platos',
      cantidad: 3,
      sugerido: 8002,
      candidatos: [
        { idproducto: 8001, nombreProducto: 'Lavandina 5L', idrubro: 1, rubro: 'Limpieza' },
        { idproducto: 8002, nombreProducto: 'Resma A4 75g', idrubro: 2, rubro: 'Librería' }
      ]
    }]);
  });

  it('descarta un candidato inventado y conserva los válidos', async () => {
    callGemini.mockResolvedValueOnce({
      items: [],
      ambiguas: [{ textoOriginal: '3 platos', cantidad: 3, sugerido: 8001, candidatos: [8001, 999999, 8002] }],
      noEncontrados: []
    });

    const out = await procesarLista({ tipo: 'texto', texto: '3 platos' });

    expect(out.ambiguas[0].candidatos.map(c => c.idproducto)).toEqual([8001, 8002]);
  });

  it('una ambigua que queda con un solo candidato deja de serlo y baja a su grupo', async () => {
    callGemini.mockResolvedValueOnce({
      items: [],
      ambiguas: [{ textoOriginal: '3 lavandinas', cantidad: 3, sugerido: 8001, candidatos: [8001, 999999] }],
      noEncontrados: []
    });

    const out = await procesarLista({ tipo: 'texto', texto: '3 lavandinas' });

    expect(out.ambiguas).toEqual([]);
    expect(out.grupos).toHaveLength(1);
    expect(out.grupos[0].items[0]).toEqual({
      textoOriginal: '3 lavandinas', idproducto: 8001, nombreProducto: 'Lavandina 5L', cantidad: 3
    });
  });

  it('una ambigua sin candidatos válidos va a noEncontrados', async () => {
    callGemini.mockResolvedValueOnce({
      items: [],
      ambiguas: [{ textoOriginal: 'un unicornio', cantidad: 1, sugerido: 999999, candidatos: [999999] }],
      noEncontrados: []
    });

    const out = await procesarLista({ tipo: 'texto', texto: 'un unicornio' });

    expect(out.ambiguas).toEqual([]);
    expect(out.grupos).toEqual([]);
    expect(out.noEncontrados).toEqual([
      { textoOriginal: 'un unicornio', motivo: 'no está en el catálogo' }
    ]);
  });

  it('si el sugerido no sobrevivió, sugiere el primer candidato válido', async () => {
    callGemini.mockResolvedValueOnce({
      items: [],
      ambiguas: [{ textoOriginal: '3 platos', cantidad: 3, sugerido: 999999, candidatos: [8001, 8002] }],
      noEncontrados: []
    });

    const out = await procesarLista({ tipo: 'texto', texto: '3 platos' });

    expect(out.ambiguas[0].sugerido).toBe(8001);
  });

  it('recorta a tres candidatos', async () => {
    callGemini.mockResolvedValueOnce({
      items: [],
      ambiguas: [{
        textoOriginal: '3 platos', cantidad: 3, sugerido: 8001,
        candidatos: [8001, 8002, 8003, 8001, 8002]
      }],
      noEncontrados: []
    });

    const out = await procesarLista({ tipo: 'texto', texto: '3 platos' });

    expect(out.ambiguas[0].candidatos).toHaveLength(3);
  });

  it('una línea ambigua cuenta para la cobertura y no se pierde', async () => {
    callGemini.mockResolvedValueOnce({
      items: [{ textoOriginal: '3 lavandinas 5L', idproducto: 8001, cantidad: 3 }],
      ambiguas: [{ textoOriginal: '2 resmas A4', cantidad: 2, sugerido: 8002, candidatos: [8002, 8003] }],
      noEncontrados: []
    });

    const out = await procesarLista({ tipo: 'texto', texto: '3 lavandinas 5L\n2 resmas A4' });

    expect(out.noEncontrados).toEqual([]);
    expect(out.grupos).toHaveLength(1);
    expect(out.ambiguas).toHaveLength(1);
  });

  it('sin ambiguas devuelve la lista vacía, no undefined', async () => {
    callGemini.mockResolvedValueOnce({
      items: [{ textoOriginal: '3 lavandinas 5L', idproducto: 8001, cantidad: 3 }],
      ambiguas: [],
      noEncontrados: []
    });

    const out = await procesarLista({ tipo: 'texto', texto: '3 lavandinas 5L' });

    expect(out.ambiguas).toEqual([]);
  });
});
```

El producto `8003` ya existe en el `beforeAll` del archivo (`Casco obra`, rubro 8, desactivado), así que en el test de recorte sólo `8001` y `8002` son válidos: con `[8001, 8002, 8003, 8001, 8002]` quedan dos válidos únicos, lo que daría `toHaveLength(2)` y no 3. Cambiar ese test para usar un tercer producto activo: agregar al `beforeAll` del archivo, en `db.Products.bulkCreate`, un cuarto producto activo

```js
    { id: 8004, nombreproducto: 'Resma A4 90g', categoria: 93, categoriaPadre: 2 },
```

y en el test de recorte usar `candidatos: [8001, 8002, 8004, 8001, 8002]`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd quodom-web/api && npx jest tests/lista.controller.test.js`
Expected: FAIL — `out.ambiguas` es `undefined`

- [ ] **Step 3: Extend the response schema**

En `quodom-web/api/src/controllers/lista.controller.js`, dentro de `LISTA_SCHEMA`, agregar la propiedad `ambiguas` junto a `items` y `noEncontrados`:

```js
        ambiguas: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    textoOriginal: { type: 'string' },
                    cantidad: { type: 'integer' },
                    sugerido: { type: 'integer' },
                    candidatos: { type: 'array', items: { type: 'integer' } }
                },
                required: ['textoOriginal', 'candidatos']
            }
        }
```

y cambiar el `required` del esquema a:

```js
    required: ['items', 'ambiguas', 'noEncontrados']
```

- [ ] **Step 4: Add the prompt rule**

En la función `systemPrompt`, agregar una regla nueva a la lista numerada, después de la última:

```js
        '9. Si un renglón corresponde a VARIOS productos del catálogo que responden igual de bien ' +
        '(por ejemplo "platos descartables" cuando hay platos de cartón, de aluminio y de plástico), ' +
        'NO elijas uno en silencio: devolvelo en "ambiguas" con hasta 3 "candidatos" (sus idproducto) ' +
        'y "sugerido" con el que te parece mejor. Si el renglón es preciso, resolvelo en "items": ' +
        'la ambigüedad no es una excusa para no decidir.\n' +
```

Y en el bloque de formato, donde se describen `items` y `noEncontrados`, mencionar la tercera lista para que el modelo sepa que existe.

- [ ] **Step 5: Process the ambiguous lines**

En `procesarLista`, después del bucle que recorre `reply.items` y antes del que recorre `reply.noEncontrados`, agregar el procesamiento de las ambiguas. Se empujan al mismo array `resueltos` para que participen del recorte por límite y del chequeo de cobertura; se separan al final.

```js
    for (const a of Array.isArray(reply.ambiguas) ? reply.ambiguas : []) {
        const textoOriginal = String(a.textoOriginal || '').trim();
        vistos.add(clave(textoOriginal));

        // Se validan primero y se recorta después: si el modelo manda cinco y
        // los dos primeros no existen, igual quedan tres candidatos reales.
        const candidatos = [];
        for (const id of Array.isArray(a.candidatos) ? a.candidatos : []) {
            const producto = porId.get(id);
            if (!producto) continue;
            if (candidatos.some(c => c.idproducto === producto.id)) continue;
            candidatos.push({
                idproducto: producto.id,
                nombreProducto: producto.nombre,
                idrubro: producto.idrubro,
                rubro: producto.rubro
            });
            if (candidatos.length === 3) break;
        }

        const cantidad = Math.max(1, Number(a.cantidad) || 1);

        if (candidatos.length === 0) {
            resueltos.push({ textoOriginal, motivo: 'no está en el catálogo' });
            continue;
        }

        // Elegir entre una sola opción no es elegir: baja directo a su grupo.
        if (candidatos.length === 1) {
            const unico = candidatos[0];
            resueltos.push({
                textoOriginal,
                idproducto: unico.idproducto,
                nombreProducto: unico.nombreProducto,
                cantidad,
                idrubro: unico.idrubro,
                rubro: unico.rubro
            });
            continue;
        }

        const sugerido = candidatos.some(c => c.idproducto === a.sugerido)
            ? a.sugerido
            : candidatos[0].idproducto;

        resueltos.push({ textoOriginal, cantidad, sugerido, candidatos });
    }
```

- [ ] **Step 6: Split them out of the grouping loop**

En el bucle final que arma los grupos, las ambiguas tienen que salir antes de la rama de `noEncontrados`, porque no tienen `idproducto` pero tampoco son un fallo. Declarar el array junto a los otros:

```js
    const ambiguas = [];
```

y al principio del cuerpo del bucle `for (const r of dentro)`, antes del `if (!r.idproducto)`:

```js
        if (r.candidatos) {
            ambiguas.push({
                textoOriginal: r.textoOriginal,
                cantidad: r.cantidad,
                sugerido: r.sugerido,
                candidatos: r.candidatos
            });
            continue;
        }
```

Y devolver la lista nueva:

```js
    return { res: true, grupos, ambiguas, noEncontrados, lineasIgnoradas };
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd quodom-web/api && npx jest tests/lista.controller.test.js`
Expected: PASS — los 8 tests nuevos y los que ya estaban

- [ ] **Step 8: Run the whole API suite**

Run: `cd quodom-web/api && npm test`
Expected: PASS — en particular `lista.endpoint.test.js`, que no se modificó: el endpoint devuelve lo que le da el controller sin mirarlo

- [ ] **Step 9: Commit**

```bash
git add quodom-web/api/src/controllers/lista.controller.js quodom-web/api/tests/lista.controller.test.js
git commit -m "feat(api): return competing catalog matches as ambiguous lines"
```

---

### Task 2: Los tipos del front

**Files:**
- Modify: `quodom-web/app/src/api/lista.ts`

**Interfaces:**
- Produces:
  - `type ListaCandidato = { idproducto: number; nombreProducto: string; idrubro: number; rubro: string }`
  - `type ListaAmbigua = { textoOriginal: string; cantidad: number; sugerido: number; candidatos: ListaCandidato[] }`
  - `ListaResponse` gana `ambiguas: ListaAmbigua[]`

Las tres tareas siguientes importan estos nombres verbatim.

- [ ] **Step 1: Write the types**

En `quodom-web/app/src/api/lista.ts`, agregar después de `ListaNoEncontrado`:

```ts
export type ListaCandidato = {
  idproducto: number;
  nombreProducto: string;
  idrubro: number;
  rubro: string;
};

export type ListaAmbigua = {
  textoOriginal: string;
  cantidad: number;
  sugerido: number;
  candidatos: ListaCandidato[];
};
```

y agregar el campo a `ListaResponse`, entre `grupos` y `noEncontrados`:

```ts
  ambiguas: ListaAmbigua[];
```

Este archivo no lleva test propio: lo cubren las tres tareas siguientes, que lo mockean, más `npm run typecheck`.

- [ ] **Step 2: Verify it typechecks**

Run: `cd quodom-web/app && npm run typecheck`
Expected: sin errores. Los tests existentes que construyen un `ListaResponse` literal van a fallar la compilación si les falta `ambiguas` — si eso pasa, agregarles `ambiguas: []`, que es lo que el servidor devuelve cuando no hay ninguna.

- [ ] **Step 3: Run the app suite**

Run: `cd quodom-web/app && npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add quodom-web/app/src
git commit -m "feat(app): type the ambiguous lines returned by the list endpoint"
```

---

### Task 3: El bloque "Tenés que elegir"

**Files:**
- Create: `quodom-web/app/src/screens/ListaIA/LineasAmbiguas.tsx`
- Modify: `quodom-web/app/src/screens/ListaIA/ListaIA.css`
- Test: `quodom-web/app/src/screens/ListaIA/__tests__/LineasAmbiguas.test.tsx`

**Interfaces:**
- Consumes: `ListaAmbigua`, `ListaCandidato` de `../../api/lista` (Task 2).
- Produces: `<LineasAmbiguas lineas={ListaAmbigua[]} onElegir={(linea: ListaAmbigua, candidato: ListaCandidato) => void} onDescartar={(linea: ListaAmbigua) => void} />`

El componente es presentacional: no guarda estado ni decide a qué grupo va nada. Sólo avisa qué tocó el usuario.

- [ ] **Step 1: Write the failing test**

Crear `quodom-web/app/src/screens/ListaIA/__tests__/LineasAmbiguas.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { LineasAmbiguas } from '../LineasAmbiguas';
import type { ListaAmbigua } from '../../../api/lista';

const LINEA: ListaAmbigua = {
  textoOriginal: '3 platos descartables',
  cantidad: 3,
  sugerido: 493,
  candidatos: [
    { idproducto: 455, nombreProducto: 'Plato por 10 unidades', idrubro: 3, rubro: 'Papelera' },
    { idproducto: 493, nombreProducto: 'Plato descartable por 100 unidades', idrubro: 3, rubro: 'Papelera' }
  ]
};

describe('LineasAmbiguas', () => {
  it('no dibuja nada sin líneas', () => {
    const { container } = render(<LineasAmbiguas lineas={[]} onElegir={vi.fn()} onDescartar={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra el renglón original y los candidatos con su rubro', () => {
    render(<LineasAmbiguas lineas={[LINEA]} onElegir={vi.fn()} onDescartar={vi.fn()} />);

    const bloque = screen.getByRole('region', { name: /tenés que elegir/i });
    expect(within(bloque).getByText(/3 platos descartables/)).toBeInTheDocument();
    expect(within(bloque).getByRole('button', { name: /plato por 10 unidades/i })).toBeInTheDocument();
    expect(within(bloque).getByRole('button', { name: /plato descartable por 100 unidades/i })).toBeInTheDocument();
    expect(within(bloque).getAllByText(/papelera/i).length).toBeGreaterThan(0);
  });

  it('marca el sugerido y no el resto', () => {
    render(<LineasAmbiguas lineas={[LINEA]} onElegir={vi.fn()} onDescartar={vi.fn()} />);

    expect(screen.getByRole('button', { name: /plato descartable por 100 unidades/i }))
      .toHaveTextContent(/sugerido/i);
    expect(screen.getByRole('button', { name: /plato por 10 unidades/i }))
      .not.toHaveTextContent(/sugerido/i);
  });

  it('avisa qué candidato se eligió', () => {
    const onElegir = vi.fn();
    render(<LineasAmbiguas lineas={[LINEA]} onElegir={onElegir} onDescartar={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /plato por 10 unidades/i }));

    expect(onElegir).toHaveBeenCalledWith(LINEA, LINEA.candidatos[0]);
  });

  it('avisa cuando se descarta la línea', () => {
    const onDescartar = vi.fn();
    render(<LineasAmbiguas lineas={[LINEA]} onElegir={vi.fn()} onDescartar={onDescartar} />);

    fireEvent.click(screen.getByRole('button', { name: /descartar/i }));

    expect(onDescartar).toHaveBeenCalledWith(LINEA);
  });

  it('dice cuántas líneas hay esperando', () => {
    const otra: ListaAmbigua = { ...LINEA, textoOriginal: '2 papeles' };
    render(<LineasAmbiguas lineas={[LINEA, otra]} onElegir={vi.fn()} onDescartar={vi.fn()} />);

    expect(screen.getByRole('region', { name: /tenés que elegir/i })).toHaveTextContent(/2/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/app && npx vitest run src/screens/ListaIA/__tests__/LineasAmbiguas.test.tsx`
Expected: FAIL — no se puede resolver `../LineasAmbiguas`

- [ ] **Step 3: Write the component**

Crear `quodom-web/app/src/screens/ListaIA/LineasAmbiguas.tsx`:

```tsx
import type { ListaAmbigua, ListaCandidato } from '../../api/lista';

// Presentacional a propósito: no guarda estado ni sabe a qué grupo va cada
// línea. Avisa qué tocó el usuario y el panel decide qué hacer con eso.
export function LineasAmbiguas({
  lineas,
  onElegir,
  onDescartar
}: {
  lineas: ListaAmbigua[];
  onElegir: (linea: ListaAmbigua, candidato: ListaCandidato) => void;
  onDescartar: (linea: ListaAmbigua) => void;
}) {
  if (lineas.length === 0) return null;

  return (
    <section className="amb card hoja" aria-labelledby="amb-titulo">
      <h2 id="amb-titulo" className="amb-titulo">
        Tenés que elegir — {lineas.length}{' '}
        {lineas.length === 1 ? 'línea' : 'líneas'}
      </h2>
      <p className="amb-ayuda">
        Encontré más de un producto para estos renglones. Elegí cuál querés y va a ir al Quodom
        del rubro que corresponda.
      </p>

      <ul className="amb-lista">
        {lineas.map(linea => (
          <li key={linea.textoOriginal} className="amb-item">
            <p className="amb-original">
              <strong>{linea.textoOriginal}</strong>
            </p>

            <div className="amb-candidatos">
              {linea.candidatos.map(c => (
                <button
                  key={c.idproducto}
                  type="button"
                  className="amb-candidato"
                  onClick={() => onElegir(linea, c)}
                >
                  <span className="amb-candidato-nombre">{c.nombreProducto}</span>
                  <span className="amb-candidato-rubro">{c.rubro}</span>
                  {c.idproducto === linea.sugerido && (
                    <span className="amb-sugerido">sugerido</span>
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-ghost amb-descartar"
              onClick={() => onDescartar(linea)}
            >
              Descartar este renglón
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Style it**

En `quodom-web/app/src/screens/ListaIA/ListaIA.css`, agregar al final:

```css
.amb { padding: 16px; margin-bottom: 16px; }

.amb-titulo {
  font-family: var(--font-prompt);
  font-size: 1.05rem;
  margin: 0 0 var(--sp-2) 0;
  color: var(--color-texto);
}

.amb-ayuda {
  font-family: var(--font-jaldi);
  color: var(--color-texto);
  margin: 0 0 var(--sp-3) 0;
}

.amb-lista { list-style: none; margin: 0; padding: 0; }

.amb-item {
  padding: var(--sp-2) 0;
  border-bottom: 1px solid var(--color-fondo);
}

.amb-original { margin: 0 0 var(--sp-2) 0; font-family: var(--font-jaldi); }

.amb-candidatos { display: flex; flex-direction: column; gap: 8px; }

.amb-candidato {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-acento);
  background: var(--color-tarjeta);
  color: var(--color-texto);
  font-family: var(--font-jaldi);
  text-align: left;
  cursor: pointer;
  border-top-left-radius: var(--radius-hoja-tl);
  border-bottom-right-radius: var(--radius-hoja-br);
}

.amb-candidato:hover { filter: brightness(0.98); }

.amb-candidato-nombre { font-weight: 600; }

.amb-candidato-rubro {
  font-size: 0.85rem;
  opacity: 0.7;
}

.amb-sugerido {
  font-size: 0.75rem;
  font-family: var(--font-mont);
  text-transform: uppercase;
  color: var(--color-acento);
}

.amb-descartar { margin-top: var(--sp-2); }

@media (min-width: 1025px) {
  .amb-candidatos { flex-direction: row; flex-wrap: wrap; }
  .amb-candidato { width: auto; min-width: 220px; }
}
```

Las variables usadas están todas definidas en `src/styles/tokens.css`: `--color-fondo`, `--color-tarjeta`, `--color-texto`, `--color-acento`, `--font-prompt`, `--font-jaldi`, `--font-mont`, `--radius-hoja-tl`, `--radius-hoja-br`. No inventar ninguna nueva.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd quodom-web/app && npx vitest run src/screens/ListaIA/__tests__/LineasAmbiguas.test.tsx`
Expected: PASS, 6 tests

- [ ] **Step 6: Commit**

```bash
git add quodom-web/app/src/screens/ListaIA
git commit -m "feat(app): add the block for picking between competing matches"
```

---

### Task 4: El grupo acepta productos después de haber sido confirmado

**Files:**
- Modify: `quodom-web/app/src/screens/ListaIA/GrupoRubro.tsx`
- Test: `quodom-web/app/src/screens/ListaIA/__tests__/GrupoRubro.test.tsx`

**Interfaces:**
- Produces: `<GrupoRubro grupo={ListaGrupo} pendientesSinResolver={number} />`. `pendientesSinResolver` es cuántas líneas ambiguas siguen esperando decisión en el bloque de arriba; sólo se usa para el aviso del botón. Por defecto `0`.

Hoy un grupo confirmado queda en "Agregado ✓" para siempre, porque su contenido no podía cambiar. Con las alternativas sí puede: el usuario puede confirmar el grupo de Papelera y recién entonces resolver una línea que también es de Papelera.

- [ ] **Step 1: Write the failing tests**

En `quodom-web/app/src/screens/ListaIA/__tests__/GrupoRubro.test.tsx`, agregar al final:

```tsx
describe('GrupoRubro (le llega un producto después de confirmar)', () => {
  it('vuelve a mostrar la propuesta y sólo agrega lo nuevo', async () => {
    mockActivo.mockResolvedValue({ id: 'QD-9', idrubro: 1 });
    const { rerender } = render(<MemoryRouter><GrupoRubro grupo={GRUPO} /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));
    await waitFor(() => expect(screen.getByText(/agregado/i)).toBeInTheDocument());
    expect(mockAdd).toHaveBeenCalledTimes(1);

    const conMas = {
      ...GRUPO,
      items: [
        ...GRUPO.items,
        { textoOriginal: '3 platos', idproducto: 8009, nombreProducto: 'Plato por 10 unidades', cantidad: 3 }
      ]
    };
    rerender(<MemoryRouter><GrupoRubro grupo={conMas} /></MemoryRouter>);

    expect(screen.getByText(/agregado/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));

    await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(2));
    expect(mockAdd).toHaveBeenLastCalledWith(expect.objectContaining({ idproducto: 8009 }));
  });

  it('avisa cuántas líneas quedaron sin resolver arriba', () => {
    mockActivo.mockResolvedValue({ id: 'QD-9', idrubro: 1 });
    render(<MemoryRouter><GrupoRubro grupo={GRUPO} pendientesSinResolver={2} /></MemoryRouter>);

    expect(screen.getByText(/2 líneas .*sin resolver/i)).toBeInTheDocument();
  });

  it('no avisa nada si no quedan líneas sin resolver', () => {
    mockActivo.mockResolvedValue({ id: 'QD-9', idrubro: 1 });
    render(<MemoryRouter><GrupoRubro grupo={GRUPO} pendientesSinResolver={0} /></MemoryRouter>);

    expect(screen.queryByText(/sin resolver/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd quodom-web/app && npx vitest run src/screens/ListaIA/__tests__/GrupoRubro.test.tsx`
Expected: FAIL — tras confirmar no vuelve a mostrar la propuesta, y no existe el aviso

- [ ] **Step 3: Split what is already added from what is pending**

En `quodom-web/app/src/screens/ListaIA/GrupoRubro.tsx`:

1. Cambiar la firma:

```tsx
export function GrupoRubro({
  grupo,
  pendientesSinResolver = 0
}: {
  grupo: ListaGrupo;
  pendientesSinResolver?: number;
}) {
```

2. Después de la constante `items` y del `agregadosRef`, derivar lo que falta agregar. `agregadosRef` es un ref, así que no dispara render por sí solo — pero cuando llega un producto nuevo cambian las props, y en ese render el filtro se recalcula:

```tsx
  // Lo que todavía no se mandó al servidor. Un grupo ya confirmado puede recibir
  // productos nuevos si el usuario resuelve una línea ambigua de este rubro
  // después de haber confirmado.
  const pendientes = items.filter(it => !agregadosRef.current.has(it.idproducto));
  const todoAgregado = agregadoEn !== null && pendientes.length === 0;
```

3. Reemplazar el bloque ternario del render por los dos bloques independientes, para que "Agregado ✓" y la propuesta puedan convivir:

```tsx
      {agregadoEn && (
        <p className="gr-agregado">
          Agregado ✓ <Link to={'/quodom?id=' + encodeURIComponent(agregadoEn)}>ver Quodom</Link>
        </p>
      )}

      {!todoAgregado && (
        <PropuestaEditable items={pendientes} onConfirm={confirmar} busy={confirming} />
      )}

      {pendientesSinResolver > 0 && (
        <p className="gr-pendientes">
          Quedan {pendientesSinResolver}{' '}
          {pendientesSinResolver === 1 ? 'línea' : 'líneas'} sin resolver arriba.
        </p>
      )}
```

- [ ] **Step 4: Style the notice**

En `quodom-web/app/src/screens/ListaIA/ListaIA.css`, agregar:

```css
.gr-pendientes {
  font-family: var(--font-jaldi);
  color: var(--color-texto);
  opacity: 0.75;
  margin: var(--sp-2) 0 0 0;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd quodom-web/app && npx vitest run src/screens/ListaIA/__tests__/GrupoRubro.test.tsx`
Expected: PASS — los 3 nuevos y los 7 que ya estaban

- [ ] **Step 6: Commit**

```bash
git add quodom-web/app/src/screens/ListaIA
git commit -m "feat(app): let a confirmed rubro group accept newly resolved products"
```

---

### Task 5: El panel combina lo del servidor con lo que el usuario resolvió

**Files:**
- Modify: `quodom-web/app/src/screens/ListaIA/PanelLista.tsx`
- Test: `quodom-web/app/src/screens/ListaIA/__tests__/PanelLista.test.tsx`

**Interfaces:**
- Consumes: `<LineasAmbiguas lineas onElegir onDescartar />` (Task 3); `<GrupoRubro grupo pendientesSinResolver />` (Task 4); `ListaAmbigua`, `ListaCandidato`, `ListaItem`, `ListaGrupo` de `../../api/lista` (Task 2).

- [ ] **Step 1: Write the failing tests**

En `quodom-web/app/src/screens/ListaIA/__tests__/PanelLista.test.tsx`, agregar al final del archivo:

```tsx
const CON_AMBIGUA = {
  res: true as const,
  grupos: [
    {
      idrubro: 1, rubro: 'Limpieza',
      items: [{ textoOriginal: '3 lavandinas', idproducto: 8001, nombreProducto: 'Lavandina 5L', cantidad: 3 }]
    }
  ],
  ambiguas: [
    {
      textoOriginal: '3 platos descartables',
      cantidad: 3,
      sugerido: 493,
      candidatos: [
        { idproducto: 455, nombreProducto: 'Plato por 10 unidades', idrubro: 3, rubro: 'Papelera' },
        { idproducto: 493, nombreProducto: 'Plato descartable por 100 unidades', idrubro: 3, rubro: 'Papelera' }
      ]
    }
  ],
  noEncontrados: [],
  lineasIgnoradas: 0
};

async function enviarCon(respuesta: unknown) {
  mockProcesar.mockResolvedValue(respuesta);
  render(<MemoryRouter><PanelLista /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(/pegá tu lista/i), { target: { value: '3 lavandinas\n3 platos descartables' } });
  fireEvent.click(screen.getByRole('button', { name: /buscar en el catálogo/i }));
}

describe('PanelLista (líneas ambiguas)', () => {
  it('muestra el bloque de elección arriba de los grupos', async () => {
    await enviarCon(CON_AMBIGUA);

    expect(await screen.findByRole('region', { name: /tenés que elegir/i })).toBeInTheDocument();
    expect(screen.getByText(/Limpieza/)).toBeInTheDocument();
    expect(screen.queryByText(/Papelera/)).toBeInTheDocument();
  });

  it('elegir un candidato lo saca del bloque y crea el grupo de su rubro', async () => {
    await enviarCon(CON_AMBIGUA);
    await screen.findByRole('region', { name: /tenés que elegir/i });

    fireEvent.click(screen.getByRole('button', { name: /plato descartable por 100 unidades/i }));

    await waitFor(() => expect(screen.queryByRole('region', { name: /tenés que elegir/i })).toBeNull());
    expect(screen.getByText('Plato descartable por 100 unidades')).toBeInTheDocument();
    expect(screen.getByText(/Papelera — 1 producto/)).toBeInTheDocument();
  });

  it('descartar una línea no la agrega a ningún grupo', async () => {
    await enviarCon(CON_AMBIGUA);
    await screen.findByRole('region', { name: /tenés que elegir/i });

    fireEvent.click(screen.getByRole('button', { name: /descartar/i }));

    await waitFor(() => expect(screen.queryByRole('region', { name: /tenés que elegir/i })).toBeNull());
    expect(screen.queryByText(/Papelera/)).toBeNull();
  });

  it('avisa en el grupo cuántas líneas quedan sin resolver', async () => {
    await enviarCon(CON_AMBIGUA);

    expect(await screen.findByText(/1 línea sin resolver/i)).toBeInTheDocument();
  });

  it('sin ambiguas no dibuja el bloque', async () => {
    await enviarCon({ ...CON_AMBIGUA, ambiguas: [] });

    await screen.findByText(/Limpieza/);
    expect(screen.queryByRole('region', { name: /tenés que elegir/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd quodom-web/app && npx vitest run src/screens/ListaIA/__tests__/PanelLista.test.tsx`
Expected: FAIL — el bloque no existe

- [ ] **Step 3: Hold what the user resolved**

En `quodom-web/app/src/screens/ListaIA/PanelLista.tsx`:

1. Agregar los imports:

```tsx
import { LineasAmbiguas } from './LineasAmbiguas';
import type { ListaAmbigua, ListaCandidato, ListaGrupo, ListaItem } from '../../api/lista';
```

2. Agregar el estado, junto a los que ya están. Se guarda qué renglones resolvió el usuario y con qué producto; los descartados quedan resueltos sin producto:

```tsx
  const [resueltas, setResueltas] = useState<Record<string, ListaCandidato | null>>({});
```

El índice es el texto original del renglón. Dos líneas ambiguas con el texto idéntico compartirían entrada, pero el servidor ya colapsa los renglones repetidos por ese mismo texto normalizado antes de responder, así que no llegan dos ambiguas con el mismo `textoOriginal`.

3. Limpiar ese estado al procesar una lista nueva. Dentro de `procesar`, junto a `setResultado(null)`:

```tsx
    setResueltas({});
```

4. Agregar los dos handlers y el cálculo de lo que se dibuja, antes del `return`:

```tsx
  function elegir(linea: ListaAmbigua, candidato: ListaCandidato) {
    setResueltas(r => ({ ...r, [linea.textoOriginal]: candidato }));
  }

  function descartar(linea: ListaAmbigua) {
    setResueltas(r => ({ ...r, [linea.textoOriginal]: null }));
  }

  // Los grupos que se dibujan son los que trajo el servidor más lo que el
  // usuario fue resolviendo: elegir un candidato agrega su producto al grupo de
  // su rubro, creándolo si ese rubro todavía no tenía uno.
  const ambiguasPendientes = (resultado?.ambiguas ?? [])
    .filter(a => !(a.textoOriginal in resueltas));

  const grupos: ListaGrupo[] = (resultado?.grupos ?? []).map(g => ({ ...g, items: [...g.items] }));

  for (const ambigua of resultado?.ambiguas ?? []) {
    const elegido = resueltas[ambigua.textoOriginal];
    if (!elegido) continue;
    const item: ListaItem = {
      textoOriginal: ambigua.textoOriginal,
      idproducto: elegido.idproducto,
      nombreProducto: elegido.nombreProducto,
      cantidad: ambigua.cantidad
    };
    const grupo = grupos.find(g => g.idrubro === elegido.idrubro);
    if (grupo) {
      grupo.items.push(item);
    } else {
      grupos.push({ idrubro: elegido.idrubro, rubro: elegido.rubro, items: [item] });
    }
  }
```

Nota sobre `!elegido`: un renglón descartado se guarda como `null`, así que la misma condición saltea los descartados y los que todavía no se tocaron. Los que todavía no se tocaron ya están fuera por no estar en `resueltas`, y los descartados no deben agregarse — que es justo lo que hace el `continue`.

5. En el `return`, dibujar el bloque antes de los grupos y pasarle a cada grupo cuántas quedan pendientes. Reemplazar la línea que hoy mapea los grupos:

```tsx
      {resultado && (
        <LineasAmbiguas lineas={ambiguasPendientes} onElegir={elegir} onDescartar={descartar} />
      )}

      {resultado && grupos.map(g => (
        <GrupoRubro key={g.idrubro} grupo={g} pendientesSinResolver={ambiguasPendientes.length} />
      ))}
```

6. La condición de "no encontré nada" tiene que contemplar las ambiguas, o una lista que sólo trajo dudosas se anunciaría como vacía:

```tsx
  const vacio = resultado
    && resultado.grupos.length === 0
    && resultado.ambiguas.length === 0
    && resultado.noEncontrados.length === 0;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd quodom-web/app && npx vitest run src/screens/ListaIA/__tests__/PanelLista.test.tsx`
Expected: PASS — los 5 nuevos y los que ya estaban

- [ ] **Step 5: Run everything**

Run: `cd quodom-web/app && npm test && npm run build`
Run: `cd quodom-web/api && npm test`
Expected: PASS en las tres

- [ ] **Step 6: Commit**

```bash
git add quodom-web/app/src/screens/ListaIA
git commit -m "feat(app): merge user-resolved lines into the rubro groups"
```

---

## Verificación final

- [ ] `cd quodom-web/api && npm test` — verde
- [ ] `cd quodom-web/app && npm test` — verde
- [ ] `cd quodom-web/app && npm run build` — sin errores de tipos ni imports muertos
- [ ] Con el dev server corriendo, comparar bytes servidos contra disco para el archivo nuevo (CLAUDE.md §7):
  `curl -s http://localhost:5173/src/screens/ListaIA/LineasAmbiguas.tsx | wc -c`
- [ ] `git status` — `api/quodom.sqlite` sin modificar
