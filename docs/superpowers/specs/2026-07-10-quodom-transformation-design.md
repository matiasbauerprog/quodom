# Especificación de Diseño: Transformación Quodom 3.0 (Versión Ligera Web)

Este documento define la arquitectura, el diseño y las directrices para la creación de Quodom 3.0, una versión web ligera adaptada de la aplicación original Quodom 1.0 (React Native). Esta versión se enfoca exclusivamente en el flujo del usuario comprador, eliminando las funcionalidades de vendedores, cotizaciones directas en la app y pasarelas de pago.

---

## 1. Arquitectura General y Stack Tecnológico

El proyecto se estructurará en la carpeta raíz `quodom-new/` dividiéndose en dos subproyectos desacoplados:

- **Frontend**: Single Page Application (SPA) utilizando **React 18 (Vite)** y **TypeScript**.
- **Backend**: Servidor REST utilizando **Node.js (Express)** y **TypeScript**.
- **Persistencia**: Base de datos SQL ligera utilizando **SQLite** administrada por **Prisma ORM**.
- **Contrato de API**: Especificación **OpenAPI 3.0** (`quodom-new/openapi.yaml`) como única fuente de verdad.

---

## 2. Reglas del Frontend (Mapeo de Quodom 1.0)

El frontend respetará de forma exacta el diseño, paleta y flujos del Quodom 1.0 original, adaptándolo a una web semántica y mobile-first.

### 2.1 Estilo Visual y Branding (Original de Quodom)
- **Paleta de Colores (`colors.js`):**
  - Fondo general de la aplicación: `#F6EE5D` (Amarillo)
  - Color de acento / navegación: `#706F9A` (Violeta)
  - Color de éxito / finalización: `#2DAB66` (Verde)
  - Textos de lectura: `#45444C` (Gris oscuro)
  - Fondo de tarjetas/bloques: `#FFFFFF` (Blanco)
- **Bordes y Formas:**
  - Estilo de tarjeta/imagen característica en forma de hoja: `border-top-left-radius: 8px; border-bottom-right-radius: 8px;`
  - Botones redondos con `border-radius: 50px` o de bordes suaves (`border-radius: 8px`).
- **Tipografías:**
  - `Prompt` (Google Fonts) para textos principales y etiquetas.
  - `Jaldi` (Google Fonts) para cuerpos generales.
  - `Work Sans` y `Montserrat` para títulos y resúmenes.

### 2.2 Maquetación HTML Semántica y Accesible
- Queda prohibido el uso indiscriminado de `div`.
- Toda la estructura debe construirse con etiquetas semánticas de HTML5:
  - Cabeceras: `<header>`
  - Menús y barras de navegación: `<nav>`
  - Contenido principal: `<main>`
  - Agrupación temática: `<section>`
  - Tarjetas de producto/Quodom: `<article>`
  - Botones de acción: `<button>`
  - Formularios y entradas: `<form>`, `<label>`, `<input>`
  - Fechas: `<time>`

### 2.3 Responsividad (Mobile First)
- **Estilo Base:** Diseñado exclusivamente para Celulares (pantallas de hasta 600px).
- **Tablet Breakpoint:** `@media (min-width: 601px) and (max-width: 1024px)` para adaptar la grilla de categorías a 3-4 columnas.
- **Desktop Breakpoint:** `@media (min-width: 1025px)` para fijar la navegación lateral e integrar el editor de Quodom y el catálogo en una vista de doble columna.

---

## 3. Modelo de Datos y Persistencia

La persistencia utilizará SQLite. El script de seeding importará las categorías y los 644 productos reales directamente desde el archivo `Migracion.xlsx` ubicado en la carpeta de documentación.

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  name         String
  company      String?
  cuit         String?
  whatsapp     String   // Formato internacional
  address      String?
  quodoms      Quodom[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Category {
  id        Int       @id // ID numérico fijo coincidente con Migracion.xlsx
  name      String
  parentId  Int       @default(0) // Jerarquía de categorías (0 = Raíz)
  image     String?
  products  Product[]
}

model Product {
  id          Int          @id // ID numérico fijo coincidente con Migracion.xlsx
  name        String
  description String?
  unit        String       // Litros, Kilos, Unidades, etc.
  image       String?
  categoryId  Int
  category    Category     @relation(fields: [categoryId], references: [id])
  items       QuodomItem[]
}

model Quodom {
  id        String       @id @default(uuid())
  title     String       // Ej: "Pintura dpto 55m con dos ventanas"
  status    String       // "En Proceso", "Enviado"
  userId    String
  user      User         @relation(fields: [userId], references: [id])
  items     QuodomItem[]
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
}

model QuodomItem {
  id        String  @id @default(uuid())
  quodomId  String
  quodom    Quodom  @relation(fields: [quodomId], references: [id], onDelete: Cascade)
  productId Int
  product   Product @relation(fields: [productId], references: [id])
  quantity  Float
}
```

---

## 4. Diseño de Endpoints API (OpenAPI First)

La especificación completa estará documentada en `quodom-new/openapi.yaml`. Los flujos clave son:

1. **Autenticación (`/auth`)**:
   - `POST /auth/signup`: Registro de comprador (Campos: `email`, `password`, `name`, `company`, `cuit`, `whatsapp`, `address`).
   - `POST /auth/login`: Login para retornar Token JWT.
   - `GET /auth/me`: Retorna los detalles del usuario actual.
2. **Catálogo (`/catalog`)**:
   - `GET /catalog/categories`: Lista la jerarquía de categorías.
   - `GET /catalog/products`: Búsqueda de productos por categoría y texto.
3. **Quodoms (`/quodoms`)**:
   - `GET /quodoms`: Lista de Quodoms del usuario comprador.
   - `GET /quodoms/{id}`: Detalle de un Quodom con sus productos.
   - `POST /quodoms`: Crea un Quodom.
   - `PUT /quodoms/{id}`: Actualiza título o lista de productos y cantidades.
   - `DELETE /quodoms/{id}`: Elimina el Quodom.
   - `POST /quodoms/{id}/send`: Cambia el estado del Quodom a "Enviado".

---

## 5. Modo IA y Lógica del Chat

En la pantalla de inicio se ubicará una caja de texto con el placeholder `"Modo IA"` en gris claro.

### 5.1 Flujo de Ejecución de la IA
1. El usuario ingresa un prompt en lenguaje natural: *"necesito pintar un dpto de 55m con dos ventanas"*.
2. El frontend realiza un `POST /ai/generate` con el prompt y el token del usuario.
3. El backend llama a la API de LLM (Gemini/OpenAI) con un **System Prompt** estructurado que contiene:
   - Las subcategorías de Pintura y productos relevantes del catálogo indexados en la DB.
   - La regla para retornar únicamente una estructura JSON válida que se mapee a los IDs y cantidades calculadas:
     ```json
     {
       "title": "Pintura Dpto 55m (IA)",
       "items": [
         { "productId": 35, "quantity": 1 },
         { "productId": 39, "quantity": 1 }
       ]
     }
     ```
4. El backend parsea la respuesta, crea el registro del Quodom asociado al comprador en la DB con estado `"En Proceso"`, y le retorna el Quodom creado al cliente.
5. El frontend recibe la respuesta y redirige directamente a la pantalla de edición del Quodom, mostrando la lista sugerida.

---

## 6. Envío e Integración con WhatsApp

Una vez que el usuario comprador valida la lista en la pantalla de detalle de su Quodom:
1. Hace clic en **ENVIAR VÍA WHATSAPP**.
2. El cliente ejecuta un `POST /quodoms/{id}/send` para guardar el estado del Quodom como `"Enviado"`.
3. El frontend genera el mensaje formateado:
   ```text
   Hola! Te adjunto mi pedido de cotización de Quodom para el proyecto [Título del Quodom]:
   
   Comprador: [Nombre del Comprador]
   Empresa: [Nombre de Empresa / CUIT]
   Dirección de entrega: [Dirección]
   Contacto: [WhatsApp Comprador]
   
   Detalle de Productos:
   - 1 x Latex Interior Blanco Mate (20 lts)
   - 2 x Pincel para Latex N°20
   
   Espero tu cotización, gracias!
   ```
4. Se abre el enlace de redirección: `https://wa.me/?text={mensaje_codificado}` permitiendo al usuario enviarlo al proveedor deseado en su lista de chat.
