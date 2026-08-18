import { generateMigrationPreview } from '../src/data/migration/MigrationDryRun';
import { LegacyAcademicSnapshot } from '../src/data/migration/LegacyDataCollector';
import { calculateStudentMatchConfidence } from '../src/data/mappers/legacyMappers';
import { Student } from "../src/domain";

function runTests() {
  console.log('--- TEST RESULTS V6 ---');

  // TEST A: same source, different strong IDs -> DISTINCT
  const sA1 = { id: 's1', classGroupId: 'c1', name: 'Alice', number: 1, status: 'ACTIVE', createdAt: 0, updatedAt: 0 } as Student;
  const sA2 = { id: 's2', classGroupId: 'c1', name: 'Alice', number: 2, status: 'ACTIVE', createdAt: 0, updatedAt: 0 } as Student;
  const resA = calculateStudentMatchConfidence(sA1, sA2, 'src1', 'src1', 'id_1', 'id_2');
  console.log('Test A (Same source, diff ID -> DISTINCT):', resA.confidence === 'DISTINCT' ? 'PASS' : `FAIL (${resA.confidence})`);

  // TEST B: diff source, same local ID -> not EXACT
  const resB = calculateStudentMatchConfidence(sA1, sA2, 'src1', 'src2', 'id_1', 'id_1');
  console.log('Test B (Diff source, same local ID -> not EXACT):', resB.confidence !== 'EXACT' ? 'PASS' : 'FAIL');

  // TEST D: UNRESOLVED x UNRESOLVED -> not SAME_CLASS
  const sD1 = { id: 's1', classGroupId: 'UNRESOLVED', name: 'Bob', number: 1, status: 'ACTIVE', createdAt: 0, updatedAt: 0 } as Student;
  const sD2 = { id: 's2', classGroupId: 'UNRESOLVED', name: 'Bob', number: 1, status: 'ACTIVE', createdAt: 0, updatedAt: 0 } as Student;
  const resD = calculateStudentMatchConfidence(sD1, sD2, 'src1', 'src2', 'id_1', 'id_2');
  console.log('Test D (UNRESOLVED != SAME_CLASS):', resD.reason === 'DIFFERENT_CLASS' && resD.confidence === 'DISTINCT' ? 'PASS' : `FAIL (${resD.reason})`);

  // E) 81 UNRESOLVED students do not create 3240 ambiguities
  const snapshot: LegacyAcademicSnapshot = {
    userId: 'test',
    capturedAt: Date.now(),
    sources: ['taskAnalysis', 'matificAnalysis', 'pp_'],
    localStorageData: { classTurmasList: ['Class A'], assessments_grades: {
       "eval1": { "1": 10, "2": "falta", "3": { score: 5 }, "4": "invalid" }
    }, eduPlans_v2: null },
    firestoreData: {
      taskAnalysis: {},
      matificAnalysis: {
         'Class_Missing': {
             students: Array.from({length: 81}).map((_, i) => ({ id: i, name: `Student ${i}` }))
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

  const { preview } = generateMigrationPreview(snapshot, {}, 'run_test');
  
  // Test E
  console.log('Test E (81 UNRESOLVED ambiguities count):', preview.freshMatching.ambiguousPairs === 0 ? 'PASS' : `FAIL (${preview.freshMatching.ambiguousPairs})`);
  
  // Test F: Name extraction
  console.log('Test F (Name found in field alternative):', preview.studentFieldCoverage['matificAnalysis'].usableName === 81 ? 'PASS' : `FAIL (${preview.studentFieldCoverage['matificAnalysis'].usableName})`);
  
  // Test G & H (Class patterns)
  console.log('Test G/H (Matific Pattern Audit):', preview.matificClassPatternAudit.unresolvedPatterns === 1 ? 'PASS' : 'FAIL');

  // Test I: Adapter grades validation
  console.log('Test I (Result Schema leaves):', preview.resultAudit.resultAdapterValidation.recognizedLeaves === 2 ? 'PASS' : `FAIL (${preview.resultAudit.resultAdapterValidation.recognizedLeaves})`);
  console.log('Test I (Unrecognized leaves):', preview.resultAudit.resultAdapterValidation.unrecognizedLeaves === 2 ? 'PASS' : `FAIL (${preview.resultAudit.resultAdapterValidation.unrecognizedLeaves})`);
}

runTests();
