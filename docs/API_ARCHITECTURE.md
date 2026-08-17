# Arquitetura de API e Backend

## DEPOIS DO PROMPT 04.1 (Hardening de Autorização e API Client)

Para garantir segurança total, a autenticação foi separada da autorização. O sistema agora exige explicitamente que o Firebase UID do requisitante conste na variável de ambiente `AUTHORIZED_FIREBASE_UIDS`. Sem isso, as rotas falham fechadas e não operam.

### Mapa da Nova Arquitetura

```text
Frontend
|
v
apiClient: authenticatedFetch()
|
+--> auth.currentUser.getIdToken()
|
v
/api/*
|
v
Authentication: requireAuth (Verifica validade do Firebase ID Token via firebase-admin)
|
v
Authorization: requireAuthorizedUser (Valida se o UID do token está na allowlist)
|
+--> Protected Route
|
+--> Service
|
+--> Gemini / Parser / etc.
```

### Classificação de Rotas

**PUBLIC**
- `/api/client-error` (Possui limite estrito de 500KB no payload, falha graciosamente se houver abuso).

**AUTHENTICATED & AUTHORIZED**
- `/api/gemini-proxy` (Proxy restrito EXCLUSIVAMENTE ao modelo gemini-2.0-flash, métodos POST/GET, limite 25MB)
- `/api/parse-curriculum` (Upload máximo 50MB)
- `/api/parse-addon-curriculum` (Upload máximo 50MB)
- `/api/parse-curriculum-text`
- `/api/extract-text` (Upload máximo 50MB)
- `/api/generate-eval-report`
- `/api/generate-lousa` (Upload máximo 50MB)

### Entrypoint Local (`server.ts`), Legacy Vercel (`api/index.ts`) e Target Firebase (`functions/src/index.ts`)
Possuem a mesma configuração centralizada via `createApiRouter` e agora ambos montam uma regra de CORS rigorosa permitindo origens explícitas mapeadas em `ALLOWED_ORIGINS` além das URIs de desenvolvimento. No Firebase Hosting, frontend e API compartilham a mesma origem (rewrites). O entrypoint `api/index.ts` (Vercel) permanece como LEGACY e `functions/src/index.ts` como TARGET para transição futura.
O `window.fetch` voltou a ser o objeto nativo, sem sobrescritas (monkey patch), melhorando a compatibilidade de bibliotecas de terceiros, com o envio de tokens restrito especificamente ao método auxiliar `authenticatedFetch`.
