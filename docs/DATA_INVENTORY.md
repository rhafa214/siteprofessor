# Inventário de Dados

## Fontes de Dados
- **Firebase Firestore**: Utilizado como banco de dados principal sincronizado na nuvem (NoSQL, orientado a documentos). Coleções principais ficam dentro de `users/{uid}/...`.
- **Firebase Authentication**: Login e gestão de usuários.
- **LocalStorage**: Cache local, configurações e, em alguns casos, fonte da verdade (antes da nuvem).
- **IndexedDB (localforage)**: Armazenamento de arquivos binários grandes (PDFs) no frontend (`localPdfStorage.ts`).
- **Google Workspace APIs**: Integrações para leitura de Drive, Gmail e Agenda.

## CURRENT LEGACY MODEL

Chaves atualmente em uso que requerem migração ou manutenção:

- `classTurmasList`: [MIGRATION TARGET] Lista de nomes de turmas. 
  - **Entity Type:** ClassGroup
  - **Conflict Risk:** Baixo.
  - **Has stable legacy ID?** Não.
- `taskAnalysis_{bKey}_{turma}` / `taskAnalysis_{turma}`: [MIGRATION TARGET] [CACHE] Cache/Legacy offline das tarefas.
  - **Entity Type:** Student, Assessment, AssessmentResult
  - **Source Priority:** Media (para Identidade de Alunos); Alta (para notas de tarefas).
  - **Has stable legacy ID?** Sim (aluno.id / número).
- `matificAnalysis_{bKey}_{turma}` / `matificAnalysis_{turma}`: [MIGRATION TARGET] [CACHE] Cache offline das notas do Matific.
  - **Entity Type:** Student, Assessment, AssessmentResult
  - **Source Priority:** Media (para Identidade); Alta (para notas do Matific).
  - **Has stable legacy ID?** Sim (login matific / nome / numero).
- `pp_{bKey}_{turma}` / `pp_{turma}`: [MIGRATION TARGET] [CACHE] Cache offline da Prova Paulista.
  - **Entity Type:** Student, Assessment, AssessmentResult
  - **Source Priority:** Alta (para resultados de prova); Baixa (para identidade base).
  - **Has stable legacy ID?** Sim (numero do aluno).
- `assessments_grades`: [MIGRATION TARGET] [CACHE] Cache offline de avaliações.
  - **Entity Type:** Assessment, AssessmentResult
  - **Source Priority:** Alta (para notas de provas externas ou locais).
- `customAulas`: [MIGRATION TARGET] Lista de aulas personalizadas pelo usuário.
  - **Entity Type:** Lesson
- `eduPlan` / `eduPlans_dict` / `eduPlans_v2`: [MIGRATION TARGET] Planos de aula.
  - **Entity Type:** Planning
- `classLogs`: [MIGRATION TARGET] Diário de classe local.
  - **Entity Type:** Lesson
- `userGeminiKey`, `googleAuthToken`: [CREDENTIAL LEGACY] [REMOVED] Não deve entrar em backups!
- `lessonPlanChatCurrent`, `app_background_url`, `nav_class_journal_turma`, `eduCurrentChatId`, `widget_order`, `efapeDone`: [PREFERENCES / ACTIVE LEGACY] Manter como estão, ou migrar apenas prefs não-estruturadas.

## TARGET CANONICAL MODEL

- **ClassGroup**: Representa uma turma consolidada (`src/domain/classGroup.ts`).
- **Student**: Representa um aluno único sem notas agregadas (`src/domain/student.ts`).
- **AcademicYear**: Modelo para anos letivos.
- **Lesson**: Registro de aulas/diários.
- **Assessment**: Definição de avaliações, tarefas, provas (incluindo provas externas como Matific e PP).
- **AssessmentResult**: Resultado individual de aluno em uma Assessment específica.
- **Planning**: Planejamentos (anual, bimestral, semanal, aula).

