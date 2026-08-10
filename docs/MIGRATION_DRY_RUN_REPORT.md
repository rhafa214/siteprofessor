# Relatório de Dry Run de Migração

## 1. Dados Básicos
- **Data:** 2026-08-10T14:34:30.881Z
- **Backup ID (Simulado):** bkp_mock-uid-123_1786372470881
- **Migration Run ID:** mig_1786372470881
- **Status do Manifest:** DRY_RUN_COMPLETE

## 2. Fontes Encontradas
- **localStorage:** classTurmasList, eduPlans_v2
- **Firestore:** taskAnalysis, matificAnalysis

## 3. Resultados da Análise

### Turmas (ClassGroups)
- **Detectadas nas fontes (nomes crus):** 3
- **Propostas (Únicas por slug):** 2 (6a, 6-b)

### Alunos (Students)
- **Candidatos Totais Detectados (linhas):** 4
- **Matches Exatos (EXACT):** 0
- **Matches Alta Confiança (HIGH_CONFIDENCE):** 1
- **Matches Ambíguos (AMBIGUOUS):** 0
- **Candidatos Distintos (DISTINCT):** 3
- **Alunos Propostos (Total):** 3

### Avaliações e Resultados
- **Assessments Detectados:** 0
- **Resultados Resolvidos:** 0
- **Resultados Órfãos:** 0

### Planejamentos e Aulas
- **Planejamentos Detectados:** 1
- **Aulas (Lessons) MIGRATABLE:** 0

## 4. Problemas (Warnings/Errors)
- **Warnings:** 0
- **Erros:** 0
- **Records Skipped:** 0
- **Revisão Necessária (REVIEW_REQUIRED):** 0
