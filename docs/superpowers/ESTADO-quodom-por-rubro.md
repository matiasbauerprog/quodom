# Estado: un Quodom por rubro

**Mergeado a `main`** el 2026-08-19. 37 commits desde `f655cec`.
Spec: `specs/2026-08-18-quodom-por-rubro-design.md` · Plan: `plans/2026-08-18-quodom-por-rubro.md`

Suites al momento del merge: API 121/121 en 16 suites, frontend 73/73 en 13 archivos, `tsc -b --noEmit` limpio.

## Qué quedó construido

Un Quodom pertenece a un solo rubro y hay como máximo uno abierto por usuario y rubro, con la regla enforced en tres capas: el chequeo en `create()` (que produce el 409 legible), un índice único parcial en la base (la red bajo la carrera entre pestañas), y la validación de `producto.categoriaPadre === quodom.idrubro` en cada alta de línea.

- **Backend:** columna `idrubro` inmutable; 409 `rubro_duplicado` y 409 `rubro_mismatch`; `GET /quodom/activo/:idrubro` busca sin crear (reemplazó a `POST /quodom/getLastQuodom/`, que hacía las dos cosas).
- **Catálogo:** agregar resuelve el Quodom del rubro del producto; si no hay, pide confirmación antes de crear.
- **Invitados:** un carrito por rubro en `localStorage`, migración rubro por rubro al login con integrar / reemplazar / cancelar.
- **Sidebar y barra inferior:** listan los Quodoms abiertos y se refrescan con el evento `quodom:changed`.
- **Modo IA:** un rubro por conversación, con filtrado defensivo de lo que devuelve el modelo.

## Desviaciones del spec

**Envío por WhatsApp sin sesión** (spec 2026-07-12 §4.3: *"el flujo de envío continúa donde quedó"*). Ahora es: enviar → login → aterrizás en el Quodom migrado → enviar de nuevo. Un clic más. La frase original se escribió cuando un invitado tenía un solo carrito; con carritos de varios rubros, auto-enviar significaría elegir uno por el usuario o disparar varios links. **Revocable si se prefiere la forma anterior.**

**Diálogo de rubro sin frase comparativa** (spec 2026-08-18 §5). El texto "…y tu Quodom abierto es de X" se descartó: habría costado una consulta extra para servir una sola cláusula. El título es "Creá un Quodom de <rubro>", cierto tanto con cero Quodoms como mezclando.

## Pendientes conocidos

Ninguno bloquea el uso. Ordenados por lo que más conviene atacar primero.

1. **La rama de invitado de la barra inferior no tiene tests.** Es la única ruta hacia un carrito de invitado y construye los links `/quodom?rubro=`. El archivo de test mockea `useAuth` como siempre-logueado.
2. **Tres implementaciones de modal sin unificar** (`DialogoNuevoRubro`, `DialogoConflictoRubro`, el selector inline de `ListaMisQuodoms`): mismo backdrop literal repetido, mismo manejo de Escape, y **ninguna tiene focus trap** — sólo el selector recibió `inert`/`aria-hidden` sobre el fondo. Divergencia que introdujo esta rama; un `<Modal>` compartido la cierra.
3. **`rubro_duplicado` devuelve `idquodom` y nadie lo usa.** El spec §4.1 lo incluye "para que el frontend pueda llevar al usuario ahí"; hoy sólo se muestra el mensaje.
4. **`DialogoNuevoRubro` no tiene test de render.** Escape, click afuera y el estado deshabilitado están verificados sólo por lectura de código, en un componente que consumen cuatro pantallas.
5. **`/quodom` sin parámetros, con sesión iniciada, elige un Quodom arbitrario** (`lista.find(q => q.estado === 'CREADO')`) — resabio de la era de un solo Quodom activo, e inconsistente con la rama de invitado, que ofrece un selector.
6. **Las tarjetas `ENVIADO` del sidebar no muestran el rubro**, mientras las activas sí, en el mismo componente.
7. **`reset-quodoms` deja notificaciones huérfanas**: las filas de `oper_notificaciones` sobreviven al drop y apuntan a Quodoms destruidos; abrirlas da "Quodom no encontrado". Consecuencia deliberada de que el spec §3.4 preserva las notificaciones.
8. **Asimetría en el primer agregado**: un invitado sin ningún carrito no ve diálogo; un usuario logueado sin Quodoms sí. Discutible como UX, pero el spec §6 pide que la experiencia sea idéntica antes y después del login.

## Nota operativa

Ver CLAUDE.md §6 antes de tocar el schema o commitear `quodom.sqlite`. El archivo local y el blob commiteado son cosas distintas mientras haya WAL, y esa confusión ya rompió el deploy una vez.
