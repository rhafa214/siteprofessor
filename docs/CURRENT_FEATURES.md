# Inventário de Funcionalidades (EduAssistente)

## CORE
- **Dashboard / Mission Control** (`src/views/Dashboard.tsx`)
  - *Objetivo:* Visão central do professor, contendo widgets de notícias, atalhos, chat integrado com IA (Jarvis) e lembretes.
  - *Origem/Destino:* `localStorage` (widgets, chat), Firebase (lembretes/datas importantes), Google Calendar (via `useGoogleCalendar`), Gemini API.
  - *Dependências:* Firebase, Google Calendar, Gemini, dnd-kit (para drag & drop).
  - *Status:* Em uso (Página inicial principal).

- **Banco de Alunos** (`src/views/StudentsDatabase.tsx`)
  - *Objetivo:* Cadastro, importação (via CSV/TXT/Excel/PDF) e gerenciamento de turmas e alunos ativos.
  - *Origem/Destino:* Firebase (`users/{uid}/taskAnalysis/{turma}`), localStorage (`classTurmasList`).
  - *Dependências:* `studentExtractor.ts`, `fileExtraction.ts`, Firebase Firestore.
  - *Status:* Em uso.

- **Autenticação** (`src/views/LoginView.tsx`, `src/contexts/AuthContext.tsx`)
  - *Objetivo:* Login do usuário.
  - *Dependências:* Firebase Authentication (Google Auth / Email).
  - *Status:* Em uso.

- **Sistema de Janelas / Roteamento** (`src/components/layout/WindowManager.tsx`, `src/components/layout/Sidebar.tsx`)
  - *Objetivo:* Gerenciar a navegação sem usar um router tradicional (SPA com abas virtuais ou troca de estado).
  - *Status:* Em uso.

## IMPORTANT
- **Planejamento de Aula** (`src/views/LessonPlan.tsx`)
  - *Objetivo:* Criação de planos de aula utilizando IA (Gemini), gerenciamento e arquivamento de planejamentos passados, seleção de matriz curricular e turmas.
  - *Origem/Destino:* localStorage (`eduPlan`, `eduPlans_v2`, `eduPlans_dict`), Gemini API.
  - *Status:* Em uso (Crítico para a rotina).
  
- **Controle de Tarefas** (`src/views/TaskAnalysis.tsx`)
  - *Objetivo:* Registro de tarefas por turma, notas, cálculos de média parcial.
  - *Origem/Destino:* Firebase (`users/{uid}/taskAnalysis`).
  - *Status:* Em uso.

- **Matific / Prova Paulista** (`src/views/MatificAnalysis.tsx`, `src/views/ProvaPaulistaAnalysis.tsx`)
  - *Objetivo:* Acompanhamento e relatórios específicos dessas plataformas educacionais estaduais.
  - *Origem/Destino:* Firebase (`users/{uid}/matificAnalysis`, `users/{uid}/pp`).
  - *Status:* Em uso.
  
- **Cálculo de Média Bimestral** (`src/components/BimestralReportView.tsx`, `src/views/CalculadoraMediaView.tsx`)
  - *Objetivo:* Consolidação das avaliações e emissão de relatório por turma utilizando Gemini para gerar análises descritivas.
  - *Origem/Destino:* APIs (`/api/generate-eval-report`), Firebase Firestore.
  - *Status:* Em uso.

- **Diário de Classe / Log de Atividades** (`src/views/ClassJournal.tsx`)
  - *Objetivo:* Registro cronológico do que foi feito em cada aula.
  - *Origem/Destino:* Firebase, localStorage (`classLogs`).
  - *Status:* Em uso.

- **Base de Conhecimento / Jarvis Base** (`src/views/KnowledgeBase.tsx`, `src/views/JarvisBaseView.tsx`)
  - *Objetivo:* Armazenamento de arquivos PDF/texto para contexto da IA.
  - *Origem/Destino:* IndexedDB (pdf storage local via `localforage`), Firebase, Gemini API.
  - *Status:* Em uso.

- **Guia Pedagógico** (`src/views/GuiaPedagogicoView.tsx`, etc)
  - *Objetivo:* Consulta estruturada de matrizes e escopos da SED.
  - *Origem/Destino:* Dados estáticos e extraídos por IA (`spMathData.ts`).
  - *Status:* Em uso.

## OPTIONAL / EXPERIMENTAL
- **Lousa Mágica** (`src/views/LousaView.tsx`)
  - *Objetivo:* Quadro interativo para desenho e captura com análise do Gemini.
  - *Origem/Destino:* API (`/api/generate-lousa`), `perfect-freehand`.
  - *Status:* Experimental / Optional.

- **Integração Google Drive / Gmail / Agenda** (`src/components/Drive*.tsx`, `src/views/Agenda.tsx`)
  - *Objetivo:* Conectar ao Workspace do professor.
  - *Origem/Destino:* Google APIs, OAuth.
  - *Status:* Optional (Requer permissões extras).
