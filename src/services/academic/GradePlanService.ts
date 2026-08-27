import { db } from "../../lib/firebase";
import { doc, getDoc, getDocs, setDoc, query, where, collection, writeBatch, runTransaction } from "firebase/firestore";
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
    const pointerRef = doc(db, "users", uid, "gradePlanActivePointers", `${yearId}_${termId}_${classId}`);
    const pointerSnap = await getDoc(pointerRef);
    if (!pointerSnap.exists()) return null;
    
    const activePlanId = pointerSnap.data().planId;
    if (!activePlanId) return null;

    const planRef = doc(db, "users", uid, "gradePlans", activePlanId);
    const planSnap = await getDoc(planRef);

    if (!planSnap.exists()) {
      throw new Error("Integrity Error: Active pointer references a non-existent GradePlan.");
    }

    const plan = planSnap.data() as CanonicalGradePlan;
    if (plan.academicYearId !== yearId || plan.termId !== termId || plan.classGroupId !== classId) {
      throw new Error("Integrity Error: Active pointer references a GradePlan from a different context.");
    }

    if (plan.status !== 'ACTIVE') {
      throw new Error("Integrity Error: Active pointer references a GradePlan that is not ACTIVE.");
    }

    return plan;
  }

  async getGradeComponents(uid: string, planId: string): Promise<CanonicalGradeComponent[]> {
    const q = query(collection(db, "users", uid, "gradeComponents"), where("gradePlanId", "==", planId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as CanonicalGradeComponent).sort((a, b) => a.order - b.order);
  }

  async activateGradePlan(uid: string, newPlan: CanonicalGradePlan, components: CanonicalGradeComponent[]) {
    const nonInteger = components.some(c => c.enabled && !Number.isInteger(c.weight));
    if (nonInteger) {
      throw new Error("ACTIVE plans must use integer weights.");
    }
    const totalWeight = components.filter(c => c.enabled).reduce((sum, c) => sum + c.weight, 0);
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
      const pointerId = `${newPlan.academicYearId}_${newPlan.termId}_${newPlan.classGroupId}`;
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
