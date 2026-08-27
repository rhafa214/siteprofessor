import fs from "fs";
import path from "path";

// 1. GradePlanTypes.ts
const typesPath = "src/domain/assessment/GradePlanTypes.ts";
let typesContent = `export type GradePlanStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type GradeSourceType = 'MANUAL' | 'SALA_FUTURO' | 'MATIFIC' | 'TASK_ANALYSIS' | 'PROVA_PAULISTA' | 'CUSTOM';
export type ResolverStatus = 'SUPPORTED' | 'PENDING_INTEGRATION' | 'MANUAL_ENTRY_REQUIRED';

export interface CanonicalGradePlan {
  id: string;
  uid: string;
  academicYearId: string;
  termId: string;
  classGroupId: string;
  version: number;
  status: GradePlanStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CanonicalGradeComponent {
  id: string;
  gradePlanId: string;
  key: string;
  label: string;
  weight: number; 
  sourceType: GradeSourceType;
  sourceKey?: string;
  enabled: boolean;
  order: number;
}

export function getSourceResolverStatus(sourceType: GradeSourceType): ResolverStatus {
  switch (sourceType) {
    case 'MANUAL':
    case 'MATIFIC':
    case 'TASK_ANALYSIS':
    case 'PROVA_PAULISTA':
      return 'SUPPORTED';
    case 'SALA_FUTURO':
    case 'CUSTOM':
      return 'PENDING_INTEGRATION';
    default:
      return 'PENDING_INTEGRATION';
  }
}
`;
fs.writeFileSync(typesPath, typesContent);

// 2. GradePlanService.ts
const servicePath = "src/services/academic/GradePlanService.ts";
let serviceContent = `import { db } from "../../lib/firebase";
import { doc, getDocs, setDoc, query, where, collection, writeBatch, runTransaction } from "firebase/firestore";
import { CanonicalGradePlan, CanonicalGradeComponent, getSourceResolverStatus } from "../../domain/assessment/GradePlanTypes";

export class GradePlanService {
  async getGradePlans(uid: string, yearId: string, termId: string, classId: string): Promise<CanonicalGradePlan[]> {
    const q = query(
      collection(db, "users", uid, "gradePlans"),
      where("academicYearId", "==", yearId),
      where("termId", "==", termId),
      where("classGroupId", "==", classId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as CanonicalGradePlan);
  }

  async getActiveGradePlan(uid: string, yearId: string, termId: string, classId: string): Promise<CanonicalGradePlan | null> {
    const pointerRef = doc(db, "users", uid, "gradePlanActivePointers", \`\${yearId}_\${termId}_\${classId}\`);
    // Note: To save reads, one could just query ACTIVE plans directly, but the pointer is the single source of truth.
    const plans = await this.getGradePlans(uid, yearId, termId, classId);
    return plans.find(p => p.status === 'ACTIVE') || null;
  }

  async getGradeComponents(uid: string, planId: string): Promise<CanonicalGradeComponent[]> {
    const q = query(collection(db, "users", uid, "gradeComponents"), where("gradePlanId", "==", planId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as CanonicalGradeComponent).sort((a, b) => a.order - b.order);
  }

  async activateGradePlan(uid: string, newPlan: CanonicalGradePlan, components: CanonicalGradeComponent[]) {
    const totalWeight = components.filter(c => c.enabled).reduce((sum, c) => sum + Math.round(c.weight), 0);
    if (totalWeight !== 100) {
      throw new Error("ACTIVE plans must have exactly 100% total weight.");
    }

    const hasPending = components.some(c => c.enabled && getSourceResolverStatus(c.sourceType) === 'PENDING_INTEGRATION');
    if (hasPending) {
      throw new Error("Cannot activate a plan with components that are PENDING_INTEGRATION.");
    }

    // Force ACTIVE status
    newPlan.status = 'ACTIVE';

    await runTransaction(db, async (transaction) => {
      const pointerId = \`\${newPlan.academicYearId}_\${newPlan.termId}_\${newPlan.classGroupId}\`;
      const pointerRef = doc(db, "users", uid, "gradePlanActivePointers", pointerId);
      const pointerSnap = await transaction.get(pointerRef);
      
      if (pointerSnap.exists()) {
        const oldActivePlanId = pointerSnap.data().planId;
        if (oldActivePlanId && oldActivePlanId !== newPlan.id) {
          const oldPlanRef = doc(db, "users", uid, "gradePlans", oldActivePlanId);
          transaction.update(oldPlanRef, { status: 'ARCHIVED', updatedAt: Date.now() });
        }
      }

      transaction.set(pointerRef, { planId: newPlan.id, updatedAt: Date.now() }, { merge: true });

      const newPlanRef = doc(db, "users", uid, "gradePlans", newPlan.id);
      transaction.set(newPlanRef, newPlan, { merge: true });

      components.forEach(comp => {
        const compRef = doc(db, "users", uid, "gradeComponents", comp.id);
        transaction.set(compRef, comp, { merge: true });
      });
    });
  }

  async saveDraft(uid: string, newPlan: CanonicalGradePlan, components: CanonicalGradeComponent[]) {
    newPlan.status = 'DRAFT';
    const batch = writeBatch(db);
    const newPlanRef = doc(db, "users", uid, "gradePlans", newPlan.id);
    batch.set(newPlanRef, newPlan, { merge: true });

    components.forEach(comp => {
      const compRef = doc(db, "users", uid, "gradeComponents", comp.id);
      batch.set(compRef, comp, { merge: true });
    });

    await batch.commit();
  }
}
`;
fs.writeFileSync(servicePath, serviceContent);

// 3. Update BimestralGradeService to fail on PENDING_INTEGRATION
const bgServicePath = "src/services/academic/BimestralGradeService.ts";
let bgContent = fs.readFileSync(bgServicePath, "utf8");
bgContent = bgContent.replace(
  'import { CanonicalGradeComponent } from "../../domain/assessment/GradePlanTypes";',
  'import { CanonicalGradeComponent, getSourceResolverStatus } from "../../domain/assessment/GradePlanTypes";'
);

const bgValidationRegex = /      components\.forEach\(comp => \{/;
const bgValidationCode = `      components.forEach(comp => {
        if (getSourceResolverStatus(comp.sourceType) === 'PENDING_INTEGRATION') {
          throw new Error(\`Component \${comp.label} (sourceType: \${comp.sourceType}) is not implemented yet. Calculation aborted.\`);
        }`;
bgContent = bgContent.replace(bgValidationRegex, bgValidationCode);

// Fix MANUAL sourceKey resolution
bgContent = bgContent.replace(
  /case 'BIMESTRAL': val = canonicalMaps\['BIMESTRAL'\]\.get\(stId\); break;/g,
  `case 'BIMESTRAL': 
          case 'SIMULADO': 
          case 'PARTICIPACAO': 
             if (comp.sourceType === 'MANUAL' && comp.sourceKey) {
                val = canonicalMaps[comp.sourceKey]?.get(stId);
             } else {
                val = canonicalMaps[comp.key]?.get(stId); // Fallback for old comps
             }
             break;`
);
bgContent = bgContent.replace(/case 'SIMULADO': val = canonicalMaps\['SIMULADO'\]\.get\(stId\); break;/g, "");
bgContent = bgContent.replace(/case 'PARTICIPACAO': val = canonicalMaps\['PARTICIPACAO'\]\.get\(stId\); break;/g, "");

fs.writeFileSync(bgServicePath, bgContent);

// 4. Update GradePlanConfigView
const uiPath = "src/views/GradePlanConfigView.tsx";
let uiContent = fs.readFileSync(uiPath, "utf8");

uiContent = uiContent.replace(
  'import { CanonicalGradePlan, CanonicalGradeComponent } from "../domain/assessment/GradePlanTypes";',
  'import { CanonicalGradePlan, CanonicalGradeComponent, getSourceResolverStatus, ResolverStatus } from "../domain/assessment/GradePlanTypes";'
);

// Map resolver status to badge
const resolverBadgeCode = `
const getResolverBadge = (status: ResolverStatus) => {
  switch (status) {
    case 'SUPPORTED': return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">Disponível</span>;
    case 'PENDING_INTEGRATION': return <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-full">Em Breve (Bloqueia Ativação)</span>;
    case 'MANUAL_ENTRY_REQUIRED': return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">Manual</span>;
  }
};
`;

uiContent = uiContent.replace(
  'export default function GradePlanConfigView',
  resolverBadgeCode + '\nexport default function GradePlanConfigView'
);

// New default comps with sourceKey
uiContent = uiContent.replace(
  "key: 'BIMESTRAL', label: 'Avaliação', weight: 30, sourceType: 'MANUAL', enabled: true, order: 2",
  "key: 'BIMESTRAL', label: 'Avaliação', weight: 30, sourceType: 'MANUAL', sourceKey: 'BIMESTRAL', enabled: true, order: 2"
);
uiContent = uiContent.replace(
  "key: 'PARTICIPACAO', label: 'Participação', weight: 10, sourceType: 'MANUAL', enabled: true, order: 5",
  "key: 'PARTICIPACAO', label: 'Participação', weight: 10, sourceType: 'MANUAL', sourceKey: 'PARTICIPACAO', enabled: true, order: 5"
);

// Validate hasPending
uiContent = uiContent.replace(
  'const totalWeight = components.reduce((sum, c) => sum + (c.enabled ? Number(c.weight) : 0), 0);',
  'const totalWeight = components.reduce((sum, c) => sum + (c.enabled ? Number(c.weight) : 0), 0);\n  const hasPending = components.some(c => c.enabled && getSourceResolverStatus(c.sourceType) === "PENDING_INTEGRATION");'
);
uiContent = uiContent.replace(
  'const isValid = totalWeight === 100;',
  'const isValid = totalWeight === 100 && !hasPending;'
);

// Display resolver status
uiContent = uiContent.replace(
  /<p className="text-xs text-slate-400 uppercase tracking-wider">\{comp\.sourceType\}<\/p>/g,
  `<div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-slate-400 uppercase tracking-wider">{comp.sourceType}</p>
                      {getResolverBadge(getSourceResolverStatus(comp.sourceType))}
                    </div>`
);

fs.writeFileSync(uiPath, uiContent);
