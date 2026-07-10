# Quodom 3.0 - Reglas y Directrices de Desarrollo (claude.md)

Este archivo establece las reglas estrictas de desarrollo que rigen la transformación de Quodom de su versión 1.0 (React Native) a su nueva versión web 3.0 (ligera).

---

## 1. Arquitectura y Estructura
- **Estructura de Carpetas:** Todo el nuevo código vive bajo `quodom-new/`:
  - `quodom-new/openapi.yaml` (Especificación OpenAPI 3.0)
  - `quodom-new/backend/` (Servidor Express + TypeScript + SQLite + Prisma)
  - `quodom-new/frontend/` (React Vite + TypeScript + Vanilla CSS)
- **OpenAPI-First:** Cualquier cambio en la comunicación cliente-servidor se especifica y aprueba primero en `quodom-new/openapi.yaml`.

---

## 2. Reglas del Frontend (Mapeo de Quodom 1.0)
- **No Diseñar Nuevos Flujos:** Se deben replicar las pantallas y el flujo de navegación de la aplicación original Quodom 1.0, adaptándolo a la web y descartando toda la lógica de vendedores y pasarelas de pago.
- **Mobile First Estricto:** Toda la maquetación y estilos se escriben pensando primero en móviles, y se escalan mediante media queries específicos:
  - **Mobile (Base):** Celulares (hasta 600px).
  - **Tablet:** `@media (min-width: 601px) and (max-width: 1024px)`
  - **Desktop:** `@media (min-width: 1025px)`
- **HTML Semántico Estricto:** Evitar el uso de `div`s a menos que sea indispensable para el maquetado estructural (flexbox/grid wrapper). Usar:
  - `<header>` para cabeceras de app y vistas.
  - `<nav>` para menús, pestañas de subcategorías y navegación.
  - `<main>` para el contenedor principal de cada pantalla.
  - `<section>` para agrupar bloques de contenido (e.g. grilla de categorías, chat de IA).
  - `<article>` para tarjetas de productos y tarjetas de Quodoms en listas.
  - `<button>` para elementos interactivos con clic.
  - `<input>` y `<label>` para campos de formulario.
- **Estilos Visuales (Original Quodom):**
  - **Paleta de Colores (`colors.js`):**
    - Fondo general: `#F6EE5D` (Amarillo)
    - Acento/Destacados: `#706F9A` (Violeta)
    - Éxito/Completado: `#2DAB66` (Verde)
    - Texto base: `#45444C` (Gris oscuro)
    - Tarjetas/Inputs: `#FFFFFF` (Blanco)
  - **Forma de Hoja:** Las tarjetas e imágenes de producto deben tener la forma característica:
    ```css
    border-top-left-radius: 8px;
    border-bottom-right-radius: 8px;
    ```
  - **Tipografía:** Importar las fuentes del Quodom original desde Google Fonts: `Prompt`, `Jaldi`, `Work Sans` y `Montserrat`.

---

## 3. Reglas de Backend y Base de Datos
- **Seeding Real:** La base de datos SQLite se poblará automáticamente mediante un script que lea `Documentacion 2.0/Categorias/Migracion.xlsx`, asegurando que contenga las 62 subcategorías y los 644 productos reales mapeados por ID.
- **Lógica de la IA:** El endpoint de generación de IA debe utilizar llamadas directas de API (Gemini/OpenAI) configuradas para retornar JSON estructurado mapeando a los IDs y cantidades calculadas del catálogo real.
- **WhatsApp Link:** La exportación del Quodom genera una redirección directa a `https://wa.me/?text={encoded_message}` conteniendo el listado detallado de productos y los datos de contacto del comprador.

---

## 4. Idioma y Convenciones de Código
- **Interfaz de Usuario (UI):** Español (respetando los textos del Quodom original).
- **Código Técnico:** Inglés (nombre de variables, tipos de TypeScript, endpoints de API, nombres de columnas de base de datos, comentarios de código y commits).
