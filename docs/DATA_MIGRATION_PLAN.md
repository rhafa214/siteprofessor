# Plano de Migração de Dados Acadêmicos (Atualizado Prompt 06.1)

## A. Fontes atuais (Legacy)
- **localStorage**: `classTurmasList`, caches de `taskAnalysis`, `matificAnalysis`, `pp_`, `assessments_grades`, etc.
- **Firestore**: `taskAnalysis`, `matificAnalysis`, `pp_`, `classLogs` organizados implicitamente por nome da turma.

## B. Entidades Canônicas (Target)
- **ClassGroup**: Representa uma turma.
- **Student**: Representa um aluno.
- **AcademicYear**: Representa o ano letivo.
- **Lesson**: Representa uma aula/diário.
- **Assessment**: Representa uma avaliação/tarefa.
- **AssessmentResult**: Resultado de uma avaliação.
- **Planning**: Planejamento acadêmico.

## C. Estratégia para IDs Canônicos (Opaque IDs)
- **ClassGroup**: Geração de um novo identificador técnico (ex: UUID). O slug normalizado (ex: `6º-a`) é registrado no campo `legacySlug` para reconciliações e pesquisas, mas NUNCA é usado como identidade principal, pois um nome de turma pode colidir entre anos letivos (ex: 6º A de 2026 vs 6º A de 2027).
- **Student**: Geração de UUID opaco. O ID legado e os números associados vão para `migrationMetadata.legacyIds`. A identidade do aluno não ficará acoplada ao número da chamada (pois isso pode mudar).
- A separação entre *Id Canônico* e *Legacy Match Key (Fingerprint)* é crucial para permitir rastreabilidade sem poluir o domínio.

## D. Estratégia para Descoberta de Alunos (União e Matching)
- **Múltiplas Fontes**: Em vez de tratar a coleção `taskAnalysis` como a fonte mestra absoluta, construiremos a lista de alunos utilizando a **UNIÃO** de candidatos de todas as fontes: (`StudentsDatabase` + `taskAnalysis` + `matificAnalysis` + `pp_` + etc).
- **Classificação de Match**: Dois registros de alunos com chaves legadas serão pareados e classificados como:
  - `EXACT` (mesmo legacyId).
  - `HIGH_CONFIDENCE` (mesmo nome e número).
  - `AMBIGUOUS` (mesmo nome com números diferentes, ou mesmo número com nomes diferentes).
  - `DISTINCT` (nenhuma correspondência).
- Apenas candidatos `EXACT` e `HIGH_CONFIDENCE` serão mesclados automaticamente no mesmo `Student.id`. Casos `AMBIGUOUS` exigirão revisão ou serão mantidos como alunos separados temporariamente, rotulados como `REVIEW_REQUIRED`. Nomes semelhantes sozinhos nunca causarão um merge automático (para evitar juntar pessoas com o mesmo nome e sobrenome).

## E. Estratégia de Prioridade de Fonte (Source Priority) e Conflitos
- A política **Last-Write-Wins (LWW) GLOBAL É PROIBIDA**. Uma gravação recente do *Matific* pode ter metadados mais pobres que uma antiga do *Cadastro de Alunos*.
- **Hierarquia por Campo/Entidade**: A fusão de alunos durante a migração respeitará prioridades:
  - Para o nome e identificação base: *Banco de Alunos (StudentsDatabase)* > *taskAnalysis* > Outros.
  - Para as notas de avaliações, cada fonte (Matific, Prova Paulista) será a autoridade definitiva do seu respectivo `AssessmentResult`.

## F. Estratégia de Idempotência e Migration Mapping
- A migração utilizará um documento de registro de mapeamento (`migrationMapping`) que vinculará `(legacySource + legacyIdentifier)` ao `(canonicalId)`.
- Se a migração for rodada uma segunda vez, o sistema identificará que o registro já foi processado e ignorará (evitando duplicar `ClassGroups`, `Students`, etc).
- Se o usuário tiver modificado dados canônicos após a migração, a migração não os sobrescreverá silenciosamente.

## G. Estratégia de Backup, Fallback e Rollback
- **LocalStorage Backup Client-Side**: O cliente (browser) fará a coleta apenas de chaves *estritamente acadêmicas* do `localStorage`, montará um JSON fragmentado e os enviará para o Firestore.
- **Credenciais de Fora**: O backup NÃO incluirá `userGeminiKey`, tokens OAuth, senhas ou histórico de chat que não compõem a base acadêmica.
- **Chunked Backup**: Backups grandes serão divididos em "Chunks" dentro da coleção `users/{uid}/backups/{backupId}/chunks/{chunkId}`. Um documento mestre (Manifest) manterá o checksum.
- **Fallback**: Se a migração falhar ao ser lida (ex: `SUPPORTED_SCHEMA_VERSION` não reconhecido), o app pode continuar lendo os dados legados (`schema_version = 0`).
- **Rollback**: É uma operação ativa para reverter (deletar) as entidades recém-criadas na nuvem, usando os metadados `migrationRunId` inseridos em cada novo documento canônico.

## H. Migration Safety Gates (Portões de Segurança)
A migração real no Prompt 07 não começará até que:
1. Backup possa ser criado e validado.
2. Dry-Run possa ser completado (sem erros bloqueadores).
3. Conflitos ambíguos sejam conhecidos e categorizados.
4. O *MigrationManifest* possa ser gerado.
5. Idempotência por Mapeamento e Rollback Seletivo estejam definidos.

## I. Dry-Run e Migration Preview
- Uma análise pura (`analyzeLegacyData()`) varrerá os snapshots do Firestore/localStorage sem realizar nenhuma operação de escrita real.
- Vai gerar um relatório (Preview) mostrando total de turmas encontradas, estudantes descobertos, ambiguidades que requerem revisão humana e quantidade de `Assessments`.
