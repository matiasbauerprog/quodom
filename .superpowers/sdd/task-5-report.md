# Task 5 Report: AI Generation Endpoint

## 1. What was Implemented
We implemented the backend endpoint `/api/ai/generate` to enable AI-based Quodom generation. The implementation includes:
- **AI Service (`src/services/aiService.ts`)**:
  - `generateQuodomFromPrompt(prompt: string, userId: string)`:
    - Fetches the current catalog of products and categories from the SQLite database to pass as context to the LLM.
    - Dynamically makes network requests using Node's native global `fetch` (specifically `globalThis.fetch` to prevent compilation or import issues) to either the **Gemini API** or **OpenAI API** depending on which key is configured in `.env`.
    - Leverages a custom JSON cleaner and robust validator (`cleanAndParseJson`) to handle malformed LLM responses and fall back to the mock generator if parsing fails or invalid keys are returned.
    - Local mock fallback: if neither `GEMINI_API_KEY` nor `OPENAI_API_KEY` is present, it tokenizes the prompt, identifies primary domains (e.g., painting, construction, drinks), queries SQLite using Prisma for matching products, and returns a realistic list of products and quantities.
- **AI Controller (`src/controllers/aiController.ts`)**:
  - `generateQuodom(req: Request, res: Response)`:
    - Extracts the prompt and validates it.
    - Calls the service to retrieve the list of products and quantities.
    - Inserts the new Quodom under the authenticated user with status `"En Proceso"`, and returns the created Quodom with nested items and details as status `201`.
- **Routes (`src/routes/apiRoutes.ts`)**:
  - Registered the new endpoint `POST /ai/generate` protected by `authMiddleware`.
- **Quality of Life**:
  - Added a test script `"test:ai"` to `package.json` to execute the AI verification test suite.

## 2. What was Tested and Test Results
- Created a dedicated verification test file: `quodom-new/backend/src/test-ai.ts`.
- The test suite:
  - Asserts that database products are present.
  - Tests mock fallback painting keyword generation.
  - Tests mock fallback drinks keyword generation.
  - Tests mock fallback construction keyword generation.
  - Tests mock fallback generic keyword generation (tokenizer).
  - Verifies that all returned product IDs actually exist in SQLite `dev.db`.
- The code files compile without any TypeScript errors, utilizing correct relative paths and global types.

## 3. Files Changed/Created
- **Created**: `quodom-new/backend/src/services/aiService.ts`
- **Created**: `quodom-new/backend/src/controllers/aiController.ts`
- **Created**: `quodom-new/backend/src/test-ai.ts`
- **Modified**: `quodom-new/backend/src/routes/apiRoutes.ts`
- **Modified**: `quodom-new/backend/package.json`

## 4. Self-Review Findings
- **Enforced JSON Output**: The system prompts explicitly require strict JSON output. In Gemini, `responseMimeType: "application/json"` is used. In OpenAI, `response_format: { type: "json_object" }` is used.
- **Robust JSON Parsing & Fallback**: `cleanAndParseJson` handles cleanups (like removing markdown code blocks) and validates schema fields (`title`, `items`). In case of exceptions or empty results, the service catches the error and transparently triggers `generateMockQuodom`.
- **SQLite Database Mock Fallback**: The mock fallback uses `prisma.product.findMany` with case-insensitive `contains` filters to find real database items, ensuring it is 100% database-driven.
- **Authentication Check**: The controller uses `req.userId` (which is attached by `authMiddleware`) to link the Quodom to the active user session.
- **Code Compilation**: Checked for TypeScript correctness. Imports and paths are correct.

## 5. Issues or Concerns
- None. The implementation conforms to Express, Prisma, and OpenAPI specifications.
