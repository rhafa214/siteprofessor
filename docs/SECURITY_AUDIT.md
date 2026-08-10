# Auditoria de Segurança

## CRITICAL
- **[RESOLVED] Endpoints da API sem autenticação**: As rotas no backend possuíam acesso público. O Firebase Admin foi configurado e agora o middleware de autenticação intercepta as requisições.
- **[RESOLVED] Authorization (Acesso Autorizado)**: Além de autenticação, agora existe uma layer de autorização. Somente usuários cujo UID conste em `AUTHORIZED_FIREBASE_UIDS` podem utilizar os endpoints sensíveis.
- **[RESOLVED] Authenticated API Client**: O monkey patch global de fetch foi removido. Foi criado um cliente de API isolado (`authenticatedFetch`) que cuida apenas das rotas da API interna do backend injetando o Firebase ID Token.
- **[OPEN] Tokens no LocalStorage (Google OAuth Token)**: A chave `googleAuthToken` guarda um Token de Acesso do Google Workspace em `localStorage`. Isso expõe o acesso completo do usuário (Drive/Calendar/Gmail) via XSS. (Pendente - Próximos Prompts).

## HIGH
- **[OPEN] Regras do Firestore (`firestore.rules`)**: Sem análise profunda das regras (pois não foram impressas todas), coleções como `users/{uid}` costumam estar protegidas, mas é imperativo validar se o acesso é estritamente `request.auth.uid == uid`.
- **[RESOLVED] Uploads sem sanitização severa**: As rotas agora contam com limites explícitos e globais de 50MB (para comportar PDFs com imagens do dia a dia escolar), evitando abuso ilimitado.
- **[RESOLVED] Gemini Proxy**: Agora possui validação estrita, permitindo apenas `gemini-2.0-flash` e limitando payload a 25MB, evitando que o backend seja usado de forma arbitrária.
- **[RESOLVED] Tratamento de Erros**: O envio integral de logs externos (como 429 e erros brutos do Google) foi cortado; respostas sanitizadas são exibidas ao front.

## MEDIUM
- **[OPEN] Gemini Key Injetada no Frontend**: O sistema permite o usuário fornecer sua própria `userGeminiKey` que vai para o LocalStorage. Funcionalmente é prático, mas expõe a chave a extensões. (Pendente).
- **[OPEN] VITE_GEMINI_API_KEY**: Se `VITE_GEMINI_API_KEY` for compilada no client bundle (como o prefixo `VITE_` permite), os usuários podem extraí-la e utilizá-la fora do app.
- **[RESOLVED] CORS**: CORS está rigorosamente restrito a origens conhecidas e configuráveis por `ALLOWED_ORIGINS` e de desenvolvimento.

## LOW
- **[OPEN] Inconsistência State/Firebase**: Dados sensíveis de alunos estão salvos localmente misturados a chaves obscuras no localStorage e podem persistir num PC compartilhado.

## PROMPT 05: CLIENT-SIDE CREDENTIAL ELIMINATION

### GOOGLE OAUTH SCOPE REVIEW
- **https://www.googleapis.com/auth/calendar.readonly**: POSSIBLY OVERPRIVILEGED (Apenas usado para leitura da agenda. Veremos em breve se pode ser substituído por algo mais restrito ou mantido).
- **https://www.googleapis.com/auth/drive**: POSSIBLY OVERPRIVILEGED (Permite acesso total ao Drive. Pode ser restrito para `drive.file` ou `drive.readonly` no futuro).
- **https://www.googleapis.com/auth/gmail.readonly**: REQUIRED (Necessário para listar e ler emails).

### RESOLUÇÕES
- **Backend Authentication**: RESOLVED
- **Backend Authorization**: RESOLVED
- **userGeminiKey**: RESOLVED (Removida funcionalmente e limpada do localStorage. Backend assume toda operação via `GEMINI_API_KEY`).
- **Gemini API Key Exposure**: RESOLVED (Nenhuma key no client bundle e nenhuma variável `VITE_GEMINI_*`).
- **googleAuthToken LocalStorage**: RESOLVED (Movido de `localStorage` para `sessionStorage` em memória durante a sessão).
- **Google OAuth Scope Minimization**: PARTIALLY RESOLVED (Escopos mapeados, mas redução ainda precisa de testes nas integrações).
- **Google Token Lifetime**: RESOLVED (Token expira junto com a aba/sessão e não há persistência durável ou refresh token inseguro).
