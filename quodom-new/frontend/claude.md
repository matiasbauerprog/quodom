# Reglas de Desarrollo del Frontend (quodom-new/frontend/claude.md)

Este archivo define las directrices exclusivas para el desarrollo del frontend de Quodom 3.0.

---

## 1. HTML Semántico Estricto (Sin Divitis)
- **Regla de Oro:** Queda prohibido el uso de la etiqueta `div` a menos que sea estrictamente necesario para alineación estructural (e.g. flex/grid wrapper de layouts complejos).
- **Etiquetas Semánticas Requeridas:**
  - Estructura general: `<header>`, `<main>`, `<footer>`
  - Paneles de navegación/Categorías: `<nav>`
  - Agrupaciones de sección: `<section>`
  - Tarjetas de producto o ítems de Quodom: `<article>`
  - Botones y enlaces interactivos: `<button>`, `<a>`
  - Listas ordenadas e inordenadas: `<ul>`, `<ol>`, `<li>`
  - Campos de entrada de datos: `<form>`, `<label>`, `<input>`, `<textarea>`
  - Visualización de imágenes: `<figure>`, `<img>`
  - Fechas y horas: `<time>`

---

## 2. Responsividad y Breakpoints (Mobile First)
El diseño debe pensarse y escribirse primero para celulares y escalarse hacia pantallas más grandes utilizando media queries específicos:
1. **Móviles (Estilo Base):** Pantallas de hasta 600px de ancho. Caja de Modo IA fija/flotante simulando barra de chat.
2. **Tablets:** `@media (min-width: 601px) and (max-width: 1024px)`. Grilla de categorías en 3-4 columnas.
3. **Desktops:** `@media (min-width: 1025px)`. Navegación lateral persistente y pantalla de editor en doble columna (Catálogo + Ítems seleccionados).

---

## 3. Guía de Diseño Visual (Original de Quodom)
Respeta exactamente los colores, formas y fuentes definidos en Quodom 1.0:
- **Colores de Marca:**
  - Fondo de la aplicación: `#F6EE5D` (Amarillo)
  - Color de destaque y navegación: `#706F9A` (Violeta)
  - Botones de éxito y finalización: `#2DAB66` (Verde)
  - Color de texto base: `#45444C` (Gris oscuro)
  - Tarjetas/Fondos de bloques: `#FFFFFF` (Blanco)
- **Bordes y Formas:**
  - Tarjetas e imágenes de producto con forma de hoja:
    ```css
    border-top-left-radius: 8px;
    border-bottom-right-radius: 8px;
    border-top-right-radius: 0;
    border-bottom-left-radius: 0;
    ```
  - Botones de control redondeados: `border-radius: 50px;`
- **Tipografías:**
  - Carga e importa desde Google Fonts las tipografías del Quodom original:
    - `Prompt` (títulos y etiquetas destacadas)
    - `Jaldi` (cuerpo general)
    - `Work Sans` y `Montserrat` (resúmenes y subtítulos)

---

## 4. Navegación y Flujo de Pantallas
Se deben portar de forma exacta las pantallas y navegación de la app original (Drawer/Tabs):
- **SignIn / SignUp / ForgotPassword:** Formularios con el diseño original (cajas blancas sobre fondo amarillo con botones violetas).
- **Home (SitioInicial):** Selector principal de categorías con buscador. Incluye la caja de texto `"Modo IA"` en gris claro en la zona inferior de la pantalla.
- **Products (ListaProductos):** Lista con tabs de subcategorías en horizontal y scroll vertical de productos con checkmarks.
- **Quodom Editor (DetalleQuodom):** Permite ver la lista de productos agregados, sumar/restar cantidades y tocar **ENVIAR VÍA WHATSAPP** para generar el mensaje y cambiar el estado del Quodom a "Enviado".
- **MyQuodoms (ListaMisQuodoms):** Listado de Quodoms del usuario con sus estados y progreso.

---

## 5. Comunicación y API
- La comunicación se realiza únicamente contra la API especificada en `quodom-new/openapi.yaml`.
- Toda interacción de datos del cliente debe tiparse de acuerdo a las respuestas esperadas en el contrato API.
- Almacena el token JWT de sesión de forma segura en `localStorage` o cookies para enviar en la cabecera `Authorization: Bearer <token>`.
