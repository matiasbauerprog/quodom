# Quodom en celular — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la app funcione bien en celular y tablet: la barra de abajo como hoja deslizable que hace lo del panel oculto de escritorio, arrastre de productos con el dedo, y las pantallas que hoy se ven mal arregladas — sin cambiar nada desde 1025px.

**Architecture:** Dos cortes (móvil ≤1024px, escritorio ≥1025px). Lo que el panel de escritorio ya tiene para el estado oculto (`AvisoAgregado`, `DestinoCompacto`) se saca a módulos propios y lo usan las dos superficies. `arrastre.ts` suma el dedo con "mantener apretado". La hoja de la barra se desliza con eventos de puntero, a mano, sin dependencias.

**Tech Stack:** React 18 + Vite + TypeScript + CSS plano; Vitest + Testing Library + happy-dom.

**Spec:** `docs/superpowers/specs/2026-10-21-celular-responsive-design.md`

## Global Constraints

- Cortes: móvil `@media (max-width: 1024px)`, escritorio `@media (min-width: 1025px)`. Ningún `601px` queda en el CSS al terminar (salvo `DialogoMapa` si se demuestra que lo necesita; anotarlo).
- Escritorio (≥1025px) visualmente idéntico a antes; los tests existentes de escritorio no cambian sus expectativas.
- Sin dependencias nuevas.
- Todo camino de agregar sigue pasando por `agregarProducto.ts`; soltar va por `blancoBajo` + `onSoltar` como hoy.
- Destinos de arrastre: `data-destino`/`data-nuevo` + `data-rubro`, **montados** sólo cuando corresponden, nunca escondidos con CSS.
- Todas las salidas de un arrastre terminan en `limpiar()`.
- UI en español, código y commits en inglés, comentarios explican el porqué (estilo del repo).
- Cada task deja `npx vitest run` y `npx tsc -b` en verde.

## Review Focus

1. Toque lento sin mover (dedo quieto >450ms y suelta) → abre `DialogoDestino` como un toque normal. (Task 2)
2. Dedo que se mueve antes de los 450ms → scroll; nunca levanta, nunca bloquea. (Task 2)
3. Escritorio con panel cerrado arrastrando con mouse → la barra (oculta por CSS) no monta un segundo `DestinoCompacto`. (Task 3)
4. Hoja abierta a mano antes de arrastrar → queda abierta al terminar el arrastre; abierta por el arrastre → se cierra. (Task 3)
5. Cambiar sólo la búsqueda (`?sub=`, `?quodom=`) no scrollea arriba; cambiar de pantalla sí. (Task 5)

---

### Task 1: Sacar `AvisoAgregado` y `DestinoCompacto` a módulos compartidos

**Files:**
- Create: `app/src/components/layout/AvisoAgregado.tsx`, `app/src/components/layout/DestinoCompacto.tsx`
- Modify: `app/src/components/layout/MisQuodomsSidebar.tsx` (borrar las dos funciones privadas, importar), `MisQuodomsSidebar.css` (las clases `.mq-sidebar-agregado*` y `.mq-sidebar-soltar` se quedan donde están o se mueven a `AvisoAgregado.css`/`DestinoCompacto.css`; los nombres de clase no cambian)

**Interfaces:**
- Produces: `export function AvisoAgregado({ ramas, className }: { ramas: RamaRubro[]; className?: string })` y `export function DestinoCompacto({ arrastrando, ramas, className }: { arrastrando: ArrastreActivo; ramas: RamaRubro[]; className?: string })`. `className` se suma a la clase base, para que la barra los ubique distinto.

- [ ] **Step 1:** Mover el código tal cual (comentarios incluidos) y sumar `className`.
- [ ] **Step 2:** `npx vitest run src/components/layout` → todos PASS sin tocar tests.
- [ ] **Step 3:** Commit `refactor(app): share AvisoAgregado and DestinoCompacto`.

---

### Task 2: Arrastre con el dedo en `arrastre.ts`

**Files:**
- Modify: `app/src/quodom/arrastre.ts`, `app/src/screens/Home/ListaProductos.css` (`.prod-item`: `-webkit-touch-callout: none; user-select: none;`)
- Test: `app/src/screens/Home/__tests__/ListaProductos.test.tsx` (reemplazar el describe "arrastrar es de escritorio"), `app/src/quodom/__tests__/arrastre.test.ts` si existe (si no, los tests van en ListaProductos)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `iniciarArrastre(ev, opts)` con la misma firma; constantes exportadas `ESPERA_TOQUE_MS = 450`, `TOLERANCIA_TOQUE = 8`. Nuevo evento opcional en `opts`: `onToqueLento?: () => void` — lo llama cuando el dedo levantó y soltó sin moverse; `ListaProductos` le pasa la misma acción que el clic en `.prod-info` (abrir `DialogoDestino`).

Máquina de estados para `pointerType === 'touch' | 'pen'`:
- `pointerdown` → arma un `setTimeout(ESPERA_TOQUE_MS)` y registra en `window`: `pointermove`, `pointerup`, `pointercancel`, y `touchmove` **no pasivo** (`{ passive: false }`).
- Antes del timeout: un movimiento > `TOLERANCIA_TOQUE` o un `pointercancel` → `limpiar()` sin levantar (era scroll). `pointerup` → `limpiar()` sin levantar (fue un toque corto: el clic normal del navegador hace lo suyo).
- Al vencer el timeout: `levantar()` (como hoy) + `navigator.vibrate?.(15)`. Desde ahí el `touchmove` hace `preventDefault()`.
- Después de levantar: `pointermove` mueve el fantasma **48px por encima del dedo**; `pointerup` sin haberse movido más de la tolerancia desde el levantado → `limpiar()`, `tragarClic()`, `opts.onToqueLento?.()`; con movimiento → igual que mouse (resolver `blancoBajo`, `limpiar`, `tragarClic`, `onSoltar` si es del rubro).
- `contextmenu` con `preventDefault` mientras dure (registrado en `pointerdown`, sacado en `limpiar`).
- `mover` no aborta por `e.buttons === 0` en touch (en touch `buttons` puede venir 0 en algunos navegadores durante `pointermove`): esa regla queda sólo para mouse.
- Mouse: sin cambios.

- [ ] **Step 1: Tests que fallan** (fake timers, `pointerType: 'touch'`):
  - `'el dedo que se mueve antes de tiempo es scroll'`: pointerDown en `.prod-info` (100,100), pointermove a (100,140) a los 100ms, avanzar 1000ms → `body.arrastrando` false, sin `.arrastre-fantasma`.
  - `'mantener apretado levanta el producto'`: pointerDown, avanzar 450ms → `body.arrastrando` true; pointermove (300,300) → fantasma con `top` = `300 - 48 + 'px'`.
  - `'un toque lento sin mover abre el destino como un toque'`: pointerDown, avanzar 500ms, pointerup en el mismo punto → se abre el diálogo de destino (`findByRole('dialog')`) y `agregarADestino` no se llamó.
  - `'soltar con el dedo sobre un destino agrega'`: con `bajoElPuntero('<button data-destino="q-7" data-rubro="7"></button>')`, pointerDown, avanzar 450ms, pointermove (300,300), pointerup (300,300) → `agregarADestino` llamado con `'q-7'`.
  - `'pointercancel antes de levantar no agrega ni levanta'`.
  - `'sin sesión el dedo no arrastra'` (usuario null): pointerDown + 600ms → sin `arrastrando`.
  - Se mantiene `'con mouse sí'`; se borra `'un toque no levanta el arrastre'` (el spec lo invierte).
- [ ] **Step 2:** `npx vitest run src/screens/Home/__tests__/ListaProductos.test.tsx` → los nuevos FAIL.
- [ ] **Step 3:** Implementar en `arrastre.ts` y pasar `onToqueLento` desde `ListaProductos.agarrar` (la acción que hoy hace el clic en `.prod-info`). Actualizar el comentario de cabecera ("sólo con mouse" ya no es cierto: explicar mantener apretado y por qué).
- [ ] **Step 4:** Tests PASS + suite entera PASS.
- [ ] **Step 5:** Commit `feat(app): drag products with a long press on touch`.

---

### Task 3: La barra de abajo hace lo del panel oculto

**Files:**
- Create: `app/src/components/layout/useEsMovil.ts`
- Modify: `app/src/components/layout/BarraQuodomInferior.tsx`, `BarraQuodomInferior.css`, `app/src/components/layout/Layout.css`
- Test: `app/src/components/layout/__tests__/BarraQuodomInferior.test.tsx`

**Interfaces:**
- Consumes: `AvisoAgregado`, `DestinoCompacto` (Task 1); `useArrastreActivo()`.
- Produces: `useEsMovil(): boolean` — `matchMedia('(max-width: 1024px)')` con suscripción a `change`; sin `matchMedia` (tests) devuelve `true`. CSS var `--alto-barra` escrita por la barra en `document.documentElement` (ResizeObserver sobre `.barra-quodom-fila`; sin ResizeObserver, no escribe y queda el valor por defecto `72px` declarado en `Layout.css`).

Comportamiento:
- `AvisoAgregado` arriba de la barra (posición absoluta sobre `.barra-quodom-fila`).
- Mientras `arrastrando && esMovil && !abierto` → `DestinoCompacto` reemplaza visualmente la fila (encima, mismo alto). Con la hoja abierta no se monta.
- Arrastre sobre la barra ≥ `ESPERA_ABRIR_MS = 800` (medido con `pointermove` en `window` mientras dura el arrastre y `elementFromPoint` dentro de `.barra-quodom-wrap`) → `setAbierto(true)` y se recuerda `abiertaPorArrastre = true`. Al `arrastre:fin`, si `abiertaPorArrastre` → cerrar y olvidar. Si estaba abierta antes de arrastrar, no se toca.
- Cerrar tocando afuera: `pointerdown` en vez de `mousedown`.
- `.barra-quodom-destino`: en ≤360px de ancho de la barra puede ir en dos renglones (`white-space: normal` con `-webkit-line-clamp: 2`).
- `Layout.css`: `main { padding-bottom: var(--alto-barra, 72px); }` dentro del media móvil.

- [ ] **Step 1: Tests que fallan:**
  - `'mientras se arrastra muestra dónde soltar'`: dispatch `arrastre:inicio` {idrubro:5,...} con un abierto del rubro 5 → existe `[data-destino="<id>"][data-rubro="5"]` con "Soltá para sumar a".
  - `'en escritorio no monta el destino'`: `matchMedia` mockeado a `false` → tras `arrastre:inicio` no hay `[data-destino]` en la barra.
  - `'muestra lo agregado'`: dispatch `quodom:agregado` → `getByRole('status')` con el nombre.
  - `'tocar afuera la cierra'`: abrir, `fireEvent.pointerDown(document.body)` → `aria-expanded=false`.
  - `'la hoja que abrió el arrastre se cierra al terminar'` y `'la que abrió el usuario se queda'` (fake timers; `elementFromPoint` mockeado a un nodo de la barra; 800ms; `arrastre:fin`).
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS + suite.
- [ ] **Step 5:** Commit `feat(app): bottom bar shows drop target and added notice like the hidden panel`.

---

### Task 4: Hoja deslizable

**Files:**
- Create: `app/src/components/layout/useHojaDeslizable.ts`
- Modify: `BarraQuodomInferior.tsx`, `BarraQuodomInferior.css`
- Test: `app/src/components/layout/__tests__/useHojaDeslizable.test.ts`

**Interfaces:**
- Produces: `useHojaDeslizable({ abierta, onCambio, alto }: { abierta: boolean; onCambio: (abierta: boolean) => void; alto: () => number }): { arrastrando: boolean; desplazamiento: number; manejadores: { onPointerDown: (e: React.PointerEvent) => void } }` y la función pura `export function decidirFinal(desplazamiento: number, velocidad: number, alto: number, abierta: boolean): boolean` (true = queda abierta).

Reglas de `decidirFinal` (px y px/ms; desplazamiento positivo = hacia abajo): `|velocidad| ≥ 0.5` → manda la dirección (hacia arriba abre, hacia abajo cierra); si no → abierta si la posición final deja visible más de la mitad de `alto`.

- Los manejadores van en la fila de la barra (deslizar hacia arriba abre) y en una manija nueva `.barra-quodom-manija` al tope de la hoja (deslizar hacia abajo cierra). El contenido de la hoja scrollea normal; deslizar desde el contenido cierra sólo si `scrollTop === 0` y el gesto va hacia abajo.
- Un toque sin desplazamiento (<6px) sigue siendo el clic que abre/cierra (no romper el botón).
- Durante el gesto la hoja sigue al dedo con `transform: translateY(...)` sin transición; al soltar, transición 200ms hacia el estado final; con `prefers-reduced-motion` sin transición.
- Hoja: `max-height: 70svh` (con `70vh` antes como reserva), `padding-bottom: env(safe-area-inset-bottom)`, `touch-action: none` en la manija y en la fila.
- La hoja se monta siempre que se esté deslizando (para poder verla subir) y queda montada sólo si termina abierta.

- [ ] **Step 1: Tests que fallan** de `decidirFinal`: `(−200, −0.8, 400, false)` → true; `(30, 0.9, 400, true)` → false; `(−250, 0.1, 400, false)` → true; `(100, 0.1, 400, true)` → true; `(260, 0.1, 400, true)` → false. Y en `BarraQuodomInferior.test.tsx`: `'deslizar la barra hacia arriba la abre'` (pointerDown en la fila y=780, pointermove y=500, pointerup → `aria-expanded=true`); `'un toque sigue abriendo'`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS + suite.
- [ ] **Step 5:** Commit `feat(app): swipeable bottom sheet`.

---

### Task 5: Pantallas, cortes y viewport

**Files:**
- Modify: `app/index.html` (viewport con `viewport-fit=cover`), `app/src/styles/tokens.css` (comentario de los dos cortes), `app/src/styles/utilities.css`, `app/src/screens/Home/ListaProductos.css`, `SitioInicial.css`, `SubcategoriaTabs.css`, `app/src/screens/MisQuodoms/ListaMisQuodoms.css`, `DialogoPedido.css`, `app/src/screens/Quodom/VentanaQuodom.css`, `app/src/quodom/DialogoProveedores.css`, `FilaProveedor.css`, `app/src/screens/Direcciones/ListaDirecciones.css`, `app/src/screens/ModoIA/ModoIA.css` (y cualquier otro con `601px`: `grep -rn "601px" app/src`), `app/src/router/routes.tsx` o `Layout.tsx` (volver arriba)
- Create: `app/src/components/layout/VolverArriba.tsx` (+ test `__tests__/VolverArriba.test.tsx`)
- Modify docs: `CLAUDE.md` raíz §4 y `app/CLAUDE.md` "Reglas visuales" (dos cortes), más una línea en `app/CLAUDE.md` por cada componente nuevo (`useEsMovil`, `useHojaDeslizable`, `VolverArriba`, el arrastre con dedo en la entrada de `arrastre.ts`, la barra).

**Interfaces:**
- Produces: `export function VolverArriba(): null` montado en `Layout`: `useEffect` sobre `useLocation().pathname` que hace `window.scrollTo(0, 0)`, salvo `navigationType === 'POP'` (Atrás/Adelante restauran solos).

Cambios:
- **Cada `601px`** se reemplaza: columnas → `repeat(auto-fill, minmax(<mín>, 1fr))`; márgenes/tamaños → `clamp()`; ventanas (`VentanaQuodom`, `DialogoPedido`, `DialogoProveedores`) → hasta 1024px hoja abajo con `max-width: 560px; margin-inline: auto`, desde 1025px el estilo que hoy tienen desde 601px. `utilities.css` `.container` tablet → `padding-inline: clamp(var(--sp-4), 4vw, var(--sp-6))`.
- **Tarjeta de producto en móvil**: `.prod-info` apilado (imagen arriba, nombre abajo a todo el ancho), `.prod-name` con `line-clamp: 3`; grilla `repeat(auto-fill, minmax(150px, 1fr))` (en 320px dan dos columnas de ~140; si el recorrido muestra que no entran, `minmax(140px,1fr)`). Escritorio sin cambios.
- **Rubros en fila**: `.home-compacto .cat-grid` en móvil → `display: flex; overflow-x: auto; scrollbar-width: none` con `.cat-card` chicas (ícono 32px + nombre en una línea). El seleccionado se lleva a la vista: `RubroSelector` hace `scrollIntoView({ inline: 'center', block: 'nearest' })` sobre `.cat-card-sel` al montar/cambiar `idSeleccionado` (si `scrollIntoView` existe).
- **Pantallas de sección** en móvil: `.pantalla-*` sin `space-evenly` ni `--pantalla-alto`; el contenido arranca a `var(--sp-5)` del título.
- **Pestañas**: `.subtabs { scrollbar-width: none } .subtabs::-webkit-scrollbar { display: none }`.
- **Modo IA**: el formulario del chat `position: sticky; bottom: var(--alto-barra, 72px)` en móvil. Si en el recorrido choca con el teclado, se revierte y se anota en `app/CLAUDE.md`.

- [ ] **Step 1: Tests que fallan** (`VolverArriba.test.tsx`, MemoryRouter, `window.scrollTo` espiado): `'cambiar de pantalla vuelve arriba'` (navegar `/` → `/perfil` → llamado con `0,0`); `'cambiar sólo la búsqueda no'` (`/?rubro=5` → `/?rubro=5&sub=35` → no llamado). Test de `RubroSelector`: `'lleva el rubro elegido a la vista'` (`Element.prototype.scrollIntoView` espiado, llamado sobre el `aria-current="page"`).
- [ ] **Step 2:** FAIL. **Step 3:** Implementar CSS, componente y docs. **Step 4:** `npx vitest run` y `npx tsc -b` PASS; `grep -rn "601px" src` vacío (o justificado).
- [ ] **Step 5:** Commit `feat(app): two breakpoints, readable product cards, compact rubros, scroll to top`.

---

### Task 6: Recorrido final

- [ ] **Step 1:** Capturas de escritorio de **antes** (en `main` antes de mergear, build + preview, 1280px de ancho): inicio, rubro, panel abierto y cerrado, historial, ventana del Quodom.
- [ ] **Step 2:** Mismo recorrido del 2026-10-21 en 320, 390 y 800px y en 1280px con la rama: los siete problemas del spec resueltos; escritorio igual a las capturas de antes.
- [ ] **Step 3:** Revisión de toda la rama por un revisor fresco.
- [ ] **Step 4:** Merge a `main`, push, y lista para el usuario de qué probar en un teléfono de verdad (arrastre contra scroll, hoja deslizada, franja del iPhone, toque lento).
