# Firebase Migration Plan (07A.3)

## Current Vercel Architecture (Legacy)
- **Frontend:** Vite SPA deployed via Vercel.
- **Backend:** Express API deployed as Vercel Serverless Functions (`api/index.ts`).
- **Routing:** Handled via `vercel.json` (rewrites `/api/**` to backend, `**` to `index.html` fallback).

## Target Firebase Architecture
- **Frontend:** Firebase Hosting serving the `dist/` directory.
- **Backend:** Cloud Functions for Firebase (2nd gen, Node.js 22) exposing the shared Express API from `src/server/api.ts`.
- **Routing:** Handled via `firebase.json` (rewrites `/api/**` to `api` function, `**` to `/index.html` for SPA fallback).

## Key Preservations
- **Shared API Layer:** The Express backend (`src/server/api.ts`) is bundled into the Cloud Function, avoiding code duplication.
- **Security:** `AUTHORIZED_FIREBASE_UIDS` and Gemini keys remain server-side.
- **PWA:** VitePWA assets are served cleanly by Firebase Hosting.
- **Migration Admin:** `/migration-admin` remains a protected SPA route relying on API authorization.

## Billing Requirement
- **Hosting:** Can be used on the Spark (free) plan.
- **Cloud Functions:** Requires the **Blaze** (pay-as-you-go) plan for deployment (due to Node.js requirements and general Functions policy).
- **Note:** Usage within the generous free tier limits usually incurs no cost, but it is highly recommended to set up billing alerts/budgets before deployment.

## Emulator Runtime Test
EMULATOR RUNTIME TEST — MANUAL VERIFICATION REQUIRED
