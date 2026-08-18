import { generateMigrationPreview } from '../src/data/migration/MigrationDryRun';
import { LegacyAcademicSnapshot } from '../src/data/migration/LegacyDataCollector';
import { MigrationMapping } from '../src/domain/migration';

function runTests() {
  const snapshot: LegacyAcademicSnapshot = {
    userId: 'test',
    capturedAt: Date.now(),
    sources: ['taskAnalysis', 'matificAnalysis', 'pp_'],
    localStorageData: { classTurmasList: ['Class A'], assessments_grades: {
      "assessment1": {
         "1": 10,
         "2": 8
      }
    } },
    firestoreData: {
      taskAnalysis: {
        'Class A': {
          alunos: [
            { id: 1, nome: 'Alice' },
            { id: 2, nome: 'Bob' },
            { id: 3, nome: 'Bob' } // Ambiguous with Bob above
          ]
        }
      },
      matificAnalysis: {
         'Class B': { // CLASS_NAME_NOT_FOUND
             students: [
                 { id: 4, nome: 'Charlie' },
                 { id: 5, nome: 'Dave' }
             ]
         }
      },
      pp_: {},
      apostilas: {},
      assessments_grades: {}
      ,classLogs: {}
    },
    warnings: [],
    errors: []
  };

  const mappings: Record<string, MigrationMapping> = {
    '1': {
      legacySource: 'taskAnalysis',
      legacyRecordIdentifier: 'Class A_1',
      canonicalEntityType: 'STUDENT',
      canonicalId: 'canonical_merge_bob',
      migrationRunId: 'run1',
    },
    '2': {
      legacySource: 'taskAnalysis',
      legacyRecordIdentifier: 'Class A_2',
      canonicalEntityType: 'STUDENT',
      canonicalId: 'canonical_merge_bob',
      migrationRunId: 'run1',
    },
    '3': {
      legacySource: 'taskAnalysis',
      legacyRecordIdentifier: 'Class A_3',
      canonicalEntityType: 'STUDENT',
      canonicalId: 'canonical_merge_bob',
      migrationRunId: 'run1',
    }
  };

  const { preview } = generateMigrationPreview(snapshot, mappings as any, 'run_test');

  console.log('--- TEST RESULTS V5 ---');
  
  // A) prepared mapping antigo agrupando dois registros que fresh considera distintos -> NEEDS_REBUILD.
  // We grouped Alice(1), Bob(2) and Bob(3) into 'canonical_merge_bob'.
  // Alice is distinct. Bob and Bob are ambiguous. None are merged by fresh.
  console.log('Needs Rebuild > 0 (A):', preview.mappingReconciliation.NEEDS_REBUILD > 0 ? 'PASS' : `FAIL (${preview.mappingReconciliation.NEEDS_REBUILD})`);
  
  // C, D) Matific class testing
  console.log('Matific records (C):', preview.matificClassResolutionAudit.records === 2 ? 'PASS' : `FAIL`);
  console.log('Unresolved Matific (D):', preview.classResolution.unresolvedClassesBySource.matificAnalysis === 2 ? 'PASS' : `FAIL`);
  
  // E) correlation between unresolved and ambiguous
  console.log('Ambiguity Correlation (E):', preview.ambiguityClassCorrelation !== undefined ? 'PASS' : 'FAIL');

  // F, G) Assessment adapter
  console.log('Result Schema Validated (G):', preview.resultAudit.schemaStatus.RESULT_SCHEMA_UNRECOGNIZED === 0 ? 'PASS' : 'FAIL');
  console.log('Adapter detected (F):', preview.resultAudit.structuralShapes['localstorage_assessments_grades']?.adapterUsed === '_ROOT_AS_RESULTS_' ? 'PASS' : `FAIL (${JSON.stringify(preview.resultAudit.structuralShapes)})`);
}

runTests();
