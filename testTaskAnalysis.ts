import { TaskAnalysisMatchingService } from './src/services/academic/TaskAnalysisMatchingService.ts';
import { AcademicRosterService, CanonicalStudentRoster } from './src/services/academic/AcademicRosterService.ts';

async function runTests() {
  console.log("Running Task Analysis Tests...");

  const matcher = new TaskAnalysisMatchingService();

  const roster: CanonicalStudentRoster[] = [
    { studentId: 's1', name: 'João da Silva', normalizedName: 'joao da silva', callNumber: 1 },
    { studentId: 's2', name: 'Maria Aparecida', normalizedName: 'maria aparecida', callNumber: 2 },
    { studentId: 's3', name: 'Carlos Eduardo', normalizedName: 'carlos eduardo', callNumber: 3 },
    { studentId: 's4', name: 'Ana Souza', normalizedName: 'ana souza', callNumber: 4 },
    // Ambiguidade para testar P
    { studentId: 's5', name: 'José Santos', normalizedName: 'jose santos', callNumber: 5 },
    { studentId: 's6', name: 'José Santos', normalizedName: 'jose santos', callNumber: 6 },
  ];

  const importedNames = [
    'joao da silva', // Exact normalized
    'Mária AParecíDa ', // Case/Accent
    'Batman', // Unmatched
    'José Santos' // Ambiguous
  ];

  const result = matcher.matchImportedRecords(importedNames, roster);

  if (result.matched.length !== 2) throw new Error(`Expected 2 matched, got ${result.matched.length}`);
  if (result.matched[0].student.name !== 'João da Silva') throw new Error(`M failed`);
  if (result.matched[1].student.name !== 'Maria Aparecida') throw new Error(`N failed`);

  const unmatchedBatman = result.unmatched.find(u => u.fileRecord.rawName === 'Batman');
  if (!unmatchedBatman || unmatchedBatman.reason !== 'UNMATCHED_STUDENT') throw new Error(`O failed`);

  const ambiguousJose = result.unmatched.find(u => u.fileRecord.rawName === 'José Santos');
  if (!ambiguousJose || ambiguousJose.reason !== 'AMBIGUOUS_STUDENT_MATCH') throw new Error(`P failed`);

  if (result.missingStudents.length !== 4) throw new Error(`R failed: expected 4 missing, got ${result.missingStudents.length}`);

  console.log("All matching tests passed!");
}

runTests().catch(e => {
  console.error("Test failed", e);
  process.exit(1);
});
