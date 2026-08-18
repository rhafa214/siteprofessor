import { generateMigrationPreview } from '../src/data/migration/MigrationDryRun';
import { LegacyAcademicSnapshot } from '../src/data/migration/LegacyDataCollector';
import { MigrationMapping } from '../src/data/migration/MigrationMappingService';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error('FAIL: ' + msg);
    process.exit(1);
  } else {
    console.log('PASS: ' + msg);
  }
}

const mockSnapshot: LegacyAcademicSnapshot = {
  capturedAt: Date.now(),
  userId: 'test',
  sources: ['test'],
  localStorageData: {
    classTurmasList: ['ClassA']
  },
  firestoreData: {
    taskAnalysis: {
      ClassA: [
        { id: 1, nome: 'Joao', numero: 1 },
        { id: 2, nome: 'Joao', numero: 2 }, 
        { nome: 'Maria' }, 
        { id: 4, nome: 'Ana', numero: 4 },
        { id: 5, nome: 'Ana', numero: 4 } 
      ]
    },
    matificAnalysis: {},
    pp_: {
      ClassX: [
        { id: 6, nome: 'Pedro', numero: 6 } 
      ]
    },
    apostilas: {
       assess1: { results: { '1': 10 } },
       assess2: { notas: { '1': 10 } }
    },
    assessments_grades: {},
    classLogs: {}
  },
  warnings: [],
  errors: []
};

const mockExistingMappings: Record<string, MigrationMapping> = {
  'm1': { legacySource: 'taskAnalysis', legacyRecordIdentifier: 'ClassA_id_1', canonicalEntityType: 'STUDENT', proposedCanonicalId: 'canonical_joao1', migrationRunId: 'run1', status: 'PREPARED', createdAt: 0 },
  'm2': { legacySource: 'taskAnalysis', legacyRecordIdentifier: 'ClassA_id_2', canonicalEntityType: 'STUDENT', proposedCanonicalId: 'canonical_joao2', migrationRunId: 'run1', status: 'PREPARED', createdAt: 0 },
  'm3': { legacySource: 'taskAnalysis', legacyRecordIdentifier: 'ClassA_fallback_2_maria', canonicalEntityType: 'STUDENT', proposedCanonicalId: 'canonical_maria', migrationRunId: 'run1', status: 'PREPARED', createdAt: 0 },
  'm4': { legacySource: 'taskAnalysis', legacyRecordIdentifier: 'ClassA_id_4', canonicalEntityType: 'STUDENT', proposedCanonicalId: 'canonical_ana', migrationRunId: 'run1', status: 'PREPARED', createdAt: 0 },
  'm5': { legacySource: 'taskAnalysis', legacyRecordIdentifier: 'ClassA_id_5', canonicalEntityType: 'STUDENT', proposedCanonicalId: 'canonical_ana_different', migrationRunId: 'run1', status: 'PREPARED', createdAt: 0 }, 
  'm6': { legacySource: 'pp_', legacyRecordIdentifier: 'ClassX_id_6', canonicalEntityType: 'STUDENT', proposedCanonicalId: 'canonical_pedro', migrationRunId: 'run1', status: 'PREPARED', createdAt: 0 },
};

const result = generateMigrationPreview(mockSnapshot, mockExistingMappings, 'run1');
const pv = result.preview;

console.log(JSON.stringify(pv, null, 2));

assert(pv.freshMatching.recordsAnalyzed === 6, 'Fresh matching analyzed all 6 records');
assert(pv.mappingConsistency.mismatchGroups > 0, 'Mismatch groups detected (prepared distinct, fresh merge)');
assert(pv.mappingConsistency.preparedDistinctButFreshMerge > 0, 'Prepared Distinct But Fresh Merge detected');
assert(pv.identifierSafety.unstableLegacyIdentifiers === 1, 'Unstable legacy identifier correctly detected for Maria');
assert(pv.classResolution.unresolvedClassAssignments === 1, 'Unresolved class assignment correctly detected for Pedro in ClassX');
assert(pv.freshMatching.ambiguousGroups === 1, 'Ambiguous group detected for Joao 1 and Joao 2');
assert(pv.resultAudit.unrecognizedRecords['firestore_apostilas'] === 1, 'Unrecognized results shape flagged in resultAudit');

console.log('ALL SYNTHETIC TESTS PASSED');
