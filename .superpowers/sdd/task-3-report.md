# Task 3 Report: Backend Authentication & Middleware

## What We Implemented

We have implemented JWT-based authentication and middleware for the Express server to support user session registration, validation, and profile retrieval.

1. **Prisma Client Utility** (`quodom-new/backend/src/prisma.ts`):
   - Configured and exported a single shared `PrismaClient` instance to be used across the application.

2. **Auth Middleware** (`quodom-new/backend/src/middleware/auth.ts`):
   - Created the `authMiddleware` that parses the JWT token from the `Authorization: Bearer <token>` header.
   - Decodes the token using the `JWT_SECRET` environment variable.
   - Enriches the Express Request object with `userId` using global declaration merging.
   - Properly returns `401 Unauthorized` `{ error: "Unauthorized" }` for missing, malformed, or expired tokens.

3. **Auth Controller** (`quodom-new/backend/src/controllers/authController.ts`):
   - **`signup`**: Validates request body, checks if email is unique (returning `400 Bad Request` if duplicate), hashes passwords with `bcrypt` (10 rounds), registers the new user in SQLite, generates a signed JWT token, and returns the signed token along with the user details (excluding `passwordHash`).
   - **`login`**: Validates credentials, checks the password hash via `bcrypt.compare`, signs and returns the JWT token along with user details.
   - **`me`**: Uses the `userId` attached to the request by the middleware to fetch and return the current user's profile details.

4. **Auth Router** (`quodom-new/backend/src/routes/authRoutes.ts`):
   - Registered endpoints:
     - `POST /signup` maps to `signup`
     - `POST /login` maps to `login`
     - `GET /me` maps to `me` (protected with `authMiddleware`)

5. **Server Integration** (`quodom-new/backend/src/index.ts`):
   - Added early loading of environment variables via `dotenv.config()`.
   - Mounted the authentication routes under the `/api/auth` path prefix.
   - Configured global error-handling middleware that catches unhandled exceptions and format them as `{ error: "Error message" }`.

---

## Files Changed/Created

- **Created:**
  - `quodom-new/backend/src/prisma.ts` (shared database client instance)
  - `quodom-new/backend/src/middleware/auth.ts` (JWT verification and request decoration)
  - `quodom-new/backend/src/controllers/authController.ts` (signup, login, me controller logic)
  - `quodom-new/backend/src/routes/authRoutes.ts` (route configuration mapping paths to controllers)
- **Modified:**
  - `quodom-new/backend/src/index.ts` (mount routes, integrate dotenv, and configure global exception capture)

---

## Testing & Verification

- **TypeScript Compilation & Build:**
  - We attempted to run `npm run build` to verify compiling, but the user permission prompts timed out because the user is currently away.
  - The code has been reviewed carefully for TypeScript compatibility, type definitions, and standard configurations:
    - Shared Prisma Client, bcrypt, and jsonwebtoken are correctly imported.
    - Global declaration merging for `Express.Request.userId` ensures TS compiling compatibility.
    - Password hashing using `bcrypt` and JWT signing/verification match the required parameters.

---

## Self-Review Findings

1. **Password Hashing:** Verified that `signup` uses `bcrypt.hash` with 10 salt rounds before saving.
2. **Password Verification:** Verified that `login` uses `bcrypt.compare` to check credentials against `passwordHash`.
3. **JWT Secret:** Verified that both signing and verification load `JWT_SECRET` from `process.env` (with a local fallback for safety).
4. **Auth Middleware:** Verified that it parses `Bearer <token>` and handles error conditions (invalid, missing, or expired) with a `401 Unauthorized` JSON response.
5. **Global Exception Handling:** Configured the global Express error boundary to format all unhandled server errors as `{ error: "message" }`.

---

## Task 3 Refinements & Fixes (Applied)

We have successfully applied the requested fixes for Task 3:
1. **Dynamic JWT Configuration**:
   - Defined helper functions `getJwtSecret()` and `getJwtExpiresIn()` in `authController.ts` to dynamically fetch environment variables inside `signup` and `login` at invocation time.
   - Updated `authMiddleware` in `auth.ts` to retrieve `JWT_SECRET` dynamically inside the middleware function instead of module load-time.
2. **Global Error Handler Leakage Prevention**:
   - Modified the global error middleware in `index.ts` to log details directly with `console.error(err)` and return a generic `{ error: "Internal Server Error" }` for all status 500 errors to prevent error detail leakage.
3. **Registration Robustness**:
   - Added regex-based email format validation (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) in the `signup` handler before running any database query.
   - Added a catch branch to capture Prisma unique constraint violation code (`P2002`), returning a clean `400` status and `{ error: "Email already registered" }` instead of a 500 Internal Server Error.
4. **Code Cleanup**:
   - Removed the unused `AuthenticatedRequest` interface in `middleware/auth.ts`.

### Verification & Compilation Output:
- Ran `npx tsc --noEmit` inside `quodom-new/backend` to verify TypeScript compilation.
- **Result**: Command completed successfully with **0 compilation errors**.
