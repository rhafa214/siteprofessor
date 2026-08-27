import fs from "fs";

let content = fs.readFileSync("src/services/academic/GradePlanService.ts", "utf8");

// Add getDoc to imports
content = content.replace(
  'import { doc, getDocs, setDoc, query, where, collection, writeBatch, runTransaction } from "firebase/firestore";',
  'import { doc, getDoc, getDocs, setDoc, query, where, collection, writeBatch, runTransaction } from "firebase/firestore";'
);

// Update getActiveGradePlan
const getActiveRegex = /async getActiveGradePlan[\s\S]*?async getGradeComponents/m;
const getActiveReplacement = `async getActiveGradePlan(uid: string, yearId: string, termId: string, classId: string): Promise<CanonicalGradePlan | null> {
    const pointerRef = doc(db, "users", uid, "gradePlanActivePointers", \`\${yearId}_\${termId}_\${classId}\`);
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

  async getGradeComponents`;
content = content.replace(getActiveRegex, getActiveReplacement);

// Update activateGradePlan
content = content.replace(
  'const totalWeight = components.filter(c => c.enabled).reduce((sum, c) => sum + Math.round(c.weight), 0);',
  `const nonInteger = components.some(c => c.enabled && !Number.isInteger(c.weight));
    if (nonInteger) {
      throw new Error("ACTIVE plans must use integer weights.");
    }
    const totalWeight = components.filter(c => c.enabled).reduce((sum, c) => sum + c.weight, 0);`
);

fs.writeFileSync("src/services/academic/GradePlanService.ts", content);
