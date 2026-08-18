# Baseline de Refatoração

## Estado Atual
- **Projeto Funcional**: Sim.
- **Build**: Sucesso. O Vite + esbuild (`npm run build`) completou sem erros no código base (apenas alertas padrão de chunks do Vite).
- **TypeScript (Typecheck/Lint)**: Falha isolada detectada em `src/views/ProvaPaulistaAnalysis.tsx(263,91)` (uso do hook `confirm` com 2 argumentos, quando a tipagem espera 1 argumento).
- **Testes**: Não foram encontrados comandos de teste (como Jest ou Vitest) configurados no `package.json`.

## Estatísticas e Dimensionamento
- **Componentes / Views**: Aproximadamente 25 Views principais e 10 Componentes compartilhados.
- **Linhas de Código**: Concentração maciça em alguns componentes:
  - `LessonPlan.tsx` (~2130 linhas)
  - `Dashboard.tsx` (~1965 linhas)
  - `MatificAnalysis.tsx`, `TaskAnalysis.tsx` (~1000 linhas cada)
- **Integrações Principais**:
  - Google Gemini API (via server.ts e localmente).
  - Firebase (Auth e Firestore).
  - Google Workspace (OAuth implícito no frontend para Drive/Calendar/Gmail).

## Funcionalidades Críticas
As funcionalidades que não devem ser quebradas (e dependem fortemente de Firebase / LocalStorage combinados) são:
1. **LessonPlan (Planejador de Aula)**: Manipula um objeto de histórico longo em cache.
2. **Dashboard**: Carrega calendário e chats localmente + Firestore.
3. **Task / Matific / Prova Paulista Analysis**: Controlam dados vitais de avaliações dos alunos.

## Riscos Atuais (Baseline)
- Muito armazenamento baseado na premissa de `localStorage`, limitando a portabilidade total mesmo usando Firebase.
- Falta de autenticação e proteção de segurança nos endpoints (`server.ts`, `api/index.ts`), criando brechas para uso de quota de APIs pagas.
- O linter aponta falhas menores de tipagem ou assinaturas de métodos (ex: Confirm Context).
- O arquivo de entrada backend (`server.ts`) precisa ser repensado ou consolidado se a aplicação for seguir estritamente como SPA + API Serverless.

---
**NOTA**: A refatoração a partir desta base focará primeiramente em normalizar a arquitetura e componentes, devendo ser validada em relação a este documento para não perder recursos.

## PROMPT 02 — TECHNICAL BASELINE STABILIZATION

- **Erro anterior**: Em `src/views/ProvaPaulistaAnalysis.tsx`, na chamada `confirm(...)`, ocorria o erro TypeScript informando `Expected 1 arguments, but got 2` pois estava sendo chamado com a assinatura da API global do browser `window.confirm(message, callback)`. O Contexto implementado no projeto espera `confirm(options) => Promise<boolean>`.
- **Causa**: O hook destruturado `const { confirm } = useConfirm();` sobrepunha o `confirm` do tipo global, fazendo com que o linter identificasse corretamente a assinatura inconsistente do objeto options esperado (`{ title, message, ... }`). Em `src/views/JarvisBaseView.tsx` havia também duas chamadas que usavam a API global `window.confirm` omitindo o `useConfirm()`.
- **Arquivos Corrigidos**:
  - `src/views/ProvaPaulistaAnalysis.tsx`: refatorado de `confirm("...", () => { ... })` para `if (await confirm({ ... })) { ... }` transformando o handler do onClick em `async`.
  - `src/views/JarvisBaseView.tsx`: Refatorado adicionando `const { confirm } = useConfirm()` e alterando as chamadas para manter a interface uniforme e visual compatível (substituindo o modal padrão do browser pelo `ConfirmModal` do sistema).
  - `package.json`: Inserido o script de `"typecheck": "tsc --noEmit"`.
- **Resultado do TypeScript (typecheck)**: 0 erros, compilação passando limpa.
- **Resultado do Lint**: 0 erros.
- **Resultado do Build**: Completo com sucesso (código de saída 0).
- **Novos problemas encontrados**: Apenas alertas de bundle size do Vite que deverão ser avaliados quando houver separação física dos bundles no futuro (Chunk size warning). O baseline permanece verde e os contratos da API do `ConfirmContext` intactos sem mudar código funcional e nem as regras. Nenhuma nova dependência adicionada e interfaces mantidas idênticas.

## PROMPT 03 — BACKEND ARCHITECTURE UNIFICATION
- **Objetivo**: Eliminar a duplicação de lógica entre `server.ts` (entrypoint local) e `api/index.ts` (entrypoint serverless), criando uma camada unificada sem alterar contratos.
- **Implementação**: Foi criado o arquivo `src/server/api.ts` contendo a função `createApiRouter()`, que retorna um router do Express com todas as rotas `/api/*` da aplicação.
- **Rotas Unificadas**: 
  - `/client-error`, `/gemini-proxy`, `/generate-lousa` (antes exclusivas do `server.ts`).
  - `/parse-curriculum`, `/parse-addon-curriculum`, `/parse-curriculum-text`, `/extract-text`, `/generate-eval-report` (antes duplicadas).
- **Resultados de Validação**:
  - `npm run typecheck`: 0 erros.
  - `npm run lint`: 0 erros.
  - `npm run build`: sucesso (exit code 0).
- **Contratos da API**: Inalterados. Nenhuma regra de negócio ou funcionalidade frontend foi removida ou modificada. Nenhuma dependência externa foi instalada.
- **Próximos Passos (Prompt 04)**: As rotas ainda não possuem restrição de acesso autenticado. A proteção via Firebase Auth e checagem de tokens será implementada no próximo passo (Hardening de Segurança).

## PROMPT 04 — BACKEND SECURITY HARDENING
- **Objetivo**: Implementar a autenticação de rotas sensíveis para que o backend exija Firebase ID Token, restringindo também o `/api/gemini-proxy` para evitar abuso e limitando o tamanho dos uploads de arquivo.
- **Implementação**: 
  - Instalada a biblioteca `firebase-admin`.
  - Criado `src/server/firebaseAdmin.ts` para inicialização centralizada do admin.
  - Criado `src/server/authMiddleware.ts` com a lógica de `requireAuth` para barrar acessos não logados (401).
  - O entrypoint unificado `src/server/api.ts` foi refatorado para utilizar o `requireAuth` em todas as rotas sensíveis.
  - Proxy de IA restrito apenas aos métodos GET e POST, modelo `gemini-2.0-flash` e payload limitado a 25MB.
  - Criado `src/lib/apiClient.ts` que implementa um monkey-patch no `window.fetch` de modo que QUALQUER chamada feita pelo frontend ao diretório `/api/*` injete automaticamente o `Authorization: Bearer <token>` sem requerer modificação individual nas views.
  - O tratamento de erros (429, 503) do Gemini Proxy não expõe mais a string bruta gerada pela API do Google ao cliente, protegendo informações sobre a arquitetura.
- **Resultados de Validação**:
  - Testes com acesso deslogado e payloads inválidos resultam nos corretos status (401 e 413).
  - `npm run typecheck`: 0 erros.
  - `npm run lint`: 0 erros.
  - `npm run build`: sucesso (exit code 0).
- **Contratos da API**:
  - As interfaces se mantêm funcionalmente iguais, as rotas recebem os mesmos dados de antes (e retornam o mesmo), exceto que o backend os barra proativamente se a requisição originar de fonte não autenticada.
  - Nenhuma regra pedagógica, esquema de banco Firestore, ou Google OAuth (Drive, Agenda) foi alterado, o que fica sob pendência para a próxima etapa.
- **Próximos Passos (Prompt 05)**: O front ainda persiste localmente o `googleAuthToken` de um lado, e do outro a `userGeminiKey`. O foco deve ser direcionado no gerenciamento seguro dessas credenciais client-side.

## PROMPT 04.1 — AUTHORIZATION AND API CLIENT HARDENING
- **Objetivo**: Separar autenticação de autorização garantindo que apenas usuários em uma allowlist explícita acessem os recursos da IA via backend. Além disso, remover a sobrescrita global (monkey patch) do `window.fetch` para garantir integridade.
- **Implementação**: 
  - Adicionado middleware `requireAuthorizedUser` em `src/server/authMiddleware.ts` que valida a variável de ambiente `AUTHORIZED_FIREBASE_UIDS`.
  - Removido o import global lateral de `apiClient` em `src/main.tsx`.
  - Limpo o monkey patch de `fetch` do `src/lib/apiClient.ts`, exportando agora somente a função de rede explícita `authenticatedFetch`.
  - Passado o construtor explícito `{ fetch: authenticatedFetch } as any` ao `@google/genai` (SDK) em `src/lib/gemini.ts`.
  - Configurações de CORS (`server.ts` e `api/index.ts`) foram limitadas e passaram a ler de `ALLOWED_ORIGINS` ao invés de abrir livremente para a Vercel.
- **Resultados de Validação**:
  - Testes sem autenticação, com token malformado ou inválido retornam corretamente status 401.
  - Tentativas sem allowlist configurada "falham fechado" retornando status 503.
  - `npm run typecheck`: 0 erros.
  - `npm run lint`: 0 erros.
  - `npm run build`: sucesso (exit code 0).
- **Contratos da API**:
  - Interfaces funcionais mantidas. Somente clientes que passarem o token via header `Authorization` no `authenticatedFetch` chegarão aos endpoints.
- **Próximos Passos (Prompt 05)**: O front ainda persiste localmente o `googleAuthToken` de um lado, e do outro a `userGeminiKey`. O foco deve ser direcionado no gerenciamento seguro dessas credenciais client-side.

### PROMPT 06 — CANONICAL ACADEMIC DATA FOUNDATION

**Objetivo:** Criar um modelo acadêmico central, sem duplicar identidade de alunos, criando contratos de repositórios, sem modificar a persistência atual ou UI.

**Realizações:**
- Modelos canônicos criados em `src/domain/` (`ClassGroup`, `Student`, `AcademicYear`, `Lesson`, `Assessment`, `Planning`).
- Contratos de repositórios criados em `src/data/repositories/` (`ClassGroupRepository`, `StudentRepository`).
- Mappers legados puros implementados em `src/data/mappers/legacyMappers.ts`.
- Identificação de que `taskAnalysis` era a fonte mestra implícita da lista de alunos das turmas, enquanto `matificAnalysis` e `pp_` dependiam ou replicavam isso.
- O novo modelo adota IDs estáveis (`std_class_{id}_{numero}`) e separa os resultados acadêmicos (`AssessmentResult`) da identidade do aluno (`Student`).
- Fonte futura de verdade acadêmica foi definida no Firestore.
- Documentação de migração e arquitetura atualizada (`docs/DATA_MIGRATION_PLAN.md`, `docs/ACADEMIC_DATA_ARCHITECTURE.md`).

**Riscos e Observações:**
- Nenhum dado foi migrado neste passo.
- `localStorage` e Firestore mantêm os dados atuais inalterados.
- Os componentes UI continuam dependentes das chaves legadas.

**Itens ainda não migrados:**
- Refatoração dos componentes para usarem os Repositórios.
- Rotina efetiva de migração e merge de alunos duplicados.
- Backups antes da migração.

### PROMPT 06.1 — MIGRATION SAFETY HARDENING

**Objetivo:** Revisar e fortalecer o modelo canônico e o plano de migração, estabelecendo portas de segurança, mecanismos de ID seguros e resolvendo imprecisões conceituais (ex: Firestore como NoSQL, não relacional). Sem alterar a persistência ou migrar dados reais.

**Realizações:**
- Adição de `id` opacos (ex: UUID) para `ClassGroup` e `Student` e separação das chaves de pareamento em metadados (`migrationMetadata`, `legacySlug`).
- Definição do uso de uniões (`StudentsDatabase` + `taskAnalysis` + etc.) para a descoberta de alunos e priorização de dados baseada na origem e nível de confiança (`MatchConfidence`).
- Remoção da regra `Last-Write-Wins (LWW)` global, permitindo a consolidação de informações em diferentes níveis.
- Projeto de uma estrutura de coleções flat no Firestore (top-level em `users/{uid}`) para escalabilidade.
- Planejamento de backups particionados (chunked), separando os processos para Firestore e LocalStorage. Exclusão explícita de chaves sensíveis (ex: API Keys, credenciais, histórico de chats não-relevante).
- Definição formal das ferramentas de controle de migração: `migrationRunId`, `MigrationManifest`, Mapas de Idempotência e um `MigrationPreview` determinístico (dry-run) que não faz uso de APIs externas como Gemini ou gravações.
- Mappers (`src/data/mappers/legacyMappers.ts`) testados de modo puro, simulando as regras conceituais, sem integrar na UI ou persistir.

**Riscos e Observações:**
- Ainda não foram atualizados nem criados nenhum hook e não conectamos o repositório à UI.
- Nenhuma modificação foi feita em coleções reais; não ativamos nenhuma migração.

**Itens para o próximo prompt (Prompt 07):**
- Conectar mecanismos do Firestore aos contratos de repositório;
- Rodar o dry-run com dados reais da aplicação;
- Executar a migração de dados de fato (quando o gate estiver seguro);
- Atualizar a `USER_CURRENT_SCHEMA_VERSION`.

### PROMPT 07A.3 — FIREBASE HOSTING + FUNCTIONS PREPARATION
**Objetivo:** Preparar a aplicação para funcionar integralmente no Firebase (Hosting + Cloud Functions for Firebase), removendo a dependência estrutural da Vercel para o backend, sem realizar deploy automático.
**Realizações:**
- Arquivos/Estrutura Criada:
  - `functions/package.json` configurado para Node 22 com dependências server-side.
  - `functions/tsconfig.json`.
  - `functions/src/index.ts` servindo como Cloud Function entrypoint que encapsula a lógica partilhada do Express sem duplicação de código.
  - `firebase.json` unificando o frontend (`dist`) com `rewrites` para a `api` da Cloud Function, com fallback de SPA para `/index.html`.
  - Novos documentos de controle: `docs/FIREBASE_MIGRATION_PLAN.md` e `docs/FIREBASE_DEPLOY_CHECKLIST.md`.
- **Arquitetura & Segurança:**
  - `src/server/api.ts` compartilhado; o bundle de functions extrai a mesma lógica da *Shared API Layer*.
  - A inicialização do Admin SDK em `src/server/firebaseAdmin.ts` não foi alterada pois sua execução por omissão de ambiente (`getApps()`) é oficialmente compatível e segura no Cloud Functions.
  - A chave de IA (`GEMINI_API_KEY`) e as regras de autorização (`AUTHORIZED_FIREBASE_UIDS`) foram preparadas para gerenciamento server-side nativo.
  - As proteções desenvolvidas previamente para `/migration-admin` (Auth + Allowlist) mantêm-se firmes.
  - O PWA original (Vite) preserva os manifestos intactos (exclusão no firebase.json `ignore`).
- **Testes & Builds:**
  - Build local Vite: verde (`npm run build`).
  - Linter & Typecheck: verde (`npm run lint`, `npm run typecheck`).
  - Build das Functions: verde (esbuild).
- **Riscos / Billing:**
  - É **mandatório** upgrade para o plano Blaze antes do deploy da função no Cloud Functions (para cobrir execuções e imagens do Artifact Registry). O Hosting em si suportaria o tier Spark (Free).
- **Status do Deploy:** `NOT DEPLOYED`. Nenhuma migração ou push produtivo ocorreu. Nenhuma Vercel rule foi destruída ainda.


### TEMPORARY COMPATIBILITY PIN: FIREBASE ADMIN
- **firebase-admin**: Pinned exactly to `13.10.0`
- **Motivo**: upstream `ERR_REQUIRE_ESM` incompatibility involving `firebase-admin 14.x` / `jwks-rsa 4.x` / `jose 6.x` in CommonJS serverless runtimes (like Vercel).
- **Ação futura**: This pin should be reviewed and upgraded when the upstream issue is resolved.
