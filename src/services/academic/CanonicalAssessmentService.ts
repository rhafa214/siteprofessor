import { db } from "../../lib/firebase";
import { doc, getDoc, setDoc, writeBatch, collection, query, where, getDocs } from "firebase/firestore";
import { AssessmentCategory, CanonicalAssessmentSheet, CanonicalAssessmentResult } from "../../domain/assessment/AssessmentTypes";

export class CanonicalAssessmentService {
  async getSheet(
    uid: string,
    academicYearId: string,
    termId: string,
    classGroupId: string,
    category: AssessmentCategory
  ): Promise<CanonicalAssessmentSheet | null> {
    const sheetId = `sheet_${academicYearId}_${termId}_${classGroupId}_${category}`;
    const ref = doc(db, "users", uid, "assessmentSheets", sheetId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as CanonicalAssessmentSheet;
    }
    return null;
  }

  async upsertSheet(sheet: CanonicalAssessmentSheet): Promise<void> {
    const ref = doc(db, "users", sheet.uid, "assessmentSheets", sheet.id);
    await setDoc(ref, sheet, { merge: true });
  }

  async getResults(uid: string, assessmentId: string): Promise<CanonicalAssessmentResult[]> {
    const q = query(
      collection(db, "users", uid, "assessmentResults"),
      where("assessmentId", "==", assessmentId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as CanonicalAssessmentResult);
  }

  async saveResults(uid: string, assessmentId: string, results: CanonicalAssessmentResult[]): Promise<void> {
    const batch = writeBatch(db);
    for (const res of results) {
      const ref = doc(db, "users", uid, "assessmentResults", res.id);
      batch.set(ref, res, { merge: true });
    }
    await batch.commit();
  }
}
