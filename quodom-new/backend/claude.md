# Reglas de Desarrollo del Backend (quodom-new/backend/claude.md)

Este archivo define las directrices exclusivas para el desarrollo del backend de Quodom 3.0.

---

## 1. Tecnologías y Estándares
- **Entorno:** Node.js con TypeScript (modo estricto habilitado en `tsconfig.json`).
- **Framework:** Express.js para enrutamiento.
- **ORM & Persistencia:** Prisma ORM interactuando con una base de datos local SQLite (`dev.db`).
- **Pruebas:** Jest o Vitest para pruebas unitarias y de integración.

---

## 2. API y OpenAPI-First
- Todos los controladores, rutas y tipos de parámetros de entrada/salida deben conformar estrictamente la especificación del archivo global `quodom-new/openapi.yaml`.
- Si se requiere añadir o cambiar un endpoint, primero debe modificarse el archivo `openapi.yaml`.
- Utiliza tipado estático derivado del spec para las peticiones y respuestas siempre que sea posible.

---

## 3. Base de Datos y Seeding
- **Jerarquía:** Soporta categorías raíz (e.g. Pintura, ID 5) y subcategorías (e.g. Latex, ID 35).
- **Catálogo de Migración:** El script de sembrado (`prisma/seed.ts`) debe leer directamente el archivo Excel `../../Documentacion 2.0/Categorias/Migracion.xlsx` usando una librería como `xlsx` y mapear los IDs originales de categorías, subcategorías y productos (644 productos en total). No alteres los IDs numéricos autoincrementales; usa los IDs fijos del Excel para asegurar la concordancia con la IA y la app original.

---

## 4. Integración del Modo IA
- El endpoint `POST /ai/generate` procesa el prompt en lenguaje natural del usuario comprador.
- Debe llamar a la API del LLM (Gemini o OpenAI) utilizando un prompt del sistema estructurado que incluya las categorías y productos relevantes de la base de datos.
- Se debe exigir que el LLM responda con un JSON válido de la forma:
  ```json
  {
    "title": "Pintura Dpto 55m (IA)",
    "items": [
      { "productId": 35, "quantity": 1 },
      { "productId": 39, "quantity": 1 }
    ]
  }
  ```
- El backend debe capturar este JSON, buscar los productos en la base de datos de SQLite, guardar el Quodom en estado "En Proceso" y retornarlo.
- Debe existir un "mock fallback" en caso de que no esté configurada la API Key en las variables de entorno.

---

## 5. Convenciones de Código y Estilo
- **Idioma:** Todo el código (variables, métodos, clases, tablas, endpoints, comentarios técnicos) debe escribirse en **Inglés**.
- **Seguridad:** Las contraseñas de los usuarios se encriptan con `bcrypt`. Las sesiones se firman mediante tokens **JWT**.
- **Estructura de Archivos:** Dividir el código por responsabilidad técnica en:
  - `src/controllers/` (Lógica de control y mapeo HTTP)
  - `src/services/` (Lógica de negocio, integración con LLM, formateo de WhatsApp)
  - `src/middleware/` (Verificación de autenticación JWT, manejo de errores)
  - `src/routes/` (Registro de endpoints Express de acuerdo al spec)
- **Manejo de Errores:** Evita bloques try-catch repetitivos sin registrar; utiliza un middleware global de captura de excepciones en Express para retornar respuestas JSON de error estandarizadas (`{ error: "Mensaje de error" }`).
