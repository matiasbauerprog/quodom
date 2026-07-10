# Quodom 3.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a lightweight web app transformation of Quodom (named Quodom 3.0) consisting of a Node/Express TypeScript backend with SQLite persistence seeded from real migration data, and a mobile-first semantic React (Vite) frontend matching Quodom 1.0 visual design.

**Architecture:** Client-Server decoupled application with OpenAPI-first specifications. The frontend communicates with the backend using APIs generated from the contract, and the backend handles AI prompt parsing by matching natural language requests to real SQLite product IDs.

**Tech Stack:** React 18, Vite, TypeScript, Vanilla CSS, Node.js, Express, Prisma ORM, SQLite, Gemini API/OpenAI API, WhatsApp URL integration.

## Global Constraints
- Target directory: `quodom-new/`
- Background color: `#F6EE5D` (Yellow)
- Accent color: `#706F9A` (Violet)
- Success color: `#2DAB66` (Green)
- Typography: Montserrat, Prompt, Jaldi, Work Sans
- Breakpoints: Mobile (<600px), Tablet (601px-1024px), Desktop (1025px+)
- HTML Semantics: Strict usage of semantic tags; no arbitrary `div`s unless necessary.

---

### Task 1: API Specification and Project Scaffolding

**Files:**
- Create: `quodom-new/openapi.yaml`
- Create: `quodom-new/backend/package.json`
- Create: `quodom-new/backend/tsconfig.json`
- Create: `quodom-new/frontend/package.json`
- Create: `quodom-new/frontend/tsconfig.json`

**Interfaces:**
- Produces: Base project structure and contract definitions.

- [ ] **Step 1: Write openapi.yaml spec file**
  Create `quodom-new/openapi.yaml` with endpoints for `/auth/signup`, `/auth/login`, `/auth/me`, `/catalog/categories`, `/catalog/products`, `/quodoms`, `/quodoms/{id}`, `/quodoms/{id}/send`, and `/ai/generate`.

- [ ] **Step 2: Initialize backend node structure**
  Create `quodom-new/backend/package.json` and install Express, Prisma, TypeScript, JWT, bcrypt, and CORS dependencies. Set up `tsconfig.json`.

- [ ] **Step 3: Scaffold frontend React + TS structure**
  Create `quodom-new/frontend/package.json` with React, Vite, TypeScript, and routing dependencies.

- [ ] **Step 4: Verify scaffolding compilation**
  Run: `npm run build` or verification compile checks in both folders.

---

### Task 2: Prisma Database Setup and Excel Seeder

**Files:**
- Create: `quodom-new/backend/prisma/schema.prisma`
- Create: `quodom-new/backend/prisma/seed.ts`

**Interfaces:**
- Consumes: `Documentacion 2.0/Categorias/Migracion.xlsx`
- Produces: SQLite database (`dev.db`) populated with 8 root categories, 62 subcategories, and 644 products.

- [ ] **Step 1: Write schema.prisma**
  Define `User`, `Category`, `Product`, `Quodom`, and `QuodomItem` schemas matching the design spec.

- [ ] **Step 2: Implement the Excel seed script**
  Create `quodom-new/backend/prisma/seed.ts` using a library like `xlsx` to parse `Documentacion 2.0/Categorias/Migracion.xlsx` sheets `TodasCategorias` and `Productos` and upsert categories and products into SQLite.

- [ ] **Step 3: Run migrations and seeding**
  Run: `npx prisma migrate dev --name init` and `npx prisma db seed`
  Expected: Database seeded with 644 products.

---

### Task 3: Backend Authentication & Middleware

**Files:**
- Create: `quodom-new/backend/src/middleware/auth.ts`
- Create: `quodom-new/backend/src/controllers/authController.ts`
- Create: `quodom-new/backend/src/routes/authRoutes.ts`

**Interfaces:**
- Consumes: JWT token in Authorization headers.
- Produces: `User` creation, token signing, and session validation.

- [ ] **Step 1: Create auth middleware**
  Validate JWT token from Bearer header and attach `userId` to the request object.

- [ ] **Step 2: Implement authController**
  Provide `signup` (hash passwords with bcrypt, save user) and `login` (verify password, sign JWT token) functions.

- [ ] **Step 3: Register routes in authRoutes**
  Map routes to `/auth/signup`, `/auth/login`, and `/auth/me`.

---

### Task 4: Catalog & Quodoms CRUD Endpoints

**Files:**
- Create: `quodom-new/backend/src/controllers/catalogController.ts`
- Create: `quodom-new/backend/src/controllers/quodomController.ts`
- Create: `quodom-new/backend/src/routes/apiRoutes.ts`

**Interfaces:**
- Consumes: Database models for Category, Product, Quodom, QuodomItem.
- Produces: JSON outputs for category lists, products, and Quodom CRUD operations.

- [ ] **Step 1: Implement catalogController**
  Implement categories retrieval with subcategories nested, and product lists filtered by category and search strings.

- [ ] **Step 2: Implement quodomController**
  Implement GET `/quodoms` (user's lists), GET `/quodoms/{id}` (detail with products), POST `/quodoms` (creation), PUT `/quodoms/{id}` (editing products/quantities), and POST `/quodoms/{id}/send` (marks status as 'Enviado').

- [ ] **Step 3: Setup routing entry points**
  Map Express routers to `/catalog/*` and `/quodoms/*` using authorization middleware.

---

### Task 5: AI Generation Endpoint

**Files:**
- Create: `quodom-new/backend/src/services/aiService.ts`
- Create: `quodom-new/backend/src/controllers/aiController.ts`

**Interfaces:**
- Consumes: Gemini API Key / OpenAI API Key from environment, and user natural language input.
- Produces: Automatically created Quodom with product items matching real database IDs.

- [ ] **Step 1: Write aiService prompt logic**
  Build system instructions containing the database categories/products. Instruct the LLM to return a strict JSON payload mapping inputs to exact product IDs and quantities.

- [ ] **Step 2: Implement aiController**
  Accept `{ prompt }`, query `aiService`, parse the returned JSON list, match IDs with database Products, create the Quodom in the database, and return it.

---

### Task 6: Frontend Styles, Layout, and Routing

**Files:**
- Create: `quodom-new/frontend/src/styles/variables.css`
- Create: `quodom-new/frontend/src/styles/global.css`
- Create: `quodom-new/frontend/src/App.tsx`

**Interfaces:**
- Consumes: CSS custom properties matching Quodom 1.0.
- Produces: Main application shell with responsive breakpoints and page routing.

- [ ] **Step 1: Create CSS branding variables**
  Set up colors (`--color-yellow: #F6EE5D`, `--color-violet: #706F9A`, `--color-green: #2DAB66`, `--color-dark-gray: #45444C`), typography loaders, and leaf-shape styling tokens.

- [ ] **Step 2: Implement media queries and semantic layouts**
  Write mobile-first CSS rules, scaling items to grid columns on tablets and double-column panes on desktop.

- [ ] **Step 3: Set up App.tsx navigation routes**
  Implement React Router mapping routes for `/login`, `/register`, `/home`, `/my-quodoms`, and `/quodom/:id`.

---

### Task 7: Frontend Authentication & Home Screen (IA Mode)

**Files:**
- Create: `quodom-new/frontend/src/screens/Login.tsx`
- Create: `quodom-new/frontend/src/screens/Register.tsx`
- Create: `quodom-new/frontend/src/screens/Home.tsx`

**Interfaces:**
- Consumes: `/auth/*` and `/ai/generate` API endpoints.
- Produces: Fully styled registration, login, and home dashboard with categories and the Modo IA chat drawer.

- [ ] **Step 1: Implement Login & Register views**
  Design yellow background screens matching Quodom 1.0 with white inputs and violet submit buttons using semantic forms.

- [ ] **Step 2: Implement Home.tsx dashboard layout**
  Draw the search bar, the main categories grid using `<article>` and category icons.

- [ ] **Step 3: Implement the "Modo IA" Input Component**
  Create a bottom sticky input bar showing `"Modo IA"`. Handle submit, trigger API loading overlays, and redirect to the Quodom Editor upon creation.

---

### Task 8: Frontend Products list & Quodom Editor (WhatsApp sharing)

**Files:**
- Create: `quodom-new/frontend/src/screens/Products.tsx`
- Create: `quodom-new/frontend/src/screens/QuodomEditor.tsx`
- Create: `quodom-new/frontend/src/screens/MyQuodoms.tsx`

**Interfaces:**
- Consumes: `/catalog/products`, `/quodoms/*` APIs.
- Produces: Product grids, interactive Quodom detail editor, and the WhatsApp share link generator.

- [ ] **Step 1: Implement Products.tsx screen**
  Display horizontal subcategory scroll nav and list products matching the leaf-rounded borders card layout.

- [ ] **Step 2: Implement QuodomEditor.tsx view**
  Show the active list of products, quantity controls (+/-), and title editing.

- [ ] **Step 3: Implement WhatsApp sharing button**
  Add the "ENVIAR VÍA WHATSAPP" button. Construct the formatted plain text message, update status to "Enviado" in the backend, and trigger `window.open` targeting `https://wa.me/?text=...`.

- [ ] **Step 4: Implement MyQuodoms.tsx dashboard list**
  Display all Quodoms with their statuses (En Proceso in purple, Enviado in green) and creation dates.
