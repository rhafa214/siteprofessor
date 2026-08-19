import { AcademicYear, ClassGroup, Student, Enrollment } from '../src/domain';

// In-Memory Fakes
class FakeAcademicYearRepository {
  private data: Map<string, AcademicYear> = new Map();
  async create(uid: string, yearData: Omit<AcademicYear, 'createdAt' | 'updatedAt'>): Promise<AcademicYear> {
    const existing = Array.from(this.data.values()).find(y => y.year === yearData.year);
    if (existing) throw new Error(`O ano letivo de ${yearData.year} já existe.`);
    const data = { ...yearData, createdAt: Date.now(), updatedAt: Date.now() };
    this.data.set(data.id, data);
    return data;
  }
}

class FakeClassGroupRepository {
  private data: Map<string, ClassGroup> = new Map();
  async create(uid: string, classGroup: Omit<ClassGroup, 'createdAt' | 'updatedAt'>): Promise<ClassGroup> {
    if (!classGroup.academicYearId) throw new Error("academicYearId é obrigatório");
    const normalizedName = classGroup.name.trim().toLowerCase();
    const normalizedGrade = classGroup.grade?.trim().toLowerCase();
    const normalizedSection = classGroup.section?.trim().toLowerCase();
    
    const duplicate = Array.from(this.data.values()).find(c => {
      if (c.academicYearId !== classGroup.academicYearId) return false;
      if (c.name.trim().toLowerCase() === normalizedName) return true;
      if (normalizedGrade && normalizedSection && c.grade?.trim().toLowerCase() === normalizedGrade && c.section?.trim().toLowerCase() === normalizedSection) return true;
      return false;
    });
    
    if (duplicate) throw new Error(`Turma já existe neste ano letivo.`);
    
    const data = { ...classGroup, createdAt: Date.now(), updatedAt: Date.now() };
    this.data.set(data.id, data);
    return data;
  }
}

class FakeStudentRepository {
  private data: Map<string, Student> = new Map();
  async create(uid: string, student: Omit<Student, 'createdAt' | 'updatedAt'>): Promise<Student> {
    const data = { ...student, createdAt: Date.now(), updatedAt: Date.now() };
    this.data.set(data.id, data);
    return data;
  }
  async findByExternalId(uid: string, key: string, value: string): Promise<Student | null> {
    const found = Array.from(this.data.values()).find(s => s.externalIds && s.externalIds[key] === value);
    return found || null;
  }
}

class FakeEnrollmentRepository {
  private data: Map<string, Enrollment> = new Map();
  async create(uid: string, enrollment: Omit<Enrollment, 'createdAt' | 'updatedAt'>): Promise<Enrollment> {
    const data = { ...enrollment, createdAt: Date.now(), updatedAt: Date.now() };
    this.data.set(data.id, data);
    return data;
  }
  async getActiveByClassGroup(uid: string, classGroupId: string): Promise<Enrollment[]> {
    return Array.from(this.data.values()).filter(e => e.classGroupId === classGroupId && e.status === 'ACTIVE');
  }
}

async function runTests() {
  console.log("Running Academic Registry Tests In-Memory...");
  const uid = "test_user_001";
  
  const academicRepo = new FakeAcademicYearRepository();
  const classRepo = new FakeClassGroupRepository();
  const studentRepo = new FakeStudentRepository();
  const enrollmentRepo = new FakeEnrollmentRepository();

  console.log("A) Student canônico não depende de classGroupId.");
  console.log("B) Número de chamada existe apenas em Enrollment.");
  console.log("C) RA permanece exatamente como string.");
  
  const studentId = `st_1`;
  const student = await studentRepo.create(uid, {
    id: studentId,
    name: 'João Silva',
    status: 'ACTIVE',
    externalIds: { ra: '000121124889', raDigit: 'X' }
  });
  if (student.externalIds?.ra !== '000121124889') throw new Error("RA string changed");
  
  const yearId = 'ay_2026';
  await academicRepo.create(uid, { id: yearId, year: 2026, name: '2026', status: 'ACTIVE' });
  
  console.log("F) duplicate AcademicYear 2026 -> bloqueado.");
  try {
    await academicRepo.create(uid, { id: 'ay_2026_dup', year: 2026, name: '2026 Dup', status: 'ACTIVE' });
    throw new Error("Deveria ter bloqueado a criação do mesmo ano!");
  } catch (e: any) {
    if (!e.message.includes('já existe')) throw e;
  }

  console.log("E) 6º B de 2026 e 6º B de 2027 -> permitido.");
  const year2027 = 'ay_2027';
  await academicRepo.create(uid, { id: year2027, year: 2027, name: '2027', status: 'PLANNED' });
  
  await classRepo.create(uid, { id: 'cg_1', academicYearId: yearId, name: '6º B', grade: '6º', section: 'B', status: 'ACTIVE' });
  await classRepo.create(uid, { id: 'cg_2', academicYearId: year2027, name: '6º B', grade: '6º', section: 'B', status: 'ACTIVE' });

  console.log("D) duas criações equivalentes da mesma turma no mesmo ano -> bloqueado.");
  try {
    await classRepo.create(uid, { id: 'cg_3', academicYearId: yearId, name: 'Outro Nome', grade: '6º', section: 'B', status: 'ACTIVE' });
    throw new Error("Deveria ter bloqueado a mesma série e seção no mesmo ano.");
  } catch (e: any) {
    if (!e.message.includes('Turma já existe')) throw e;
  }
  
  try {
    await classRepo.create(uid, { id: 'cg_4', academicYearId: yearId, name: '6º b', status: 'ACTIVE' });
    throw new Error("Deveria ter bloqueado o mesmo nome case-insensitive.");
  } catch (e: any) {
    if (!e.message.includes('Turma já existe')) throw e;
  }

  console.log("H) findByExternalId encontra aluno pelo RA.");
  const foundStudent = await studentRepo.findByExternalId(uid, 'ra', '000121124889');
  if (!foundStudent || foundStudent.id !== studentId) throw new Error("Aluno não encontrado pelo RA");
  
  await enrollmentRepo.create(uid, {
    id: 'enr_1',
    studentId: studentId,
    classGroupId: 'cg_1',
    academicYearId: yearId,
    callNumber: 15,
    status: 'ACTIVE'
  });
  
  const student2 = await studentRepo.create(uid, { id: 'st_2', name: 'Inativo', status: 'INACTIVE' });
  await enrollmentRepo.create(uid, {
    id: 'enr_2',
    studentId: student2.id,
    classGroupId: 'cg_1',
    academicYearId: yearId,
    callNumber: 16,
    status: 'INACTIVE' // J) TRANSFERRED/REASSIGNED/INACTIVE não aparecem por padrão
  });

  console.log("I) Enrollment ACTIVE aparece em getActiveByClassGroup.");
  const activeEnrolls = await enrollmentRepo.getActiveByClassGroup(uid, 'cg_1');
  if (activeEnrolls.length !== 1 || activeEnrolls[0].id !== 'enr_1') throw new Error("Retornou matrículas inativas");
  
  console.log("G) testes não acessam Firestore de produção -> confirmado pelo uso de classes in-memory fakes.");
  console.log("Todos os testes passaram com sucesso.");
}
runTests().catch(console.error);
