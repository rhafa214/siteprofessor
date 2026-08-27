import fs from "fs";

const content = `import { AcademicRosterService } from "./AcademicRosterService";
import { CanonicalAssessmentService } from "./CanonicalAssessmentService";
import { GradePlanService } from "./GradePlanService";
import { CanonicalGradeComponent } from "../../domain/assessment/GradePlanTypes";

export interface StudentGradeMeta {
  studentId: string;
  name: string;
  mediaFinal: number;
  components: Record<string, {
    grade: number | null;
    weight: number;
    isLancado: boolean;
  }>;
  // Legacy fields below so we don't break existing components immediately
  notaAvaliacao: number;
  notaSimulado: number;
  notaParticipacao: number;
  notaPaulista: number;
  notaMatific: number;
  notaTarefa: number;
  isAvaliacaoLancado: boolean;
  isSimuladoLancado: boolean;
  isParticipacaoLancado: boolean;
}

export interface GradeCalculationResult {
  components: CanonicalGradeComponent[];
  students: StudentGradeMeta[];
}

export class BimestralGradeService {
  constructor(
    private rosterService: AcademicRosterService,
    private canonicalService: CanonicalAssessmentService,
    private gradePlanService: GradePlanService = new GradePlanService()
  ) {}

  private normalizeName(name: string): string {
    return name.trim().toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
  }

  async calculateForClass(
    uid: string,
    academicYearId: string,
    classGroupId: string,
    termId: string,
    termLabel: string,
    legacyTurmaName: string
  ): Promise<GradeCalculationResult> {
    const roster = await this.rosterService.getActiveRoster(uid, academicYearId, classGroupId);

    // Fetch dynamic plan
    const activePlan = await this.gradePlanService.getActiveGradePlan(uid, academicYearId, termId, classGroupId);
    
    let components: CanonicalGradeComponent[] = [];
    if (activePlan) {
      const allComps = await this.gradePlanService.getGradeComponents(uid, activePlan.id);
      components = allComps.filter(c => c.enabled);
    }

    // 1. Fetch Canonical Assessments (BIMESTRAL, SIMULADO, PARTICIPACAO)
    const catLabels = ["BIMESTRAL", "SIMULADO", "PARTICIPACAO"] as const;
    const sheetsMap = new Map<string, any>();
    const canonicalMaps: Record<string, Map<string, number>> = {
       "BIMESTRAL": new Map(),
       "SIMULADO": new Map(),
       "PARTICIPACAO": new Map()
    };

    for (const cat of catLabels) {
      const sheets = await this.canonicalService.getSheetsByCategory(uid, academicYearId, termId, classGroupId, cat);
      if (sheets.length > 0) {
        const sheet = sheets[0];
        sheetsMap.set(cat, sheet);
        const results = await this.canonicalService.getResults(uid, sheet.id);
        const rmap = new Map<string, number>();
        results.forEach(r => {
          if (r.grade !== null) rmap.set(r.studentId, r.grade);
        });
        canonicalMaps[cat] = rmap;
      }
    }

    // 2. Fetch Legacies (Paulista, Matific, TaskAnalysis) - TEMPORARY adapters
    const legacyPaulistaStr = localStorage.getItem("pp_" + termLabel);
    const paulistaGlobal = legacyPaulistaStr ? JSON.parse(legacyPaulistaStr) : {};
    const legacyPaulistaGrades = paulistaGlobal[legacyTurmaName] || [];

    const legacyMatificStr = localStorage.getItem("matificAnalysis_" + termLabel);
    const matificGlobal = legacyMatificStr ? JSON.parse(legacyMatificStr) : {};
    const legacyMatificGrades = matificGlobal[legacyTurmaName] || [];

    const legacyTaskStr = localStorage.getItem("taskAnalysis_" + termLabel);
    const taskGlobal = legacyTaskStr ? JSON.parse(legacyTaskStr) : {};
    const legacyTaskGrades = taskGlobal[legacyTurmaName] || [];

    // Map names to StudentId (Temporary adapter)
    const paulistaMap = new Map<string, number>();
    const matificMap = new Map<string, number>();
    const taskMap = new Map<string, number>();

    roster.forEach(enroll => {
      const stNameNorm = this.normalizeName(enroll.student.name);

      const ppRec = legacyPaulistaGrades.find((p: any) => this.normalizeName(p.studentName || "") === stNameNorm);
      if (ppRec && typeof ppRec.grade === "number") paulistaMap.set(enroll.studentId, ppRec.grade);

      const mRec = legacyMatificGrades.find((m: any) => this.normalizeName(m.studentName || "") === stNameNorm);
      if (mRec && mRec.metrics) {
        const min = Number(mRec.metrics.minutes || 0);
        let g = (min / 30) * 10;
        if (g > 10) g = 10;
        matificMap.set(enroll.studentId, g);
      }

      const tRec = legacyTaskGrades.find((t: any) => this.normalizeName(t.studentName || "") === stNameNorm);
      if (tRec && tRec.metrics) {
        const done = Number(tRec.metrics.done || 0);
        const late = Number(tRec.metrics.late || 0);
        const missing = Number(tRec.metrics.missing || 0);
        const total = done + late + missing;
        if (total > 0) {
          const tGrade = ((done + (late * 0.5)) / total) * 10;
          taskMap.set(enroll.studentId, tGrade);
        } else {
          taskMap.set(enroll.studentId, 10);
        }
      }
    });

    const hasTasks = legacyTaskGrades.length > 0;

    // Apply default fallback if no active plan
    if (!activePlan) {
      components = [
        { id: 'def_1', gradePlanId: 'def', key: 'BIMESTRAL', label: 'Avaliação Bimestral', weight: 30, sourceType: 'MANUAL', enabled: true, order: 1 },
        { id: 'def_2', gradePlanId: 'def', key: 'PAULISTA', label: 'Prova Paulista', weight: 30, sourceType: 'PROVA_PAULISTA', enabled: true, order: 2 },
        { id: 'def_3', gradePlanId: 'def', key: 'SIMULADO', label: 'Simulado', weight: 20, sourceType: 'MANUAL', enabled: true, order: 3 },
        { id: 'def_4', gradePlanId: 'def', key: 'PARTICIPACAO', label: 'Participação', weight: 10, sourceType: 'MANUAL', enabled: true, order: 4 },
        { id: 'def_5', gradePlanId: 'def', key: 'MATIFIC', label: 'Matific', weight: 5, sourceType: 'MATIFIC', enabled: true, order: 5 },
        { id: 'def_6', gradePlanId: 'def', key: 'TAREFA', label: 'Tarefas', weight: 5, sourceType: 'TASK_ANALYSIS', enabled: true, order: 6 },
      ];
      if (!hasTasks) {
        components.find(c => c.key === 'MATIFIC')!.weight = 10;
        components.find(c => c.key === 'TAREFA')!.weight = 0;
        components = components.filter(c => c.weight > 0);
      }
    }

    const students = roster.map(enroll => {
      const stId = enroll.studentId;
      let mediaFinal = 0;
      const compGrades: Record<string, any> = {};

      components.forEach(comp => {
        let val: number | null | undefined = null;
        switch(comp.key) {
          case 'BIMESTRAL': val = canonicalMaps['BIMESTRAL'].get(stId); break;
          case 'SIMULADO': val = canonicalMaps['SIMULADO'].get(stId); break;
          case 'PARTICIPACAO': val = canonicalMaps['PARTICIPACAO'].get(stId); break;
          case 'PAULISTA': val = paulistaMap.get(stId); break;
          case 'MATIFIC': val = matificMap.get(stId); break;
          case 'TAREFA': val = taskMap.get(stId) ?? (hasTasks ? undefined : 10); break;
          default:
             // Support for custom or future keys if mapped. 
             // We can allow injecting generic grades later.
             val = null;
        }

        const isLancado = val !== null && val !== undefined && !Number.isNaN(val);
        const gradeNum = isLancado ? val : null;
        mediaFinal += (gradeNum || 0) * (comp.weight / 100);

        compGrades[comp.key] = {
          grade: gradeNum,
          weight: comp.weight,
          isLancado
        };
      });

      return {
        studentId: stId,
        name: enroll.student.name,
        mediaFinal,
        components: compGrades,

        // Backwards compatible properties
        notaAvaliacao: compGrades['BIMESTRAL']?.grade || 0,
        notaSimulado: compGrades['SIMULADO']?.grade || 0,
        notaParticipacao: compGrades['PARTICIPACAO']?.grade || 0,
        notaPaulista: compGrades['PAULISTA']?.grade || 0,
        notaMatific: compGrades['MATIFIC']?.grade || 0,
        notaTarefa: compGrades['TAREFA']?.grade || 0,
        isAvaliacaoLancado: compGrades['BIMESTRAL']?.isLancado || false,
        isSimuladoLancado: compGrades['SIMULADO']?.isLancado || false,
        isParticipacaoLancado: compGrades['PARTICIPACAO']?.isLancado || false,
      };
    });

    // Ensure deterministic sort by name
    students.sort((a, b) => a.name.localeCompare(b.name));

    return {
      components,
      students
    };
  }
}
`;

fs.writeFileSync("src/services/academic/BimestralGradeService.ts", content);
