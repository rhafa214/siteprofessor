# Alvos de Refatoração

Esta lista contém os maiores arquivos TypeScript/TSX do projeto, que concentram muitas responsabilidades e devem ser analisados futuramente para quebra de componentes.

1. **`src/views/LessonPlan.tsx`**
   - **Linhas aproximadas**: ~2130 linhas.
   - **Responsabilidades**: Gerenciamento completo de tela de planejamento, chamadas massivas ao Gemini com prompts imensos, manipulação de cache `eduPlans_v2`, renderização de Markdown, formulários de criação, visualização, listagem de turmas.
   - **Candidato por**: Ser um arquivo "Deus", excessivamente longo, com mistura de lógica de negócios, chamadas de API, estados complexos e layout.

2. **`src/views/Dashboard.tsx`**
   - **Linhas aproximadas**: ~1965 linhas.
   - **Responsabilidades**: Mission Control, Widgets drag and drop (`@dnd-kit`), chamadas de notificação, chat integrado com "Jarvis", sincronização de Google Calendar, emails do Gmail, histórico de conversas.
   - **Candidato por**: Mistura pesada de UI (muitas modais), hooks customizados grandes rodando inline, inicialização de plugins, chat local, lógicas temporais de saudação.

3. **`src/views/MatificAnalysis.tsx`**
   - **Linhas aproximadas**: ~1160 linhas.
   - **Responsabilidades**: Gerenciamento de tarefas do Matific, salvamento em Firebase, notas bimestrais, cache em localStorage, relatórios agregados.
   - **Candidato por**: A interface da tabela de notas e o parser das planilhas deveriam ser componentes e utilities separados. A lógica é muito parecida (duplicada) em relação ao `TaskAnalysis`.

4. **`src/views/TaskAnalysis.tsx`**
   - **Linhas aproximadas**: ~965 linhas.
   - **Responsabilidades**: Mesmas do MatificAnalysis, mas focadas em Tarefas de Classe.
   - **Candidato por**: Código de tabela HTML complexo e muita lógica de controle embutida na View.

5. **`src/views/SchoolAssessments.tsx`**
   - **Linhas aproximadas**: ~925 linhas.
   - **Responsabilidades**: Controle e análise de avaliações gerais (bimestrais).
   - **Candidato por**: Repetição de lógicas de fetch do Firebase, tabelas enormes renderizadas inline.
