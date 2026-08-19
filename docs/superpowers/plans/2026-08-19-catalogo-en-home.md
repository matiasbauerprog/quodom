# Catálogo en el home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover el recorrido rubro → subcategoría → productos a la home, con el estado en la query string, y dar de baja la búsqueda.

**Architecture:** La home pasa de pantalla a orquestador: lee `rubro` y `sub` de `useSearchParams` y compone tres componentes nuevos (`RubroSelector`, `SubcategoriaTabs`, `ListaProductos`). La URL **es** el estado — rubros y tabs se renderizan como `<Link>`, así que cada selección es una entrada de historial y el Atrás funciona sin código. Las pantallas `/categoria/:id` y `/subcategoria/:id` se borran y quedan como redirects.

**Tech Stack:** React 18 + TypeScript + Vite, react-router-dom 6 (`useSearchParams`), CSS plano, vitest + @testing-library/react (happy-dom).

**Spec:** `docs/superpowers/specs/2026-08-19-catalogo-en-home-design.md`

## Global Constraints

- **UI en español, código y commits en inglés.** (CLAUDE.md §5)
- **Mobile-first estricto.** Breakpoints: tablet `@media (min-width: 601px) and (max-width: 1024px)`, desktop `@media (min-width: 1025px)`. (CLAUDE.md §4)
- **Forma de hoja** en tarjetas: `border-top-left-radius: 8px; border-bottom-right-radius: 8px` (vars `--radius-hoja-tl` / `--radius-hoja-br`).
- **HTML semántico estricto:** `header`, `nav`, `main`, `section`, `article`, `button`, `label`/`input`.
- **Todo camino de "agregar producto" pasa por `app/src/quodom/agregarProducto.ts` o el hook `useAgregarProducto`.** Nunca llamar `addGuestLine` directo. (CLAUDE.md §3)
- **El backend no se toca en este plan.** Ningún archivo bajo `quodom-web/api/`.
- Trabajar siempre desde `quodom-web/app/`. Tests: `npm test`. Typecheck: `npx tsc -b --noEmit`.
- Los rubros habilitados los decide `api/src/config/rubros.js`; el frontend nunca hardcodea qué rubros existen, los toma de `GET /categorias`.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/screens/Home/SitioInicial.tsx` | Orquestador: lee la URL, normaliza params, decide header completo o compacto |
| `src/screens/Home/RubroSelector.tsx` | Fila de rubros como links, con el elegido marcado |
| `src/screens/Home/SubcategoriaTabs.tsx` | Tira horizontal de subcategorías como links |
| `src/screens/Home/SubcategoriaTabs.css` | Estilos de la tira |
| `src/screens/Home/ListaProductos.tsx` | Carga y lista los productos de una subcategoría, modal de detalle, botón agregar |
| `src/screens/Home/ListaProductos.css` | Estilos de la lista (viene de `ProductosPorCategoria.css`) |
| `src/screens/Home/RedirectCategoria.tsx` | Redirects de las dos rutas viejas |
| `src/api/categorias.ts` | Suma `porId` para resolver el rubro padre de una subcategoría |

**Se borran:** `BusquedaScreen.tsx/.css`, `MasBuscados.tsx/.css`, `SubcategoriaLista.tsx/.css`, `ProductosPorCategoria.tsx/.css`, `src/api/busqueda.ts`, `src/api/hist_busquedas.ts`.

---

### Task 1: Dar de baja la búsqueda

Sale primero y sola: es una resta pura, deja el repo funcionando y achica lo que hay que mover después.

**Files:**
- Modify: `src/components/layout/Drawer.tsx:17`
- Modify: `src/router/routes.tsx:13,38`
- Modify: `src/screens/Home/SitioInicial.tsx`
- Modify: `src/screens/Home/SitioInicial.css` (bloque `.home-search*`)
- Delete: `src/screens/Home/BusquedaScreen.tsx`, `src/screens/Home/BusquedaScreen.css`
- Delete: `src/screens/Home/MasBuscados.tsx`, `src/screens/Home/MasBuscados.css`
- Delete: `src/api/busqueda.ts`, `src/api/hist_busquedas.ts`
- Test: `src/components/layout/__tests__/Drawer.test.tsx` (nuevo)

**Interfaces:**
- Consumes: nada.
- Produces: `SitioInicial` sin buscador ni `MasBuscados`; el `Drawer` con una entrada `Modo IA` a `/modo-ia`.

- [ ] **Step 1: Write the failing test**

Crear `src/components/layout/__tests__/Drawer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Drawer } from '../Drawer';
import { useAuth } from '../../../auth/AuthContext';

vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));

function montar() {
  vi.mocked(useAuth).mockReturnValue(
    { user: null, signout: vi.fn() } as unknown as ReturnType<typeof useAuth>
  );
  render(<MemoryRouter><Drawer open onClose={() => {}} /></MemoryRouter>);
}

describe('Drawer', () => {
  it('linkea a Modo IA en lugar de a Buscar', () => {
    montar();

    // La búsqueda se dio de baja: con cinco rubros y las subcategorías a un
    // clic dejó de tener razón de ser.
    expect(screen.queryByRole('link', { name: /buscar/i })).toBeNull();
    // Modo IA vive acá porque el header del home lo esconde al elegir un rubro.
    expect(screen.getByRole('link', { name: /modo ia/i })).toHaveAttribute('href', '/modo-ia');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Drawer`
Expected: FAIL — encuentra el link "Buscar" y no encuentra "Modo IA".

- [ ] **Step 3: Swap the drawer entry**

En `src/components/layout/Drawer.tsx`, reemplazar la línea 17:

```tsx
          <NavLink to="/busqueda" onClick={onClose}>Buscar</NavLink>
```

por:

```tsx
          <NavLink to="/modo-ia" onClick={onClose}>Modo IA</NavLink>
```

No hace falta condicionarlo a `user`: `/modo-ia` está detrás de `ProtectedRoute`, que ya manda a `/login` con `state.from` cuando no hay sesión.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Drawer`
Expected: PASS

- [ ] **Step 5: Delete the search screens and their API clients**

```bash
git rm src/screens/Home/BusquedaScreen.tsx src/screens/Home/BusquedaScreen.css
git rm src/screens/Home/MasBuscados.tsx src/screens/Home/MasBuscados.css
git rm src/api/busqueda.ts src/api/hist_busquedas.ts
```

- [ ] **Step 6: Drop the route**

En `src/router/routes.tsx`, borrar el import de la línea 13:

```tsx
import { BusquedaScreen } from '../screens/Home/BusquedaScreen';
```

y la ruta de la línea 38:

```tsx
      { path: '/busqueda', element: <BusquedaScreen /> },
```

- [ ] **Step 7: Strip the search form from the home**

`src/screens/Home/SitioInicial.tsx` queda así (se van `q`, `onSearch`, el `<form>`, el comentario de `MasBuscados`, y el botón de Modo IA pasa a `Link` — `ProtectedRoute` ya resuelve el caso sin sesión, así que `useNavigate` y `useAuth` dejan de hacer falta):

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { categorias } from '../../api/categorias';
import type { Category } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { RubroIcon } from '../../components/icons/RubroIcon';
import './SitioInicial.css';

export function SitioInicial() {
  const [cats, setCats] = useState<Category[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setCats(null); setErr(null);
    categorias.raiz()
      .then(d => { if (alive) setCats(d); })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error al cargar categorías.'); });
    return () => { alive = false; };
  }, [nonce]);

  if (err) return <div className="container"><ErrorState message={err} onRetry={() => setNonce(n => n + 1)} /></div>;

  return (
    <section className="container home-inicial">
      <h1 className="home-wordmark">QUODOM</h1>
      <Link to="/modo-ia" className="btn home-modo-ia">
        Modo IA — armá tu Quodom conversando
      </Link>
      {!cats ? <Loader /> : (
        <div className="cat-grid">
          {cats.map(c => (
            <Link key={c.id} to={'/categoria/' + c.id} className="cat-card">
              <RubroIcon id={c.id} size={72} />
              <span className="cat-card-name">{c.nombrecategoria}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
```

(El `to="/categoria/"` se mantiene por ahora: lo cambia la Task 5.)

- [ ] **Step 8: Drop the search styles**

En `src/screens/Home/SitioInicial.css`, borrar estas tres reglas completas:

```css
.home-search { position: relative; width: 100%; max-width: 640px; }
.home-search-icon {
  position: absolute; left: 20px; top: 50%; transform: translateY(-50%);
  color: var(--color-texto-muted); pointer-events: none;
  display: inline-flex;
  z-index: 1;
}
.home-inicial .home-search .home-search-input {
  height: 52px;
  padding-left: 56px;
  padding-right: var(--sp-4);
  background: #fff;
  border-radius: 999px;
  box-shadow: var(--shadow-card);
}
```

- [ ] **Step 9: Verify the whole suite and the types**

Run: `npm test && npx tsc -b --noEmit`
Expected: todos los tests en verde, typecheck sin salida. Si `tsc` se queja de un import muerto, es un archivo que quedó referenciando `api/busqueda` o `MasBuscados`: borrar esa referencia.

- [ ] **Step 10: Commit**

```bash
git add -A src/
git commit -m "refactor(app): retire search and point the drawer at Modo IA"
```

---

### Task 2: `ListaProductos`

Extrae el cuerpo de `ProductosPorCategoria` a un componente que recibe la subcategoría por props en vez de por `useParams`, sin header propio. Es la pieza más grande y la que más se reusa; va antes que el orquestador.

**Files:**
- Create: `src/screens/Home/ListaProductos.tsx`
- Create: `src/screens/Home/ListaProductos.css`
- Test: `src/screens/Home/__tests__/ListaProductos.test.tsx`
- (`ProductosPorCategoria.tsx/.css` siguen existiendo hasta la Task 5.)

**Interfaces:**
- Consumes: `productos.porCategoria(idcategoria: number): Promise<Product[]>` de `src/api/productos.ts`; `useAgregarProducto()` de `src/quodom/useAgregarProducto.ts`, que devuelve `{ agregar, agregando, error, pendiente, confirmar, cancelar }`.
- Produces: `export function ListaProductos({ idsubcategoria }: { idsubcategoria: number }): JSX.Element`

- [ ] **Step 1: Write the failing test**

Crear `src/screens/Home/__tests__/ListaProductos.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ListaProductos } from '../ListaProductos';
import { productos } from '../../../api/productos';
import { useAgregarProducto } from '../../../quodom/useAgregarProducto';

vi.mock('../../../api/productos', () => ({ productos: { porCategoria: vi.fn() } }));
vi.mock('../../../quodom/useAgregarProducto', () => ({ useAgregarProducto: vi.fn() }));

const porCategoria = productos.porCategoria as unknown as ReturnType<typeof vi.fn>;
const agregar = vi.fn();

const COCA = {
  id: 700, nombreproducto: 'Coca Cola 2L', descripcion: null, categoria: 70,
  categoriaPadre: 7, imagen: null, refreshImagen: null, atributo1: null, atributo2: null
};

beforeEach(() => {
  porCategoria.mockReset();
  agregar.mockReset();
  vi.mocked(useAgregarProducto).mockReturnValue({
    agregar, agregando: false, error: null, pendiente: null,
    confirmar: vi.fn(), cancelar: vi.fn()
  } as unknown as ReturnType<typeof useAgregarProducto>);
});

describe('ListaProductos', () => {
  it('lista los productos de la subcategoría que recibe', async () => {
    porCategoria.mockResolvedValue([COCA]);
    render(<ListaProductos idsubcategoria={70} />);

    expect(await screen.findByText('Coca Cola 2L')).toBeInTheDocument();
    expect(porCategoria).toHaveBeenCalledWith(70);
  });

  it('recarga cuando cambia la subcategoría', async () => {
    porCategoria.mockResolvedValue([COCA]);
    const { rerender } = render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Coca Cola 2L');

    porCategoria.mockResolvedValue([{ ...COCA, id: 701, nombreproducto: 'Agua 500ml', categoria: 71 }]);
    rerender(<ListaProductos idsubcategoria={71} />);

    expect(await screen.findByText('Agua 500ml')).toBeInTheDocument();
    expect(porCategoria).toHaveBeenLastCalledWith(71);
  });

  it('agrega el producto con su rubro, que es lo que decide a qué Quodom va', async () => {
    porCategoria.mockResolvedValue([COCA]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Coca Cola 2L');

    fireEvent.click(screen.getByRole('button', { name: /agregar coca cola 2l/i }));

    expect(agregar).toHaveBeenCalledWith(
      expect.objectContaining({ idproducto: 700, nombreProducto: 'Coca Cola 2L', cantidad: 1 }),
      7
    );
  });

  it('avisa cuando la subcategoría no tiene productos', async () => {
    porCategoria.mockResolvedValue([]);
    render(<ListaProductos idsubcategoria={70} />);

    expect(await screen.findByText(/no hay productos/i)).toBeInTheDocument();
  });

  it('ofrece reintentar cuando la carga falla', async () => {
    porCategoria.mockRejectedValue(new Error('network down'));
    render(<ListaProductos idsubcategoria={70} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument());

    porCategoria.mockResolvedValue([COCA]);
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(await screen.findByText('Coca Cola 2L')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ListaProductos`
Expected: FAIL — "Failed to resolve import ../ListaProductos".

- [ ] **Step 3: Create the component**

Crear `src/screens/Home/ListaProductos.tsx`. Es el cuerpo de `ProductosPorCategoria` sin `AppBarBack`, sin `useParams` y sin el `<section className="container prods">` (ahora vive dentro del home):

```tsx
import { useEffect, useState } from 'react';
import { productos } from '../../api/productos';
import type { Product } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { ProductImage } from '../../components/ProductImage';
import { useAgregarProducto } from '../../quodom/useAgregarProducto';
import { DialogoNuevoRubro } from '../../quodom/DialogoNuevoRubro';
import { nombreRubro } from '../../quodom/rubros';
import { DetalleProducto } from './DetalleProducto';
import './ListaProductos.css';

export function ListaProductos({ idsubcategoria }: { idsubcategoria: number }) {
  const [prods, setProds] = useState<Product[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [nonce, setNonce] = useState(0);
  const { agregar: agregarLinea, agregando, error: errAgregar, pendiente, confirmar, cancelar } = useAgregarProducto();

  useEffect(() => {
    let alive = true;
    setProds(null); setErr(null); setSelected(null);
    productos.porCategoria(idsubcategoria)
      .then(d => { if (alive) setProds(d); })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error.'); });
    // El guard descarta la respuesta de una subcategoría que el usuario ya
    // abandonó: sin esto una tab lenta pisa la lista de la tab siguiente.
    return () => { alive = false; };
  }, [idsubcategoria, nonce]);

  function agregar(p: Product) {
    // categoriaPadre es el rubro del producto, y el rubro es lo que decide en
    // qué Quodom entra la línea (spec 2026-08-18).
    agregarLinea(
      { idproducto: p.id, nombreProducto: p.nombreproducto, cantidad: 1, nombreAtributo1: p.atributo1 ?? undefined, nombreAtributo2: p.atributo2 ?? undefined },
      p.categoriaPadre
    );
  }

  return (
    <div className="prods">
      {err && <ErrorState message={err} onRetry={() => setNonce(n => n + 1)} />}
      {errAgregar && <p className="prods-add-error" role="alert">{errAgregar}</p>}
      {!err && !prods && <Loader />}
      {prods && prods.length === 0 && <p className="prods-empty">No hay productos en esta subcategoría.</p>}
      {prods && prods.length > 0 && (
        <ul className="prod-list">
          {prods.map(p => (
            <li key={p.id} className="prod-item">
              <button className="prod-info" onClick={() => setSelected(p)}>
                <ProductImage idproducto={p.id} alt={p.nombreproducto} size="md" />
                <span className="prod-name">{p.nombreproducto}</span>
              </button>
              <button className="prod-add" aria-label={'Agregar ' + p.nombreproducto} disabled={agregando} onClick={() => agregar(p)}>+</button>
            </li>
          ))}
        </ul>
      )}
      {selected && <DetalleProducto product={selected} onClose={() => setSelected(null)} onAdd={() => { agregar(selected); setSelected(null); }} />}
      {pendiente && (
        <DialogoNuevoRubro
          nombreRubro={nombreRubro(pendiente.idrubro)}
          onConfirmar={confirmar}
          onCancelar={cancelar}
          ocupado={agregando}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create the stylesheet**

Crear `src/screens/Home/ListaProductos.css` con el contenido de `ProductosPorCategoria.css`, cambiando sólo el contenedor: `.container.prods` era una pantalla con `margin-top: var(--sp-7)`; ahora es un bloque dentro del home.

```css
.prods {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-4);
  width: 100%;
}
.prod-list {
  display: grid;
  gap: var(--sp-4);
  grid-template-columns: repeat(2, 1fr);
  width: 100%;
  max-width: 640px;
}
.prod-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  padding: var(--sp-3);
  text-align: center;
  background: transparent;
  transition: transform .15s ease;
}
.prod-item:hover { transform: translateY(-2px); }
.prod-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  width: 100%;
  text-align: center;
  padding: 0;
}
.prod-name {
  display: block;
  font-family: var(--font-work);
  font-weight: 400;
  color: var(--color-texto);
  font-size: 14px;
  line-height: 1.2;
}
.prod-add {
  position: absolute;
  top: var(--sp-2);
  right: var(--sp-2);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-exito);
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0,0,0,.15);
}
.prod-add:hover { filter: brightness(1.08); }
.prods-empty { text-align: center; color: var(--color-texto-muted); padding: var(--sp-6) 0; }
.prods-add-error { color: var(--color-error); font-size: var(--fs-small); margin: 0 0 var(--sp-3) 0; }

@media (min-width: 601px) { .prod-list { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1025px) { .prod-list { grid-template-columns: repeat(4, 1fr); max-width: 720px; } }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- ListaProductos`
Expected: PASS, 5 tests.

Si el test de reintentar falla porque no encuentra el botón, revisar cómo etiqueta el botón `src/components/ErrorState.tsx` y ajustar el nombre en el test al texto real — el componente es el que manda.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Home/ListaProductos.tsx src/screens/Home/ListaProductos.css src/screens/Home/__tests__/ListaProductos.test.tsx
git commit -m "feat(app): extract the product list into a prop-driven component"
```

---

### Task 3: `RubroSelector`

**Files:**
- Create: `src/screens/Home/RubroSelector.tsx`
- Modify: `src/screens/Home/SitioInicial.css` (regla `.cat-card-sel`)
- Test: `src/screens/Home/__tests__/RubroSelector.test.tsx`

**Interfaces:**
- Consumes: `Category` de `src/api/types.ts` (`{ id, nombrecategoria, idcategoriapadre, imagen, refreshImage, orden }`); `RubroIcon` de `src/components/icons/RubroIcon.tsx` (`{ id: number; size?: number }`).
- Produces: `export function RubroSelector({ rubros, idSeleccionado }: { rubros: Category[]; idSeleccionado: number | null }): JSX.Element`

- [ ] **Step 1: Write the failing test**

Crear `src/screens/Home/__tests__/RubroSelector.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RubroSelector } from '../RubroSelector';
import type { Category } from '../../../api/types';

const RUBROS = [
  { id: 7, nombrecategoria: 'Bebidas', idcategoriapadre: 0, imagen: null, refreshImage: null, orden: 1 },
  { id: 1, nombrecategoria: 'Limpieza', idcategoriapadre: 0, imagen: null, refreshImage: null, orden: 2 }
] as Category[];

describe('RubroSelector', () => {
  it('sin selección cada rubro linkea a su propia query', () => {
    render(<MemoryRouter><RubroSelector rubros={RUBROS} idSeleccionado={null} /></MemoryRouter>);

    expect(screen.getByRole('link', { name: /bebidas/i })).toHaveAttribute('href', '/?rubro=7');
    expect(screen.getByRole('link', { name: /limpieza/i })).toHaveAttribute('href', '/?rubro=1');
  });

  it('marca el rubro elegido y lo convierte en el link para deseleccionar', () => {
    render(<MemoryRouter><RubroSelector rubros={RUBROS} idSeleccionado={7} /></MemoryRouter>);

    const elegido = screen.getByRole('link', { name: /bebidas/i });
    expect(elegido).toHaveAttribute('aria-current', 'page');
    // Volver a tocarlo vuelve al home completo.
    expect(elegido).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /limpieza/i })).not.toHaveAttribute('aria-current');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- RubroSelector`
Expected: FAIL — no existe `../RubroSelector`.

- [ ] **Step 3: Create the component**

Crear `src/screens/Home/RubroSelector.tsx`:

```tsx
import { Link } from 'react-router-dom';
import type { Category } from '../../api/types';
import { RubroIcon } from '../../components/icons/RubroIcon';

// Los rubros son links y no botones a propósito: cada selección queda en el
// historial, así que el Atrás del navegador funciona sin código, y andan el
// clic derecho y "abrir en pestaña nueva".
export function RubroSelector({ rubros, idSeleccionado }: { rubros: Category[]; idSeleccionado: number | null }) {
  return (
    <div className="cat-grid">
      {rubros.map(c => {
        const elegido = c.id === idSeleccionado;
        return (
          <Link
            key={c.id}
            to={elegido ? '/' : '/?rubro=' + c.id}
            className={'cat-card' + (elegido ? ' cat-card-sel' : '')}
            aria-current={elegido ? 'page' : undefined}
          >
            <RubroIcon id={c.id} size={72} />
            <span className="cat-card-name">{c.nombrecategoria}</span>
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Add the selected style**

En `src/screens/Home/SitioInicial.css`, agregar justo después de la regla `.cat-card:hover`:

```css
.cat-card-sel {
  outline: 2px solid var(--color-acento);
  outline-offset: -2px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.10);
}
.cat-card-sel .cat-card-name { color: var(--color-acento); }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- RubroSelector`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Home/RubroSelector.tsx src/screens/Home/__tests__/RubroSelector.test.tsx src/screens/Home/SitioInicial.css
git commit -m "feat(app): add the rubro selector with a selected state"
```

---

### Task 4: `SubcategoriaTabs`

**Files:**
- Create: `src/screens/Home/SubcategoriaTabs.tsx`
- Create: `src/screens/Home/SubcategoriaTabs.css`
- Test: `src/screens/Home/__tests__/SubcategoriaTabs.test.tsx`

**Interfaces:**
- Consumes: `Category` de `src/api/types.ts`.
- Produces: `export function SubcategoriaTabs({ idrubro, subs, idSeleccionada }: { idrubro: number; subs: Category[]; idSeleccionada: number | null }): JSX.Element`

- [ ] **Step 1: Write the failing test**

Crear `src/screens/Home/__tests__/SubcategoriaTabs.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SubcategoriaTabs } from '../SubcategoriaTabs';
import type { Category } from '../../../api/types';

const SUBS = [
  { id: 70, nombrecategoria: 'Gaseosas', idcategoriapadre: 7, imagen: null, refreshImage: null, orden: 1 },
  { id: 71, nombrecategoria: 'Aguas', idcategoriapadre: 7, imagen: null, refreshImage: null, orden: 2 }
] as Category[];

describe('SubcategoriaTabs', () => {
  it('cada tab conserva el rubro en la URL', () => {
    render(<MemoryRouter><SubcategoriaTabs idrubro={7} subs={SUBS} idSeleccionada={70} /></MemoryRouter>);

    expect(screen.getByRole('link', { name: 'Gaseosas' })).toHaveAttribute('href', '/?rubro=7&sub=70');
    expect(screen.getByRole('link', { name: 'Aguas' })).toHaveAttribute('href', '/?rubro=7&sub=71');
  });

  it('marca la subcategoría abierta', () => {
    render(<MemoryRouter><SubcategoriaTabs idrubro={7} subs={SUBS} idSeleccionada={70} /></MemoryRouter>);

    expect(screen.getByRole('link', { name: 'Gaseosas' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Aguas' })).not.toHaveAttribute('aria-current');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- SubcategoriaTabs`
Expected: FAIL — no existe `../SubcategoriaTabs`.

- [ ] **Step 3: Create the component**

Crear `src/screens/Home/SubcategoriaTabs.tsx`:

```tsx
import { Link } from 'react-router-dom';
import type { Category } from '../../api/types';
import './SubcategoriaTabs.css';

export function SubcategoriaTabs({ idrubro, subs, idSeleccionada }: { idrubro: number; subs: Category[]; idSeleccionada: number | null }) {
  return (
    <nav className="subtabs" aria-label="Subcategorías">
      {subs.map(s => {
        const elegida = s.id === idSeleccionada;
        return (
          <Link
            key={s.id}
            to={'/?rubro=' + idrubro + '&sub=' + s.id}
            className={'subtab' + (elegida ? ' subtab-sel' : '')}
            aria-current={elegida ? 'page' : undefined}
          >
            {s.nombrecategoria}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Create the stylesheet**

Crear `src/screens/Home/SubcategoriaTabs.css`. Scroll horizontal porque un rubro puede tener diez subcategorías y no entran en el ancho de un teléfono:

```css
.subtabs {
  display: flex;
  gap: var(--sp-2);
  width: 100%;
  max-width: 640px;
  overflow-x: auto;
  padding-bottom: var(--sp-2);
  /* Sin esto la barra de scroll tapa las tabs en Windows. */
  scrollbar-width: thin;
}
.subtab {
  flex: 0 0 auto;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--color-tarjeta);
  color: var(--color-texto);
  font-family: var(--font-work);
  font-size: var(--fs-small);
  text-decoration: none;
  white-space: nowrap;
  box-shadow: var(--shadow-card);
}
.subtab-sel {
  background: var(--color-acento);
  color: #fff;
}

@media (min-width: 1025px) {
  .subtabs { max-width: 720px; flex-wrap: wrap; overflow-x: visible; }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- SubcategoriaTabs`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Home/SubcategoriaTabs.tsx src/screens/Home/SubcategoriaTabs.css src/screens/Home/__tests__/SubcategoriaTabs.test.tsx
git commit -m "feat(app): add the subcategory tab strip"
```

---

### Task 5: El home orquestador

El corazón del cambio: `SitioInicial` lee la URL, normaliza los params, decide header completo o compacto y compone las tres piezas. Acá se borran las dos pantallas viejas.

**Files:**
- Modify: `src/screens/Home/SitioInicial.tsx` (reescritura completa)
- Modify: `src/screens/Home/SitioInicial.css` (header compacto)
- Modify: `src/router/routes.tsx` (se van las dos rutas)
- Delete: `src/screens/Home/SubcategoriaLista.tsx`, `src/screens/Home/SubcategoriaLista.css`
- Delete: `src/screens/Home/ProductosPorCategoria.tsx`, `src/screens/Home/ProductosPorCategoria.css`
- Test: `src/screens/Home/__tests__/SitioInicial.test.tsx`

**Interfaces:**
- Consumes: `RubroSelector({ rubros, idSeleccionado })` (Task 3), `SubcategoriaTabs({ idrubro, subs, idSeleccionada })` (Task 4), `ListaProductos({ idsubcategoria })` (Task 2), `categorias.raiz()` y `categorias.subs(idPadre)` de `src/api/categorias.ts`.
- Produces: la home en `/` con el contrato de URL `?rubro=&sub=`.

- [ ] **Step 1: Write the failing test**

Crear `src/screens/Home/__tests__/SitioInicial.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SitioInicial } from '../SitioInicial';
import { categorias } from '../../../api/categorias';
import { productos } from '../../../api/productos';

vi.mock('../../../api/categorias', () => ({ categorias: { raiz: vi.fn(), subs: vi.fn() } }));
vi.mock('../../../api/productos', () => ({ productos: { porCategoria: vi.fn() } }));
vi.mock('../../../quodom/useAgregarProducto', () => ({
  useAgregarProducto: () => ({
    agregar: vi.fn(), agregando: false, error: null, pendiente: null,
    confirmar: vi.fn(), cancelar: vi.fn()
  })
}));

const raiz = categorias.raiz as unknown as ReturnType<typeof vi.fn>;
const subs = categorias.subs as unknown as ReturnType<typeof vi.fn>;
const porCategoria = productos.porCategoria as unknown as ReturnType<typeof vi.fn>;

const RUBROS = [
  { id: 7, nombrecategoria: 'Bebidas', idcategoriapadre: 0, imagen: null, refreshImage: null, orden: 1 },
  { id: 1, nombrecategoria: 'Limpieza', idcategoriapadre: 0, imagen: null, refreshImage: null, orden: 2 }
];
const SUBS_BEBIDAS = [
  { id: 70, nombrecategoria: 'Gaseosas', idcategoriapadre: 7, imagen: null, refreshImage: null, orden: 1 },
  { id: 71, nombrecategoria: 'Aguas', idcategoriapadre: 7, imagen: null, refreshImage: null, orden: 2 }
];
const COCA = {
  id: 700, nombreproducto: 'Coca Cola 2L', descripcion: null, categoria: 70,
  categoriaPadre: 7, imagen: null, refreshImagen: null, atributo1: null, atributo2: null
};

function montar(url: string) {
  return render(<MemoryRouter initialEntries={[url]}><SitioInicial /></MemoryRouter>);
}

beforeEach(() => {
  raiz.mockReset(); subs.mockReset(); porCategoria.mockReset();
  raiz.mockResolvedValue(RUBROS);
  subs.mockResolvedValue(SUBS_BEBIDAS);
  porCategoria.mockResolvedValue([COCA]);
});

describe('SitioInicial', () => {
  it('sin params muestra sólo los rubros', async () => {
    montar('/');

    expect(await screen.findByRole('link', { name: /bebidas/i })).toBeInTheDocument();
    expect(screen.getByText('QUODOM')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /subcategorías/i })).toBeNull();
    // La búsqueda se dio de baja: no queda ningún input en el home.
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(subs).not.toHaveBeenCalled();
    expect(porCategoria).not.toHaveBeenCalled();
  });

  it('tocar una tab cambia la lista de productos', async () => {
    montar('/?rubro=7&sub=70');
    await screen.findByText('Coca Cola 2L');

    porCategoria.mockResolvedValue([
      { ...COCA, id: 701, nombreproducto: 'Agua mineral 500ml', categoria: 71 }
    ]);
    fireEvent.click(screen.getByRole('link', { name: 'Aguas' }));

    expect(await screen.findByText('Agua mineral 500ml')).toBeInTheDocument();
    expect(porCategoria).toHaveBeenLastCalledWith(71);
    expect(screen.getByRole('link', { name: 'Aguas' })).toHaveAttribute('aria-current', 'page');
  });

  it('con un rubro abre su primera subcategoría y lista sus productos', async () => {
    montar('/?rubro=7');

    expect(await screen.findByText('Coca Cola 2L')).toBeInTheDocument();
    expect(subs).toHaveBeenCalledWith(7);
    // Se normaliza a la primera sub: nunca queda un hueco vacío bajo las tabs.
    expect(porCategoria).toHaveBeenCalledWith(70);
    expect(screen.getByRole('link', { name: 'Gaseosas' })).toHaveAttribute('aria-current', 'page');
  });

  it('entrar directo a rubro y sub pinta todo sin pasar por el home vacío', async () => {
    montar('/?rubro=7&sub=71');

    await waitFor(() => expect(porCategoria).toHaveBeenCalledWith(71));
    expect(screen.getByRole('link', { name: 'Aguas' })).toHaveAttribute('aria-current', 'page');
  });

  it('con un rubro elegido esconde el wordmark', async () => {
    montar('/?rubro=7');

    await screen.findByText('Coca Cola 2L');
    expect(screen.queryByText('QUODOM')).toBeNull();
  });

  it('un rubro inexistente vuelve al home sin mostrar error', async () => {
    montar('/?rubro=999');

    expect(await screen.findByText('QUODOM')).toBeInTheDocument();
    expect(subs).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('una sub que no es del rubro cae en la primera del rubro', async () => {
    montar('/?rubro=7&sub=999');

    await waitFor(() => expect(porCategoria).toHaveBeenCalledWith(70));
    expect(porCategoria).not.toHaveBeenCalledWith(999);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- SitioInicial`
Expected: FAIL — el home actual no lee la query y no llama a `categorias.subs`.

- [ ] **Step 3: Rewrite the home**

Reescribir `src/screens/Home/SitioInicial.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { categorias } from '../../api/categorias';
import type { Category } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { RubroSelector } from './RubroSelector';
import { SubcategoriaTabs } from './SubcategoriaTabs';
import { ListaProductos } from './ListaProductos';
import './SitioInicial.css';

// Devuelve el número del param o null: "", "abc" y "0" son todos "sin valor".
function numParam(valor: string | null): number | null {
  const n = Number(valor);
  return valor && Number.isInteger(n) && n > 0 ? n : null;
}

export function SitioInicial() {
  const [params, setParams] = useSearchParams();
  const rubroParam = numParam(params.get('rubro'));
  const subParam = numParam(params.get('sub'));

  const [rubros, setRubros] = useState<Category[] | null>(null);
  const [subs, setSubs] = useState<Category[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [errSubs, setErrSubs] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [nonceSubs, setNonceSubs] = useState(0);

  useEffect(() => {
    let alive = true;
    setRubros(null); setErr(null);
    categorias.raiz()
      .then(d => { if (alive) setRubros(d); })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error al cargar categorías.'); });
    return () => { alive = false; };
  }, [nonce]);

  // Un rubro que no está habilitado (link viejo, URL a mano, rubro apagado en
  // api/src/config/rubros.js) degrada al home, no muestra un error.
  const rubroValido = rubros !== null && rubroParam !== null && rubros.some(r => r.id === rubroParam);
  useEffect(() => {
    if (rubros !== null && rubroParam !== null && !rubroValido) setParams({}, { replace: true });
  }, [rubros, rubroParam, rubroValido, setParams]);

  const idrubro = rubroValido ? rubroParam : null;

  useEffect(() => {
    if (idrubro === null) { setSubs(null); setErrSubs(null); return; }
    let alive = true;
    setSubs(null); setErrSubs(null);
    categorias.subs(idrubro)
      .then(d => { if (alive) setSubs(d); })
      .catch(e => { if (alive) setErrSubs(e instanceof ApiError ? e.message : 'Error al cargar subcategorías.'); });
    return () => { alive = false; };
  }, [idrubro, nonceSubs]);

  // Normalización: llegar con ?rubro= sin sub, o con una sub de otro rubro,
  // abre la primera. `replace` para no dejar una entrada intermedia que haga
  // que el Atrás parezca no hacer nada.
  const subValida = subs !== null && subParam !== null && subs.some(s => s.id === subParam);
  useEffect(() => {
    if (idrubro === null || subs === null || subs.length === 0 || subValida) return;
    setParams({ rubro: String(idrubro), sub: String(subs[0].id) }, { replace: true });
  }, [idrubro, subs, subValida, setParams]);

  const idsub = subValida ? subParam : null;

  if (err) return <div className="container"><ErrorState message={err} onRetry={() => setNonce(n => n + 1)} /></div>;

  return (
    <section className={'container home-inicial' + (idrubro !== null ? ' home-compacto' : '')}>
      {idrubro === null && (
        <>
          <h1 className="home-wordmark">QUODOM</h1>
          <Link to="/modo-ia" className="btn home-modo-ia">
            Modo IA — armá tu Quodom conversando
          </Link>
        </>
      )}

      {!rubros ? <Loader /> : <RubroSelector rubros={rubros} idSeleccionado={idrubro} />}

      {idrubro !== null && errSubs && (
        <ErrorState message={errSubs} onRetry={() => setNonceSubs(n => n + 1)} />
      )}
      {idrubro !== null && !errSubs && !subs && <Loader />}
      {idrubro !== null && subs && subs.length > 0 && (
        <SubcategoriaTabs idrubro={idrubro} subs={subs} idSeleccionada={idsub} />
      )}
      {idrubro !== null && subs && subs.length === 0 && (
        <p className="prods-empty">Este rubro todavía no tiene subcategorías.</p>
      )}

      {idsub !== null && <ListaProductos idsubcategoria={idsub} />}
    </section>
  );
}
```

- [ ] **Step 4: Add the compact-header style**

En `src/screens/Home/SitioInicial.css`, agregar al final:

```css
/* Con un rubro elegido el bloque de arriba se achica para que el primer
   producto quede cerca del borde superior en un teléfono. */
.container.home-inicial.home-compacto {
  gap: var(--sp-3);
  margin-top: var(--sp-3);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- SitioInicial`
Expected: PASS, 7 tests.

- [ ] **Step 6: Delete the two old screens and their routes**

```bash
git rm src/screens/Home/SubcategoriaLista.tsx src/screens/Home/SubcategoriaLista.css
git rm src/screens/Home/ProductosPorCategoria.tsx src/screens/Home/ProductosPorCategoria.css
```

En `src/router/routes.tsx` borrar estos dos imports:

```tsx
import { SubcategoriaLista } from '../screens/Home/SubcategoriaLista';
import { ProductosPorCategoria } from '../screens/Home/ProductosPorCategoria';
```

y estas dos rutas:

```tsx
      { path: '/categoria/:id', element: <SubcategoriaLista /> },
      { path: '/subcategoria/:id', element: <ProductosPorCategoria /> },
```

- [ ] **Step 7: Verify the whole suite and the types**

Run: `npm test && npx tsc -b --noEmit && npx vite build`
Expected: todo verde. El build tiene que pasar: es lo que detecta un import que quedó apuntando a una pantalla borrada.

- [ ] **Step 8: Commit**

```bash
git add -A src/
git commit -m "feat(app): browse the catalog from the home screen"
```

---

### Task 6: Redirects de las rutas viejas

La app está deployada: `/categoria/7` y `/subcategoria/70` no pueden quedar en blanco.

**Files:**
- Create: `src/screens/Home/RedirectCategoria.tsx`
- Modify: `src/api/categorias.ts`
- Modify: `src/router/routes.tsx`
- Test: `src/screens/Home/__tests__/RedirectCategoria.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` de `src/api/client.ts`; `Category` de `src/api/types.ts`.
- Produces: `categorias.porId(id: number): Promise<Category>`; `export function RedirectRubro(): JSX.Element` y `export function RedirectSubcategoria(): JSX.Element`.

- [ ] **Step 1: Write the failing test**

Crear `src/screens/Home/__tests__/RedirectCategoria.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { RedirectRubro, RedirectSubcategoria } from '../RedirectCategoria';
import { categorias } from '../../../api/categorias';

vi.mock('../../../api/categorias', () => ({ categorias: { porId: vi.fn() } }));

const porId = categorias.porId as unknown as ReturnType<typeof vi.fn>;

function Espia() {
  const l = useLocation();
  return <div data-testid="url">{l.pathname + l.search}</div>;
}

function montar(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/" element={<Espia />} />
        <Route path="/categoria/:id" element={<RedirectRubro />} />
        <Route path="/subcategoria/:id" element={<RedirectSubcategoria />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => { porId.mockReset(); });

describe('redirects de las rutas viejas', () => {
  it('/categoria/:id lleva al home con ese rubro', async () => {
    montar('/categoria/7');
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/?rubro=7'));
  });

  it('/subcategoria/:id resuelve su rubro padre y lleva a los dos params', async () => {
    porId.mockResolvedValue({ id: 70, nombrecategoria: 'Gaseosas', idcategoriapadre: 7, imagen: null, refreshImage: null, orden: 1 });

    montar('/subcategoria/70');

    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/?rubro=7&sub=70'));
    expect(porId).toHaveBeenCalledWith(70);
  });

  it('si no se puede resolver el padre, cae al home', async () => {
    porId.mockRejectedValue(new Error('404'));

    montar('/subcategoria/70');

    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- RedirectCategoria`
Expected: FAIL — no existe `../RedirectCategoria`.

- [ ] **Step 3: Add the API client method**

En `src/api/categorias.ts`, agregar `porId` (el endpoint devuelve la categoría completa, con `idcategoriapadre`, a diferencia de `/categorias`, que lo excluye):

```ts
export const categorias = {
  raiz: () => apiFetch<Category[]>('/categorias'),
  subs: (idPadre: number) => apiFetch<Category[]>('/categorias/Sub/' + idPadre),
  porId: (id: number) => apiFetch<Category>('/categorias/' + id)
};
```

- [ ] **Step 4: Create the redirect components**

Crear `src/screens/Home/RedirectCategoria.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { categorias } from '../../api/categorias';

// El catálogo vivía en /categoria/:id y /subcategoria/:id. La app está
// deployada, así que esas URLs siguen existiendo como redirect al home.
export function RedirectRubro() {
  const { id = '' } = useParams();
  return <Navigate to={'/?rubro=' + encodeURIComponent(id)} replace />;
}

export function RedirectSubcategoria() {
  const { id = '' } = useParams();
  // La URL vieja no dice a qué rubro pertenece la subcategoría: hay que
  // preguntarlo. Si no se puede, el home vacío es mejor que una pantalla rota.
  const [destino, setDestino] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    categorias.porId(Number(id))
      .then(c => { if (alive) setDestino('/?rubro=' + c.idcategoriapadre + '&sub=' + c.id); })
      .catch(() => { if (alive) setDestino('/'); });
    return () => { alive = false; };
  }, [id]);

  if (!destino) return null;
  return <Navigate to={destino} replace />;
}
```

- [ ] **Step 5: Wire the routes**

En `src/router/routes.tsx`, agregar el import:

```tsx
import { RedirectRubro, RedirectSubcategoria } from '../screens/Home/RedirectCategoria';
```

y las dos rutas, justo después de `{ path: '/', element: <SitioInicial /> },`:

```tsx
      { path: '/categoria/:id', element: <RedirectRubro /> },
      { path: '/subcategoria/:id', element: <RedirectSubcategoria /> },
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- RedirectCategoria`
Expected: PASS, 3 tests.

- [ ] **Step 7: Verify everything**

Run: `npm test && npx tsc -b --noEmit && npx vite build`
Expected: suite completa en verde, typecheck limpio, build OK.

- [ ] **Step 8: Commit**

```bash
git add -A src/
git commit -m "feat(app): redirect the retired catalog routes to the home"
```

---

### Task 7: Verificación manual en el navegador

Los tests cubren la lógica; el layout no. Este paso es a ojo y no lleva código.

**Files:** ninguno.

- [ ] **Step 1: Restart the dev server**

Reiniciar `npm run dev` en `quodom-web/app` **sí o sí**, no confiar en el que ya está corriendo: cuando un archivo se reescribe entero con vite levantado, vite puede cachear un módulo vacío y servirlo con `200 OK` y 0 bytes, lo que deja la pantalla en blanco sin ningún error en los tests. Si aparece la pantalla en blanco, comparar bytes servidos contra el disco:

```bash
curl -s http://localhost:5173/src/screens/Home/SitioInicial.tsx | wc -c
wc -c < src/screens/Home/SitioInicial.tsx
```

- [ ] **Step 2: Walk the flow**

Con el API corriendo (`npm run dev` en `quodom-web/api`, puerto 3999), verificar en el navegador:

1. `/` muestra wordmark, botón de Modo IA y los 5 rubros en una fila (3 y 2 en móvil).
2. Tocar **Bebidas**: el wordmark desaparece, Bebidas queda marcado, aparecen las tabs y los productos de la primera subcategoría. La URL dice `/?rubro=7&sub=<id>`.
3. Cambiar de tab: cambia la lista y la URL.
4. **Atrás** del navegador: vuelve a la tab anterior; con más Atrás, al home completo.
5. Tocar el rubro marcado: vuelve al home completo.
6. F5 en `/?rubro=7&sub=70`: queda en el mismo lugar.
7. `+` en un producto: se agrega al Quodom (o pide confirmación de rubro si no hay uno abierto) y el sidebar se actualiza.
8. Ancho de teléfono (DevTools, 360px): las tabs scrollean en horizontal y los productos entran en dos columnas.
9. `/categoria/7` y `/subcategoria/70` redirigen al home con los params correctos.
10. El Drawer muestra **Modo IA** y ya no **Buscar**.

- [ ] **Step 3: Report**

Reportar qué se vio, con lo que no funcione descrito con su ancho de pantalla y su URL. No hay commit en esta tarea.
