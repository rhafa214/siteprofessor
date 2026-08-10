import { generateMigrationPreview } from './src/data/migration/MigrationDryRun';
import { LegacyAcademicSnapshot } from './src/data/migration/LegacyDataCollector';
import { MigrationMapping } from './src/data/migration/MigrationMappingService';

const mockSnapshot: LegacyAcademicSnapshot = {
  capturedAt: Date.now(),
  userId: 'mock-uid-123',
  sources: ['localStorage', 'firestore'],
  localStorageData: {
    classTurmasList: ['6A'],
  },
  firestoreData: {
    taskAnalysis: {
      '6A': {
        alunos: [
          { id: 1, numero: 1, nome: 'João Silva' }
        ]
      }
    },
    matificAnalysis: {},
    pp_: {},
    assessments_grades: {},
    classLogs: {}
  },
  warnings: [],
  errors: []
};

console.log("--- RUN 1 ---");
const mappings: Record<string, MigrationMapping> = {};
const result1 = generateMigrationPreview(mockSnapshot, mappings, 'run-1');
console.log("New Mappings Count:", result1.newMappings.length);
const studentId1 = result1.newMappings.find(m => m.canonicalEntityType === 'STUDENT')?.proposedCanonicalId;
console.log("Student proposed ID 1:", studentId1);

console.log("\n--- RUN 2 ---");
const result2 = generateMigrationPreview(mockSnapshot, mappings, 'run-2');
console.log("New Mappings Count:", result2.newMappings.length); // Should be 0
const studentId2 = mappings[Object.keys(mappings).find(k => k.includes('STUDENT'))!].proposedCanonicalId;
console.log("Student proposed ID 2:", studentId2);

console.log("\nMatches:", studentId1 === studentId2 ? "YES (Idempotent)" : "NO (Failed)");

// Test ambiguous
console.log("\n--- RUN 3 (Ambiguous) ---");
const mockSnapshotAmbiguous: LegacyAcademicSnapshot = {
  capturedAt: Date.now(),
  userId: 'mock-uid-123',
  sources: ['localStorage', 'firestore'],
  localStorageData: {},
  firestoreData: {
    taskAnalysis: {
      '6A': {
        alunos: [
          { id: 1, numero: 1, nome: 'João Silva' }
        ]
      }
    },
    matificAnalysis: {
      '6A': {
        alunos: [
          { id: 2, numero: 2, nome: 'João Silva' } // Same name, different number -> Ambiguous
        ]
      }
    },
    pp_: {},
    assessments_grades: {},
    classLogs: {}
  },
  warnings: [],
  errors: []
};
const mappingsAmb = {};
const result3 = generateMigrationPreview(mockSnapshotAmbiguous, mappingsAmb, 'run-3');
console.log("Ambiguous Matches:", result3.preview.ambiguousMatches.length); // Should be 1
const newStudentIds = result3.newMappings.filter(m => m.canonicalEntityType === 'STUDENT').map(m => m.proposedCanonicalId);
console.log("Student proposed IDs:", newStudentIds.length, "(Should be 2 distinct IDs)");
console.log("Distinct?", newStudentIds[0] !== newStudentIds[1] ? "YES" : "NO");

