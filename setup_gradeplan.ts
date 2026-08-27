import fs from "fs";
import path from "path";

// 1. Types
const typesPath = "src/domain/assessment/GradePlanTypes.ts";
const typesContent = `export type GradePlanStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type GradeSourceType = 'MANUAL' | 'SALA_FUTURO' | 'MATIFIC' | 'TASK_ANALYSIS' | 'PROVA_PAULISTA' | 'CUSTOM';

export interface CanonicalGradePlan {
  id: string; // e.g. plan_\${yearId}_\${termId}_\${classId}_v\${version}
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
  id: string; // e.g. comp_\${planId}_\${key}
  gradePlanId: string;
  key: string; 
  label: string;
  weight: number; 
  sourceType: GradeSourceType;
  enabled: boolean;
  order: number;
}
`;
fs.mkdirSync(path.dirname(typesPath), { recursive: true });
fs.writeFileSync(typesPath, typesContent);

// 2. Service
const servicePath = "src/services/academic/GradePlanService.ts";
const serviceContent = `import { db } from "../../lib/firebase";
import { doc, getDocs, setDoc, query, where, collection, writeBatch } from "firebase/firestore";
import { CanonicalGradePlan, CanonicalGradeComponent } from "../../domain/assessment/GradePlanTypes";

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
    const plans = await this.getGradePlans(uid, yearId, termId, classId);
    return plans.find(p => p.status === 'ACTIVE') || null;
  }

  async getGradeComponents(uid: string, planId: string): Promise<CanonicalGradeComponent[]> {
    const q = query(collection(db, "users", uid, "gradeComponents"), where("gradePlanId", "==", planId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as CanonicalGradeComponent).sort((a, b) => a.order - b.order);
  }

  async activateGradePlan(uid: string, newPlan: CanonicalGradePlan, components: CanonicalGradeComponent[], oldActivePlanId?: string) {
    const batch = writeBatch(db);

    if (oldActivePlanId) {
      const oldRef = doc(db, "users", uid, "gradePlans", oldActivePlanId);
      batch.update(oldRef, { status: 'ARCHIVED', updatedAt: Date.now() });
    }

    const newPlanRef = doc(db, "users", uid, "gradePlans", newPlan.id);
    batch.set(newPlanRef, newPlan, { merge: true });

    components.forEach(comp => {
      const compRef = doc(db, "users", uid, "gradeComponents", comp.id);
      batch.set(compRef, comp, { merge: true });
    });

    await batch.commit();
  }

  async saveDraft(uid: string, newPlan: CanonicalGradePlan, components: CanonicalGradeComponent[]) {
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
console.log("Created Types and Service");
