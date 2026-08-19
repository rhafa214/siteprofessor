import { getFirestore, doc, collection, getDocs, getDoc, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { app } from '../../lib/firebase';
import { Enrollment } from '../../domain';

export class EnrollmentRepository {
  private db = getFirestore(app);

  async getByClassGroup(uid: string, classGroupId: string): Promise<Enrollment[]> {
    const q = query(collection(this.db, `users/${uid}/enrollments`), where('classGroupId', '==', classGroupId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment));
  }

  async getActiveByClassGroup(uid: string, classGroupId: string): Promise<Enrollment[]> {
    const q = query(collection(this.db, `users/${uid}/enrollments`), where('classGroupId', '==', classGroupId), where('status', '==', 'ACTIVE'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment));
  }
  
  async findByStudentAndAcademicYear(uid: string, studentId: string, academicYearId: string): Promise<Enrollment[]> {
    const q = query(collection(this.db, `users/${uid}/enrollments`), 
      where('studentId', '==', studentId), 
      where('academicYearId', '==', academicYearId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment));
  }

  async create(uid: string, enrollment: Omit<Enrollment, 'createdAt' | 'updatedAt'>): Promise<Enrollment> {
    const ref = doc(collection(this.db, `users/${uid}/enrollments`), enrollment.id);
    const data: Enrollment = { ...enrollment, createdAt: Date.now(), updatedAt: Date.now() };
    await setDoc(ref, data);
    return data;
  }
  
  async updateStatus(uid: string, id: string, status: Enrollment['status'], sourceStatus?: string): Promise<void> {
    const ref = doc(this.db, `users/${uid}/enrollments/${id}`);
    await updateDoc(ref, { status, sourceStatus, updatedAt: Date.now() });
  }
  
  async updateCallNumber(uid: string, id: string, callNumber: number): Promise<void> {
    const ref = doc(this.db, `users/${uid}/enrollments/${id}`);
    await updateDoc(ref, { callNumber, updatedAt: Date.now() });
  }
}
