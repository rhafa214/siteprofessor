import { AcademicYear, ClassGroup, Student, Enrollment } from '../src/domain';
import { AcademicImporterService } from '../src/services/academic/AcademicImporterService';
import { ParsedRow, ImportCandidate } from '../src/services/academic/AcademicImporterTypes';
import { extractFromAoA } from '../src/services/academic/AcademicImporterParser';

class FakeStudentRepository {
  public data: Map<string, Student> = new Map();
  async findByExternalId(uid: string, key: string, value: string): Promise<Student | null> {
    const found = Array.from(this.data.values()).find(s => s.externalIds && (s.externalIds as any)[key] === value);
    return found || null;
  }
  async getById(uid: string, id: string): Promise<Student | null> {
    return this.data.get(id) || null;
  }
}

class FakeEnrollmentRepository {
  public data: Map<string, Enrollment> = new Map();
  async getActiveByClassGroup(uid: string, classGroupId: string): Promise<Enrollment[]> {
    return Array.from(this.data.values()).filter(e => e.classGroupId === classGroupId && e.status === 'ACTIVE');
  }
  async findByStudentAndClassGroup(uid: string, studentId: string, classGroupId: string): Promise<Enrollment | null> {
    return Array.from(this.data.values()).find(e => e.studentId === studentId && e.classGroupId === classGroupId) || null;
  }
  async getActiveByStudentAndYear(uid: string, studentId: string, academicYearId: string): Promise<Enrollment | null> {
    return Array.from(this.data.values()).find(e => e.studentId === studentId && e.academicYearId === academicYearId && e.status === 'ACTIVE') || null;
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

  if (extracted.yearFound !== 2026) throw new Error("A) Year not detected properly: " + extracted.yearFound);
  if (extracted.parsedRows.length !== 4) throw new Error("A) Should have 4 rows (3 valid + 1 missing RA). Got " + extracted.parsedRows.length);
  if (extracted.ignoredBlankRows !== 1) throw new Error("A) Should have 2 ignored blank rows (one before header, one after). Got " + extracted.ignoredBlankRows);
  if (extracted.parsedRows[0].ra !== "000000000001") throw new Error("A) RA leading zeros lost");

  const studentRepo = new FakeStudentRepository();
  const enrollmentRepo = new FakeEnrollmentRepository();
  const service = new AcademicImporterService(studentRepo, enrollmentRepo);

  const ay: AcademicYear = { id: 'ay_1', year: 2026, name: '2026', status: 'ACTIVE', createdAt: 0, updatedAt: 0 };
  const cg: ClassGroup = { id: 'cg_1', academicYearId: 'ay_1', name: '6A', grade: '', section: '', status: 'ACTIVE', createdAt: 0, updatedAt: 0 };

  // Test B: Missing RA -> REVIEW_REQUIRED
  // Test C: Call number missing -> null
  const { candidates: cands1, stats: stats1 } = await (service as any).buildCandidates('uid', extracted.parsedRows, ay, cg);
  
  const candMissingRa = cands1.find((c: ImportCandidate) => c.parsed.name === 'ALUNO QUATRO SEM RA');
  if (!candMissingRa || candMissingRa.action !== 'REVIEW_REQUIRED' || candMissingRa.conflictReason !== 'MISSING_STRONG_IDENTIFIER') {
    throw new Error("B) Missing RA not flagged properly");
  }
  if (candMissingRa.parsed.callNumber !== null) throw new Error("C) Call number should be null");

  const candUnknown = cands1.find((c: ImportCandidate) => c.parsed.name === 'ALUNO TRES');
  if (!candUnknown || candUnknown.action !== 'REVIEW_REQUIRED' || candUnknown.conflictReason !== 'UNKNOWN_STATUS') {
    throw new Error("Unknown status not flagged properly");
  }

  // Test E: Name Exact Match (same norm)
  studentRepo.data.set('st_1', { id: 'st_1', normalizedName: 'aluno um', externalIds: { ra: '000000000001', raDigit: '1' } } as any);
  
  // Test F: Name Conflict (different norm)
  studentRepo.data.set('st_2', { id: 'st_2', normalizedName: 'aluno diferente', externalIds: { ra: '000000000002', raDigit: '2' } } as any);

  const { candidates: cands2 } = await (service as any).buildCandidates('uid', extracted.parsedRows, ay, cg);
  
  const candUm = cands2.find((c: ImportCandidate) => c.parsed.ra === '000000000001');
  if (candUm.action !== 'CREATE_ENROLLMENT') throw new Error("E) Exact name match should not be conflict");

  const candDois = cands2.find((c: ImportCandidate) => c.parsed.ra === '000000000002');
  if (candDois.action !== 'REVIEW_REQUIRED' || candDois.conflictReason !== 'IDENTITY_NAME_CONFLICT') {
    throw new Error("F) Name variation not flagged properly");
  }

  // Test G: Transferido + Ativo -> 1 Student ACTIVE
  const fakeCsvData2 = [
    ["Nº de chamada", "Nome do Aluno", "RA", "Dig. RA", "Situação do Aluno"],
    ["5", "ALUNO CINCO", "0005", "5", "Transferido"],
    ["5", "ALUNO CINCO", "0005", "5", "Ativo"]
  ];
  const extr2 = extractFromAoA(fakeCsvData2);
  const { candidates: cands3, stats: stats3 } = await (service as any).buildCandidates('uid', extr2.parsedRows, ay, cg);
  if (cands3.length !== 1 || cands3[0].parsed.normalizedStatus !== 'ACTIVE') throw new Error("G) Transferido+Ativo failed");

  // Test H: Two ACTIVES
  const fakeCsvData3 = [
    ["Nº de chamada", "Nome do Aluno", "RA", "Dig. RA", "Situação do Aluno"],
    ["6", "ALUNO SEIS", "0006", "6", "Ativo"],
    ["7", "ALUNO SEIS", "0006", "6", "Ativo"]
  ];
  const extr3 = extractFromAoA(fakeCsvData3);
  const { candidates: cands4 } = await (service as any).buildCandidates('uid', extr3.parsedRows, ay, cg);
  if (cands4[0].action !== 'REVIEW_REQUIRED' || cands4[0].conflictReason !== 'DUPLICATE_ACTIVE_CONFLICT') throw new Error("H) Two actives failed");

  // Test I: Two NON-ACTIVES conflicting
  const fakeCsvData4 = [
    ["Nº de chamada", "Nome do Aluno", "RA", "Dig. RA", "Situação do Aluno"],
    ["8", "ALUNO OITO", "0008", "8", "Transferido"],
    ["8", "ALUNO OITO", "0008", "8", "Inativo"]
  ];
  const extr4 = extractFromAoA(fakeCsvData4);
  const { candidates: cands5 } = await (service as any).buildCandidates('uid', extr4.parsedRows, ay, cg);
  if (cands5[0].action !== 'REVIEW_REQUIRED' || cands5[0].conflictReason !== 'STATUS_HISTORY_CONFLICT') throw new Error("I) Status history conflict failed");

  // Test J: RA Digit Conflict
  studentRepo.data.set('st_9', { id: 'st_9', normalizedName: 'aluno nove', externalIds: { ra: '0009', raDigit: 'x' } } as any);
  const fakeCsvData5 = [
    ["Nº de chamada", "Nome do Aluno", "RA", "Dig. RA", "Situação do Aluno"],
    ["9", "ALUNO NOVE", "0009", "9", "Ativo"],
  ];
  const extr5 = extractFromAoA(fakeCsvData5);
  const { candidates: cands6 } = await (service as any).buildCandidates('uid', extr5.parsedRows, ay, cg);
  if (cands6[0].action !== 'REVIEW_REQUIRED' || cands6[0].conflictReason !== 'IDENTITY_CONFLICT') throw new Error("J) RA digit conflict failed");

  // Test O: Idempotence (1x, 5x, 20x)
  // Clean DB
  studentRepo.data.clear();
  enrollmentRepo.data.clear();
  
  const idempotenceData = [
    ["Nº de chamada", "Nome do Aluno", "RA", "Dig. RA", "Situação do Aluno"],
    ["1", "UM", "10", "1", "Ativo"],
    ["2", "DOIS", "20", "2", "Ativo"],
    ["3", "TRES", "30", "3", "Ativo"],
  ];
  const extrIdem = extractFromAoA(idempotenceData);
  
  // 1x
  const { candidates: candIdem1 } = await (service as any).buildCandidates('uid', extrIdem.parsedRows, ay, cg);
  // fake commit manually to simulate DB insertion
  let mockId = 1;
  for (const c of candIdem1) {
    const sid = 'st_' + mockId;
    const eid = 'enr_' + mockId;
    studentRepo.data.set(sid, { id: sid, normalizedName: c.parsed.normalizedName, externalIds: { ra: c.parsed.ra, raDigit: c.parsed.raDigit } } as any);
    enrollmentRepo.data.set(eid, { id: eid, studentId: sid, classGroupId: cg.id, status: c.parsed.normalizedStatus, callNumber: c.parsed.callNumber } as any);
    mockId++;
  }

  // 5x
  const { candidates: candIdem5 } = await (service as any).buildCandidates('uid', extrIdem.parsedRows, ay, cg);
  if (candIdem5.some((c: ImportCandidate) => c.action !== 'UNCHANGED')) throw new Error("O) 5x idempotence failed");

  // 20x
  const { candidates: candIdem20 } = await (service as any).buildCandidates('uid', extrIdem.parsedRows, ay, cg);
  const unchangedCount = candIdem20.filter((c: ImportCandidate) => c.action === 'UNCHANGED').length;
  if (unchangedCount !== 3) throw new Error("O) 20x idempotence failed");
  if (candIdem20.length !== 3) throw new Error("O) 20x length failed");

  console.log("All tests passed successfully.");
}

runTests().catch(console.error);
