import { generateMigrationPreview } from '../src/data/migration/MigrationDryRun';
import { LegacyAcademicSnapshot } from '../src/data/migration/LegacyDataCollector';
import { MigrationMapping } from '../src/domain/migration';

function runTests() {
  const snapshot: LegacyAcademicSnapshot = {
    userId: 'test',
    capturedAt: Date.now(),
    sources: ['taskAnalysis', 'matificAnalysis', 'pp_'],
    localStorageData: { classTurmasList: ['Class A'] },
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
      matificAnalysis: {},
      pp_: {},
      apostilas: {
        'Class A': { // No results expected
          'doc1': { title: 'Apostila 1' } 
        }
      },
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
      canonicalId: 'student_alice',
      migrationRunId: 'run1'
    },
    '2': {
      legacySource: 'taskAnalysis',
      legacyRecordIdentifier: 'Class A_2',
      canonicalEntityType: 'STUDENT',
      canonicalId: 'student_bob',
      migrationRunId: 'run1'
    }
    // Bob 2 is not mapped, so we should get mappingMissing
  };

  const { preview } = generateMigrationPreview(snapshot, mappings as any, 'run_test');

  console.log('--- TEST RESULTS ---');
  
  // A, B, C, D, E: Mappings consistency
  console.log('Mapping Missing (D):', preview.mappingConsistency.preparedMappingMissing === 1 ? 'PASS' : `FAIL (${preview.mappingConsistency.preparedMappingMissing})`);
  console.log('Exact Key Matches (A):', preview.mappingConsistency.mappingLookup.exactKeyMatches === 2 ? 'PASS' : `FAIL (${preview.mappingConsistency.mappingLookup.exactKeyMatches})`);
  
  // F: Sum of pair matches
  const fm = preview.freshMatching;
  const sumMatches = fm.exactMatches + fm.highConfidenceMatches + fm.ambiguousPairs + fm.distinctPairs;
  console.log('Pair Comparisons Math (F):', sumMatches === fm.pairComparisons ? 'PASS' : `FAIL (sum=${sumMatches}, actual=${fm.pairComparisons})`);

  // G, H: Assessment results logic
  console.log('Result Schema Validated (H):', preview.resultAudit.schemaStatus.RESULT_SCHEMA_UNRECOGNIZED === 0 ? 'PASS' : 'FAIL');
  console.log('Result Not Expected (G):', preview.resultAudit.schemaStatus.RESULT_NOT_EXPECTED === 1 ? 'PASS' : 'FAIL');
  
  // I, J, K: MIGRATION_READY gates
  console.log('Migration Ready Gate (I, J, K):', preview.MIGRATION_READY === false ? 'PASS' : 'FAIL');
  console.log('Blocking Reasons:', preview.blockingReasons);
}

runTests();
