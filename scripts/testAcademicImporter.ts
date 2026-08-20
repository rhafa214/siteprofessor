import { AcademicYear, ClassGroup, Student, Enrollment } from '../src/domain';
import { AcademicImporterService } from '../src/services/academic/AcademicImporterService';
import { ParsedRow, ImportCandidate, IStudentRepository, IEnrollmentRepository } from '../src/services/academic/AcademicImporterTypes';
import { extractFromAoA } from '../src/services/academic/AcademicImporterParser';

class FakeStudentRepository implements IStudentRepository {
  public data: Map<string, Student> = new Map();
  async findByExternalId(uid: string, key: string, value: string): Promise<Student | null> {
    const found = Array.from(this.data.values()).find(s => s.externalIds && (s.externalIds as any)[key] === value);
    return found || null;
  }
  async getById(uid: string, id: string): Promise<Student | null> {
    return this.data.get(id) || null;
  }
}

class FakeEnrollmentRepository implements IEnrollmentRepository {
  public data: Map<string, Enrollment> = new Map();
  async getActiveByClassGroup(uid: string, classGroupId: string): Promise<Enrollment[]> {
    return Array.from(this.data.values()).filter(e => e.classGroupId === classGroupId && e.status === 'ACTIVE');
  }
  async findByStudentAndClassGroup(uid: string, studentId: string, classGroupId: string): Promise<Enrollment | null> {
    return Array.from(this.data.values()).find(e => e.studentId === studentId && e.classGroupId === classGroupId) || null;
  }
  async getActiveByStudentAndYear(uid: string, studentId: string, academicYearId: string): Promise<Enrollment | null> {
    const active = Array.from(this.data.values()).filter(e => e.studentId === studentId && e.academicYearId === academicYearId && e.status === 'ACTIVE');
    if (active.length > 1) throw new Error('MULTIPLE_ACTIVE_ENROLLMENTS');
    return active.length === 1 ? active[0] : null;
  }
}

async function runTests() {
  console.log("Running Importer Tests...");

  const fakeCsvData = [
    ["Secretaria de Estado"],
    ["Filtros: ..."],
    ["Ano Letivo", "2026"],
    [],
    ["Nº de chamada", "Nome do Aluno", "RA", "Dig. RA", "Situação do Aluno"],
    ["1", "ALUNO UM", "000000000001", "1", "Ativo"],
    ["2", "ALUNO DOIS", "000000000002", "2", "Transferido"],
    ["3", "ALUNO TRES", "000000000003", "3", "Desconhecido"],
    ["", "ALUNO QUATRO SEM RA", "", "", "Ativo"],
    ["", "", "", "", ""] // Blank row
  ];

  const extracted = extractFromAoA(fakeCsvData);

  const studentRepo = new FakeStudentRepository();
  const enrollmentRepo = new FakeEnrollmentRepository();
  const service = new AcademicImporterService(studentRepo, enrollmentRepo);

  const ay: AcademicYear = { id: 'ay_1', year: 2026, name: '2026', status: 'ACTIVE', createdAt: 0, updatedAt: 0 };
  const cg: ClassGroup = { id: 'cg_1', academicYearId: 'ay_1', name: '6A', grade: '', section: '', status: 'ACTIVE', createdAt: 0, updatedAt: 0 };
  const cgB: ClassGroup = { id: 'cg_2', academicYearId: 'ay_1', name: '6B', grade: '', section: '', status: 'ACTIVE', createdAt: 0, updatedAt: 0 };

  // Test A: Transferido -> Ativo (expected ACTIVE)
  const dataA = [
    ["Nº de chamada", "Nome do Aluno", "RA", "Dig. RA", "Situação do Aluno"],
    ["1", "ALUNO A", "0001", "1", "Transferido"],
    ["1", "ALUNO A", "0001", "1", "Ativo"]
  ];
  const extrA = extractFromAoA(dataA);
  const { candidates: candA } = await (service as any).buildCandidates('uid', extrA.parsedRows, ay, cg);
  if (candA.length !== 1 || candA[0].parsed.normalizedStatus !== 'ACTIVE') throw new Error("Test A failed");

  // Test B: Remanejamento -> Transferido (expected TRANSFERRED)
  const dataB = [
    ["Nº de chamada", "Nome do Aluno", "RA", "Dig. RA", "Situação do Aluno"],
    ["2", "ALUNO B", "0002", "2", "Remanejado"],
    ["2", "ALUNO B", "0002", "2", "Transferido"]
  ];
  const extrB = extractFromAoA(dataB);
  const { candidates: candB } = await (service as any).buildCandidates('uid', extrB.parsedRows, ay, cg);
  if (candB.length !== 1 || candB[0].parsed.normalizedStatus !== 'TRANSFERRED') throw new Error("Test B failed");

  // Test C: Ativo -> Transferido (expected TRANSFERRED)
  const dataC = [
    ["Nº de chamada", "Nome do Aluno", "RA", "Dig. RA", "Situação do Aluno"],
    ["3", "ALUNO C", "0003", "3", "Ativo"],
    ["3", "ALUNO C", "0003", "3", "Transferido"]
  ];
  const extrC = extractFromAoA(dataC);
  const { candidates: candC } = await (service as any).buildCandidates('uid', extrC.parsedRows, ay, cg);
  if (candC.length !== 1 || candC[0].parsed.normalizedStatus !== 'TRANSFERRED') throw new Error("Test C failed");

  // Test D: Transferido -> Ativo -> Transferido
  const dataD = [
    ["Nº de chamada", "Nome do Aluno", "RA", "Dig. RA", "Situação do Aluno"],
    ["4", "ALUNO D", "0004", "4", "Transferido"],
    ["4", "ALUNO D", "0004", "4", "Ativo"],
    ["4", "ALUNO D", "0004", "4", "Transferido"]
  ];
  const extrD = extractFromAoA(dataD);
  const { candidates: candD } = await (service as any).buildCandidates('uid', extrD.parsedRows, ay, cg);
  if (candD.length !== 1 || candD[0].parsed.normalizedStatus !== 'TRANSFERRED') throw new Error("Test D failed");

  // Test E, F, G: 44 rows, 1 duplicate -> 43 unique.
  const dataEFG = [
    ["Nº de chamada", "Nome do Aluno", "RA", "Dig. RA", "Situação do Aluno"]
  ];
  for (let i = 1; i <= 43; i++) {
    dataEFG.push([String(i), `ALUNO ${i}`, String(i).padStart(4, '0'), "1", "Ativo"]);
  }
  // Duplicate RA 43 with Transferido
  dataEFG.push(["43", "ALUNO 43", "0043", "1", "Transferido"]);

  const extrEFG = extractFromAoA(dataEFG);
  const { stats: statsEFG } = await (service as any).buildCandidates('uid', extrEFG.parsedRows, ay, cg);
  statsEFG.rowsRead = extrEFG.parsedRows.length; 
  if (statsEFG.rowsRead !== 44) throw new Error("Test EFG rowsRead failed");
  if (statsEFG.uniqueStudents !== 43) throw new Error("Test EFG uniqueStudents failed");
  if (statsEFG.historicalDuplicateRows !== 1) throw new Error("Test EFG historicalDuplicateRows failed");
  if (statsEFG.ignoredBlankRows !== 0) throw new Error("Test EFG ignoredBlankRows should be 0");

  // Test K: Reproduce Bug (Existing Student and Enrollment in SAME class group)
  studentRepo.data.set('st_bug', { id: 'st_bug', normalizedName: 'aluno bug', externalIds: { ra: '9999', raDigit: '9' } } as any);
  enrollmentRepo.data.set('enr_bug', { id: 'enr_bug', studentId: 'st_bug', classGroupId: cg.id, academicYearId: ay.id, status: 'ACTIVE', callNumber: 1 } as any);
  
  const dataBug = [
    ["Nº de chamada", "Nome do Aluno", "RA", "Dig. RA", "Situação do Aluno"],
    ["1", "ALUNO BUG", "9999", "9", "Ativo"]
  ];
  const extrBug = extractFromAoA(dataBug);
  const { candidates: candBug, stats: statsBug } = await (service as any).buildCandidates('uid', extrBug.parsedRows, ay, cg);
  if (candBug.length !== 1 || candBug[0].action !== 'UNCHANGED') throw new Error("Test K failed: Should be UNCHANGED");
  if (statsBug.existingStudents !== 1 || statsBug.newStudents !== 0) throw new Error("Test K failed: Wrong stats");
  
  // Test L: 43 Students Second Import
  studentRepo.data.clear();
  enrollmentRepo.data.clear();
  
  const dataL = [["Nº de chamada", "Nome do Aluno", "RA", "Dig. RA", "Situação do Aluno"]];
  for (let i = 1; i <= 43; i++) {
    const isTransferido = i > 34; // 34 active, 9 non-active
    const status = isTransferido ? 'Transferido' : 'Ativo';
    dataL.push([String(i), 'ALUNO ' + i, String(i).padStart(4, '0'), '1', status]);
    
    // Seed DB
    const sid = 'st_' + i;
    const eid = 'enr_' + i;
    studentRepo.data.set(sid, { id: sid, normalizedName: `aluno ${i}`, externalIds: { ra: String(i).padStart(4, '0'), raDigit: '1' } } as any);
    enrollmentRepo.data.set(eid, { id: eid, studentId: sid, classGroupId: cg.id, academicYearId: ay.id, status: isTransferido ? 'TRANSFERRED' : 'ACTIVE', callNumber: i } as any);
  }
  
  const extrL = extractFromAoA(dataL);
  const { candidates: candL, stats: statsL } = await (service as any).buildCandidates('uid', extrL.parsedRows, ay, cg);
  
  const unchangedCount = candL.filter((c: ImportCandidate) => c.action === 'UNCHANGED').length;
  if (unchangedCount !== 43) throw new Error(`Test L failed: Should be 43 UNCHANGED, got ${unchangedCount}`);
  if (statsL.newStudents !== 0) throw new Error("Test L failed: newStudents should be 0");
  if (statsL.existingStudents !== 43) throw new Error("Test L failed: existingStudents should be 43");
  if (statsL.updatedEnrollments !== 0) throw new Error("Test L failed: updatedEnrollments should be 0");
  if (statsL.classChanges !== 0) throw new Error("Test L failed: classChanges should be 0");
  if (statsL.ignoredDuplicates !== 43) throw new Error("Test L failed: ignoredDuplicates should be 43");
  
  // Test M: Class Change (Existing in cg_1, imported in cg_2)
  studentRepo.data.clear();
  enrollmentRepo.data.clear();
  
  studentRepo.data.set('st_cc', { id: 'st_cc', normalizedName: 'aluno change', externalIds: { ra: '8888', raDigit: '8' } } as any);
  enrollmentRepo.data.set('enr_cc1', { id: 'enr_cc1', studentId: 'st_cc', classGroupId: cg.id, academicYearId: ay.id, status: 'ACTIVE', callNumber: 1 } as any);
  
  const dataM = [
    ["Nº de chamada", "Nome do Aluno", "RA", "Dig. RA", "Situação do Aluno"],
    ["5", "ALUNO CHANGE", "8888", "8", "Ativo"]
  ];
  const extrM = extractFromAoA(dataM);
  // Import into cg_2 (class B)
  const { candidates: candM, stats: statsM } = await (service as any).buildCandidates('uid', extrM.parsedRows, ay, cgB);
  
  if (candM.length !== 1 || candM[0].action !== 'CLASS_CHANGE') throw new Error("Test M failed: Action should be CLASS_CHANGE");
  if (statsM.classChanges !== 1) throw new Error("Test M failed: Stats should reflect 1 class change");
  if (candM[0].classGroupChange?.fromClassGroupId !== cg.id) throw new Error("Test M failed: Should indicate from cg_1");

  console.log("All tests passed successfully.");
}

runTests().catch(console.error);
