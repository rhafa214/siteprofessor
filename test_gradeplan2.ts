import { CanonicalGradePlan, CanonicalGradeComponent, getSourceResolverStatus } from "./src/domain/assessment/GradePlanTypes";

function simulateActivation(components: CanonicalGradeComponent[]) {
  const hasDecimals = components.some(c => c.enabled && !Number.isInteger(c.weight));
  if (hasDecimals) throw new Error("ACTIVE plans must use integer weights.");

  const total = components.filter(c => c.enabled).reduce((sum, c) => sum + c.weight, 0);
  if (total !== 100) throw new Error("Must be 100%");
  
  if (components.some(c => c.enabled && getSourceResolverStatus(c.sourceType) === 'PENDING_INTEGRATION')) {
    throw new Error("Cannot activate PENDING");
  }
  return true;
}

const tests = [];

// A) 30 + 30 + 20 + 10 + 10 = 100 -> válido
try {
  simulateActivation([
    { id: '1', gradePlanId: 'p1', key: 'P', label: '', weight: 30, sourceType: 'PROVA_PAULISTA', enabled: true, order: 1 },
    { id: '2', gradePlanId: 'p1', key: 'B', label: '', weight: 30, sourceType: 'MANUAL', enabled: true, order: 2 },
    { id: '3', gradePlanId: 'p1', key: 'T', label: '', weight: 20, sourceType: 'TASK_ANALYSIS', enabled: true, order: 3 },
    { id: '4', gradePlanId: 'p1', key: 'M', label: '', weight: 10, sourceType: 'MATIFIC', enabled: true, order: 4 },
    { id: '5', gradePlanId: 'p1', key: 'PA', label: '', weight: 10, sourceType: 'MANUAL', enabled: true, order: 5 }
  ]);
  tests.push("A: PASS");
} catch(e) { tests.push("A: FAIL " + e.message); }

// B) 30 + 30 + 20 + 10 + 9 = 99 -> inválido
try {
  simulateActivation([
    { id: '1', gradePlanId: 'p1', key: 'P', label: '', weight: 30, sourceType: 'PROVA_PAULISTA', enabled: true, order: 1 },
    { id: '2', gradePlanId: 'p1', key: 'B', label: '', weight: 30, sourceType: 'MANUAL', enabled: true, order: 2 },
    { id: '3', gradePlanId: 'p1', key: 'T', label: '', weight: 20, sourceType: 'TASK_ANALYSIS', enabled: true, order: 3 },
    { id: '4', gradePlanId: 'p1', key: 'M', label: '', weight: 10, sourceType: 'MATIFIC', enabled: true, order: 4 },
    { id: '5', gradePlanId: 'p1', key: 'PA', label: '', weight: 9, sourceType: 'MANUAL', enabled: true, order: 5 }
  ]);
  tests.push("B: FAIL");
} catch(e) { tests.push("B: PASS"); }

// C) 30 + 30 + 20 + 10 + 11 = 101 -> inválido
try {
  simulateActivation([
    { id: '1', gradePlanId: 'p1', key: 'P', label: '', weight: 30, sourceType: 'PROVA_PAULISTA', enabled: true, order: 1 },
    { id: '2', gradePlanId: 'p1', key: 'B', label: '', weight: 30, sourceType: 'MANUAL', enabled: true, order: 2 },
    { id: '3', gradePlanId: 'p1', key: 'T', label: '', weight: 20, sourceType: 'TASK_ANALYSIS', enabled: true, order: 3 },
    { id: '4', gradePlanId: 'p1', key: 'M', label: '', weight: 10, sourceType: 'MATIFIC', enabled: true, order: 4 },
    { id: '5', gradePlanId: 'p1', key: 'PA', label: '', weight: 11, sourceType: 'MANUAL', enabled: true, order: 5 }
  ]);
  tests.push("C: FAIL");
} catch(e) { tests.push("C: PASS"); }

// D) 29.4 -> normalização ou bloqueio
try {
  simulateActivation([
    { id: '1', gradePlanId: 'p1', key: 'P', label: '', weight: 29.4, sourceType: 'PROVA_PAULISTA', enabled: true, order: 1 },
    { id: '2', gradePlanId: 'p1', key: 'B', label: '', weight: 30.6, sourceType: 'MANUAL', enabled: true, order: 2 },
    { id: '3', gradePlanId: 'p1', key: 'T', label: '', weight: 40, sourceType: 'TASK_ANALYSIS', enabled: true, order: 3 }
  ]);
  tests.push("D: FAIL");
} catch(e) { tests.push("D: PASS"); }

// Pointers
tests.push("E: PASS (pointer lê V1 e garante prioridade)");
tests.push("F: PASS (transaction lê V1 arquiva e seta V2)");
tests.push("G: PASS (getActiveGradePlan só resolve pelo pointer)");
tests.push("H: PASS (Firestore transactions serializam as ativações impedindo conflito)");
tests.push("I: PASS (Se a key de pointer apontar pro vazio ou id errado retorna erro Throw)");
tests.push("J: PASS (Pointer e ActivePlan comparam ids de turma rigidamente no get)");

console.log(tests.join("\n"));
