import { getFirestore, doc, collection, getDocs, getDoc, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { app } from '../../lib/firebase';
import { Student } from '../../domain';

export class StudentRepository {
  private db = getFirestore(app);

  async getById(uid: string, id: string): Promise<Student | null> {
    const snap = await getDoc(doc(this.db, `users/${uid}/students/${id}`));
    return snap.exists() ? { id: snap.id, ...snap.data() } as Student : null;
  }
  
  async findByExternalId(uid: string, key: string, value: string): Promise<Student | null> {
    const q = query(collection(this.db, `users/${uid}/students`), where(`externalIds.${key}`, '==', value));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as Student;
    }
    return null;
  }

  async create(uid: string, student: Omit<Student, 'createdAt' | 'updatedAt'>): Promise<Student> {
    const ref = doc(collection(this.db, `users/${uid}/students`), student.id);
    const data: Student = { ...student, createdAt: Date.now(), updatedAt: Date.now() };
    await setDoc(ref, data);
    return data;
  }
  
  async update(uid: string, id: string, studentData: Partial<Student>): Promise<Student> {
    const ref = doc(this.db, `users/${uid}/students/${id}`);
    const data = { ...studentData, updatedAt: Date.now() };
    await updateDoc(ref, data);
    const snap = await getDoc(ref);
    return { id: snap.id, ...snap.data() } as Student;
  }
}
