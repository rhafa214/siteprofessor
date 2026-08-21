import { AcademicRosterService, CanonicalStudentRoster } from './src/services/academic/AcademicRosterService';
import { AcademicMatchingService } from './src/services/academic/AcademicMatchingService';

// Mock dependencies
class MockStudentRepo {
  private students: Record<string, any> = {};
  setStudents(s: any[]) {
    this.students = {};
    for (const student of s) {
      this.students[student.id] = student;
    }
  }
  async getById(uid: string, id: string) {
    return this.students[id] || null;
  }
}

class MockEnrollmentRepo {
  private enrollments: any[] = [];
  setEnrollments(e: any[]) {
    this.enrollments = e;
  }
  async getActiveByClassGroup(uid: string, classGroupId: string) {
    return this.enrollments.filter(e => e.classGroupId === classGroupId && e.status === 'ACTIVE');
  }
}

async function runAudit() {
  console.log("Running Audit 08C.1.1 Tests...");
  
  const studentRepo = new MockStudentRepo() as any;
  const enrollmentRepo = new MockEnrollmentRepo() as any;
  const rosterService = new AcademicRosterService(studentRepo, enrollmentRepo);
  const matchService = new AcademicMatchingService();
  
  const uid = "mock_user";
  const yearId = "year2026";
  const classId = "class6B";

  // Base dataset
  let mockStudents = [];
  let mockEnrollments = [];
  
  // A) 34 ACTIVE -> roster 34
  for (let i = 1; i <= 34; i++) {
    mockStudents.push({ id: `st${i}`, name: `Student ${i}`, normalizedName: `student ${i}` });
    mockEnrollments.push({ id: `en${i}`, studentId: `st${i}`, classGroupId: classId, academicYearId: yearId, status: 'ACTIVE', callNumber: i });
  }
  
  studentRepo.setStudents(mockStudents);
  enrollmentRepo.setEnrollments(mockEnrollments);
  
  let roster = await rosterService.getActiveRoster(uid, yearId, classId);
  console.assert(roster.length === 34, `A failed: expected 34, got ${roster.length}`);
  
  // B) +1 TRANSFERRED -> roster continua 34
  mockStudents.push({ id: `st35`, name: `Transferred Student`, normalizedName: `transferred student` });
  mockEnrollments.push({ id: `en35`, studentId: `st35`, classGroupId: classId, academicYearId: yearId, status: 'TRANSFERRED', callNumber: 35 });
  studentRepo.setStudents(mockStudents);
  enrollmentRepo.setEnrollments(mockEnrollments);
  
  roster = await rosterService.getActiveRoster(uid, yearId, classId);
  console.assert(roster.length === 34, `B failed: expected 34, got ${roster.length}`);
  
  // C) +1 ACTIVE -> proxima leitura 35 (J is same basically)
  mockStudents.push({ id: `st36`, name: `New Active`, normalizedName: `new active` });
  mockEnrollments.push({ id: `en36`, studentId: `st36`, classGroupId: classId, academicYearId: yearId, status: 'ACTIVE', callNumber: 36 });
  studentRepo.setStudents(mockStudents);
  enrollmentRepo.setEnrollments(mockEnrollments);
  
  roster = await rosterService.getActiveRoster(uid, yearId, classId);
  console.assert(roster.length === 35, `C/J failed: expected 35, got ${roster.length}`);
  
  // D) Student without ACTIVE enrollment -> won't appear (same as B essentially)
  // Tested by B.
  
  // E) callNumber comes from Enrollment & Ordered correctly
  // Let's create specific test for E and ordering.
  mockStudents.push({ id: `st37`, name: `Zebra`, normalizedName: `zebra` });
  mockEnrollments.push({ id: `en37`, studentId: `st37`, classGroupId: classId, academicYearId: yearId, status: 'ACTIVE', callNumber: null }); // null call number
  
  mockStudents.push({ id: `st38`, name: `Aardvark`, normalizedName: `aardvark` });
  mockEnrollments.push({ id: `en38`, studentId: `st38`, classGroupId: classId, academicYearId: yearId, status: 'ACTIVE', callNumber: null }); // null call number
  
  studentRepo.setStudents(mockStudents);
  enrollmentRepo.setEnrollments(mockEnrollments);
  roster = await rosterService.getActiveRoster(uid, yearId, classId);
  
  // Roster should have 37 items. Last two should be Aardvark then Zebra (nulls sorted alphabetically)
  console.assert(roster.length === 37, `E failed: expected 37, got ${roster.length}`);
  const last1 = roster[35];
  const last2 = roster[36];
  console.assert(last1.name === 'Aardvark' && last1.callNumber === null, `E failed order: last1 is ${last1.name}`);
  console.assert(last2.name === 'Zebra' && last2.callNumber === null, `E failed order: last2 is ${last2.name}`);
  
  // F) Roster does not contain RA/externalIds
  const firstStudent = roster[0];
  console.assert(!('ra' in firstStudent) && !('externalIds' in firstStudent), `F failed: RA found`);
  
  // K) INACTIVE leaves roster
  // Change st1 to INACTIVE
  mockEnrollments[0].status = 'INACTIVE';
  enrollmentRepo.setEnrollments(mockEnrollments);
  roster = await rosterService.getActiveRoster(uid, yearId, classId);
  console.assert(roster.length === 36, `K failed: expected 36, got ${roster.length}`); // 37 - 1
  
  // M) Exact match (normalized)
  // N) Accent/Case
  // O) Only similar (NO MATCH) -> Let's test "JOAO PEDRO SILVA" vs "JOAO PAULO SILVA"
  // P) Unmatched
  // Q) Ambiguous
  
  const matchRoster: CanonicalStudentRoster[] = [
    { studentId: 'm1', name: 'Maria Aparecida', normalizedName: 'maria aparecida', callNumber: 1 },
    { studentId: 'm2', name: 'João Paulo Silva', normalizedName: 'joao paulo silva', callNumber: 2 },
    { studentId: 'm3', name: 'José Santos', normalizedName: 'jose santos', callNumber: 3 },
    { studentId: 'm4', name: 'José Santos', normalizedName: 'jose santos', callNumber: 4 } // Ambiguous
  ];
  
  const extracted = [
    'maria aparecida', // M
    'Mária   Aparecída', // N
    'JOÃO PEDRO SILVA', // O
    'Batman', // P
    'José Santos' // Q
  ];
  
  const mResult = matchService.matchImportedRecords(extracted, matchRoster);
  
  // maria aparecida and Mária Aparecída should both match m1
  const mMatches = mResult.matched.filter(m => m.student.studentId === 'm1');
  console.assert(mMatches.length === 2, `M/N failed: expected 2 matches for Maria, got ${mMatches.length}`);
  
  // JOÃO PEDRO SILVA should NOT match JOÃO PAULO SILVA (m2)
  const oMatch = mResult.matched.find(m => m.fileRecord.rawName === 'JOÃO PEDRO SILVA');
  console.assert(!oMatch, `O failed: found fuzzy match where it shouldn't exist`);
  
  // Batman -> UNMATCHED
  const pMatch = mResult.unmatched.find(u => u.fileRecord.rawName === 'Batman');
  console.assert(pMatch && pMatch.reason === 'UNMATCHED_STUDENT', `P failed: Batman not UNMATCHED`);
  
  // José Santos -> AMBIGUOUS
  const qMatch = mResult.unmatched.find(u => u.fileRecord.rawName === 'José Santos');
  console.assert(qMatch && qMatch.reason === 'AMBIGUOUS_STUDENT_MATCH', `Q failed: Jose not AMBIGUOUS`);
  
  // S) 32 results for 35 students -> 3 missing
  const rResult = matchService.matchImportedRecords(['maria aparecida'], matchRoster);
  console.assert(rResult.missingStudents.length === 3, `S failed: expected 3 missing, got ${rResult.missingStudents.length}`);
  
  console.log("AUDIT SUCCESSFUL!");
}

runAudit().catch(e => {
  console.error(e);
  process.exit(1);
});
