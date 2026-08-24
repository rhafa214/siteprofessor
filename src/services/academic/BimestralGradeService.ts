import { CanonicalAssessmentService } from "./CanonicalAssessmentService";
import { StudentRepository, EnrollmentRepository } from "../../data/repositories";
import { AcademicRosterService, CanonicalStudentRoster } from "./AcademicRosterService";
import { TaskAnalysisService } from "./TaskAnalysisService";
import { MatificService } from "./MatificService";
import { AcademicTermService, AcademicTerm } from "./AcademicTermService";


export interface StudentGradeMeta {
  studentId: string;
  name: string;
  notaAvaliacao: number;
  notaSimulado: number;
  notaParticipacao: number;
  notaPaulista: number;
  notaMatific: number;
  notaTarefa: number;
  mediaFinal: number;
  isAvaliacaoLancado: boolean;
  isSimuladoLancado: boolean;
  isParticipacaoLancado: boolean;
}

export class BimestralGradeService {
  private assessmentService = new CanonicalAssessmentService();
  private rosterService = new AcademicRosterService(new StudentRepository(), new EnrollmentRepository());
  private taskService = new TaskAnalysisService();
  private matificService = new MatificService();
  private termService = new AcademicTermService();

  async calculateForClass(
    uid: string,
    academicYearId: string,
    classGroupId: string,
    termId: string, // canonical termId, e.g. "1º", "2º"
    termLabel: string, // e.g. "1º Bimestre"
    legacyTurmaName: string // Need this to match legacy data for Prova Paulista and old Tasks/Matific if we wanted
  ): Promise<StudentGradeMeta[]> {
    // 1. Fetch Active Roster
    const roster = await this.rosterService.getActiveRoster(uid, academicYearId, classGroupId);

    // 2. Fetch Canonical Assessments
    const fetchAssesment = async (category: "BIMESTRAL" | "SIMULADO" | "PARTICIPACAO") => {
      const sheet = await this.assessmentService.getSheet(uid, academicYearId, termId, classGroupId, category);
      if (!sheet) return new Map<string, number | null>();
      const results = await this.assessmentService.getResults(uid, sheet.id);
      const map = new Map<string, number | null>();
      results.forEach(r => map.set(r.studentId, r.grade));
      return map;
    };

    const avaliacaoMap = await fetchAssesment("BIMESTRAL");
    const simuladoMap = await fetchAssesment("SIMULADO");
    const participacaoMap = await fetchAssesment("PARTICIPACAO");

    // 3. Fetch Tasks (Canonical vs Legacy fallback)
    // We try canonical first. If not, fallback to legacy.
    const taskMap = new Map<string, number>();
    let hasTasks = false;
    try {
      const taskAssessments = await this.taskService.getAssessments(uid, academicYearId, classGroupId);
      // We need to filter by term. Using termService.
      const yearStr = String(new Date().getFullYear()); // Hardcoded or get from year. 
      // Actually we can filter by date if we pass AcademicTerm.
      // But for simplicity, the legacy adapter is safer for tasks during this transition since we don't have termId in canonical tasks.
      // Let's use the legacy logic for Tasks.
      const bKey = termId; 
      let localTasks = localStorage.getItem(`taskAnalysis_${bKey}_${legacyTurmaName}`);
      if (!localTasks && bKey === "2º") localTasks = localStorage.getItem(`taskAnalysis_${legacyTurmaName}`);
      const legacyTaskData = localTasks ? JSON.parse(localTasks) : { tasks: [] };
      hasTasks = legacyTaskData.tasks && legacyTaskData.tasks.length > 0;
      
      if (hasTasks) {
        roster.forEach(student => {
          let taskScore = 0; let taskCount = 0;
          // Match by name
          const normName = student.normalizedName;
          const legacyStudent = legacyTaskData.students?.find((s: any) => String(s.name) === normName);
          if (legacyStudent) {
            const sTaskGrades = legacyTaskData.grades[legacyStudent.id] || {};
            legacyTaskData.tasks.forEach((t: any) => {
              const g = sTaskGrades[t.id];
              if (g !== null && g !== undefined && !Number.isNaN(Number(g))) { taskScore += (Number(g) * 10) / 60; taskCount++; }
            });
          }
          taskMap.set(student.studentId, taskCount > 0 ? taskScore / taskCount : 10);
        });
      }
    } catch (e) {
      console.error(e);
    }

    // 4. Fetch Matific (Legacy fallback)
    const matificMap = new Map<string, number>();
    try {
      const bKey = termId;
      let localMatific = localStorage.getItem(`matificAnalysis_${bKey}_${legacyTurmaName}`);
      if (!localMatific && bKey === "2º") localMatific = localStorage.getItem(`matificAnalysis_${legacyTurmaName}`);
      const legacyMatificData = localMatific ? JSON.parse(localMatific) : { weeks: [] };
      
      roster.forEach(student => {
        let matScore = 0; let matCount = 0;
        const normName = student.normalizedName;
        const legacyStudent = legacyMatificData.students?.find((s: any) => String(s.name) === normName);
        if (legacyStudent) {
          const sMatGrades = legacyMatificData.minutes[legacyStudent.id] || {};
          legacyMatificData.weeks.forEach((w: any) => {
            const m = sMatGrades[w.id];
            if (m !== null && m !== undefined && !Number.isNaN(Number(m))) {
              let g = (Number(m) / 30) * 10; if (g > 10) g = 10; matScore += g; matCount++;
            }
          });
        }
        matificMap.set(student.studentId, matCount > 0 ? matScore / matCount : 0);
      });
    } catch (e) { console.error(e); }

    // 5. Fetch Prova Paulista (Legacy fallback)
    const paulistaMap = new Map<string, number>();
    try {
      const bKey = termId;
      let localPaulista = localStorage.getItem(`pp_${bKey}_${legacyTurmaName}`);
      if (!localPaulista && bKey === "2º") localPaulista = localStorage.getItem(`pp_${legacyTurmaName}`);
      const legacyPaulistaData = localPaulista ? JSON.parse(localPaulista) : { exams: [] };

      roster.forEach(student => {
        let paulistaScore = 0; let paulistaMax = 0;
        const normName = student.normalizedName;
        const legacyStudent = legacyPaulistaData.students?.find((s: any) => String(s.name) === normName);
        if (legacyStudent) {
          const sPGrades = legacyPaulistaData.grades[legacyStudent.id] || {};
          legacyPaulistaData.exams.forEach((ex: any) => {
            const g = sPGrades[ex.id];
            if (g !== null && g !== undefined) { paulistaScore += g; paulistaMax += ex.maxScore; }
          });
        }
        paulistaMap.set(student.studentId, paulistaMax > 0 ? (paulistaScore / paulistaMax) * 10 : 0);
      });
    } catch (e) { console.error(e); }


    // Calculate for each student
    const result: StudentGradeMeta[] = roster.map(enrollment => {
      const stId = enrollment.studentId;
      const aval = avaliacaoMap.get(stId);
      const sim = simuladoMap.get(stId);
      const part = participacaoMap.get(stId);

      const notaAvaliacao = aval === null || aval === undefined ? 0 : aval;
      const notaSimulado = sim === null || sim === undefined ? 0 : sim;
      const notaParticipacao = part === null || part === undefined ? 0 : part;
      
      const notaTarefa = taskMap.get(stId) || (hasTasks ? 0 : 10);
      const notaMatific = matificMap.get(stId) || 0;
      const notaPaulista = paulistaMap.get(stId) || 0;

      let wMatific = 0.05; let wTarefa = 0.05;
      if (!hasTasks) { wMatific = 0.1; wTarefa = 0; }

      const mediaFinal = 
        (notaAvaliacao * 0.3) + 
        (notaPaulista * 0.3) + 
        (notaSimulado * 0.2) + 
        (notaParticipacao * 0.1) + 
        (notaMatific * wMatific) + 
        (notaTarefa * wTarefa);

      return {
        studentId: stId,
        name: enrollment.name,
        notaAvaliacao,
        notaSimulado,
        notaParticipacao,
        notaPaulista,
        notaMatific,
        notaTarefa,
        mediaFinal,
        isAvaliacaoLancado: aval !== null && aval !== undefined,
        isSimuladoLancado: sim !== null && sim !== undefined,
        isParticipacaoLancado: part !== null && part !== undefined
      };
    });

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }
}
