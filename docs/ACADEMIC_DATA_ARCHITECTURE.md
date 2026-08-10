# Arquitetura de Dados Acadêmicos

## Diagrama Conceitual (Entidades)

```
AcademicYear
   |
   +--> ClassGroup
           |
           +--> Student
           |
           +--> Lesson
           |
           +--> Assessment
                   |
                   +--> AssessmentResult
                           |
                           +--> Student

Planning
   |
   +--> ClassGroup
   +--> AcademicYear
```

## Papéis dos Repositórios e Serviços

O acesso aos dados não deve ser feito chamando o Firebase DIRETAMENTE de dentro da UI, para evitar acoplamento e permitir fallback/offline mais seguro, e facilitar migrações futuras.

A arquitetura alvo (futura) será:

```
React Component (UI)
   |
   v
Custom Hook / Service (Lógica de negócios, cache em memória)
   |
   v
Repository Contract (Interface)
   |
   v
Concrete Implementation (FirestoreRepository, LocalStorageFallback)
   |
   v
Fonte de Dados Real
```

## Fonte da Verdade

- **Firestore**: Fonte primária para identidades (Turmas, Alunos, Avaliações, Resultados, Aulas, Planejamentos). O Firestore é um banco de dados NoSQL orientado a documentos. O modelo de dados canônico usa referências e IDs técnicos opacos (e não os nomes das coleções) para formar relacionamentos lógicos, em vez de depender da estrutura de subcoleções aninhadas.
- **LocalStorage**: Utilizado para cache de sessão rápida (ex: estado offline otimista, cache local antes da sincronização, preferências de visualização) e chaves legadas até o fim da migração.
- **IndexedDB/localforage**: Utilizado para arquivos grandes (ex: Storage de PDFs, imagens e blobs de longo prazo).
- **Google Drive**: Fonte externa de documentos não estruturados, materiais didáticos. Não utilizado como banco de dados ou identidade acadêmica.

## Identificadores Canônicos (Opaque IDs)

Os IDs permanentes gerados no momento da migração (`id`) devem ser IDs técnicos (ex: UUID) em vez de chaves legadas ou strings concatenadas como nomes de turmas e números de alunos.
- `ClassGroup.id`: UUID gerado no momento da migração. O nome normalizado (slug) será mantido como um campo auxiliar.
- `Student.id`: UUID gerado no momento da migração. Identificadores temporários e chaves de combinação (Legacy Match Keys) são armazenados separadamente e processados no momento da migração.

## Metadata e Migration Metadata

- `metadata`: Deve ser reservado estritamente para dados específicos do domínio do aplicativo e lógica de negócios.
- `migrationMetadata`: Sub-objeto para informações contextuais da migração (ex: `migrationRunId`, `legacyIds`, `sources`, etc). Isso mantém a pureza do modelo acadêmico sem apagar os metadados de histórico da migração.

## Estrutura Firestore Canônica Proposta

Organizaremos as informações principais em coleções top-level do Firebase vinculadas ao ID do usuário. Essa abordagem "flat" no NoSQL previne limites de tamanho de documento do Firestore, facilita consultas filtradas cruzadas e reduz a duplicação.

```
users/{uid}/academicYears/{academicYearId}
users/{uid}/classGroups/{classGroupId}
users/{uid}/students/{studentId}
users/{uid}/assessments/{assessmentId}
users/{uid}/assessmentResults/{resultId}
users/{uid}/lessons/{lessonId}
users/{uid}/plannings/{planningId}
```

## Isolamento da UI

A implementação desta arquitetura exigirá que componentes como `Dashboard.tsx`, `MatificAnalysis.tsx` etc. não mais chamem `collection(db, ...)` diretamente, mas consumam `useClassGroups()`, `useStudents()`, etc.
