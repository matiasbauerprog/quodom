# La IA vive en el home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el chat y la carga de lista dejen de ser pantallas aparte y se usen desde el home, en el lugar donde hoy va el catálogo.

**Architecture:** Las dos pantallas se quedan con su cuerpo y pierden su barra de navegación: `ModoIA.tsx` pasa a ser `PanelConversacion.tsx` y `ListaIA.tsx` pasa a ser `PanelLista.tsx`. El home gana un estado `modoIa` y un par de pestañas que eligen qué mostrar debajo del buscador: el catálogo (como hoy) o uno de los dos paneles. Las rutas `/modo-ia` y `/lista` y sus entradas del drawer desaparecen en la misma tarea que convierte cada pantalla, así el árbol nunca queda importando un archivo que ya no existe.

**Tech Stack:** React 18 + Vite + TypeScript, CSS plano, react-router-dom 6. Tests con Vitest + testing-library (happy-dom). No se toca el backend.

**Spec:** `docs/superpowers/specs/2026-08-20-ia-en-el-home-design.md`

## Global Constraints

- **UI en español, código e identificadores en inglés.** Los textos que ve el usuario van verbatim como los escribe este plan: los tests matchean sobre ellos.
- **HTML semántico estricto**: `button` real para las pestañas, `nav` para el grupo, `role="alert"` para los avisos, `label` ligado a su input.
- **Mobile-first.** Paleta: fondo `#F1F1F1`, acento `#E63946`, éxito `#2DAB66`, texto `#1A1A1A`, tarjetas `#FFFFFF`. Forma de hoja: `border-top-left-radius: 8px; border-bottom-right-radius: 8px`. Breakpoints: tablet `@media (min-width: 601px) and (max-width: 1024px)`, desktop `@media (min-width: 1025px)`. Usar las variables CSS que ya existen (`var(--color-acento)`, `var(--sp-3)`, `var(--font-prompt)`, etc.) en vez de repetir los literales.
- **El alto del chat nunca es fijo en píxeles**: se mide en `dvh` con `vh` como fallback declarado antes, y el campo de escribir queda fuera del área que scrollea.
- **Un Quodom pertenece a un solo rubro** y agregar productos nunca crea uno como efecto secundario: si no hay uno abierto de ese rubro, se pide confirmación primero. Esa lógica ya existe y no se toca.
- **Confirmar no navega.** Ni el chat ni la lista sacan al usuario del home: marcan "Agregado ✓" con un link al Quodom.
- **El invitado puede abrir los paneles y leerlos.** El login se pide al mandar el primer mensaje o al elegir un archivo, y en ese caso **no se llama al API**.
- Convención de estilos del repo: un `.tsx` con su `.css` al lado, importado desde el componente.
- Preferir ediciones in-place a truncar y reescribir: reescribir un archivo que Vite está sirviendo puede hacer que cachee un módulo vacío (CLAUDE.md §7).
- No commitear `quodom-web/api/quodom.sqlite`. Este plan no toca el backend.

## Nota sobre el orden

Entre la Task 2 y la Task 5, el chat y la carga de lista quedan **sin punto de entrada en la UI**: ya no tienen ruta y todavía no tienen pestaña. Es deliberado y dura tres tareas. Lo que sí se sostiene en cada commit: el árbol compila, la suite entera pasa y no queda ningún import colgado. La alternativa —dejar las pantallas viejas como envoltorios temporales— significaría escribir código para borrarlo tres tareas después.

## File Structure

**Crear:**
- `app/src/components/AvisoLogin.tsx` + `.css` — el aviso de "necesitás iniciar sesión", compartido por los dos paneles.
- `app/src/components/__tests__/AvisoLogin.test.tsx`
- `app/src/screens/Home/PestanasIA.tsx` — las dos pestañas. No sabe nada del contenido de los paneles.
- `app/src/screens/Home/__tests__/PestanasIA.test.tsx`

**Renombrar y modificar:**
- `app/src/screens/ModoIA/ModoIA.tsx` → `PanelConversacion.tsx` (sin `AppBarBack`, sin `navigate`, con gate de login)
- `app/src/screens/ModoIA/__tests__/ModoIA.test.tsx` → `PanelConversacion.test.tsx`
- `app/src/screens/ListaIA/ListaIA.tsx` → `PanelLista.tsx` (sin `AppBarBack`, con gate de login)
- `app/src/screens/ListaIA/__tests__/ListaIA.test.tsx` → `PanelLista.test.tsx`

**Modificar:**
- `app/src/screens/Home/SitioInicial.tsx` — estado `modoIa`, render condicional
- `app/src/screens/Home/SitioInicial.css` — estilos de las pestañas; se va `.home-modo-ia`
- `app/src/screens/Home/__tests__/SitioInicial.test.tsx`
- `app/src/screens/ModoIA/ModoIA.css` — alto acotado de la lista de mensajes
- `app/src/router/routes.tsx` — se van las dos rutas y sus imports
- `app/src/components/layout/Drawer.tsx` + su test — se van las dos entradas

**Sin tocar:** todo el backend, `api/lista.ts`, `CargarLista.tsx`, `GrupoRubro.tsx`, `NoEncontrados.tsx`, `PropuestaEditable.tsx`, `MensajeChat.tsx`, `ListaIA.css`, `DialogoNuevoRubro.tsx`.

---

### Task 1: El aviso de login compartido

**Files:**
- Create: `quodom-web/app/src/components/AvisoLogin.tsx`
- Create: `quodom-web/app/src/components/AvisoLogin.css`
- Test: `quodom-web/app/src/components/__tests__/AvisoLogin.test.tsx`

**Interfaces:**
- Consumes: `Link` de `react-router-dom`.
- Produces: `<AvisoLogin />` — sin props. Las tasks 2 y 3 lo renderizan tal cual.

- [ ] **Step 1: Write the failing test**

Crear `quodom-web/app/src/components/__tests__/AvisoLogin.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AvisoLogin } from '../AvisoLogin';

describe('AvisoLogin', () => {
  it('se anuncia como alerta y linkea al login', () => {
    render(<MemoryRouter><AvisoLogin /></MemoryRouter>);

    expect(screen.getByRole('alert')).toHaveTextContent(/necesitás iniciar sesión/i);
    expect(screen.getByRole('link', { name: /iniciar sesión/i })).toHaveAttribute('href', '/login');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/app && npx vitest run src/components/__tests__/AvisoLogin.test.tsx`
Expected: FAIL — no se puede resolver `../AvisoLogin`

- [ ] **Step 3: Write the component**

Crear `quodom-web/app/src/components/AvisoLogin.tsx`:

```tsx
import { Link } from 'react-router-dom';
import './AvisoLogin.css';

export function AvisoLogin() {
  return (
    <p className="aviso-login" role="alert">
      Para usar el asistente necesitás <Link to="/login">iniciar sesión</Link>.
    </p>
  );
}
```

Crear `quodom-web/app/src/components/AvisoLogin.css`:

```css
.aviso-login {
  background: var(--color-tarjeta);
  color: var(--color-texto);
  font-family: var(--font-jaldi);
  padding: 12px 16px;
  margin: 0;
  border-left: 3px solid var(--color-acento);
  border-top-left-radius: 8px;
  border-bottom-right-radius: 8px;
}

.aviso-login a {
  color: var(--color-acento);
  font-weight: 600;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quodom-web/app && npx vitest run src/components/__tests__/AvisoLogin.test.tsx`
Expected: PASS, 1 test

- [ ] **Step 5: Commit**

```bash
git add quodom-web/app/src/components/AvisoLogin.tsx quodom-web/app/src/components/AvisoLogin.css quodom-web/app/src/components/__tests__/AvisoLogin.test.tsx
git commit -m "feat(app): add the shared sign-in notice"
```

---

### Task 2: El chat deja de ser una pantalla

Convierte `ModoIA` en `PanelConversacion` y, en el mismo commit, saca la ruta y la entrada del drawer que apuntaban a la pantalla que deja de existir.

**Files:**
- Rename + modify: `quodom-web/app/src/screens/ModoIA/ModoIA.tsx` → `quodom-web/app/src/screens/ModoIA/PanelConversacion.tsx`
- Rename + modify: `quodom-web/app/src/screens/ModoIA/__tests__/ModoIA.test.tsx` → `quodom-web/app/src/screens/ModoIA/__tests__/PanelConversacion.test.tsx`
- Modify: `quodom-web/app/src/screens/ModoIA/ModoIA.css`
- Modify: `quodom-web/app/src/router/routes.tsx`
- Modify: `quodom-web/app/src/components/layout/Drawer.tsx`
- Modify: `quodom-web/app/src/components/layout/__tests__/Drawer.test.tsx`

**Interfaces:**
- Consumes: `<AvisoLogin />` (Task 1); `useAuth()` de `../../auth/AuthContext`, que expone `{ user, loading, signin, signup, signout, refresh }`.
- Produces: `<PanelConversacion />` — sin props. La Task 5 lo monta en el home.

- [ ] **Step 1: Rename the two files with git**

```bash
cd "F:/backup/Command Soluciones/Quodom/Quodom"
git mv quodom-web/app/src/screens/ModoIA/ModoIA.tsx quodom-web/app/src/screens/ModoIA/PanelConversacion.tsx
git mv quodom-web/app/src/screens/ModoIA/__tests__/ModoIA.test.tsx quodom-web/app/src/screens/ModoIA/__tests__/PanelConversacion.test.tsx
```

- [ ] **Step 2: Update the test to the new behavior**

En `quodom-web/app/src/screens/ModoIA/__tests__/PanelConversacion.test.tsx`:

Cambiar los imports y el mock de auth (agregar debajo de los `vi.mock` existentes):

```tsx
import { PanelConversacion } from '../PanelConversacion';
import { useAuth } from '../../../auth/AuthContext';

vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
```

Cambiar el helper de render y hacer que por defecto haya un usuario logueado:

```tsx
function renderWith() {
  vi.mocked(useAuth).mockReturnValue(
    { user: { id: 'u1', nombre: 'Ana' }, signout: vi.fn() } as unknown as ReturnType<typeof useAuth>
  );
  return render(<MemoryRouter><PanelConversacion /></MemoryRouter>);
}
```

Reemplazar las dos aserciones de navegación. La que hoy dice
`await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/quodom?id=Q-EXIST'));` pasa a:

```tsx
    await waitFor(() => expect(screen.getByText(/agregado/i)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /ver quodom/i })).toHaveAttribute('href', '/quodom?id=Q-EXIST');
    expect(mockNavigate).not.toHaveBeenCalled();
```

y la que dice `...toHaveBeenCalledWith('/quodom?id=Q-NEW')` pasa a:

```tsx
    await waitFor(() => expect(screen.getByText(/agregado/i)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /ver quodom/i })).toHaveAttribute('href', '/quodom?id=Q-NEW');
    expect(mockNavigate).not.toHaveBeenCalled();
```

Agregar al final del archivo un `describe` nuevo para el invitado:

```tsx
describe('PanelConversacion (invitado)', () => {
  it('pide login al enviar y no llama al API', async () => {
    vi.mocked(useAuth).mockReturnValue(
      { user: null, signout: vi.fn() } as unknown as ReturnType<typeof useAuth>
    );
    render(<MemoryRouter><PanelConversacion /></MemoryRouter>);

    fireEvent.change(screen.getByPlaceholderText(/escrib/i), { target: { value: 'quiero pintar' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/iniciar sesión/i));
    expect(iaApi.chat).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd quodom-web/app && npx vitest run src/screens/ModoIA/__tests__/PanelConversacion.test.tsx`
Expected: FAIL — el componente todavía se llama `ModoIA`, navega al confirmar y no tiene gate de login

- [ ] **Step 4: Convert the component**

En `quodom-web/app/src/screens/ModoIA/PanelConversacion.tsx`, editando in-place:

1. Quitar el import de `AppBarBack` y el de `useNavigate`; agregar los nuevos:

```tsx
import { useAuth } from '../../auth/AuthContext';
import { AvisoLogin } from '../../components/AvisoLogin';
```

`Link` de `react-router-dom` reemplaza a `useNavigate` en el import existente.

2. Renombrar la función `ModoIA` a `PanelConversacion`, borrar `const navigate = useNavigate();` y agregar:

```tsx
  const { user } = useAuth();
  const [agregadoEn, setAgregadoEn] = useState<string | null>(null);
  const [necesitaLogin, setNecesitaLogin] = useState(false);
```

3. Al principio de `send()`, antes de cualquier otra cosa:

```tsx
    if (!user) { setNecesitaLogin(true); return; }
```

4. En `confirmProposal`, reemplazar `navigate('/quodom?id=' + encodeURIComponent(activo.id));` por:

```tsx
      setAgregadoEn(activo.id);
```

5. En `crearYConfirmar`, reemplazar `navigate('/quodom?id=' + encodeURIComponent(created.idquodom));` por:

```tsx
      setAgregadoEn(created.idquodom);
```

6. En el `return`, borrar el `<AppBarBack ... />` y el fragmento `<>...</>` que lo envolvía, y poner el encabezado adentro de la sección. La sección deja de ser `container` (el home ya se lo da):

```tsx
    <section className="mia">
      <header className="mia-header">
        <h2 className="mia-titulo">Conversando</h2>
        <button type="button" className="mia-reset" aria-label="Nueva conversación" onClick={resetChat}>↺</button>
      </header>

      {agregadoEn && (
        <p className="mia-agregado">
          Agregado ✓ <Link to={'/quodom?id=' + encodeURIComponent(agregadoEn)}>ver Quodom</Link>
        </p>
      )}
      {necesitaLogin && <AvisoLogin />}
```

El resto del cuerpo (mensajes, barra de input, `DialogoNuevoRubro`) queda igual, y la sección cierra donde cerraba.

- [ ] **Step 5: Bound the message list height**

En `quodom-web/app/src/screens/ModoIA/ModoIA.css`, en la regla `.mia-messages`, agregar el alto acotado y el scroll. `vh` va primero como fallback: los navegadores que no entienden `dvh` ignoran la segunda línea y se quedan con la primera.

```css
  max-height: 55vh;
  max-height: 55dvh;
  overflow-y: auto;
```

Y agregar al final del archivo:

```css
.mia-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--sp-2);
}

.mia-titulo {
  font-family: var(--font-prompt);
  font-size: 1.05rem;
  margin: 0;
  color: var(--color-texto);
}

.mia-agregado {
  color: var(--color-exito);
  font-family: var(--font-jaldi);
  margin: 0 0 var(--sp-2) 0;
}

@media (min-width: 1025px) {
  .mia-messages { max-height: 60dvh; }
}
```

- [ ] **Step 6: Remove the route and the drawer entry**

En `quodom-web/app/src/router/routes.tsx`: borrar la línea `import { ModoIA } from '../screens/ModoIA/ModoIA';` y la línea de la ruta `{ path: '/modo-ia', element: <ProtectedRoute><ModoIA /></ProtectedRoute> },`.

En `quodom-web/app/src/components/layout/Drawer.tsx`: borrar la línea `<NavLink to="/modo-ia" onClick={onClose}>Modo IA</NavLink>`.

En `quodom-web/app/src/components/layout/__tests__/Drawer.test.tsx`, el test `linkea a Buscar y a Modo IA` pasa a llamarse `linkea a Buscar` y pierde la aserción de Modo IA junto con su comentario:

```tsx
  it('linkea a Buscar', () => {
    montar();

    expect(screen.getByRole('link', { name: /buscar/i })).toHaveAttribute('href', '/busqueda');
  });
```

- [ ] **Step 7: Run the whole app suite**

Run: `cd quodom-web/app && npm test`
Expected: PASS — incluida `PanelConversacion.test.tsx`. Si algún archivo todavía importa `ModoIA`, el fallo lo va a decir explícitamente.

- [ ] **Step 8: Commit**

```bash
git add quodom-web/app/src
git commit -m "refactor(app): turn the IA chat screen into an embeddable panel"
```

---

### Task 3: La carga de lista deja de ser una pantalla

Mismo movimiento que la Task 2, del lado de la lista.

**Files:**
- Rename + modify: `quodom-web/app/src/screens/ListaIA/ListaIA.tsx` → `quodom-web/app/src/screens/ListaIA/PanelLista.tsx`
- Rename + modify: `quodom-web/app/src/screens/ListaIA/__tests__/ListaIA.test.tsx` → `quodom-web/app/src/screens/ListaIA/__tests__/PanelLista.test.tsx`
- Modify: `quodom-web/app/src/router/routes.tsx`
- Modify: `quodom-web/app/src/components/layout/Drawer.tsx`
- Modify: `quodom-web/app/src/components/layout/__tests__/Drawer.test.tsx`

**Interfaces:**
- Consumes: `<AvisoLogin />` (Task 1); `useAuth()`; `CargarLista`, `GrupoRubro`, `NoEncontrados` y `listaApi`, todos sin cambios.
- Produces: `<PanelLista />` — sin props. La Task 5 lo monta en el home.

- [ ] **Step 1: Rename the two files with git**

```bash
cd "F:/backup/Command Soluciones/Quodom/Quodom"
git mv quodom-web/app/src/screens/ListaIA/ListaIA.tsx quodom-web/app/src/screens/ListaIA/PanelLista.tsx
git mv quodom-web/app/src/screens/ListaIA/__tests__/ListaIA.test.tsx quodom-web/app/src/screens/ListaIA/__tests__/PanelLista.test.tsx
```

- [ ] **Step 2: Update the test**

En `quodom-web/app/src/screens/ListaIA/__tests__/PanelLista.test.tsx`:

Cambiar el import del componente y agregar el mock de auth junto a los otros `vi.mock`:

```tsx
import { PanelLista } from '../PanelLista';
import { useAuth } from '../../../auth/AuthContext';

vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
```

En `beforeEach`, dejar un usuario logueado por defecto:

```tsx
beforeEach(() => {
  mockProcesar.mockReset();
  vi.mocked(useAuth).mockReturnValue(
    { user: { id: 'u1', nombre: 'Ana' }, signout: vi.fn() } as unknown as ReturnType<typeof useAuth>
  );
});
```

Reemplazar cada `<ListaIA />` por `<PanelLista />` en el archivo (aparece en el helper `renderYEnviar` y en el último test).

Agregar al final un `describe` para el invitado:

```tsx
describe('PanelLista (invitado)', () => {
  it('pide login al enviar la lista y no llama al API', async () => {
    vi.mocked(useAuth).mockReturnValue(
      { user: null, signout: vi.fn() } as unknown as ReturnType<typeof useAuth>
    );
    render(<MemoryRouter><PanelLista /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText(/pegá tu lista/i), { target: { value: '3 lavandinas' } });
    fireEvent.click(screen.getByRole('button', { name: /buscar en el catálogo/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/iniciar sesión/i));
    expect(mockProcesar).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd quodom-web/app && npx vitest run src/screens/ListaIA/__tests__/PanelLista.test.tsx`
Expected: FAIL — el componente todavía se llama `ListaIA` y no tiene gate de login

- [ ] **Step 4: Convert the component**

En `quodom-web/app/src/screens/ListaIA/PanelLista.tsx`, editando in-place:

1. Quitar el import de `AppBarBack`; agregar:

```tsx
import { useAuth } from '../../auth/AuthContext';
import { AvisoLogin } from '../../components/AvisoLogin';
```

2. Renombrar la función `ListaIA` a `PanelLista` y agregar junto a los otros estados:

```tsx
  const { user } = useAuth();
  const [necesitaLogin, setNecesitaLogin] = useState(false);
```

3. Al principio de `procesar()`, antes de `setBusy(true)`:

```tsx
    if (!user) { setNecesitaLogin(true); return; }
```

4. En el `return`, borrar el `<AppBarBack title="Subí tu lista" />` y el fragmento `<>...</>`, y dejar la sección con su encabezado. Pierde `container`, que el home ya aporta:

```tsx
    <section className="lia">
      <h2 className="lia-titulo">Subí tu lista</h2>
      <CargarLista onEnviar={procesar} ocupado={busy} />

      {necesitaLogin && <AvisoLogin />}
```

El resto del cuerpo queda igual.

5. En `quodom-web/app/src/screens/ListaIA/ListaIA.css`, agregar al final:

```css
.lia-titulo {
  font-family: var(--font-prompt);
  font-size: 1.05rem;
  margin: 0 0 var(--sp-2) 0;
  color: var(--color-texto);
}
```

- [ ] **Step 5: Remove the route and the drawer entry**

En `quodom-web/app/src/router/routes.tsx`: borrar `import { ListaIA } from '../screens/ListaIA/ListaIA';` y la ruta `{ path: '/lista', element: <ProtectedRoute><ListaIA /></ProtectedRoute> },`.

En `quodom-web/app/src/components/layout/Drawer.tsx`: borrar `<NavLink to="/lista" onClick={onClose}>Subí tu lista</NavLink>`.

En `quodom-web/app/src/components/layout/__tests__/Drawer.test.tsx`: borrar entero el test `linkea a Subí tu lista`.

- [ ] **Step 6: Run the whole app suite**

Run: `cd quodom-web/app && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add quodom-web/app/src
git commit -m "refactor(app): turn the list upload screen into an embeddable panel"
```

---

### Task 4: Las pestañas

**Files:**
- Create: `quodom-web/app/src/screens/Home/PestanasIA.tsx`
- Modify: `quodom-web/app/src/screens/Home/SitioInicial.css`
- Test: `quodom-web/app/src/screens/Home/__tests__/PestanasIA.test.tsx`

**Interfaces:**
- Produces:
  - `export type ModoIa = 'chat' | 'lista'`
  - `<PestanasIA activo={ModoIa | null} onElegir={(m: ModoIa | null) => void} />`

`onElegir` recibe `null` cuando el usuario toca la pestaña que ya estaba activa. El componente no guarda estado: sólo traduce clicks. La Task 5 es la que decide qué hacer con eso.

- [ ] **Step 1: Write the failing test**

Crear `quodom-web/app/src/screens/Home/__tests__/PestanasIA.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PestanasIA } from '../PestanasIA';

describe('PestanasIA', () => {
  it('muestra las dos pestañas, ninguna activa', () => {
    render(<PestanasIA activo={null} onElegir={vi.fn()} />);

    expect(screen.getByRole('button', { name: /conversando/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /subí tu lista/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('marca la pestaña activa', () => {
    render(<PestanasIA activo="chat" onElegir={vi.fn()} />);

    expect(screen.getByRole('button', { name: /conversando/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /subí tu lista/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('elegir una pestaña inactiva la pide', () => {
    const onElegir = vi.fn();
    render(<PestanasIA activo={null} onElegir={onElegir} />);

    fireEvent.click(screen.getByRole('button', { name: /subí tu lista/i }));

    expect(onElegir).toHaveBeenCalledWith('lista');
  });

  it('tocar la pestaña activa la cierra', () => {
    const onElegir = vi.fn();
    render(<PestanasIA activo="chat" onElegir={onElegir} />);

    fireEvent.click(screen.getByRole('button', { name: /conversando/i }));

    expect(onElegir).toHaveBeenCalledWith(null);
  });

  it('tocar la otra pestaña cambia de modo sin cerrar', () => {
    const onElegir = vi.fn();
    render(<PestanasIA activo="chat" onElegir={onElegir} />);

    fireEvent.click(screen.getByRole('button', { name: /subí tu lista/i }));

    expect(onElegir).toHaveBeenCalledWith('lista');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/app && npx vitest run src/screens/Home/__tests__/PestanasIA.test.tsx`
Expected: FAIL — no se puede resolver `../PestanasIA`

- [ ] **Step 3: Write the component**

Crear `quodom-web/app/src/screens/Home/PestanasIA.tsx`:

```tsx
export type ModoIa = 'chat' | 'lista';

// Sólo traduce clicks: tocar la pestaña activa pide null (cerrar) y tocar la
// otra pide el modo nuevo. Quién guarda el estado es el home.
export function PestanasIA({
  activo,
  onElegir
}: {
  activo: ModoIa | null;
  onElegir: (modo: ModoIa | null) => void;
}) {
  function clase(modo: ModoIa) {
    return 'home-ia-tab' + (activo === modo ? ' home-ia-tab-activa' : '');
  }

  return (
    <nav className="home-ia-tabs" aria-label="Asistente">
      <button
        type="button"
        className={clase('chat')}
        aria-pressed={activo === 'chat'}
        onClick={() => onElegir(activo === 'chat' ? null : 'chat')}
      >
        Conversando
      </button>
      <button
        type="button"
        className={clase('lista')}
        aria-pressed={activo === 'lista'}
        onClick={() => onElegir(activo === 'lista' ? null : 'lista')}
      >
        Subí tu lista
      </button>
    </nav>
  );
}
```

- [ ] **Step 4: Style the tabs**

En `quodom-web/app/src/screens/Home/SitioInicial.css`, **borrar** las reglas `.home-modo-ia` y `.home-modo-ia:hover` (el botón que reemplazan) y agregar en su lugar:

```css
.home-ia-tabs {
  display: flex;
  gap: 8px;
  width: 100%;
  max-width: 480px;
  margin: 0 auto var(--sp-3) auto;
}

.home-ia-tab {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid var(--color-acento);
  background: var(--color-tarjeta);
  color: var(--color-acento);
  font-family: var(--font-prompt);
  font-weight: 600;
  cursor: pointer;
  border-top-left-radius: 8px;
  border-bottom-right-radius: 8px;
}

.home-ia-tab:hover { filter: brightness(0.98); }

.home-ia-tab-activa {
  background: var(--color-acento);
  color: #fff;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd quodom-web/app && npx vitest run src/screens/Home/__tests__/PestanasIA.test.tsx`
Expected: PASS, 5 tests

- [ ] **Step 6: Commit**

```bash
git add quodom-web/app/src/screens/Home
git commit -m "feat(app): add the assistant mode tabs"
```

---

### Task 5: El home monta los paneles

**Files:**
- Modify: `quodom-web/app/src/screens/Home/SitioInicial.tsx`
- Test: `quodom-web/app/src/screens/Home/__tests__/SitioInicial.test.tsx`

**Interfaces:**
- Consumes: `<PestanasIA activo onElegir />` y el tipo `ModoIa` (Task 4); `<PanelConversacion />` (Task 2); `<PanelLista />` (Task 3).

- [ ] **Step 1: Write the failing tests**

En `quodom-web/app/src/screens/Home/__tests__/SitioInicial.test.tsx`, agregar los mocks de los dos paneles junto a los `vi.mock` que ya están arriba (se reemplazan por marcadores: acá se prueba el home, no lo que dibuja cada panel):

```tsx
vi.mock('../../ModoIA/PanelConversacion', () => ({ PanelConversacion: () => <p>panel chat</p> }));
vi.mock('../../ListaIA/PanelLista', () => ({ PanelLista: () => <p>panel lista</p> }));
```

Y agregar al final del archivo:

```tsx
describe('SitioInicial (pestañas de IA)', () => {
  it('muestra las dos pestañas en el home raíz', async () => {
    montar('/');
    await screen.findByRole('link', { name: /bebidas/i });

    expect(screen.getByRole('button', { name: /conversando/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subí tu lista/i })).toBeInTheDocument();
  });

  it('no muestra las pestañas con un rubro elegido', async () => {
    montar('/?rubro=7&sub=70');
    await screen.findByText('Coca Cola 2L');

    expect(screen.queryByRole('button', { name: /conversando/i })).toBeNull();
  });

  it('abrir una pestaña reemplaza el catálogo por su panel', async () => {
    montar('/');
    await screen.findByRole('link', { name: /bebidas/i });

    fireEvent.click(screen.getByRole('button', { name: /conversando/i }));

    expect(await screen.findByText('panel chat')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /bebidas/i })).toBeNull();
  });

  it('tocar la pestaña activa devuelve el catálogo', async () => {
    montar('/');
    await screen.findByRole('link', { name: /bebidas/i });

    fireEvent.click(screen.getByRole('button', { name: /conversando/i }));
    await screen.findByText('panel chat');
    fireEvent.click(screen.getByRole('button', { name: /conversando/i }));

    expect(await screen.findByRole('link', { name: /bebidas/i })).toBeInTheDocument();
    expect(screen.queryByText('panel chat')).toBeNull();
  });

  it('cambia de un panel al otro sin pasar por el catálogo', async () => {
    montar('/');
    await screen.findByRole('link', { name: /bebidas/i });

    fireEvent.click(screen.getByRole('button', { name: /conversando/i }));
    await screen.findByText('panel chat');
    fireEvent.click(screen.getByRole('button', { name: /subí tu lista/i }));

    expect(await screen.findByText('panel lista')).toBeInTheDocument();
    expect(screen.queryByText('panel chat')).toBeNull();
    expect(screen.queryByRole('link', { name: /bebidas/i })).toBeNull();
  });

  it('el wordmark se esconde con un panel abierto', async () => {
    montar('/');
    await screen.findByRole('link', { name: /bebidas/i });
    expect(screen.getByText('QUODOM')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /subí tu lista/i }));

    await screen.findByText('panel lista');
    expect(screen.queryByText('QUODOM')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd quodom-web/app && npx vitest run src/screens/Home/__tests__/SitioInicial.test.tsx`
Expected: FAIL — no existen las pestañas en el home

- [ ] **Step 3: Wire the home**

En `quodom-web/app/src/screens/Home/SitioInicial.tsx`, editando in-place:

1. Agregar los imports junto a los que ya están:

```tsx
import { PestanasIA, type ModoIa } from './PestanasIA';
import { PanelConversacion } from '../ModoIA/PanelConversacion';
import { PanelLista } from '../ListaIA/PanelLista';
```

2. Agregar el estado junto a los otros `useState`:

```tsx
  const [modoIa, setModoIa] = useState<ModoIa | null>(null);
```

3. No hace falta ningún handler: `setModoIa` se le pasa directo a `PestanasIA`. Las pestañas sólo se dibujan cuando no hay rubro elegido, así que en el momento de abrir un panel no hay `?rubro=` ni `?sub=` que limpiar — escribir esa limpieza sería código inalcanzable desde la UI.

4. Reemplazar el bloque del botón viejo:

```tsx
      {idrubro === null && (
        <Link to="/modo-ia" className="btn home-modo-ia">
          Modo IA — armá tu Quodom conversando
        </Link>
      )}
```

por:

```tsx
      {idrubro === null && <PestanasIA activo={modoIa} onElegir={setModoIa} />}
```

5. Envolver todo el bloque del catálogo —desde `{!rubros ? <Loader /> : ...}` hasta `{idsub !== null && <ListaProductos ... />}`— en un condicional, y agregar los paneles. El bloque queda así:

```tsx
      {modoIa === 'chat' && <PanelConversacion />}
      {modoIa === 'lista' && <PanelLista />}

      {modoIa === null && (
        <>
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
        </>
      )}
```

6. El wordmark también se esconde con un panel abierto, para darle aire:

```tsx
      {idrubro === null && modoIa === null && <h1 className="home-wordmark">QUODOM</h1>}
```

7. Si `Link` quedó sin uso en el archivo tras sacar el botón viejo, borrarlo del import de `react-router-dom`. El compilador de TypeScript lo va a marcar en `npm run build`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd quodom-web/app && npx vitest run src/screens/Home/__tests__/SitioInicial.test.tsx`
Expected: PASS — los 6 tests nuevos y los que ya estaban

- [ ] **Step 5: Run everything**

Run: `cd quodom-web/app && npm test && npm run build`
Run: `cd quodom-web/api && npm test`
Expected: PASS en las tres. El build es el que confirma que no quedó ningún import muerto.

- [ ] **Step 6: Commit**

```bash
git add quodom-web/app/src/screens/Home
git commit -m "feat(app): show the IA panels inside the home instead of the catalog"
```

---

## Verificación final

- [ ] `cd quodom-web/app && npm test` — verde
- [ ] `cd quodom-web/app && npm run build` — sin errores de tipos ni imports muertos
- [ ] `cd quodom-web/api && npm test` — verde (no se tocó, es el control de que sigue así)
- [ ] `grep -rn "ModoIA\|ListaIA" quodom-web/app/src --include=*.tsx --include=*.ts | grep -v "PanelConversacion\|PanelLista\|ModoIA.css\|ListaIA.css\|screens/ModoIA/\|screens/ListaIA/"` — no debería quedar ninguna referencia a las pantallas viejas
- [ ] Con el dev server corriendo, comparar bytes servidos contra disco para los archivos nuevos y renombrados (CLAUDE.md §7):
  `curl -s http://localhost:5173/src/screens/Home/PestanasIA.tsx | wc -c`
- [ ] `git status` — `api/quodom.sqlite` sin modificar
