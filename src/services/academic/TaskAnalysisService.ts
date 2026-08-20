import { getFirestore, doc, collection, getDocs, setDoc, query, where, deleteDoc } from 'firebase/firestore';
import { app } from '../../lib/firebase';

export interface CanonicalTaskAssessment {
  id: string;
  academicYearId: string;
  classGroupId: string;
  title: string;
  maxScore: number;
  date: string;
  createdAt: number;
  updatedAt: number;
}

export interface CanonicalTaskResult {
  id: string;
  assessmentId: string;
  studentId: string;
  score: number | null;
  createdAt: number;
  updatedAt: number;
}

export class TaskAnalysisService {
  private db = getFirestore(app);

  async getAssessments(uid: string, academicYearId: string, classGroupId: string): Promise<CanonicalTaskAssessment[]> {
    const q = query(
      collection(this.db, `users/${uid}/taskAssessments`),
      where('academicYearId', '==', academicYearId),
      where('classGroupId', '==', classGroupId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CanonicalTaskAssessment));
  }

  async getResultsForAssessment(uid: string, assessmentId: string): Promise<CanonicalTaskResult[]> {
    const q = query(
      collection(this.db, `users/${uid}/taskResults`),
      where('assessmentId', '==', assessmentId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CanonicalTaskResult));
  }

  async saveAssessment(uid: string, assessment: CanonicalTaskAssessment): Promise<void> {
    const ref = doc(this.db, `users/${uid}/taskAssessments/${assessment.id}`);
    await setDoc(ref, assessment);
  }

  async deleteAssessment(uid: string, assessmentId: string): Promise<void> {
    // Delete assessment
    const ref = doc(this.db, `users/${uid}/taskAssessments/${assessmentId}`);
    await deleteDoc(ref);

    // Delete all results for this assessment
    const results = await this.getResultsForAssessment(uid, assessmentId);
    for (const r of results) {
      await deleteDoc(doc(this.db, `users/${uid}/taskResults/${r.id}`));
    }
  }

  async saveResult(uid: string, result: CanonicalTaskResult, validStudentIds?: Set<string>): Promise<void> {
    if (validStudentIds && !validStudentIds.has(result.studentId)) {
      throw new Error(`Student ${result.studentId} does not belong to the canonical roster of this class group.`);
    }
    const ref = doc(this.db, `users/${uid}/taskResults/${result.id}`);
    await setDoc(ref, result);
  }
}
