# Quodom Web — Plan 2: Frontend (`quodom-web/app`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Quodom webapp frontend as a 1:1 visual port of the original React Native APP, consuming the API already merged in Plan 1.

**Architecture:** React 18 + Vite + TypeScript + plain CSS (no UI framework). Mobile-first with tablet (601–1024px) and desktop (≥1025px) breakpoints. Guest mode with the Quodom in `localStorage`; migrates to the backend on login/signup. Auth via JWT stored in `localStorage`. React Router v6 mirroring the original `Navigation.js`. Vitest for non-trivial logic only (guest storage + migration + api client); UI verification is manual in the browser per spec §6.

**Tech stack:** Vite 5, React 18, TypeScript 5, React Router 6, Vitest 1, plain CSS with CSS custom properties, Google Fonts (Prompt, Jaldi, Work Sans, Montserrat). Backend already at `http://localhost:3999` (Plan 1, on `master`).

**Out of scope:** Modo IA (Plan 3). Vendor screens: `SignUpScreenVendor`, `ElegirCuenta`, `screens/ofertas/*`, `Settings/WizardVendedor*`, `Settings/ZonasScreen`, `Settings/CategoriasScreen`, `Profile/BancosScreen`, `Profile/SelectBancos`. Payment gateway (Mobbex).

**Base URL for API:** `http://localhost:3999` in dev via `VITE_API_URL` in `.env`. `.env.example` committed.

**Working branch:** `feature/quodom-web-app` (branch from `master`).

---

## File structure

```
quodom-web/app/
├── CLAUDE.md                        # subproject rules incl. responsive breakpoints
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── public/                          # static assets (favicon)
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── vite-env.d.ts
│   ├── api/
│   │   ├── client.ts                # fetch wrapper (base URL, JWT, error normalization)
│   │   ├── types.ts                 # Category, Product, Quodom, QuodomLine, User, ...
│   │   ├── users.ts
│   │   ├── categorias.ts
│   │   ├── productos.ts
│   │   ├── busqueda.ts
│   │   ├── hist_busquedas.ts
│   │   ├── quodom.ts
│   │   ├── quodom_lines.ts
│   │   ├── user_direcciones.ts
│   │   ├── provincias.ts
│   │   ├── localidades.ts
│   │   └── oper_notificaciones.ts
│   ├── auth/
│   │   ├── AuthContext.tsx          # token+user in localStorage, signin/signup/signout
│   │   └── ProtectedRoute.tsx       # redirect to /login if no token
│   ├── guest/
│   │   ├── guestQuodom.ts           # localStorage helpers (get/add/remove/clear)
│   │   └── migrateGuestQuodom.ts    # POST to backend on login success
│   ├── styles/
│   │   ├── tokens.css               # CSS variables (palette, fonts, spacing, radius)
│   │   ├── reset.css
│   │   ├── typography.css           # Google Fonts + base rules
│   │   ├── global.css               # imports the above + body defaults
│   │   └── utilities.css            # .hoja (leaf corners), .container, .btn, .card
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppBar.tsx  + .css
│   │   │   ├── AppBarBack.tsx  + .css
│   │   │   ├── Drawer.tsx  + .css
│   │   │   ├── BarraQuodomInferior.tsx  + .css
│   │   │   └── Layout.tsx  + .css
│   │   ├── Loader.tsx  + .css
│   │   ├── ErrorState.tsx  + .css
│   │   ├── EmptyState.tsx  + .css
│   │   └── Notificaciones/
│   │       ├── CampanitaNotificaciones.tsx  + .css
│   │       └── PanelNotificaciones.tsx  + .css
│   ├── screens/
│   │   ├── Splash.tsx  + .css
│   │   ├── Auth/
│   │   │   ├── SignIn.tsx  + .css
│   │   │   ├── SignUp.tsx  + .css
│   │   │   ├── CuentaCreada.tsx  + .css
│   │   │   ├── ForgotPassword.tsx  + .css
│   │   │   ├── ResetPassword.tsx  + .css
│   │   │   └── ValidarEmail.tsx  + .css
│   │   ├── Home/
│   │   │   ├── SitioInicial.tsx  + .css
│   │   │   ├── SubcategoriaLista.tsx  + .css
│   │   │   ├── ProductosPorCategoria.tsx  + .css
│   │   │   ├── DetalleProducto.tsx  + .css
│   │   │   └── BusquedaScreen.tsx  + .css
│   │   ├── Quodom/
│   │   │   ├── DetalleQuodom.tsx  + .css
│   │   │   └── SelectorAtributo.tsx  + .css
│   │   ├── MisQuodoms/
│   │   │   └── ListaMisQuodoms.tsx  + .css
│   │   ├── Profile/
│   │   │   ├── ProfileScreen.tsx  + .css
│   │   │   ├── DetalleUsuario.tsx  + .css
│   │   │   └── CambiarPass.tsx  + .css
│   │   ├── Direcciones/
│   │   │   ├── ListaDirecciones.tsx  + .css
│   │   │   ├── AgregarDireccion.tsx  + .css
│   │   │   └── ModificarDireccion.tsx  + .css
│   │   └── Notificaciones/
│   │       └── ListaNotificaciones.tsx  + .css
│   ├── router/
│   │   └── routes.tsx
│   └── utils/
│       ├── validation.ts
│       └── whatsapp.ts
└── tests/
    ├── setup.ts
    ├── api-client.test.ts
    ├── guestQuodom.test.ts
    └── migrateGuestQuodom.test.ts
```

---

## Task 1: Scaffold Vite + React + TS + tests + branch

**Files:**
- Create: `quodom-web/app/package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `.env.example`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`, `tests/setup.ts`
- Test: `tests/setup.ts` (Vitest env config)

- [ ] **Step 1: Create branch and folder**

```bash
cd "F:\backup\Command Soluciones\Quodom\Quodom"
git checkout -b feature/quodom-web-app
mkdir quodom-web\app
mkdir quodom-web\app\src
mkdir quodom-web\app\src\api
mkdir quodom-web\app\src\auth
mkdir quodom-web\app\src\guest
mkdir quodom-web\app\src\styles
mkdir quodom-web\app\src\components
mkdir quodom-web\app\src\screens
mkdir quodom-web\app\src\router
mkdir quodom-web\app\src\utils
mkdir quodom-web\app\tests
mkdir quodom-web\app\public
```

- [ ] **Step 2: Write `quodom-web/app/package.json`**

```json
{
  "name": "quodom-web-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "happy-dom": "^15.7.4",
    "typescript": "^5.5.3",
    "vite": "^5.4.1",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Write `quodom-web/app/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Write `quodom-web/app/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true }
});
```

- [ ] **Step 5: Write `quodom-web/app/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts']
  }
});
```

- [ ] **Step 6: Write `quodom-web/app/tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 7: Write `quodom-web/app/index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Quodom</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Write `quodom-web/app/src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 9: Write `quodom-web/app/src/App.tsx`**

```tsx
export function App() {
  return <main>Quodom</main>;
}
```

- [ ] **Step 10: Write `quodom-web/app/src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 11: Write `quodom-web/app/.env.example`**

```
VITE_API_URL=http://localhost:3999
```

- [ ] **Step 12: Write `quodom-web/app/.gitignore`**

```
node_modules
dist
.env
```

- [ ] **Step 13: Install dependencies**

```bash
cd quodom-web/app && npm install
```
Expected: install completes with 0 vulnerabilities (or only informational messages).

- [ ] **Step 14: Verify `npm run dev` boots and serves the page**

```bash
cd quodom-web/app && npm run dev
```
Open `http://localhost:5173` in a browser — the word `Quodom` renders. Stop the dev server (Ctrl+C).

- [ ] **Step 15: Verify `npm test` runs (0 tests, no failures)**

```bash
cd quodom-web/app && npm test
```
Expected: `No test files found` — this is OK (Vitest exits 0 with no tests).

- [ ] **Step 16: Verify `npm run typecheck` passes**

```bash
cd quodom-web/app && npm run typecheck
```
Expected: no output, exit 0.

- [ ] **Step 17: Copy `.env.example` to `.env`**

```powershell
Copy-Item quodom-web\app\.env.example quodom-web\app\.env
```

- [ ] **Step 18: Commit**

```bash
git add quodom-web/app/package.json quodom-web/app/package-lock.json quodom-web/app/tsconfig.json quodom-web/app/vite.config.ts quodom-web/app/vitest.config.ts quodom-web/app/index.html quodom-web/app/.env.example quodom-web/app/.gitignore quodom-web/app/src quodom-web/app/tests
git commit -m "chore: scaffold quodom-web/app with vite, react, ts and vitest"
```

---

## Task 2: Design tokens, reset, typography, utilities

**Files:**
- Create: `quodom-web/app/src/styles/tokens.css`, `reset.css`, `typography.css`, `utilities.css`, `global.css`
- Modify: `quodom-web/app/src/main.tsx`, `src/App.tsx`

- [ ] **Step 1: Write `src/styles/tokens.css`**

```css
:root {
  --color-fondo: #F6EE5D;
  --color-acento: #706F9A;
  --color-exito: #2DAB66;
  --color-error: #D9534F;
  --color-texto: #45444C;
  --color-texto-muted: #898989;
  --color-tarjeta: #FFFFFF;
  --color-navbar: #F9F9F9;

  --font-prompt: 'Prompt', system-ui, sans-serif;
  --font-jaldi: 'Jaldi', Georgia, serif;
  --font-work: 'Work Sans', system-ui, sans-serif;
  --font-mont: 'Montserrat', system-ui, sans-serif;

  --fs-h1: 44px;
  --fs-h2: 32px;
  --fs-h3: 24px;
  --fs-body: 16px;
  --fs-small: 14px;
  --fs-tiny: 12px;

  --sp-1: 4px;
  --sp-2: 8px;
  --sp-3: 12px;
  --sp-4: 16px;
  --sp-5: 24px;
  --sp-6: 32px;
  --sp-7: 48px;

  --radius-hoja-tl: 8px;
  --radius-hoja-br: 8px;
  --radius-input: 6px;
  --shadow-card: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08);
}
```

- [ ] **Step 2: Write `src/styles/reset.css`**

```css
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { min-height: 100vh; }
img, svg { max-width: 100%; display: block; }
button { font: inherit; cursor: pointer; border: none; background: none; padding: 0; color: inherit; }
input, select, textarea { font: inherit; color: inherit; }
a { color: inherit; text-decoration: none; }
ul, ol { list-style: none; margin: 0; padding: 0; }
```

- [ ] **Step 3: Write `src/styles/typography.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&family=Jaldi:wght@400;700&family=Work+Sans:wght@300;400;500;600;700&family=Montserrat:wght@300;400;500;600;700&display=swap');

body {
  font-family: var(--font-work);
  font-size: var(--fs-body);
  color: var(--color-texto);
  line-height: 1.4;
}

h1, h2, h3, h4 { font-family: var(--font-prompt); font-weight: 500; margin: 0 0 var(--sp-3) 0; }
h1 { font-size: var(--fs-h1); }
h2 { font-size: var(--fs-h2); }
h3 { font-size: var(--fs-h3); }
p { margin: 0 0 var(--sp-3) 0; }
```

- [ ] **Step 4: Write `src/styles/utilities.css`**

```css
.container {
  width: 100%;
  max-width: 100%;
  padding: 0 var(--sp-4);
  margin: 0 auto;
}
@media (min-width: 601px) and (max-width: 1024px) {
  .container { max-width: 720px; padding: 0 var(--sp-5); }
}
@media (min-width: 1025px) {
  .container { max-width: 1120px; padding: 0 var(--sp-6); }
}

.hoja {
  border-top-left-radius: var(--radius-hoja-tl);
  border-bottom-right-radius: var(--radius-hoja-br);
}

.card {
  background: var(--color-tarjeta);
  padding: var(--sp-4);
  border-top-left-radius: var(--radius-hoja-tl);
  border-bottom-right-radius: var(--radius-hoja-br);
  box-shadow: var(--shadow-card);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 var(--sp-4);
  background: var(--color-acento);
  color: #fff;
  font-family: var(--font-prompt);
  font-weight: 500;
  border-top-left-radius: var(--radius-hoja-tl);
  border-bottom-right-radius: var(--radius-hoja-br);
  transition: filter .15s ease;
}
.btn:hover:not(:disabled) { filter: brightness(1.08); }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn.btn-exito { background: var(--color-exito); }
.btn.btn-ghost { background: transparent; color: var(--color-acento); border: 1px solid var(--color-acento); }
.btn.btn-block { width: 100%; }

.input {
  display: block;
  width: 100%;
  min-height: 44px;
  padding: 0 var(--sp-3);
  background: #fff;
  border: 1px solid transparent;
  border-radius: var(--radius-input);
}
.input:focus { outline: 2px solid var(--color-acento); }

label.field { display: block; margin-bottom: var(--sp-3); font-size: var(--fs-small); color: var(--color-texto); }
label.field span { display: block; margin-bottom: var(--sp-1); }
```

- [ ] **Step 5: Write `src/styles/global.css`**

```css
@import './tokens.css';
@import './reset.css';
@import './typography.css';
@import './utilities.css';

body { background: var(--color-fondo); }
main { min-height: 100vh; }
```

- [ ] **Step 6: Import `global.css` in `src/main.tsx`**

Replace the file contents with:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 7: Update `src/App.tsx` with a placeholder that shows the tokens**

```tsx
export function App() {
  return (
    <main>
      <div className="container">
        <h1>Quodom</h1>
        <p>Diseño base con tokens.</p>
        <button className="btn">Botón demo</button>
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Verify in the browser**

```bash
cd quodom-web/app && npm run dev
```

Open `http://localhost:5173`. Confirm:
- Background is yellow `#F6EE5D`.
- Title "Quodom" renders in Prompt.
- Button "Botón demo" is purple `#706F9A`, white text, with corners top-left and bottom-right rounded (leaf shape).
- Resize the window: at ≥1025px the content is centered with max 1120px; at 601–1024px it caps around 720px; below 601px it uses the full width with 16px side padding.

Stop the server.

- [ ] **Step 9: Commit**

```bash
git add quodom-web/app/src/main.tsx quodom-web/app/src/App.tsx quodom-web/app/src/styles
git commit -m "feat: add design tokens, typography, utilities and mobile-first breakpoints"
```

---

## Task 3: API client with JWT + tests

**Files:**
- Create: `quodom-web/app/src/api/client.ts`, `src/api/types.ts`
- Test: `quodom-web/app/tests/api-client.test.ts`

- [ ] **Step 1: Write failing test `tests/api-client.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError, setToken, getToken, clearToken } from '../src/api/client';

const originalFetch = globalThis.fetch;

describe('api client', () => {
  beforeEach(() => {
    localStorage.clear();
    globalThis.fetch = vi.fn();
  });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('sends JSON body and returns parsed json on success', async () => {
    (globalThis.fetch as any).mockResolvedValue(new Response(
      JSON.stringify({ id: 1, name: 'foo' }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    ));
    const data = await apiFetch<{ id: number; name: string }>('/foo', { method: 'POST', body: { x: 1 } });
    expect(data).toEqual({ id: 1, name: 'foo' });
    const req = (globalThis.fetch as any).mock.calls[0];
    expect(req[0]).toBe('http://localhost:3999/foo');
    expect(req[1].headers['Content-Type']).toBe('application/json');
    expect(req[1].body).toBe(JSON.stringify({ x: 1 }));
  });

  it('attaches Bearer token from storage', async () => {
    setToken('abc.def');
    (globalThis.fetch as any).mockResolvedValue(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    await apiFetch('/x');
    const req = (globalThis.fetch as any).mock.calls[0];
    expect(req[1].headers.Authorization).toBe('Bearer abc.def');
  });

  it('throws ApiError with backend message on 400', async () => {
    (globalThis.fetch as any).mockResolvedValue(new Response(
      JSON.stringify({ res: false, message: 'Usuario incorrecto.' }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    ));
    await expect(apiFetch('/signin', { method: 'POST', body: { u: 1 } }))
      .rejects.toMatchObject({ name: 'ApiError', status: 400, message: 'Usuario incorrecto.' });
  });

  it('clears token on 401 and throws ApiError', async () => {
    setToken('bad');
    (globalThis.fetch as any).mockResolvedValue(new Response(
      JSON.stringify({ message: 'jwt expired' }),
      { status: 401, headers: { 'content-type': 'application/json' } }
    ));
    await expect(apiFetch('/x')).rejects.toBeInstanceOf(ApiError);
    expect(getToken()).toBeNull();
  });

  it('throws a network ApiError when fetch rejects', async () => {
    (globalThis.fetch as any).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(apiFetch('/x')).rejects.toMatchObject({ status: 0, message: expect.stringContaining('conexión') });
  });

  it('clearToken removes it', () => {
    setToken('t'); expect(getToken()).toBe('t'); clearToken(); expect(getToken()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
cd quodom-web/app && npm test
```
Expected: FAIL — module `../src/api/client` does not exist.

- [ ] **Step 3: Write `src/api/types.ts`**

```ts
export type User = {
  id: string;
  username: string;
  email: string;
  nombre: string;
  apellido?: string;
  dni?: string;
  codArea?: string;
  telefono?: string;
  refreshFoto?: string | null;
  role?: string;
  token?: string;
};

export type Category = {
  id: number;
  nombrecategoria: string;
  idcategoriapadre: number;
  imagen: string | null;
  refreshImage: string | null;
  orden: number;
};

export type Product = {
  id: number;
  nombreproducto: string;
  descripcion?: string | null;
  categoria: number;
  categoriaPadre: number;
  imagen: string | null;
  refreshImagen: string | null;
  atributo1: string | null;
  atributo2: string | null;
};

export type ProductWithExiste = {
  id: number;
  nombreproducto: string;
  imagen: string | null;
  refreshImagen: string | null;
  existe: number;
};

export type Atributo = { valoratributo: string; orden: number; esvendedor: string };

export type Quodom = {
  id: string;
  descripcion: string;
  estado: 'CREADO' | 'ENVIADO';
  nro: string;
  createdBy: string;
  iddireccion: number | null;
  cantproductos?: number;
  porccompletado?: number;
  fechaenvio?: string | null;
  createdAt?: string;
};

export type QuodomLine = {
  id: number;
  idquodom: string;
  idproducto: number;
  cantidad: number;
  nombreProducto: string;
  detalleProducto?: string | null;
  nombreCategoria?: string | null;
  categoria?: number;
  categoriaPadre?: number;
  atributo1?: string | null;
  atributo2?: string | null;
  nombreAtributo1?: string | null;
  nombreAtributo2?: string | null;
  imagen?: string | null;
  refreshImagen?: string | null;
  atributosFaltantes?: number;
};

export type Direccion = {
  id: number;
  userid: string;
  provincia: string | null;
  localidad: string | null;
  direccion: string | null;
  calle: string | null;
  numero: string | null;
  piso: string | null;
  cp: string | null;
  alias: string | null;
  default: boolean | number;
  idprovincia: string | null;
  observaciones: string | null;
};

export type Provincia = { id: number; provincia: string };
export type Localidad = { id: number; localidad: string; idprovincia: number };

export type Notificacion = {
  id: number;
  titulo: string;
  texto: string;
  tiponotificacion: string;
  idquodom: string;
  createdAt: string;
  leida: number | boolean;
};

export type BusquedaResult = { id: number; nombre: string; descripcion?: string | null; imagen: string | null; refreshImagen: string | null };
```

- [ ] **Step 4: Write `src/api/client.ts`**

```ts
const TOKEN_KEY = 'quodom.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
};

export async function apiFetch<T = unknown>(path: string, options: Options = {}): Promise<T> {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:3999';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {})
  };
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;

  let res: Response;
  try {
    res = await fetch(base + path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch {
    throw new ApiError('No hay conexión con el servidor.', 0);
  }

  const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
  const payload: any = isJson ? await res.json().catch(() => ({})) : null;

  if (!res.ok) {
    if (res.status === 401) clearToken();
    const msg = (payload && payload.message) || 'Error del servidor.';
    throw new ApiError(msg, res.status);
  }
  return payload as T;
}
```

- [ ] **Step 5: Run tests, confirm pass**

```bash
cd quodom-web/app && npm test
```
Expected: 6 passed.

- [ ] **Step 6: Typecheck**

```bash
cd quodom-web/app && npm run typecheck
```
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add quodom-web/app/src/api quodom-web/app/tests/api-client.test.ts
git commit -m "feat: add typed api client with jwt storage and error normalization"
```

---

## Task 4: API modules per resource

**Files:**
- Create: `src/api/users.ts`, `categorias.ts`, `productos.ts`, `busqueda.ts`, `hist_busquedas.ts`, `quodom.ts`, `quodom_lines.ts`, `user_direcciones.ts`, `provincias.ts`, `localidades.ts`, `oper_notificaciones.ts`

Each module is a thin wrapper over `apiFetch`. No tests — the client is tested; wrappers are trivial and covered by manual verification per spec §6.

- [ ] **Step 1: Write `src/api/users.ts`**

```ts
import { apiFetch } from './client';
import type { User, Direccion } from './types';

export const users = {
  signin: (body: { username: string; password: string }) =>
    apiFetch<User>('/users/signin', { method: 'POST', body }),
  signup: (body: { username: string; email: string; nombre: string; apellido?: string; password: string; codArea: string; telefono: string; dni?: string }) =>
    apiFetch<{ res: boolean; id?: string; message: string }>('/users/signup', { method: 'POST', body }),
  reset: (body: { email: string }) =>
    apiFetch<{ res: boolean; message: string }>('/users/reset', { method: 'POST', body }),
  reenviar: (body: { email: string }) =>
    apiFetch<{ res: boolean; message: string }>('/users/reenviar', { method: 'POST', body }),
  changePass: (body: { password: string; token: string }) =>
    apiFetch<{ res: boolean; message: string }>('/users/changePass', { method: 'POST', body }),
  validateEmail: (token: string) =>
    apiFetch<{ res: boolean; message: string }>('/users/validateEmail/' + encodeURIComponent(token)),
  validateReset: (token: string) =>
    apiFetch<{ res: boolean; message?: string }>('/users/validateReset/' + encodeURIComponent(token)),
  current: () =>
    apiFetch<User>('/users/current'),
  update: (body: Partial<Pick<User, 'username' | 'email' | 'nombre' | 'apellido' | 'dni' | 'codArea' | 'telefono'>> & { password?: string }) =>
    apiFetch<{ res: boolean; message: string }>('/users/', { method: 'PUT', body }),
  getDirecciones: () =>
    apiFetch<Direccion[]>('/users/dire/'),
  getDireccionDefault: () =>
    apiFetch<Direccion | null>('/users/direcciondefault/')
};
```

- [ ] **Step 2: Write `src/api/categorias.ts`**

```ts
import { apiFetch } from './client';
import type { Category } from './types';

export const categorias = {
  raiz: () => apiFetch<Category[]>('/categorias'),
  subs: (idPadre: number) => apiFetch<Category[]>('/categorias/Sub/' + idPadre)
};
```

- [ ] **Step 3: Write `src/api/productos.ts`**

```ts
import { apiFetch } from './client';
import type { Product, ProductWithExiste } from './types';

export const productos = {
  porCategoria: (idcategoria: number) =>
    apiFetch<Product[]>('/productos/categoria/' + idcategoria),
  porId: (id: number) =>
    apiFetch<Product>('/productos/' + id),
  porCategoriaEnQuodom: (idquodom: string, idcategoria: number) =>
    apiFetch<ProductWithExiste[]>('/productos/categoriaQ/' + encodeURIComponent(idquodom) + '/' + idcategoria)
};
```

- [ ] **Step 4: Write `src/api/busqueda.ts`**

```ts
import { apiFetch } from './client';
import type { BusquedaResult } from './types';

export const busqueda = {
  buscar: (b: string) => apiFetch<BusquedaResult[]>('/busqueda?b=' + encodeURIComponent(b))
};
```

- [ ] **Step 5: Write `src/api/hist_busquedas.ts`**

```ts
import { apiFetch } from './client';

export type HistItem = { id: number; valor: string; createdAt: string };

export const historial = {
  list: () => apiFetch<HistItem[]>('/hist_busquedas'),
  add: (valor: string) => apiFetch<{ res: boolean }>('/hist_busquedas/create', { method: 'POST', body: { valor } })
};
```

- [ ] **Step 6: Write `src/api/quodom.ts`**

```ts
import { apiFetch } from './client';
import type { Quodom } from './types';

export const quodom = {
  misQuodom: () => apiFetch<Quodom[]>('/quodom/misQuodom/'),
  porId: (id: string) => apiFetch<Quodom>('/quodom/' + encodeURIComponent(id)),
  porcCompletado: (id: string) => apiFetch<{ porccompletado: number; cantproductos: number }>('/quodom/porccompletado/' + encodeURIComponent(id)),
  create: (body: { descripcion: string; iddireccion?: number | null }) =>
    apiFetch<{ res: boolean; idquodom: string }>('/quodom/create', { method: 'POST', body }),
  update: (id: string, body: { descripcion?: string; iddireccion?: number | null }) =>
    apiFetch<Quodom>('/quodom/' + encodeURIComponent(id), { method: 'PUT', body }),
  eliminar: (id: string) =>
    apiFetch<{ res: boolean }>('/quodom/' + encodeURIComponent(id), { method: 'DELETE' }),
  whatsapp: (id: string) =>
    apiFetch<{ res: boolean; link: string }>('/quodom/whatsapp/' + encodeURIComponent(id))
};
```

- [ ] **Step 7: Write `src/api/quodom_lines.ts`**

```ts
import { apiFetch } from './client';
import type { QuodomLine, Atributo } from './types';

export const quodomLines = {
  porQuodom: (idquodom: string) =>
    apiFetch<QuodomLine[]>('/quodom_lines/' + encodeURIComponent(idquodom)),
  porId: (id: number) =>
    apiFetch<QuodomLine>('/quodom_lines/lines/' + id),
  atributos: (idproducto: number, nombreatributo: string) =>
    apiFetch<Atributo[]>('/quodom_lines/atributos?idproducto=' + idproducto + '&nombreatributo=' + encodeURIComponent(nombreatributo)),
  add: (body: { idquodom: string; idproducto: number; cantidad: number; nombreProducto: string; atributo1?: string; atributo2?: string }) =>
    apiFetch<{ res: boolean; id: number }>('/quodom_lines/add', { method: 'POST', body }),
  update: (id: number, body: { cantidad?: number; atributo1?: string; atributo2?: string }) =>
    apiFetch<{ res: boolean }>('/quodom_lines/' + id, { method: 'PUT', body }),
  eliminar: (id: number) =>
    apiFetch<{ res: boolean }>('/quodom_lines/' + id, { method: 'DELETE' })
};
```

- [ ] **Step 8: Write `src/api/user_direcciones.ts`**

```ts
import { apiFetch } from './client';
import type { Direccion } from './types';

export type DireccionInput = {
  alias?: string;
  calle?: string;
  numero?: string;
  piso?: string;
  cp?: string;
  localidad?: string;
  direccion?: string;
  observaciones?: string;
  idprovincia?: number;
  default?: boolean;
};

export const userDirecciones = {
  porId: (id: number) =>
    apiFetch<Direccion>('/user_direcciones/' + id),
  default: () =>
    apiFetch<Direccion | null>('/user_direcciones/direcciondefault'),
  create: (body: DireccionInput) =>
    apiFetch<{ res: boolean; id: number }>('/user_direcciones/create', { method: 'POST', body }),
  update: (id: number, body: DireccionInput) =>
    apiFetch<unknown>('/user_direcciones/' + id, { method: 'PUT', body }),
  setPrincipal: (id: number) =>
    apiFetch<unknown>('/user_direcciones/prin/' + id, { method: 'PUT' }),
  eliminar: (id: number) =>
    apiFetch<{ res: boolean; message: string }>('/user_direcciones/' + id, { method: 'DELETE' })
};
```

- [ ] **Step 9: Write `src/api/provincias.ts`**

```ts
import { apiFetch } from './client';
import type { Provincia } from './types';

export const provincias = {
  list: () => apiFetch<Provincia[]>('/provincias')
};
```

- [ ] **Step 10: Write `src/api/localidades.ts`**

```ts
import { apiFetch } from './client';
import type { Localidad } from './types';

export const localidades = {
  porProvincia: (idprovincia: number) =>
    apiFetch<Localidad[]>('/localidades/prov?idprovincia=' + idprovincia)
};
```

- [ ] **Step 11: Write `src/api/oper_notificaciones.ts`**

```ts
import { apiFetch } from './client';
import type { Notificacion } from './types';

export const notificaciones = {
  list: () => apiFetch<Notificacion[]>('/oper_notificaciones'),
  count: () => apiFetch<number>('/oper_notificaciones/count'),
  marcarLeida: (id: number) => apiFetch<{ res: boolean }>('/oper_notificaciones/' + id, { method: 'PUT', body: { leida: 1 } })
};
```

- [ ] **Step 12: Typecheck**

```bash
cd quodom-web/app && npm run typecheck
```
Expected: exit 0.

- [ ] **Step 13: Commit**

```bash
git add quodom-web/app/src/api
git commit -m "feat: add typed api modules for every backend resource"
```

---

## Task 5: Guest Quodom in localStorage + tests

**Files:**
- Create: `src/guest/guestQuodom.ts`
- Test: `tests/guestQuodom.test.ts`

- [ ] **Step 1: Write failing test `tests/guestQuodom.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getGuestQuodom, setGuestDescripcion, addGuestLine,
  updateGuestLineCantidad, updateGuestLineAtributos,
  removeGuestLine, clearGuestQuodom, guestLineCount
} from '../src/guest/guestQuodom';

describe('guestQuodom', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty and returns a fresh quodom', () => {
    const q = getGuestQuodom();
    expect(q.lines).toEqual([]);
    expect(q.descripcion).toBe('');
  });

  it('adds lines and counts them', () => {
    addGuestLine({ idproducto: 100, nombreProducto: 'Latex 20L', cantidad: 2, nombreAtributo1: 'Color' });
    addGuestLine({ idproducto: 101, nombreProducto: 'Rodillo', cantidad: 1 });
    expect(guestLineCount()).toBe(2);
    expect(getGuestQuodom().lines).toHaveLength(2);
  });

  it('merges same-product lines by summing cantidad when attributes match', () => {
    addGuestLine({ idproducto: 100, nombreProducto: 'Latex', cantidad: 2 });
    addGuestLine({ idproducto: 100, nombreProducto: 'Latex', cantidad: 3 });
    const q = getGuestQuodom();
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0].cantidad).toBe(5);
  });

  it('keeps separate lines when attributes differ', () => {
    addGuestLine({ idproducto: 100, nombreProducto: 'Latex', cantidad: 1, atributo1: 'Rojo' });
    addGuestLine({ idproducto: 100, nombreProducto: 'Latex', cantidad: 1, atributo1: 'Azul' });
    expect(getGuestQuodom().lines).toHaveLength(2);
  });

  it('updates a line cantidad', () => {
    addGuestLine({ idproducto: 100, nombreProducto: 'Latex', cantidad: 1 });
    updateGuestLineCantidad(0, 7);
    expect(getGuestQuodom().lines[0].cantidad).toBe(7);
  });

  it('removes a line when cantidad drops to 0', () => {
    addGuestLine({ idproducto: 100, nombreProducto: 'Latex', cantidad: 3 });
    updateGuestLineCantidad(0, 0);
    expect(getGuestQuodom().lines).toEqual([]);
  });

  it('updates attributes without duplicating', () => {
    addGuestLine({ idproducto: 100, nombreProducto: 'Latex', cantidad: 1 });
    updateGuestLineAtributos(0, { atributo1: 'Rojo' });
    expect(getGuestQuodom().lines[0].atributo1).toBe('Rojo');
  });

  it('removes a line by index', () => {
    addGuestLine({ idproducto: 100, nombreProducto: 'A', cantidad: 1 });
    addGuestLine({ idproducto: 101, nombreProducto: 'B', cantidad: 1 });
    removeGuestLine(0);
    const q = getGuestQuodom();
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0].idproducto).toBe(101);
  });

  it('sets descripcion', () => {
    setGuestDescripcion('Pintura living');
    expect(getGuestQuodom().descripcion).toBe('Pintura living');
  });

  it('clears everything', () => {
    setGuestDescripcion('X');
    addGuestLine({ idproducto: 1, nombreProducto: 'a', cantidad: 1 });
    clearGuestQuodom();
    expect(getGuestQuodom()).toEqual({ descripcion: '', lines: [] });
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

```bash
cd quodom-web/app && npm test
```
Expected: FAIL — cannot resolve `../src/guest/guestQuodom`.

- [ ] **Step 3: Write `src/guest/guestQuodom.ts`**

```ts
const KEY = 'quodom.guest';

export type GuestLine = {
  idproducto: number;
  nombreProducto: string;
  cantidad: number;
  atributo1?: string;
  atributo2?: string;
  nombreAtributo1?: string;
  nombreAtributo2?: string;
};

export type GuestQuodom = {
  descripcion: string;
  lines: GuestLine[];
};

export function getGuestQuodom(): GuestQuodom {
  const raw = localStorage.getItem(KEY);
  if (!raw) return { descripcion: '', lines: [] };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.lines)) return parsed;
  } catch {}
  return { descripcion: '', lines: [] };
}

function save(q: GuestQuodom) {
  localStorage.setItem(KEY, JSON.stringify(q));
}

export function setGuestDescripcion(descripcion: string): void {
  const q = getGuestQuodom();
  q.descripcion = descripcion;
  save(q);
}

function sameLine(a: GuestLine, b: GuestLine): boolean {
  return a.idproducto === b.idproducto
    && (a.atributo1 ?? '') === (b.atributo1 ?? '')
    && (a.atributo2 ?? '') === (b.atributo2 ?? '');
}

export function addGuestLine(line: GuestLine): void {
  const q = getGuestQuodom();
  const idx = q.lines.findIndex(l => sameLine(l, line));
  if (idx >= 0) {
    q.lines[idx].cantidad += line.cantidad;
  } else {
    q.lines.push({ ...line });
  }
  save(q);
}

export function updateGuestLineCantidad(index: number, cantidad: number): void {
  const q = getGuestQuodom();
  if (index < 0 || index >= q.lines.length) return;
  if (cantidad <= 0) q.lines.splice(index, 1);
  else q.lines[index].cantidad = cantidad;
  save(q);
}

export function updateGuestLineAtributos(index: number, patch: { atributo1?: string; atributo2?: string }): void {
  const q = getGuestQuodom();
  if (index < 0 || index >= q.lines.length) return;
  q.lines[index] = { ...q.lines[index], ...patch };
  save(q);
}

export function removeGuestLine(index: number): void {
  const q = getGuestQuodom();
  if (index < 0 || index >= q.lines.length) return;
  q.lines.splice(index, 1);
  save(q);
}

export function clearGuestQuodom(): void {
  localStorage.removeItem(KEY);
}

export function guestLineCount(): number {
  return getGuestQuodom().lines.length;
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
cd quodom-web/app && npm test
```
Expected: all guestQuodom tests pass (10 in this file).

- [ ] **Step 5: Commit**

```bash
git add quodom-web/app/src/guest/guestQuodom.ts quodom-web/app/tests/guestQuodom.test.ts
git commit -m "feat: add guest quodom localStorage with merge and cantidad rules"
```

---

## Task 6: Auth context + ProtectedRoute + guest migration + tests

**Files:**
- Create: `src/auth/AuthContext.tsx`, `src/auth/ProtectedRoute.tsx`, `src/guest/migrateGuestQuodom.ts`
- Test: `tests/migrateGuestQuodom.test.ts`

- [ ] **Step 1: Write failing test `tests/migrateGuestQuodom.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateGuestQuodom } from '../src/guest/migrateGuestQuodom';
import { addGuestLine, setGuestDescripcion, getGuestQuodom } from '../src/guest/guestQuodom';

const created: any[] = [];
const linesAdded: any[] = [];
vi.mock('../src/api/quodom', () => ({
  quodom: {
    create: vi.fn(async (body: any) => { created.push(body); return { res: true, idquodom: 'new-uuid' }; })
  }
}));
vi.mock('../src/api/quodom_lines', () => ({
  quodomLines: {
    add: vi.fn(async (body: any) => { linesAdded.push(body); return { res: true, id: linesAdded.length }; })
  }
}));

describe('migrateGuestQuodom', () => {
  beforeEach(() => {
    localStorage.clear();
    created.length = 0;
    linesAdded.length = 0;
  });

  it('does nothing when the guest quodom is empty', async () => {
    const id = await migrateGuestQuodom();
    expect(id).toBeNull();
    expect(created).toHaveLength(0);
    expect(linesAdded).toHaveLength(0);
  });

  it('creates a quodom and adds all lines then clears the guest', async () => {
    setGuestDescripcion('Pintura living');
    addGuestLine({ idproducto: 100, nombreProducto: 'Latex 20L', cantidad: 2, atributo1: 'Blanco' });
    addGuestLine({ idproducto: 101, nombreProducto: 'Rodillo', cantidad: 1 });
    const id = await migrateGuestQuodom();
    expect(id).toBe('new-uuid');
    expect(created[0]).toEqual({ descripcion: 'Pintura living' });
    expect(linesAdded).toHaveLength(2);
    expect(linesAdded[0]).toMatchObject({ idquodom: 'new-uuid', idproducto: 100, cantidad: 2, atributo1: 'Blanco' });
    expect(linesAdded[1]).toMatchObject({ idquodom: 'new-uuid', idproducto: 101, cantidad: 1 });
    expect(getGuestQuodom().lines).toEqual([]);
  });

  it('defaults descripcion to "Mi Quodom" when empty', async () => {
    addGuestLine({ idproducto: 100, nombreProducto: 'Latex', cantidad: 1 });
    await migrateGuestQuodom();
    expect(created[0].descripcion).toBe('Mi Quodom');
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

```bash
cd quodom-web/app && npm test
```
Expected: FAIL — cannot resolve `../src/guest/migrateGuestQuodom`.

- [ ] **Step 3: Write `src/guest/migrateGuestQuodom.ts`**

```ts
import { quodom } from '../api/quodom';
import { quodomLines } from '../api/quodom_lines';
import { clearGuestQuodom, getGuestQuodom } from './guestQuodom';

export async function migrateGuestQuodom(): Promise<string | null> {
  const g = getGuestQuodom();
  if (g.lines.length === 0) return null;
  const descripcion = g.descripcion.trim() || 'Mi Quodom';
  const created = await quodom.create({ descripcion });
  for (const l of g.lines) {
    await quodomLines.add({
      idquodom: created.idquodom,
      idproducto: l.idproducto,
      cantidad: l.cantidad,
      nombreProducto: l.nombreProducto,
      atributo1: l.atributo1,
      atributo2: l.atributo2
    });
  }
  clearGuestQuodom();
  return created.idquodom;
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
cd quodom-web/app && npm test
```
Expected: all pass (previous + 3 new).

- [ ] **Step 5: Write `src/auth/AuthContext.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { users } from '../api/users';
import { clearToken, getToken, setToken } from '../api/client';
import type { User } from '../api/types';
import { migrateGuestQuodom } from '../guest/migrateGuestQuodom';

type AuthState = {
  user: User | null;
  loading: boolean;
  signin: (username: string, password: string) => Promise<string | null>;
  signup: (body: Parameters<typeof users.signup>[0]) => Promise<{ res: boolean; message: string; id?: string }>;
  signout: () => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(!!getToken());

  const refresh = useCallback(async () => {
    if (!getToken()) { setUser(null); setLoading(false); return; }
    try {
      const u = await users.current();
      setUser(u);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signin = useCallback(async (username: string, password: string) => {
    const u = await users.signin({ username, password });
    if (u.token) setToken(u.token);
    setUser(u);
    const migratedId = await migrateGuestQuodom().catch(() => null);
    return migratedId;
  }, []);

  const signup = useCallback(async (body: Parameters<typeof users.signup>[0]) => {
    return await users.signup(body);
  }, []);

  const signout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(() => ({ user, loading, signin, signup, signout, refresh }), [user, loading, signin, signup, signout, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
```

- [ ] **Step 6: Write `src/auth/ProtectedRoute.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}
```

- [ ] **Step 7: Typecheck**

```bash
cd quodom-web/app && npm run typecheck
```
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add quodom-web/app/src/auth quodom-web/app/src/guest/migrateGuestQuodom.ts quodom-web/app/tests/migrateGuestQuodom.test.ts
git commit -m "feat: add auth context, protected route and guest-to-backend migration"
```

---

## Task 7: Router shell with all routes (placeholders) + Layout

**Files:**
- Create: `src/router/routes.tsx`, `src/components/layout/Layout.tsx` + `.css`, `src/components/layout/AppBar.tsx` + `.css`, `src/components/layout/AppBarBack.tsx` + `.css`, `src/components/layout/Drawer.tsx` + `.css`, `src/components/Loader.tsx` + `.css`, `src/components/EmptyState.tsx` + `.css`, `src/components/ErrorState.tsx` + `.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write `src/components/Loader.tsx`**

```tsx
import './Loader.css';

export function Loader({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="loader" role="status" aria-live="polite">
      <div className="loader-spinner" aria-hidden="true" />
      <span className="loader-label">{label}</span>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/Loader.css`**

```css
.loader { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); padding: var(--sp-6); }
.loader-spinner { width: 32px; height: 32px; border: 3px solid rgba(0,0,0,.1); border-top-color: var(--color-acento); border-radius: 50%; animation: spin .8s linear infinite; }
.loader-label { font-size: var(--fs-small); color: var(--color-texto-muted); }
@keyframes spin { to { transform: rotate(360deg); } }
```

- [ ] **Step 3: Write `src/components/EmptyState.tsx`**

```tsx
import type { ReactNode } from 'react';
import './EmptyState.css';

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
```

- [ ] **Step 4: Write `src/components/EmptyState.css`**

```css
.empty-state { text-align: center; padding: var(--sp-6) var(--sp-4); color: var(--color-texto); }
.empty-state h3 { margin-bottom: var(--sp-2); }
.empty-state p { color: var(--color-texto-muted); margin-bottom: var(--sp-4); }
```

- [ ] **Step 5: Write `src/components/ErrorState.tsx`**

```tsx
import './ErrorState.css';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <p>{message}</p>
      {onRetry && <button className="btn btn-ghost" onClick={onRetry}>Reintentar</button>}
    </div>
  );
}
```

- [ ] **Step 6: Write `src/components/ErrorState.css`**

```css
.error-state { text-align: center; padding: var(--sp-6) var(--sp-4); color: var(--color-error); }
.error-state p { margin-bottom: var(--sp-3); }
```

- [ ] **Step 7: Write `src/components/layout/AppBar.tsx`**

```tsx
import { Link } from 'react-router-dom';
import './AppBar.css';

export function AppBar({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  return (
    <header className="appbar">
      <button className="appbar-hamburger" aria-label="Abrir menú" onClick={onOpenDrawer}>
        <span /><span /><span />
      </button>
      <Link to="/" className="appbar-brand">QUODOM</Link>
      <div className="appbar-actions">
        <Link to="/notificaciones" className="appbar-bell" aria-label="Notificaciones">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" /><path d="M9 17a3 3 0 0 0 6 0" /></svg>
        </Link>
      </div>
    </header>
  );
}
```

- [ ] **Step 8: Write `src/components/layout/AppBar.css`**

```css
.appbar {
  display: flex; align-items: center; gap: var(--sp-3);
  padding: 0 var(--sp-4);
  height: 56px;
  background: var(--color-navbar);
  box-shadow: 0 1px 2px rgba(0,0,0,.08);
  position: sticky; top: 0; z-index: 20;
}
.appbar-hamburger { width: 40px; height: 40px; display: inline-flex; flex-direction: column; justify-content: center; gap: 4px; align-items: center; }
.appbar-hamburger span { display: block; width: 22px; height: 2px; background: var(--color-texto); border-radius: 2px; }
.appbar-brand { flex: 1; font-family: var(--font-prompt); font-weight: 600; font-size: 20px; color: var(--color-acento); }
.appbar-actions { display: inline-flex; gap: var(--sp-2); }
.appbar-bell { color: var(--color-texto); padding: var(--sp-2); }

@media (min-width: 1025px) {
  .appbar-hamburger { display: none; }
}
```

- [ ] **Step 9: Write `src/components/layout/AppBarBack.tsx`**

```tsx
import { useNavigate } from 'react-router-dom';
import './AppBarBack.css';

export function AppBarBack({ title }: { title: string }) {
  const navigate = useNavigate();
  return (
    <header className="appbar-back">
      <button className="appbar-back-btn" aria-label="Volver" onClick={() => navigate(-1)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <h2 className="appbar-back-title">{title}</h2>
    </header>
  );
}
```

- [ ] **Step 10: Write `src/components/layout/AppBarBack.css`**

```css
.appbar-back {
  display: flex; align-items: center; gap: var(--sp-3);
  padding: 0 var(--sp-3); height: 56px;
  background: var(--color-navbar);
  position: sticky; top: 0; z-index: 20;
  box-shadow: 0 1px 2px rgba(0,0,0,.08);
}
.appbar-back-btn { width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; color: var(--color-texto); }
.appbar-back-title { margin: 0; font-family: var(--font-prompt); font-weight: 500; font-size: 18px; }
```

- [ ] **Step 11: Write `src/components/layout/Drawer.tsx`**

```tsx
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import './Drawer.css';

export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, signout } = useAuth();
  return (
    <>
      {open && <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside className={'drawer' + (open ? ' drawer-open' : '')} aria-hidden={!open}>
        <div className="drawer-header">
          <span className="drawer-brand">QUODOM</span>
          {user && <span className="drawer-user">{user.nombre}</span>}
        </div>
        <nav className="drawer-nav">
          <NavLink to="/" end onClick={onClose}>Inicio</NavLink>
          <NavLink to="/busqueda" onClick={onClose}>Buscar</NavLink>
          {user && <NavLink to="/mis-quodoms" onClick={onClose}>Mis Quodoms</NavLink>}
          {user && <NavLink to="/perfil" onClick={onClose}>Perfil</NavLink>}
          {user && <NavLink to="/direcciones" onClick={onClose}>Direcciones</NavLink>}
          {user && <NavLink to="/notificaciones" onClick={onClose}>Notificaciones</NavLink>}
        </nav>
        <div className="drawer-footer">
          {user
            ? <button className="btn btn-ghost btn-block" onClick={() => { signout(); onClose(); }}>Cerrar sesión</button>
            : <NavLink to="/login" className="btn btn-block" onClick={onClose}>Ingresar</NavLink>}
        </div>
      </aside>
    </>
  );
}
```

- [ ] **Step 12: Write `src/components/layout/Drawer.css`**

```css
.drawer-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 30;
}
.drawer {
  position: fixed; top: 0; left: 0; height: 100vh; width: 260px;
  background: #fff; box-shadow: 2px 0 8px rgba(0,0,0,.15);
  transform: translateX(-100%); transition: transform .25s ease; z-index: 40;
  display: flex; flex-direction: column;
}
.drawer-open { transform: translateX(0); }
.drawer-header { background: var(--color-acento); color: #fff; padding: var(--sp-5) var(--sp-4); }
.drawer-brand { display: block; font-family: var(--font-prompt); font-weight: 600; font-size: 22px; }
.drawer-user { display: block; font-size: var(--fs-small); opacity: .9; margin-top: var(--sp-1); }
.drawer-nav { flex: 1; display: flex; flex-direction: column; padding: var(--sp-2) 0; }
.drawer-nav a { padding: var(--sp-3) var(--sp-4); color: var(--color-texto); }
.drawer-nav a.active { background: rgba(112,111,154,.1); color: var(--color-acento); font-weight: 500; }
.drawer-footer { padding: var(--sp-4); border-top: 1px solid rgba(0,0,0,.06); }

@media (min-width: 1025px) {
  .drawer-backdrop { display: none; }
  .drawer { position: sticky; transform: none; box-shadow: none; border-right: 1px solid rgba(0,0,0,.06); }
}
```

- [ ] **Step 13: Write `src/components/layout/Layout.tsx`**

```tsx
import { useState } from 'react';
import type { ReactNode } from 'react';
import { AppBar } from './AppBar';
import { Drawer } from './Drawer';
import './Layout.css';

export function Layout({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <div className="layout">
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="layout-main">
        <AppBar onOpenDrawer={() => setDrawerOpen(true)} />
        <main>{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 14: Write `src/components/layout/Layout.css`**

```css
.layout { min-height: 100vh; }
.layout-main { display: flex; flex-direction: column; min-height: 100vh; }
@media (min-width: 1025px) {
  .layout { display: grid; grid-template-columns: 260px 1fr; }
}
```

- [ ] **Step 15: Write `src/router/routes.tsx`**

```tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { ProtectedRoute } from '../auth/ProtectedRoute';

function Placeholder({ title }: { title: string }) {
  return <div className="container"><h1>{title}</h1></div>;
}

const router = createBrowserRouter([
  { path: '/login', element: <Placeholder title="Ingresar" /> },
  { path: '/registro', element: <Placeholder title="Crear cuenta" /> },
  { path: '/cuenta-creada', element: <Placeholder title="Cuenta creada" /> },
  { path: '/recuperar', element: <Placeholder title="Recuperar contraseña" /> },
  { path: '/reset/:token', element: <Placeholder title="Nueva contraseña" /> },
  { path: '/validar-email/:token', element: <Placeholder title="Validar email" /> },
  {
    element: <Layout><Outlet /></Layout>,
    children: [
      { path: '/', element: <Placeholder title="Inicio" /> },
      { path: '/categoria/:id', element: <Placeholder title="Subcategorías" /> },
      { path: '/subcategoria/:id', element: <Placeholder title="Productos" /> },
      { path: '/busqueda', element: <Placeholder title="Buscar" /> },
      { path: '/quodom', element: <Placeholder title="Mi Quodom" /> },
      { path: '/mis-quodoms', element: <ProtectedRoute><Placeholder title="Mis Quodoms" /></ProtectedRoute> },
      { path: '/perfil', element: <ProtectedRoute><Placeholder title="Perfil" /></ProtectedRoute> },
      { path: '/direcciones', element: <ProtectedRoute><Placeholder title="Direcciones" /></ProtectedRoute> },
      { path: '/notificaciones', element: <ProtectedRoute><Placeholder title="Notificaciones" /></ProtectedRoute> }
    ]
  }
]);

import { Outlet } from 'react-router-dom';

export function AppRouter() {
  return <RouterProvider router={router} />;
}
```

- [ ] **Step 16: Rewrite `src/App.tsx`**

```tsx
import { AuthProvider } from './auth/AuthContext';
import { AppRouter } from './router/routes';

export function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
```

- [ ] **Step 17: Verify in the browser**

```bash
cd quodom-web/app && npm run dev
```

Navigate:
- `/` shows the AppBar with hamburger + "QUODOMV brand + bell icon; content says "Inicio".
- Click the hamburger — drawer slides in with links Inicio, Buscar, and an "Ingresar" button in the footer (user is not logged in).
- Resize to ≥1025px — hamburger disappears, drawer is persistent on the left.
- Go to `/mis-quodoms` in the URL — you're redirected to `/login` (placeholder).

Stop the server.

- [ ] **Step 18: Typecheck**

```bash
cd quodom-web/app && npm run typecheck
```
Expected: exit 0.

- [ ] **Step 19: Commit**

```bash
git add quodom-web/app/src/App.tsx quodom-web/app/src/router quodom-web/app/src/components
git commit -m "feat: add router, layout, appbar, drawer and shared UI states"
```

---

## Task 8: SignIn + SignUp + CuentaCreada + ForgotPassword + Reset + ValidarEmail

**Files:**
- Create: `src/screens/Auth/SignIn.tsx` + `.css`, `SignUp.tsx` + `.css`, `CuentaCreada.tsx` + `.css`, `ForgotPassword.tsx` + `.css`, `ResetPassword.tsx` + `.css`, `ValidarEmail.tsx` + `.css`, `src/utils/validation.ts`
- Modify: `src/router/routes.tsx`

- [ ] **Step 1: Write `src/utils/validation.ts`**

```ts
export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
export function nonEmpty(v: string): boolean {
  return v.trim().length > 0;
}
export function minLen(v: string, n: number): boolean {
  return v.length >= n;
}
```

- [ ] **Step 2: Write `src/screens/Auth/SignIn.tsx`**

```tsx
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import './SignIn.css';

export function SignIn() {
  const { signin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const migratedId = await signin(username, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(migratedId ? '/quodom?id=' + encodeURIComponent(migratedId) : (from ?? '/'), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo ingresar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <h1>Ingresar</h1>
        <form onSubmit={onSubmit} noValidate>
          <label className="field">
            <span>Usuario o email</span>
            <input className="input" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="btn btn-block" disabled={busy || !username || !password}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
        </form>
        <div className="auth-links">
          <Link to="/recuperar">Olvidé mi contraseña</Link>
          <span>•</span>
          <Link to="/registro">Crear cuenta</Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `src/screens/Auth/SignIn.css`**

```css
.auth-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: var(--sp-4); background: var(--color-fondo); }
.auth-card { width: 100%; max-width: 420px; }
.auth-card h1 { text-align: center; margin-bottom: var(--sp-5); }
.auth-error { color: var(--color-error); font-size: var(--fs-small); margin: 0 0 var(--sp-3) 0; }
.auth-links { text-align: center; margin-top: var(--sp-4); font-size: var(--fs-small); color: var(--color-texto-muted); display: flex; gap: var(--sp-3); justify-content: center; }
.auth-links a { color: var(--color-acento); }
```

- [ ] **Step 4: Write `src/screens/Auth/SignUp.tsx`**

```tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { users } from '../../api/users';
import { ApiError } from '../../api/client';
import { isEmail, minLen, nonEmpty } from '../../utils/validation';
import './SignIn.css';

export function SignUp() {
  const navigate = useNavigate();
  const [f, setF] = useState({ username: '', email: '', nombre: '', apellido: '', password: '', codArea: '', telefono: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = nonEmpty(f.username) && isEmail(f.email) && nonEmpty(f.nombre)
    && minLen(f.password, 6) && nonEmpty(f.codArea) && nonEmpty(f.telefono);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      await users.signup(f);
      navigate('/cuenta-creada', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar.');
    } finally { setBusy(false); }
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <h1>Crear cuenta</h1>
        <form onSubmit={onSubmit} noValidate>
          <label className="field"><span>Nombre</span><input className="input" value={f.nombre} onChange={set('nombre')} required /></label>
          <label className="field"><span>Apellido</span><input className="input" value={f.apellido} onChange={set('apellido')} /></label>
          <label className="field"><span>Email</span><input className="input" type="email" value={f.email} onChange={set('email')} required /></label>
          <label className="field"><span>Usuario</span><input className="input" value={f.username} onChange={set('username')} required /></label>
          <label className="field"><span>Contraseña (mín. 6)</span><input className="input" type="password" value={f.password} onChange={set('password')} required /></label>
          <div className="phone-row">
            <label className="field"><span>Cód. área</span><input className="input" value={f.codArea} onChange={set('codArea')} required /></label>
            <label className="field"><span>Teléfono</span><input className="input" value={f.telefono} onChange={set('telefono')} required /></label>
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="btn btn-block" disabled={!valid || busy}>{busy ? 'Creando…' : 'Crear cuenta'}</button>
        </form>
        <div className="auth-links"><Link to="/login">Ya tengo cuenta</Link></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Extend `src/screens/Auth/SignIn.css` — append to the same file**

```css
.phone-row { display: grid; grid-template-columns: 1fr 2fr; gap: var(--sp-3); }
```

- [ ] **Step 6: Write `src/screens/Auth/CuentaCreada.tsx`**

```tsx
import { Link } from 'react-router-dom';

export function CuentaCreada() {
  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <h1>¡Cuenta creada!</h1>
        <p>Te enviamos un correo para validar tu email. Revisá tu casilla (y la carpeta de spam) y hacé clic en el link.</p>
        <Link to="/login" className="btn btn-block">Ir a ingresar</Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Write `src/screens/Auth/ForgotPassword.tsx`**

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { users } from '../../api/users';
import { ApiError } from '../../api/client';
import { isEmail } from '../../utils/validation';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setBusy(true);
    try {
      const r = await users.reset({ email });
      setMsg({ ok: !!r.res, text: r.message });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'No se pudo enviar.' });
    } finally { setBusy(false); }
  }
  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <h1>Recuperar contraseña</h1>
        <p>Escribí tu email y te enviamos un link para blanquear la contraseña.</p>
        <form onSubmit={onSubmit}>
          <label className="field"><span>Email</span><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          {msg && <p className={msg.ok ? '' : 'auth-error'}>{msg.text}</p>}
          <button className="btn btn-block" disabled={busy || !isEmail(email)}>{busy ? 'Enviando…' : 'Enviar link'}</button>
        </form>
        <div className="auth-links"><Link to="/login">Volver</Link></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Write `src/screens/Auth/ResetPassword.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { users } from '../../api/users';
import { ApiError } from '../../api/client';
import { minLen } from '../../utils/validation';

export function ResetPassword() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [valid, setValid] = useState<null | boolean>(null);
  const [tokenMsg, setTokenMsg] = useState<string | undefined>();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await users.validateReset(token);
        setValid(!!r.res);
        setTokenMsg(r.message);
      } catch (err) {
        setValid(false);
        setTokenMsg(err instanceof ApiError ? err.message : 'Token invalido.');
      }
    })();
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setBusy(true);
    try {
      const r = await users.changePass({ password, token });
      setMsg({ ok: !!r.res, text: r.message });
      if (r.res) setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error.' });
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <h1>Nueva contraseña</h1>
        {valid === null && <p>Validando link…</p>}
        {valid === false && <p className="auth-error">{tokenMsg ?? 'Link invalido.'}</p>}
        {valid === true && (
          <form onSubmit={onSubmit}>
            <label className="field"><span>Contraseña nueva (mín. 6)</span><input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
            {msg && <p className={msg.ok ? '' : 'auth-error'}>{msg.text}</p>}
            <button className="btn btn-block" disabled={busy || !minLen(password, 6)}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Write `src/screens/Auth/ValidarEmail.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { users } from '../../api/users';
import { ApiError } from '../../api/client';

export function ValidarEmail() {
  const { token = '' } = useParams();
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [msg, setMsg] = useState<string>('');
  useEffect(() => {
    (async () => {
      try {
        const r = await users.validateEmail(token);
        setState(r.res ? 'ok' : 'error');
        setMsg(r.message);
      } catch (err) {
        setState('error');
        setMsg(err instanceof ApiError ? err.message : 'Error validando el correo.');
      }
    })();
  }, [token]);
  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <h1>Validar email</h1>
        {state === 'loading' && <p>Validando…</p>}
        {state === 'ok' && <><p>{msg}</p><Link to="/login" className="btn btn-block">Ir a ingresar</Link></>}
        {state === 'error' && <p className="auth-error">{msg}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Update `src/router/routes.tsx` to wire the auth screens**

Replace the file with:

```tsx
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { SignIn } from '../screens/Auth/SignIn';
import { SignUp } from '../screens/Auth/SignUp';
import { CuentaCreada } from '../screens/Auth/CuentaCreada';
import { ForgotPassword } from '../screens/Auth/ForgotPassword';
import { ResetPassword } from '../screens/Auth/ResetPassword';
import { ValidarEmail } from '../screens/Auth/ValidarEmail';

function Placeholder({ title }: { title: string }) {
  return <div className="container"><h1>{title}</h1></div>;
}

const router = createBrowserRouter([
  { path: '/login', element: <SignIn /> },
  { path: '/registro', element: <SignUp /> },
  { path: '/cuenta-creada', element: <CuentaCreada /> },
  { path: '/recuperar', element: <ForgotPassword /> },
  { path: '/reset/:token', element: <ResetPassword /> },
  { path: '/validar-email/:token', element: <ValidarEmail /> },
  {
    element: <Layout><Outlet /></Layout>,
    children: [
      { path: '/', element: <Placeholder title="Inicio" /> },
      { path: '/categoria/:id', element: <Placeholder title="Subcategorías" /> },
      { path: '/subcategoria/:id', element: <Placeholder title="Productos" /> },
      { path: '/busqueda', element: <Placeholder title="Buscar" /> },
      { path: '/quodom', element: <Placeholder title="Mi Quodom" /> },
      { path: '/mis-quodoms', element: <ProtectedRoute><Placeholder title="Mis Quodoms" /></ProtectedRoute> },
      { path: '/perfil', element: <ProtectedRoute><Placeholder title="Perfil" /></ProtectedRoute> },
      { path: '/direcciones', element: <ProtectedRoute><Placeholder title="Direcciones" /></ProtectedRoute> },
      { path: '/notificaciones', element: <ProtectedRoute><Placeholder title="Notificaciones" /></ProtectedRoute> }
    ]
  }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
```

- [ ] **Step 11: Verify in the browser**

Start the backend from another terminal: `cd quodom-web/api && npm run dev` (port 3999).
Then `cd quodom-web/app && npm run dev` and open `http://localhost:5173`.

- Visit `/login`, log in with the seeded user (`demo` / `secreto123`). Expect: redirect to `/`, drawer now shows Mis Quodoms/Perfil/etc.
- Sign out from the drawer, visit `/registro`, create a new user (unique username/email). Expect: land on `/cuenta-creada`.
- Visit `/recuperar`, submit an unknown email → error message; submit `demo@test.com` → success message.

Stop both servers.

- [ ] **Step 12: Typecheck**

```bash
cd quodom-web/app && npm run typecheck
```
Expected: exit 0.

- [ ] **Step 13: Commit**

```bash
git add quodom-web/app/src/screens/Auth quodom-web/app/src/utils/validation.ts quodom-web/app/src/router/routes.tsx
git commit -m "feat: add signin, signup, forgot/reset password and email validation screens"
```

---

## Task 9: Home — SitioInicial (categorías raíz) and category drill-down

**Files:**
- Create: `src/screens/Home/SitioInicial.tsx` + `.css`, `SubcategoriaLista.tsx` + `.css`, `ProductosPorCategoria.tsx` + `.css`, `DetalleProducto.tsx` + `.css`
- Modify: `src/router/routes.tsx`

- [ ] **Step 1: Write `src/screens/Home/SitioInicial.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { categorias } from '../../api/categorias';
import type { Category } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
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
  if (!cats) return <Loader />;

  return (
    <section className="container home-inicial">
      <h1>Categorías</h1>
      <div className="cat-grid">
        {cats.map(c => (
          <Link key={c.id} to={'/categoria/' + c.id} className="cat-card card hoja">
            <span className="cat-card-name">{c.nombrecategoria}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write `src/screens/Home/SitioInicial.css`**

```css
.home-inicial { padding: var(--sp-4) 0 var(--sp-7); }
.cat-grid { display: grid; gap: var(--sp-3); grid-template-columns: repeat(2, 1fr); }
.cat-card { display: flex; align-items: center; justify-content: center; min-height: 120px; text-align: center; }
.cat-card-name { font-family: var(--font-prompt); font-weight: 500; font-size: 18px; color: var(--color-acento); }

@media (min-width: 601px) and (max-width: 1024px) { .cat-grid { grid-template-columns: repeat(4, 1fr); } }
@media (min-width: 1025px) { .cat-grid { grid-template-columns: repeat(4, 1fr); } .cat-card { min-height: 160px; } }
```

- [ ] **Step 3: Write `src/screens/Home/SubcategoriaLista.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { categorias } from '../../api/categorias';
import type { Category } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { AppBarBack } from '../../components/layout/AppBarBack';
import './SubcategoriaLista.css';

export function SubcategoriaLista() {
  const { id = '' } = useParams();
  const idPadre = Number(id);
  const [subs, setSubs] = useState<Category[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setSubs(null); setErr(null);
    categorias.subs(idPadre)
      .then(d => { if (alive) setSubs(d); })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error.'); });
    return () => { alive = false; };
  }, [idPadre, nonce]);
  return (
    <>
      <AppBarBack title="Subcategorías" />
      <section className="container subcat">
        {err && <ErrorState message={err} onRetry={() => setNonce(n => n + 1)} />}
        {!err && !subs && <Loader />}
        {subs && (
          <div className="subcat-grid">
            {subs.map(s => (
              <Link key={s.id} to={'/subcategoria/' + s.id} className="subcat-card card hoja">
                <span>{s.nombrecategoria}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
```

- [ ] **Step 4: Write `src/screens/Home/SubcategoriaLista.css`**

```css
.subcat { padding: var(--sp-4) 0 var(--sp-7); }
.subcat-grid { display: grid; gap: var(--sp-3); grid-template-columns: repeat(2, 1fr); }
.subcat-card { min-height: 88px; display: flex; align-items: center; justify-content: center; text-align: center; color: var(--color-acento); font-weight: 500; }
@media (min-width: 601px) { .subcat-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1025px) { .subcat-grid { grid-template-columns: repeat(5, 1fr); } }
```

- [ ] **Step 5: Write `src/screens/Home/ProductosPorCategoria.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { productos } from '../../api/productos';
import type { Product } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { AppBarBack } from '../../components/layout/AppBarBack';
import { addGuestLine } from '../../guest/guestQuodom';
import { DetalleProducto } from './DetalleProducto';
import './ProductosPorCategoria.css';

export function ProductosPorCategoria() {
  const { id = '' } = useParams();
  const idCat = Number(id);
  const [prods, setProds] = useState<Product[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setProds(null); setErr(null);
    productos.porCategoria(idCat)
      .then(d => { if (alive) setProds(d); })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error.'); });
    return () => { alive = false; };
  }, [idCat, nonce]);

  function agregar(p: Product) {
    addGuestLine({ idproducto: p.id, nombreProducto: p.nombreproducto, cantidad: 1, nombreAtributo1: p.atributo1 ?? undefined, nombreAtributo2: p.atributo2 ?? undefined });
    window.dispatchEvent(new Event('quodom:changed'));
  }

  return (
    <>
      <AppBarBack title="Productos" />
      <section className="container prods">
        {err && <ErrorState message={err} onRetry={() => setNonce(n => n + 1)} />}
        {!err && !prods && <Loader />}
        {prods && prods.length === 0 && <p className="prods-empty">No hay productos en esta subcategoría.</p>}
        {prods && prods.length > 0 && (
          <ul className="prod-list">
            {prods.map(p => (
              <li key={p.id} className="prod-item card hoja">
                <button className="prod-info" onClick={() => setSelected(p)}>
                  <span className="prod-name">{p.nombreproducto}</span>
                </button>
                <button className="btn btn-exito prod-add" aria-label={'Agregar ' + p.nombreproducto} onClick={() => agregar(p)}>+</button>
              </li>
            ))}
          </ul>
        )}
        {selected && <DetalleProducto product={selected} onClose={() => setSelected(null)} onAdd={() => { agregar(selected); setSelected(null); }} />}
      </section>
    </>
  );
}
```

- [ ] **Step 6: Write `src/screens/Home/ProductosPorCategoria.css`**

```css
.prods { padding: var(--sp-4) 0 var(--sp-7); }
.prod-list { display: grid; gap: var(--sp-2); }
.prod-item { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3); }
.prod-info { flex: 1; text-align: left; padding: var(--sp-2) 0; }
.prod-name { display: block; font-family: var(--font-prompt); color: var(--color-acento); font-weight: 500; }
.prod-add { width: 44px; height: 44px; font-size: 20px; padding: 0; }
.prods-empty { text-align: center; color: var(--color-texto-muted); padding: var(--sp-6) 0; }

@media (min-width: 601px) {
  .prod-list { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1025px) {
  .prod-list { grid-template-columns: repeat(3, 1fr); }
}
```

- [ ] **Step 7: Write `src/screens/Home/DetalleProducto.tsx`**

```tsx
import type { Product } from '../../api/types';
import './DetalleProducto.css';

export function DetalleProducto({ product, onClose, onAdd }: { product: Product; onClose: () => void; onAdd: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card card hoja" onClick={e => e.stopPropagation()}>
        <h3>{product.nombreproducto}</h3>
        {product.descripcion && <p className="modal-desc">{product.descripcion}</p>}
        {(product.atributo1 || product.atributo2) && (
          <p className="modal-attrs">Atributos: {[product.atributo1, product.atributo2].filter(Boolean).join(', ')}</p>
        )}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          <button className="btn btn-exito" onClick={onAdd}>Agregar al Quodom</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Write `src/screens/Home/DetalleProducto.css`**

```css
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; padding: var(--sp-4); z-index: 60; }
.modal-card { width: 100%; max-width: 480px; }
.modal-desc { color: var(--color-texto-muted); }
.modal-attrs { font-size: var(--fs-small); color: var(--color-texto-muted); margin-bottom: var(--sp-4); }
.modal-actions { display: flex; gap: var(--sp-3); justify-content: flex-end; }
```

- [ ] **Step 9: Wire routes — update `src/router/routes.tsx`**

Replace the corresponding `children` block so it looks like this (the auth routes at the top are unchanged):

```tsx
  {
    element: <Layout><Outlet /></Layout>,
    children: [
      { path: '/', element: <SitioInicial /> },
      { path: '/categoria/:id', element: <SubcategoriaLista /> },
      { path: '/subcategoria/:id', element: <ProductosPorCategoria /> },
      { path: '/busqueda', element: <Placeholder title="Buscar" /> },
      { path: '/quodom', element: <Placeholder title="Mi Quodom" /> },
      { path: '/mis-quodoms', element: <ProtectedRoute><Placeholder title="Mis Quodoms" /></ProtectedRoute> },
      { path: '/perfil', element: <ProtectedRoute><Placeholder title="Perfil" /></ProtectedRoute> },
      { path: '/direcciones', element: <ProtectedRoute><Placeholder title="Direcciones" /></ProtectedRoute> },
      { path: '/notificaciones', element: <ProtectedRoute><Placeholder title="Notificaciones" /></ProtectedRoute> }
    ]
  }
```

Add these imports at the top:

```tsx
import { SitioInicial } from '../screens/Home/SitioInicial';
import { SubcategoriaLista } from '../screens/Home/SubcategoriaLista';
import { ProductosPorCategoria } from '../screens/Home/ProductosPorCategoria';
```

- [ ] **Step 10: Verify in the browser**

Start API + frontend. Visit `/`:
- The 8 categorías raíz appear as cards. Click "Pintura" → `/categoria/5` opens subcategorías. Click "Latex" → `/subcategoria/35` opens products.
- Resize: mobile 2 cols, tablet 3 cols on subs, desktop 4–5 cols.
- Click a product to see the modal. Close it. Click "+" to add to the guest Quodom — check in DevTools that `localStorage['quodom.guest']` gained a line.

Stop the frontend.

- [ ] **Step 11: Typecheck and commit**

```bash
cd quodom-web/app && npm run typecheck
git add quodom-web/app/src/screens/Home quodom-web/app/src/router/routes.tsx
git commit -m "feat: add home category grid, subcategory list, product list and detail modal"
```

---

## Task 10: BarraQuodomInferior floating bar

**Files:**
- Create: `src/components/layout/BarraQuodomInferior.tsx` + `.css`
- Modify: `src/components/layout/Layout.tsx`

- [ ] **Step 1: Write `src/components/layout/BarraQuodomInferior.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { guestLineCount } from '../../guest/guestQuodom';
import './BarraQuodomInferior.css';

export function BarraQuodomInferior() {
  const [count, setCount] = useState<number>(() => guestLineCount());
  useEffect(() => {
    const onChanged = () => setCount(guestLineCount());
    window.addEventListener('quodom:changed', onChanged);
    window.addEventListener('storage', onChanged);
    return () => {
      window.removeEventListener('quodom:changed', onChanged);
      window.removeEventListener('storage', onChanged);
    };
  }, []);
  if (count === 0) return null;
  return (
    <Link to="/quodom" className="barra-quodom">
      <span className="barra-quodom-count">{count}</span>
      <span className="barra-quodom-label">Ver mi Quodom</span>
      <span className="barra-quodom-arrow">›</span>
    </Link>
  );
}
```

- [ ] **Step 2: Write `src/components/layout/BarraQuodomInferior.css`**

```css
.barra-quodom {
  position: fixed; left: 0; right: 0; bottom: 0;
  display: flex; align-items: center; gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  background: var(--color-acento); color: #fff;
  box-shadow: 0 -2px 8px rgba(0,0,0,.2);
  z-index: 25;
}
.barra-quodom-count {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; background: #fff; color: var(--color-acento); border-radius: 50%;
  font-weight: 700;
}
.barra-quodom-label { flex: 1; font-family: var(--font-prompt); font-weight: 500; }
.barra-quodom-arrow { font-size: 22px; }

@media (min-width: 1025px) {
  .barra-quodom { left: 260px; }
}
```

- [ ] **Step 3: Update `src/components/layout/Layout.tsx`** — replace the file:

```tsx
import { useState } from 'react';
import type { ReactNode } from 'react';
import { AppBar } from './AppBar';
import { Drawer } from './Drawer';
import { BarraQuodomInferior } from './BarraQuodomInferior';
import './Layout.css';

export function Layout({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <div className="layout">
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="layout-main">
        <AppBar onOpenDrawer={() => setDrawerOpen(true)} />
        <main>{children}</main>
        <BarraQuodomInferior />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify in the browser**

Start API + frontend. On `/` add a product via a subcategory. Expect the purple bar to appear at the bottom showing "1 · Ver mi Quodom · ›". Add another → count becomes 2. Refresh the page → the bar persists (localStorage). Clear `localStorage['quodom.guest']` from DevTools → the bar disappears on next event tick (or on reload).

Stop the frontend.

- [ ] **Step 5: Commit**

```bash
git add quodom-web/app/src/components/layout/BarraQuodomInferior.tsx quodom-web/app/src/components/layout/BarraQuodomInferior.css quodom-web/app/src/components/layout/Layout.tsx
git commit -m "feat: add persistent bottom bar showing guest quodom line count"
```

---

## Task 11: Búsqueda + historial (opcional para logueado)

**Files:**
- Create: `src/screens/Home/BusquedaScreen.tsx` + `.css`
- Modify: `src/router/routes.tsx`

- [ ] **Step 1: Write `src/screens/Home/BusquedaScreen.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { busqueda } from '../../api/busqueda';
import { historial } from '../../api/hist_busquedas';
import type { BusquedaResult } from '../../api/types';
import { ApiError } from '../../api/client';
import { addGuestLine } from '../../guest/guestQuodom';
import { useAuth } from '../../auth/AuthContext';
import { Loader } from '../../components/Loader';
import './BusquedaScreen.css';

export function BusquedaScreen() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<BusquedaResult[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hist, setHist] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    historial.list()
      .then(h => setHist(h.slice(0, 10).map(x => x.valor)))
      .catch(() => {});
  }, [user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term.length < 2) return;
    setErr(null); setBusy(true);
    try {
      const r = await busqueda.buscar(term);
      setResults(r);
      if (user) { historial.add(term).catch(() => {}); setHist(prev => [term, ...prev.filter(x => x !== term)].slice(0, 10)); }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Error de búsqueda.');
    } finally { setBusy(false); }
  }

  function agregar(r: BusquedaResult) {
    addGuestLine({ idproducto: r.id, nombreProducto: r.nombre, cantidad: 1 });
    window.dispatchEvent(new Event('quodom:changed'));
  }

  return (
    <section className="container busqueda">
      <h1>Buscar productos</h1>
      <form className="busqueda-form" onSubmit={onSubmit}>
        <input className="input" placeholder="Ej: pintura, latex, cemento…" value={q} onChange={e => setQ(e.target.value)} />
        <button className="btn" disabled={busy || q.trim().length < 2}>{busy ? 'Buscando…' : 'Buscar'}</button>
      </form>

      {err && <p className="auth-error">{err}</p>}
      {busy && <Loader />}

      {!busy && results && (
        results.length === 0
          ? <p className="busqueda-empty">Sin resultados para "{q}".</p>
          : (
            <ul className="busqueda-list">
              {results.map(r => (
                <li key={r.id} className="prod-item card hoja">
                  <span className="prod-name">{r.nombre}</span>
                  <button className="btn btn-exito prod-add" aria-label={'Agregar ' + r.nombre} onClick={() => agregar(r)}>+</button>
                </li>
              ))}
            </ul>
          )
      )}

      {user && hist.length > 0 && !results && (
        <>
          <h3 className="busqueda-hist-title">Búsquedas recientes</h3>
          <ul className="busqueda-hist">
            {hist.map(h => (
              <li key={h}><button className="btn btn-ghost" onClick={() => { setQ(h); }}>{h}</button></li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Write `src/screens/Home/BusquedaScreen.css`**

```css
.busqueda { padding: var(--sp-4) 0 var(--sp-7); }
.busqueda-form { display: flex; gap: var(--sp-3); margin-bottom: var(--sp-4); }
.busqueda-form .input { flex: 1; }
.busqueda-empty { text-align: center; color: var(--color-texto-muted); padding: var(--sp-6) 0; }
.busqueda-list { display: grid; gap: var(--sp-2); }
.busqueda-hist-title { margin-top: var(--sp-5); }
.busqueda-hist { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
```

- [ ] **Step 3: Wire the route in `src/router/routes.tsx`**

Change `{ path: '/busqueda', element: <Placeholder title="Buscar" /> }` to `{ path: '/busqueda', element: <BusquedaScreen /> }` and add:

```tsx
import { BusquedaScreen } from '../screens/Home/BusquedaScreen';
```

- [ ] **Step 4: Verify in the browser**

`/busqueda`, type `latex`, press Buscar. Expect a list of matches. Click `+` on one — the bottom bar increments. Log in as `demo`; the term appears under "Búsquedas recientes" next time you open `/busqueda`.

Stop the frontend.

- [ ] **Step 5: Commit**

```bash
cd quodom-web/app && npm run typecheck
git add quodom-web/app/src/screens/Home/BusquedaScreen.tsx quodom-web/app/src/screens/Home/BusquedaScreen.css quodom-web/app/src/router/routes.tsx
git commit -m "feat: add product search page with per-user recent history"
```

---

## Task 12: Detalle del Quodom (guest + logged) + WhatsApp export

**Files:**
- Create: `src/screens/Quodom/DetalleQuodom.tsx` + `.css`, `src/screens/Quodom/SelectorAtributo.tsx` + `.css`, `src/utils/whatsapp.ts`
- Modify: `src/router/routes.tsx`

Design: `/quodom` shows either the guest quodom (from `localStorage`, editable in place) or a specific backend quodom (`?id=<uuid>`, when opened from Mis Quodoms). "Enviar por WhatsApp" gates on login; if guest, redirects to `/login` and the migration on signin lands the user on the migrated `/quodom?id=<new>` ready to send.

- [ ] **Step 1: Write `src/utils/whatsapp.ts`**

```ts
export function openWhatsappLink(link: string): void {
  window.open(link, '_blank', 'noopener,noreferrer');
}
```

- [ ] **Step 2: Write `src/screens/Quodom/SelectorAtributo.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { quodomLines } from '../../api/quodom_lines';
import { Loader } from '../../components/Loader';
import './SelectorAtributo.css';

export function SelectorAtributo({
  idproducto, nombreatributo, valorActual, onSelect, onClose
}: {
  idproducto: number;
  nombreatributo: string;
  valorActual: string | null | undefined;
  onSelect: (valor: string) => void;
  onClose: () => void;
}) {
  const [opts, setOpts] = useState<string[] | null>(null);
  useEffect(() => {
    quodomLines.atributos(idproducto, nombreatributo)
      .then(list => setOpts(list.map(o => o.valoratributo)))
      .catch(() => setOpts([]));
  }, [idproducto, nombreatributo]);
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card card hoja" onClick={e => e.stopPropagation()}>
        <h3>{nombreatributo}</h3>
        {!opts && <Loader />}
        {opts && opts.length === 0 && <p>No hay valores disponibles.</p>}
        {opts && opts.length > 0 && (
          <ul className="attr-options">
            {opts.map(o => (
              <li key={o}>
                <button className={'btn ' + (o === valorActual ? '' : 'btn-ghost') + ' btn-block'} onClick={() => onSelect(o)}>{o}</button>
              </li>
            ))}
          </ul>
        )}
        <button className="btn btn-ghost btn-block" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `src/screens/Quodom/SelectorAtributo.css`**

```css
.attr-options { display: grid; gap: var(--sp-2); margin-bottom: var(--sp-4); }
```

- [ ] **Step 4: Write `src/screens/Quodom/DetalleQuodom.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import {
  clearGuestQuodom, getGuestQuodom, removeGuestLine, setGuestDescripcion,
  updateGuestLineAtributos, updateGuestLineCantidad
} from '../../guest/guestQuodom';
import { quodom as quodomApi } from '../../api/quodom';
import { quodomLines as linesApi } from '../../api/quodom_lines';
import type { Quodom, QuodomLine } from '../../api/types';
import { ApiError } from '../../api/client';
import { AppBarBack } from '../../components/layout/AppBarBack';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { SelectorAtributo } from './SelectorAtributo';
import { openWhatsappLink } from '../../utils/whatsapp';
import { migrateGuestQuodom } from '../../guest/migrateGuestQuodom';
import './DetalleQuodom.css';

type Mode = 'guest' | 'server';

export function DetalleQuodom() {
  const [sp] = useSearchParams();
  const id = sp.get('id');
  const { user } = useAuth();
  const navigate = useNavigate();
  const mode: Mode = id ? 'server' : 'guest';

  const [descripcion, setDescripcion] = useState<string>('');
  const [server, setServer] = useState<{ quodom: Quodom; lines: QuodomLine[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attr, setAttr] = useState<{ lineIndex?: number; lineId?: number; idproducto: number; nombreatributo: string; slot: 1 | 2; actual: string | null | undefined } | null>(null);
  const [nonce, setNonce] = useState(0);

  const guest = useMemo(() => getGuestQuodom(), [nonce]);

  useEffect(() => {
    if (mode === 'guest') { setDescripcion(guest.descripcion); return; }
    let alive = true;
    setServer(null); setErr(null);
    Promise.all([quodomApi.porId(id!), linesApi.porQuodom(id!)])
      .then(([q, lines]) => {
        if (!alive) return;
        setServer({ quodom: q, lines });
        setDescripcion(q.descripcion);
      })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error al cargar el Quodom.'); });
    return () => { alive = false; };
  }, [mode, id, nonce, guest.descripcion]);

  const saveDescripcion = useCallback(async (value: string) => {
    if (mode === 'guest') { setGuestDescripcion(value); }
    else if (server) { try { await quodomApi.update(server.quodom.id, { descripcion: value.trim() || 'Mi Quodom' }); } catch {} }
  }, [mode, server]);

  async function cambiarCantidadServer(line: QuodomLine, cantidad: number) {
    try {
      if (cantidad <= 0) await linesApi.eliminar(line.id);
      else await linesApi.update(line.id, { cantidad });
      setNonce(n => n + 1);
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'No se pudo actualizar la cantidad.'); }
  }
  async function cambiarAtributoServer(line: QuodomLine, slot: 1 | 2, valor: string) {
    try {
      await linesApi.update(line.id, slot === 1 ? { atributo1: valor } : { atributo2: valor });
      setNonce(n => n + 1);
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'No se pudo actualizar el atributo.'); }
  }

  async function enviarWhatsapp() {
    if (mode === 'guest') {
      if (!user) { navigate('/login', { state: { from: '/quodom' } }); return; }
      setBusy(true);
      try {
        const newId = await migrateGuestQuodom();
        if (!newId) { setErr('No hay productos en el Quodom.'); return; }
        const r = await quodomApi.whatsapp(newId);
        openWhatsappLink(r.link);
        clearGuestQuodom();
        navigate('/mis-quodoms', { replace: true });
      } catch (e) { setErr(e instanceof ApiError ? e.message : 'No se pudo enviar.'); }
      finally { setBusy(false); }
      return;
    }
    if (!server) return;
    setBusy(true);
    try {
      const r = await quodomApi.whatsapp(server.quodom.id);
      openWhatsappLink(r.link);
      setNonce(n => n + 1);
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'No se pudo enviar.'); }
    finally { setBusy(false); }
  }

  const lines = mode === 'guest'
    ? guest.lines.map((l, idx) => ({
        key: 'g-' + idx, cantidad: l.cantidad, nombreProducto: l.nombreProducto,
        atributo1: l.atributo1, atributo2: l.atributo2,
        nombreAtributo1: l.nombreAtributo1, nombreAtributo2: l.nombreAtributo2,
        idproducto: l.idproducto,
        onCantidad: (c: number) => { updateGuestLineCantidad(idx, c); setNonce(n => n + 1); },
        onRemove: () => { removeGuestLine(idx); setNonce(n => n + 1); },
        onAttr: (slot: 1 | 2, valor: string) => { updateGuestLineAtributos(idx, slot === 1 ? { atributo1: valor } : { atributo2: valor }); setNonce(n => n + 1); }
      }))
    : (server?.lines ?? []).map(l => ({
        key: 's-' + l.id, cantidad: l.cantidad, nombreProducto: l.nombreProducto,
        atributo1: l.atributo1, atributo2: l.atributo2,
        nombreAtributo1: l.nombreAtributo1, nombreAtributo2: l.nombreAtributo2,
        idproducto: l.idproducto,
        onCantidad: (c: number) => cambiarCantidadServer(l, c),
        onRemove: () => cambiarCantidadServer(l, 0),
        onAttr: (slot: 1 | 2, valor: string) => cambiarAtributoServer(l, slot, valor)
      }));

  const enviarDisabled = busy || lines.length === 0 || (mode === 'server' && server?.quodom.estado === 'ENVIADO');

  return (
    <>
      <AppBarBack title={mode === 'server' ? (server?.quodom.nro ?? 'Quodom') : 'Mi Quodom'} />
      <section className="container detalle-quodom">
        {err && <ErrorState message={err} onRetry={() => setNonce(n => n + 1)} />}
        {mode === 'server' && !server && !err && <Loader />}

        <label className="field"><span>Descripción</span>
          <input className="input" value={descripcion} onChange={e => setDescripcion(e.target.value)} onBlur={() => saveDescripcion(descripcion)} />
        </label>

        {lines.length === 0 && <p className="dq-empty">Tu Quodom está vacío. Sumá productos desde Inicio o Buscar.</p>}

        <ul className="dq-lines">
          {lines.map(l => (
            <li key={l.key} className="dq-line card hoja">
              <div className="dq-line-head">
                <span className="dq-line-name">{l.nombreProducto}</span>
                <button className="dq-line-remove" aria-label="Quitar" onClick={l.onRemove}>×</button>
              </div>
              <div className="dq-line-qty">
                <button className="btn btn-ghost dq-qty-btn" onClick={() => l.onCantidad(Math.max(0, l.cantidad - 1))} aria-label="Restar">−</button>
                <input className="input dq-qty-input" type="number" min={1} value={l.cantidad} onChange={e => l.onCantidad(Math.max(1, Number(e.target.value) || 1))} />
                <button className="btn btn-ghost dq-qty-btn" onClick={() => l.onCantidad(l.cantidad + 1)} aria-label="Sumar">+</button>
              </div>
              {l.nombreAtributo1 && (
                <button className="dq-attr" onClick={() => setAttr({ lineIndex: mode === 'guest' ? Number(l.key.slice(2)) : undefined, lineId: mode === 'server' ? Number(l.key.slice(2)) : undefined, idproducto: l.idproducto, nombreatributo: l.nombreAtributo1!, slot: 1, actual: l.atributo1 })}>
                  <span>{l.nombreAtributo1}:</span> <strong>{l.atributo1 ?? 'Elegir'}</strong>
                </button>
              )}
              {l.nombreAtributo2 && (
                <button className="dq-attr" onClick={() => setAttr({ lineIndex: mode === 'guest' ? Number(l.key.slice(2)) : undefined, lineId: mode === 'server' ? Number(l.key.slice(2)) : undefined, idproducto: l.idproducto, nombreatributo: l.nombreAtributo2!, slot: 2, actual: l.atributo2 })}>
                  <span>{l.nombreAtributo2}:</span> <strong>{l.atributo2 ?? 'Elegir'}</strong>
                </button>
              )}
            </li>
          ))}
        </ul>

        <button className="btn btn-exito btn-block dq-send" disabled={enviarDisabled} onClick={enviarWhatsapp}>
          {busy ? 'Enviando…' : (mode === 'server' && server?.quodom.estado === 'ENVIADO' ? 'Ya enviado' : 'Enviar por WhatsApp')}
        </button>

        {attr && (
          <SelectorAtributo
            idproducto={attr.idproducto}
            nombreatributo={attr.nombreatributo}
            valorActual={attr.actual}
            onClose={() => setAttr(null)}
            onSelect={valor => {
              const l = lines.find(x => (mode === 'guest' ? Number(x.key.slice(2)) === attr.lineIndex : Number(x.key.slice(2)) === attr.lineId));
              l?.onAttr(attr.slot, valor);
              setAttr(null);
            }}
          />
        )}
      </section>
    </>
  );
}
```

- [ ] **Step 5: Write `src/screens/Quodom/DetalleQuodom.css`**

```css
.detalle-quodom { padding: var(--sp-4) 0 calc(var(--sp-7) + 60px); }
.dq-empty { text-align: center; color: var(--color-texto-muted); padding: var(--sp-6) 0; }
.dq-lines { display: grid; gap: var(--sp-3); margin-bottom: var(--sp-4); }
.dq-line { display: grid; gap: var(--sp-2); }
.dq-line-head { display: flex; align-items: center; gap: var(--sp-3); }
.dq-line-name { flex: 1; font-family: var(--font-prompt); font-weight: 500; color: var(--color-acento); }
.dq-line-remove { width: 32px; height: 32px; color: var(--color-texto-muted); font-size: 24px; }
.dq-line-qty { display: flex; align-items: center; gap: var(--sp-2); }
.dq-qty-btn { width: 40px; height: 40px; padding: 0; }
.dq-qty-input { width: 72px; text-align: center; }
.dq-attr { display: block; text-align: left; padding: var(--sp-2) var(--sp-3); background: rgba(112,111,154,.08); border-radius: var(--radius-input); color: var(--color-acento); }
.dq-attr strong { color: var(--color-texto); }
.dq-send { margin-top: var(--sp-4); }
```

- [ ] **Step 6: Wire the route in `src/router/routes.tsx`**

Change `{ path: '/quodom', element: <Placeholder title="Mi Quodom" /> }` to `{ path: '/quodom', element: <DetalleQuodom /> }` and add the import at the top:

```tsx
import { DetalleQuodom } from '../screens/Quodom/DetalleQuodom';
```

- [ ] **Step 7: Verify in the browser**

Start API + frontend. As guest:
- Add 2 products from a subcategory, click the bottom bar → `/quodom`. Change quantities and pick an attribute; verify the changes persist across reloads.
- Click "Enviar por WhatsApp" — redirects to `/login`. Sign in as `demo` — you land on the newly-migrated `/quodom?id=<uuid>` and WhatsApp opens automatically in a new tab. The `localStorage.quodom.guest` is cleared.

Log in as `demo`, open `/mis-quodoms` (placeholder) then manually visit `/quodom?id=<existing uuid>` (copy from `db.Quodom.findAll()` via API GET /quodom/misQuodom/). Verify edits round-trip to the backend.

- [ ] **Step 8: Typecheck and commit**

```bash
cd quodom-web/app && npm run typecheck
git add quodom-web/app/src/screens/Quodom quodom-web/app/src/utils/whatsapp.ts quodom-web/app/src/router/routes.tsx
git commit -m "feat: add quodom detail with attribute picker and whatsapp export"
```

---

## Task 13: Mis Quodoms

**Files:**
- Create: `src/screens/MisQuodoms/ListaMisQuodoms.tsx` + `.css`
- Modify: `src/router/routes.tsx`

- [ ] **Step 1: Write `src/screens/MisQuodoms/ListaMisQuodoms.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { quodom as quodomApi } from '../../api/quodom';
import type { Quodom } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import './ListaMisQuodoms.css';

export function ListaMisQuodoms() {
  const navigate = useNavigate();
  const [list, setList] = useState<Quodom[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setList(null); setErr(null);
    quodomApi.misQuodom()
      .then(d => { if (alive) setList(d); })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error.'); });
    return () => { alive = false; };
  }, [nonce]);

  async function crearNuevo() {
    try {
      const r = await quodomApi.create({ descripcion: 'Mi Quodom' });
      navigate('/quodom?id=' + encodeURIComponent(r.idquodom));
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'No se pudo crear.'); }
  }

  return (
    <section className="container mq">
      <div className="mq-header">
        <h1>Mis Quodoms</h1>
        <button className="btn" onClick={crearNuevo}>Nuevo</button>
      </div>
      {err && <ErrorState message={err} onRetry={() => setNonce(n => n + 1)} />}
      {!err && !list && <Loader />}
      {list && list.length === 0 && (
        <EmptyState title="Todavía no tenés Quodoms" description="Armá uno desde el catálogo o creá uno vacío." />
      )}
      {list && list.length > 0 && (
        <ul className="mq-list">
          {list.map(q => (
            <li key={q.id} className="mq-item card hoja">
              <Link to={'/quodom?id=' + encodeURIComponent(q.id)} className="mq-link">
                <div className="mq-nro">{q.nro}</div>
                <div className="mq-body">
                  <div className="mq-desc">{q.descripcion}</div>
                  <div className="mq-meta">
                    <span className={'mq-estado mq-estado-' + q.estado.toLowerCase()}>{q.estado}</span>
                    <span>{q.cantproductos ?? 0} productos</span>
                    <span>{q.porccompletado ?? 0}% completo</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Write `src/screens/MisQuodoms/ListaMisQuodoms.css`**

```css
.mq { padding: var(--sp-4) 0 var(--sp-7); }
.mq-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-3); }
.mq-list { display: grid; gap: var(--sp-3); }
.mq-link { display: flex; gap: var(--sp-3); padding: var(--sp-3); }
.mq-nro { min-width: 72px; font-family: var(--font-prompt); font-weight: 600; color: var(--color-acento); font-size: 20px; }
.mq-body { flex: 1; }
.mq-desc { font-weight: 500; color: var(--color-texto); }
.mq-meta { display: flex; gap: var(--sp-3); font-size: var(--fs-small); color: var(--color-texto-muted); margin-top: var(--sp-1); flex-wrap: wrap; }
.mq-estado { padding: 2px 8px; border-radius: 999px; font-weight: 500; font-size: var(--fs-tiny); }
.mq-estado-creado { background: rgba(112,111,154,.15); color: var(--color-acento); }
.mq-estado-enviado { background: rgba(45,171,102,.15); color: var(--color-exito); }
```

- [ ] **Step 3: Wire the route in `src/router/routes.tsx`**

Change the `/mis-quodoms` line to:

```tsx
{ path: '/mis-quodoms', element: <ProtectedRoute><ListaMisQuodoms /></ProtectedRoute> },
```

And add the import:

```tsx
import { ListaMisQuodoms } from '../screens/MisQuodoms/ListaMisQuodoms';
```

- [ ] **Step 4: Verify in the browser**

Log in as `demo`. Visit `/mis-quodoms`. Expect the list of your quodoms (from the manual test earlier). Click one — opens `/quodom?id=<uuid>` in edit mode. Click "Nuevo" — creates a fresh empty quodom and opens it.

- [ ] **Step 5: Typecheck and commit**

```bash
cd quodom-web/app && npm run typecheck
git add quodom-web/app/src/screens/MisQuodoms quodom-web/app/src/router/routes.tsx
git commit -m "feat: add mis quodoms list with estado/percentage and quick create"
```

---

## Task 14: Direcciones (list, agregar, modificar, provincias/localidades)

**Files:**
- Create: `src/screens/Direcciones/ListaDirecciones.tsx` + `.css`, `AgregarDireccion.tsx` + `.css`, `ModificarDireccion.tsx` + `.css`
- Modify: `src/router/routes.tsx`

- [ ] **Step 1: Write `src/screens/Direcciones/ListaDirecciones.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { users } from '../../api/users';
import { userDirecciones } from '../../api/user_direcciones';
import type { Direccion } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import './ListaDirecciones.css';

export function ListaDirecciones() {
  const [list, setList] = useState<Direccion[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setList(null); setErr(null);
    users.getDirecciones()
      .then(d => { if (alive) setList(d); })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error.'); });
    return () => { alive = false; };
  }, [nonce]);

  async function marcarDefault(id: number) {
    try { await userDirecciones.setPrincipal(id); setNonce(n => n + 1); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Error.'); }
  }
  async function eliminar(id: number) {
    if (!confirm('¿Eliminar esta dirección?')) return;
    try { await userDirecciones.eliminar(id); setNonce(n => n + 1); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Error.'); }
  }

  return (
    <section className="container dirs">
      <div className="dirs-header">
        <h1>Direcciones</h1>
        <Link to="/direcciones/nuevo" className="btn">Agregar</Link>
      </div>
      {err && <ErrorState message={err} onRetry={() => setNonce(n => n + 1)} />}
      {!err && !list && <Loader />}
      {list && list.length === 0 && (
        <EmptyState title="No tenés direcciones cargadas" description="Cargá una para incluirla en el mensaje de WhatsApp." action={<Link to="/direcciones/nuevo" className="btn">Agregar dirección</Link>} />
      )}
      {list && list.length > 0 && (
        <ul className="dirs-list">
          {list.map(d => (
            <li key={d.id} className="dirs-item card hoja">
              <div className="dirs-info">
                <div className="dirs-alias">{d.alias || d.calle}</div>
                <div className="dirs-line">{d.calle} {d.numero}{d.piso ? ' · ' + d.piso : ''}</div>
                <div className="dirs-line dirs-muted">{d.localidad}, {d.provincia} {d.cp && '(' + d.cp + ')'}</div>
              </div>
              <div className="dirs-actions">
                {(d.default ? true : false)
                  ? <span className="dirs-badge">Principal</span>
                  : <button className="btn btn-ghost" onClick={() => marcarDefault(d.id)}>Hacer principal</button>}
                <Link to={'/direcciones/' + d.id} className="btn btn-ghost">Editar</Link>
                <button className="btn btn-ghost" onClick={() => eliminar(d.id)}>Eliminar</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Write `src/screens/Direcciones/ListaDirecciones.css`**

```css
.dirs { padding: var(--sp-4) 0 var(--sp-7); }
.dirs-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-3); }
.dirs-list { display: grid; gap: var(--sp-3); }
.dirs-item { display: grid; gap: var(--sp-3); }
.dirs-alias { font-family: var(--font-prompt); font-weight: 500; color: var(--color-acento); font-size: 18px; }
.dirs-line { color: var(--color-texto); }
.dirs-muted { color: var(--color-texto-muted); font-size: var(--fs-small); }
.dirs-actions { display: flex; gap: var(--sp-2); flex-wrap: wrap; align-items: center; }
.dirs-badge { background: rgba(45,171,102,.15); color: var(--color-exito); padding: 4px 10px; border-radius: 999px; font-size: var(--fs-tiny); font-weight: 500; }

@media (min-width: 601px) { .dirs-item { grid-template-columns: 1fr auto; align-items: center; } }
```

- [ ] **Step 3: Write `src/screens/Direcciones/AgregarDireccion.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { provincias } from '../../api/provincias';
import { localidades } from '../../api/localidades';
import { userDirecciones, DireccionInput } from '../../api/user_direcciones';
import type { Provincia, Localidad } from '../../api/types';
import { ApiError } from '../../api/client';
import { AppBarBack } from '../../components/layout/AppBarBack';
import './AgregarDireccion.css';

export function AgregarDireccion() {
  const navigate = useNavigate();
  const [provs, setProvs] = useState<Provincia[]>([]);
  const [locs, setLocs] = useState<Localidad[]>([]);
  const [f, setF] = useState<DireccionInput>({ default: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { provincias.list().then(setProvs).catch(() => {}); }, []);
  useEffect(() => {
    if (!f.idprovincia) { setLocs([]); return; }
    localidades.porProvincia(f.idprovincia).then(setLocs).catch(() => setLocs([]));
  }, [f.idprovincia]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await userDirecciones.create(f);
      navigate('/direcciones', { replace: true });
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  const set = <K extends keyof DireccionInput>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const raw = e.target.value;
    const v: DireccionInput[K] = (k === 'idprovincia') ? (raw ? Number(raw) : undefined) as any : (raw as any);
    setF({ ...f, [k]: v });
  };

  return (
    <>
      <AppBarBack title="Nueva dirección" />
      <section className="container dir-form">
        <form onSubmit={onSubmit}>
          <label className="field"><span>Alias (ej: casa, obra)</span><input className="input" value={f.alias ?? ''} onChange={set('alias')} /></label>
          <div className="grid-2">
            <label className="field"><span>Calle</span><input className="input" value={f.calle ?? ''} onChange={set('calle')} required /></label>
            <label className="field"><span>Número</span><input className="input" value={f.numero ?? ''} onChange={set('numero')} required /></label>
          </div>
          <label className="field"><span>Piso / Depto</span><input className="input" value={f.piso ?? ''} onChange={set('piso')} /></label>
          <label className="field"><span>Provincia</span>
            <select className="input" value={f.idprovincia ?? ''} onChange={set('idprovincia')} required>
              <option value="">Elegí provincia</option>
              {provs.map(p => <option key={p.id} value={p.id}>{p.provincia}</option>)}
            </select>
          </label>
          <label className="field"><span>Localidad</span>
            <input list="locs" className="input" value={f.localidad ?? ''} onChange={set('localidad')} required />
            <datalist id="locs">
              {locs.map(l => <option key={l.id} value={l.localidad} />)}
            </datalist>
          </label>
          <label className="field"><span>CP</span><input className="input" value={f.cp ?? ''} onChange={set('cp')} /></label>
          <label className="field"><span>Observaciones</span><input className="input" value={f.observaciones ?? ''} onChange={set('observaciones')} /></label>
          <label className="check"><input type="checkbox" checked={!!f.default} onChange={e => setF({ ...f, default: e.target.checked })} /> Usar como dirección principal</label>
          {err && <p className="auth-error">{err}</p>}
          <button className="btn btn-block" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </form>
      </section>
    </>
  );
}
```

- [ ] **Step 4: Write `src/screens/Direcciones/AgregarDireccion.css`**

```css
.dir-form { padding: var(--sp-4) 0 var(--sp-7); }
.dir-form .grid-2 { display: grid; grid-template-columns: 2fr 1fr; gap: var(--sp-3); }
.dir-form .check { display: flex; align-items: center; gap: var(--sp-2); margin: var(--sp-3) 0; }
```

- [ ] **Step 5: Write `src/screens/Direcciones/ModificarDireccion.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { provincias } from '../../api/provincias';
import { localidades } from '../../api/localidades';
import { userDirecciones, DireccionInput } from '../../api/user_direcciones';
import type { Provincia, Localidad } from '../../api/types';
import { ApiError } from '../../api/client';
import { AppBarBack } from '../../components/layout/AppBarBack';
import { Loader } from '../../components/Loader';
import './AgregarDireccion.css';

export function ModificarDireccion() {
  const { id = '' } = useParams();
  const idNum = Number(id);
  const navigate = useNavigate();
  const [provs, setProvs] = useState<Provincia[]>([]);
  const [locs, setLocs] = useState<Localidad[]>([]);
  const [f, setF] = useState<DireccionInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([provincias.list(), userDirecciones.porId(idNum)])
      .then(([ps, d]) => {
        setProvs(ps);
        setF({
          alias: d.alias ?? '', calle: d.calle ?? '', numero: d.numero ?? '', piso: d.piso ?? '',
          cp: d.cp ?? '', localidad: d.localidad ?? '', observaciones: d.observaciones ?? '',
          idprovincia: d.idprovincia ? Number(d.idprovincia) : undefined,
          default: !!d.default
        });
      })
      .catch(e => setErr(e instanceof ApiError ? e.message : 'Error.'));
  }, [idNum]);

  useEffect(() => {
    if (!f?.idprovincia) { setLocs([]); return; }
    localidades.porProvincia(f.idprovincia).then(setLocs).catch(() => setLocs([]));
  }, [f?.idprovincia]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!f) return;
    setErr(null); setBusy(true);
    try { await userDirecciones.update(idNum, f); navigate('/direcciones', { replace: true }); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  const set = <K extends keyof DireccionInput>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!f) return;
    const raw = e.target.value;
    const v: DireccionInput[K] = (k === 'idprovincia') ? (raw ? Number(raw) : undefined) as any : (raw as any);
    setF({ ...f, [k]: v });
  };

  return (
    <>
      <AppBarBack title="Editar dirección" />
      <section className="container dir-form">
        {!f && !err && <Loader />}
        {err && <p className="auth-error">{err}</p>}
        {f && (
          <form onSubmit={onSubmit}>
            <label className="field"><span>Alias</span><input className="input" value={f.alias ?? ''} onChange={set('alias')} /></label>
            <div className="grid-2">
              <label className="field"><span>Calle</span><input className="input" value={f.calle ?? ''} onChange={set('calle')} required /></label>
              <label className="field"><span>Número</span><input className="input" value={f.numero ?? ''} onChange={set('numero')} required /></label>
            </div>
            <label className="field"><span>Piso / Depto</span><input className="input" value={f.piso ?? ''} onChange={set('piso')} /></label>
            <label className="field"><span>Provincia</span>
              <select className="input" value={f.idprovincia ?? ''} onChange={set('idprovincia')} required>
                <option value="">Elegí provincia</option>
                {provs.map(p => <option key={p.id} value={p.id}>{p.provincia}</option>)}
              </select>
            </label>
            <label className="field"><span>Localidad</span>
              <input list="locs" className="input" value={f.localidad ?? ''} onChange={set('localidad')} required />
              <datalist id="locs">{locs.map(l => <option key={l.id} value={l.localidad} />)}</datalist>
            </label>
            <label className="field"><span>CP</span><input className="input" value={f.cp ?? ''} onChange={set('cp')} /></label>
            <label className="field"><span>Observaciones</span><input className="input" value={f.observaciones ?? ''} onChange={set('observaciones')} /></label>
            <label className="check"><input type="checkbox" checked={!!f.default} onChange={e => setF({ ...f, default: e.target.checked })} /> Usar como dirección principal</label>
            <button className="btn btn-block" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </form>
        )}
      </section>
    </>
  );
}
```

- [ ] **Step 6: Wire routes — `src/router/routes.tsx`**

Replace the `/direcciones` line and add two more:

```tsx
{ path: '/direcciones', element: <ProtectedRoute><ListaDirecciones /></ProtectedRoute> },
{ path: '/direcciones/nuevo', element: <ProtectedRoute><AgregarDireccion /></ProtectedRoute> },
{ path: '/direcciones/:id', element: <ProtectedRoute><ModificarDireccion /></ProtectedRoute> },
```

Add imports at the top:

```tsx
import { ListaDirecciones } from '../screens/Direcciones/ListaDirecciones';
import { AgregarDireccion } from '../screens/Direcciones/AgregarDireccion';
import { ModificarDireccion } from '../screens/Direcciones/ModificarDireccion';
```

- [ ] **Step 7: Verify in the browser**

Log in as `demo`. Visit `/direcciones`. Add a new address (Provincia = Buenos Aires; type any localidad). Confirm it appears in the list. Mark it as principal — badge switches. Edit and change alias — reflected in the list. Delete — disappears.

Verify the WhatsApp message includes the direction: create a new quodom with a line, send WhatsApp — the mensaje decoded should have the "Dirección:" line.

- [ ] **Step 8: Typecheck and commit**

```bash
cd quodom-web/app && npm run typecheck
git add quodom-web/app/src/screens/Direcciones quodom-web/app/src/router/routes.tsx
git commit -m "feat: add direcciones abm with province and localidad pickers"
```

---

## Task 15: Perfil (data + cambiar contraseña)

**Files:**
- Create: `src/screens/Profile/ProfileScreen.tsx` + `.css`, `DetalleUsuario.tsx` + `.css`, `CambiarPass.tsx` + `.css`
- Modify: `src/router/routes.tsx`

- [ ] **Step 1: Write `src/screens/Profile/ProfileScreen.tsx`**

```tsx
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { AppBarBack } from '../../components/layout/AppBarBack';
import './ProfileScreen.css';

export function ProfileScreen() {
  const { user, signout } = useAuth();
  return (
    <>
      <AppBarBack title="Perfil" />
      <section className="container profile">
        <div className="profile-head card hoja">
          <div className="profile-name">{user?.nombre} {user?.apellido}</div>
          <div className="profile-email">{user?.email}</div>
          <div className="profile-username">@{user?.username}</div>
        </div>
        <ul className="profile-menu">
          <li><Link to="/perfil/datos" className="card hoja profile-link">Mis datos</Link></li>
          <li><Link to="/perfil/cambiar-pass" className="card hoja profile-link">Cambiar contraseña</Link></li>
          <li><Link to="/direcciones" className="card hoja profile-link">Mis direcciones</Link></li>
          <li><button className="card hoja profile-link profile-danger" onClick={signout}>Cerrar sesión</button></li>
        </ul>
      </section>
    </>
  );
}
```

- [ ] **Step 2: Write `src/screens/Profile/ProfileScreen.css`**

```css
.profile { padding: var(--sp-4) 0 var(--sp-7); }
.profile-head { text-align: center; margin-bottom: var(--sp-4); }
.profile-name { font-family: var(--font-prompt); font-weight: 600; font-size: 20px; color: var(--color-acento); }
.profile-email { color: var(--color-texto-muted); }
.profile-username { color: var(--color-texto-muted); font-size: var(--fs-small); }
.profile-menu { display: grid; gap: var(--sp-3); }
.profile-link { display: block; text-align: left; padding: var(--sp-3) var(--sp-4); color: var(--color-texto); font-weight: 500; width: 100%; }
.profile-danger { color: var(--color-error); }
```

- [ ] **Step 3: Write `src/screens/Profile/DetalleUsuario.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { users } from '../../api/users';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import { AppBarBack } from '../../components/layout/AppBarBack';
import './DetalleUsuario.css';

export function DetalleUsuario() {
  const { user, refresh } = useAuth();
  const [f, setF] = useState({ username: '', email: '', nombre: '', apellido: '', dni: '', codArea: '', telefono: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (!user) return;
    setF({
      username: user.username ?? '', email: user.email ?? '',
      nombre: user.nombre ?? '', apellido: user.apellido ?? '',
      dni: user.dni ?? '', codArea: user.codArea ?? '', telefono: user.telefono ?? ''
    });
  }, [user]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setBusy(true);
    try {
      const r = await users.update(f);
      await refresh();
      setMsg({ ok: !!r.res, text: r.message });
    } catch (e) { setMsg({ ok: false, text: e instanceof ApiError ? e.message : 'Error.' }); }
    finally { setBusy(false); }
  }
  return (
    <>
      <AppBarBack title="Mis datos" />
      <section className="container detalle-usuario">
        <form onSubmit={onSubmit}>
          <label className="field"><span>Nombre</span><input className="input" value={f.nombre} onChange={set('nombre')} required /></label>
          <label className="field"><span>Apellido</span><input className="input" value={f.apellido} onChange={set('apellido')} /></label>
          <label className="field"><span>DNI</span><input className="input" value={f.dni} onChange={set('dni')} /></label>
          <label className="field"><span>Email</span><input className="input" type="email" value={f.email} onChange={set('email')} required /></label>
          <label className="field"><span>Usuario</span><input className="input" value={f.username} onChange={set('username')} required /></label>
          <div className="grid-2">
            <label className="field"><span>Cód. área</span><input className="input" value={f.codArea} onChange={set('codArea')} /></label>
            <label className="field"><span>Teléfono</span><input className="input" value={f.telefono} onChange={set('telefono')} /></label>
          </div>
          {msg && <p className={msg.ok ? '' : 'auth-error'}>{msg.text}</p>}
          <button className="btn btn-block" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </form>
      </section>
    </>
  );
}
```

- [ ] **Step 4: Write `src/screens/Profile/DetalleUsuario.css`**

```css
.detalle-usuario { padding: var(--sp-4) 0 var(--sp-7); }
.detalle-usuario .grid-2 { display: grid; grid-template-columns: 1fr 2fr; gap: var(--sp-3); }
```

- [ ] **Step 5: Write `src/screens/Profile/CambiarPass.tsx`**

```tsx
import { useState } from 'react';
import { users } from '../../api/users';
import { ApiError } from '../../api/client';
import { AppBarBack } from '../../components/layout/AppBarBack';
import { minLen } from '../../utils/validation';
import './CambiarPass.css';

export function CambiarPass() {
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const valid = minLen(pw, 6) && pw === pw2;
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setBusy(true);
    try { const r = await users.update({ password: pw }); setMsg({ ok: !!r.res, text: r.message }); if (r.res) { setPw(''); setPw2(''); } }
    catch (e) { setMsg({ ok: false, text: e instanceof ApiError ? e.message : 'Error.' }); }
    finally { setBusy(false); }
  }
  return (
    <>
      <AppBarBack title="Cambiar contraseña" />
      <section className="container cambiar-pass">
        <form onSubmit={onSubmit}>
          <label className="field"><span>Contraseña nueva (mín. 6)</span><input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} required /></label>
          <label className="field"><span>Repetir</span><input className="input" type="password" value={pw2} onChange={e => setPw2(e.target.value)} required /></label>
          {!valid && pw2.length > 0 && pw !== pw2 && <p className="auth-error">Las contraseñas no coinciden.</p>}
          {msg && <p className={msg.ok ? '' : 'auth-error'}>{msg.text}</p>}
          <button className="btn btn-block" disabled={busy || !valid}>{busy ? 'Guardando…' : 'Cambiar'}</button>
        </form>
      </section>
    </>
  );
}
```

- [ ] **Step 6: Write `src/screens/Profile/CambiarPass.css`**

```css
.cambiar-pass { padding: var(--sp-4) 0 var(--sp-7); max-width: 480px; margin: 0 auto; }
```

- [ ] **Step 7: Wire the routes in `src/router/routes.tsx`**

Change the `/perfil` line and add two:

```tsx
{ path: '/perfil', element: <ProtectedRoute><ProfileScreen /></ProtectedRoute> },
{ path: '/perfil/datos', element: <ProtectedRoute><DetalleUsuario /></ProtectedRoute> },
{ path: '/perfil/cambiar-pass', element: <ProtectedRoute><CambiarPass /></ProtectedRoute> },
```

Add imports:

```tsx
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import { DetalleUsuario } from '../screens/Profile/DetalleUsuario';
import { CambiarPass } from '../screens/Profile/CambiarPass';
```

- [ ] **Step 8: Verify in the browser**

Log in as `demo`. Visit `/perfil`. Click "Mis datos", change nombre and save; refresh and confirm it persisted. Click "Cambiar contraseña", set `newpassword`; sign out, sign in with the new password (then reset to `secreto123` for later tests).

- [ ] **Step 9: Typecheck and commit**

```bash
cd quodom-web/app && npm run typecheck
git add quodom-web/app/src/screens/Profile quodom-web/app/src/router/routes.tsx
git commit -m "feat: add profile hub, edit datos and cambiar contraseña screens"
```

---

## Task 16: Notificaciones (campanita + página completa)

**Files:**
- Create: `src/components/Notificaciones/CampanitaNotificaciones.tsx` + `.css`, `PanelNotificaciones.tsx` + `.css`, `src/screens/Notificaciones/ListaNotificaciones.tsx` + `.css`
- Modify: `src/components/layout/AppBar.tsx`, `src/router/routes.tsx`

- [ ] **Step 1: Write `src/components/Notificaciones/CampanitaNotificaciones.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { notificaciones } from '../../api/oper_notificaciones';
import './CampanitaNotificaciones.css';

export function CampanitaNotificaciones() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!user) { setCount(0); return; }
    let alive = true;
    const load = () => notificaciones.count().then(c => { if (alive) setCount(c); }).catch(() => {});
    load();
    const interval = window.setInterval(load, 60000);
    return () => { alive = false; window.clearInterval(interval); };
  }, [user]);
  return (
    <Link to="/notificaciones" className="campanita" aria-label={'Notificaciones' + (count > 0 ? ' (' + count + ' sin leer)' : '')}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" /><path d="M9 17a3 3 0 0 0 6 0" /></svg>
      {count > 0 && <span className="campanita-badge">{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}
```

- [ ] **Step 2: Write `src/components/Notificaciones/CampanitaNotificaciones.css`**

```css
.campanita { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; color: var(--color-texto); }
.campanita-badge {
  position: absolute; top: 2px; right: 2px; min-width: 18px; height: 18px; padding: 0 4px;
  background: var(--color-error); color: #fff; border-radius: 999px;
  font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center;
}
```

- [ ] **Step 3: Replace the bell in `src/components/layout/AppBar.tsx` with the campanita component**

```tsx
import { Link } from 'react-router-dom';
import { CampanitaNotificaciones } from '../Notificaciones/CampanitaNotificaciones';
import './AppBar.css';

export function AppBar({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  return (
    <header className="appbar">
      <button className="appbar-hamburger" aria-label="Abrir menú" onClick={onOpenDrawer}>
        <span /><span /><span />
      </button>
      <Link to="/" className="appbar-brand">QUODOM</Link>
      <div className="appbar-actions">
        <CampanitaNotificaciones />
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Write `src/screens/Notificaciones/ListaNotificaciones.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { notificaciones } from '../../api/oper_notificaciones';
import type { Notificacion } from '../../api/types';
import { ApiError } from '../../api/client';
import { AppBarBack } from '../../components/layout/AppBarBack';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import './ListaNotificaciones.css';

export function ListaNotificaciones() {
  const [list, setList] = useState<Notificacion[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setList(null); setErr(null);
    notificaciones.list().then(d => { if (alive) setList(d); }).catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error.'); });
    return () => { alive = false; };
  }, [nonce]);

  async function marcar(n: Notificacion) {
    if (n.leida) return;
    try { await notificaciones.marcarLeida(n.id); setNonce(x => x + 1); } catch {}
  }

  return (
    <>
      <AppBarBack title="Notificaciones" />
      <section className="container notif">
        {err && <ErrorState message={err} onRetry={() => setNonce(n => n + 1)} />}
        {!err && !list && <Loader />}
        {list && list.length === 0 && <EmptyState title="No tenés notificaciones" />}
        {list && list.length > 0 && (
          <ul className="notif-list">
            {list.map(n => (
              <li key={n.id} className={'notif-item card hoja' + (n.leida ? ' notif-leida' : '')} onClick={() => marcar(n)}>
                <div className="notif-title">{n.titulo}</div>
                <div className="notif-text">{n.texto}</div>
                <div className="notif-date">{new Date(n.createdAt).toLocaleString('es-AR')}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
```

- [ ] **Step 5: Write `src/screens/Notificaciones/ListaNotificaciones.css`**

```css
.notif { padding: var(--sp-4) 0 var(--sp-7); }
.notif-list { display: grid; gap: var(--sp-3); }
.notif-item { cursor: pointer; }
.notif-title { font-family: var(--font-prompt); font-weight: 500; color: var(--color-acento); margin-bottom: var(--sp-1); }
.notif-text { color: var(--color-texto); margin-bottom: var(--sp-2); }
.notif-date { font-size: var(--fs-tiny); color: var(--color-texto-muted); }
.notif-leida { opacity: .6; }
```

- [ ] **Step 6: Wire the route in `src/router/routes.tsx`**

Change:

```tsx
{ path: '/notificaciones', element: <ProtectedRoute><ListaNotificaciones /></ProtectedRoute> }
```

Add import:

```tsx
import { ListaNotificaciones } from '../screens/Notificaciones/ListaNotificaciones';
```

- [ ] **Step 7: Verify in the browser**

Log in as `demo`. Send a Quodom via WhatsApp (create it, add a line, click Enviar) → the bell badge in the AppBar should show a count within 60 seconds (or immediately after refresh). Click the bell → the notifications page opens; click a notification to mark it read; the badge decrements.

- [ ] **Step 8: Typecheck and commit**

```bash
cd quodom-web/app && npm run typecheck
git add quodom-web/app/src/components/Notificaciones quodom-web/app/src/screens/Notificaciones quodom-web/app/src/components/layout/AppBar.tsx quodom-web/app/src/router/routes.tsx
git commit -m "feat: add notifications bell with polling and full list page"
```

---

## Task 17: `quodom-web/app/CLAUDE.md` + final smoke test

**Files:**
- Create: `quodom-web/app/CLAUDE.md`

- [ ] **Step 1: Write `quodom-web/app/CLAUDE.md`**

```markdown
# Quodom Web App (quodom-web/app/CLAUDE.md)

React 18 + Vite + TypeScript + plain CSS. 1:1 visual clone of the original React Native APP at `F:\backup\Command Soluciones\Quodom\APP` (read-only reference).

## Comandos
- `npm install`
- `npm run dev` — dev server en `http://localhost:5173` (requiere API en `http://localhost:3999`)
- `npm run build` — build de producción a `dist/`
- `npm run preview` — servir el build
- `npm run typecheck` — `tsc -b --noEmit`
- `npm test` — Vitest (solo lógica no trivial: api client, guest quodom, migración)

## Estructura
- `src/api/` — cliente `apiFetch` con JWT + un módulo por recurso. Todas las llamadas al backend pasan por acá.
- `src/auth/` — `AuthContext` (token+user en `localStorage.quodom.token`) y `ProtectedRoute`.
- `src/guest/` — Quodom de invitado en `localStorage.quodom.guest`; `migrateGuestQuodom` lo transfiere al backend al iniciar sesión.
- `src/styles/` — `tokens.css` (paleta, tipografías, espacios, radios), `reset.css`, `typography.css`, `utilities.css` (`.container`, `.card`, `.btn`, `.hoja`), `global.css` que las importa todas.
- `src/components/layout/` — `AppBar`, `Drawer`, `Layout`, `BarraQuodomInferior`, `AppBarBack`.
- `src/components/` — `Loader`, `EmptyState`, `ErrorState`, `Notificaciones/CampanitaNotificaciones`.
- `src/screens/` — una carpeta por área (Auth, Home, Quodom, MisQuodoms, Profile, Direcciones, Notificaciones); cada screen tiene su `.tsx` + `.css` al lado.
- `src/router/routes.tsx` — árbol de rutas con `createBrowserRouter`; rutas públicas fuera del `<Layout>` y rutas de app dentro.
- `tests/` — Vitest + happy-dom + Testing Library. Tests solo para: `api-client`, `guestQuodom`, `migrateGuestQuodom`.

## Reglas visuales (mobile-first, en este orden)
1. **Base mobile (< 601px):** escribí siempre primero para pantalla chica; grillas de 1–2 columnas, layout apilado, drawer que abre/cierra.
2. **Tablet: `@media (min-width: 601px) and (max-width: 1024px)`** — ampliá grillas a 3–4 columnas, aumentá padding lateral (`.container` va a 720px máx).
3. **Desktop: `@media (min-width: 1025px)`** — el drawer se vuelve persistente (grid `260px 1fr` en `.layout`), `.container` a 1120px máx, más columnas en grillas de productos/categorías.

Reglas duras: nunca fijes anchos en píxeles a nivel de página; usá `.container` + porcentajes/grid. La forma de hoja (`border-top-left-radius: 8px; border-bottom-right-radius: 8px`) va en tarjetas, imágenes y botones grandes (clase `.hoja`, ya aplicada por `.card` y `.btn`). Paleta: `--color-fondo #F6EE5D`, `--color-acento #706F9A`, `--color-exito #2DAB66`, `--color-texto #45444C`, `--color-tarjeta #FFFFFF`.

Fuentes: Prompt para títulos y botones (`--font-prompt`), Work Sans para texto (`--font-work`), Jaldi/Montserrat disponibles por si algún componente puntual lo necesita.

## Convenciones
- **UI:** español (mensajes, labels, estados).
- **Código:** inglés (nombres de identifiers, comentarios). Sin comentarios salvo cuando el "por qué" no sea evidente.
- **HTML semántico:** `header`, `nav`, `main`, `section`, `article`, `button`, `label`+`input`.
- **Errores del API:** los controllers backend responden `{ res: false, message }` con status 4xx; el cliente lanza `ApiError` con el `message` — mostrarlo tal cual.
- **Persistencia local:** solo dos claves — `quodom.token` (JWT) y `quodom.guest` (Quodom de invitado). Ninguna otra información sensible en `localStorage`.
- **Testing:** integración/UI se verifica en el navegador (dev server + API real). Se agregan tests Vitest solo cuando la lógica es pura y no trivial.
```

- [ ] **Step 2: Full manual smoke test end-to-end**

Terminal A: `cd quodom-web/api && npm run dev`
Terminal B: `cd quodom-web/app && npm run dev`

Execute the whole guest → send flow in the browser without pausing:

1. Open `http://localhost:5173` in incognito. Guest mode; drawer offers "Ingresar".
2. Click a rubro → subcategoría → add 2 products. The bottom purple bar shows the count.
3. Click the bar → `/quodom`. Type "Pintura living" as descripcion. Change quantities. Pick attribute if any.
4. Click "Enviar por WhatsApp" → redirect to `/login`. Log in as `demo` / `secreto123`. WhatsApp opens in a new tab with the message.
5. `localStorage.quodom.guest` is now empty; the bottom bar disappears.
6. Open `/mis-quodoms` → the just-sent quodom is there marked `ENVIADO`. Open it → attempting to edit shows the API rejecting changes.
7. Click the bell → notification "Quodom enviado" appears; click it to mark read → badge decrements.
8. `/perfil` → all links work. `/direcciones` → add an address, mark principal, edit, delete.
9. Sign out, sign up a fresh user in `/registro`, land on `/cuenta-creada`; log in with the new user → drawer updates with your name.

- [ ] **Step 3: Type check, unit tests, build**

```bash
cd quodom-web/app && npm run typecheck && npm test && npm run build
```
Expected: typecheck exit 0, unit tests all pass, build succeeds with no errors (Vite reports `built in Xs`).

- [ ] **Step 4: Commit CLAUDE.md**

```bash
git add quodom-web/app/CLAUDE.md
git commit -m "docs: add app-level CLAUDE.md with structure, responsive rules and conventions"
```

---

## After Plan 2

- Merge `feature/quodom-web-app` into `master` following the `superpowers:finishing-a-development-branch` skill.
- Plan 3 will add the Modo IA (chat with Gemini) — new endpoints `ia.controller.js` / `ia.route.js`, a chat screen next to the search bar, and the `ia_usage` table. Kept out of Plan 2 on purpose.
