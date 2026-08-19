import { getFirestore, doc, collection, getDocs, getDoc, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { app } from '../../lib/firebase';
import { AcademicYear } from '../../domain';

export class AcademicYearRepository {
  private db = getFirestore(app);

  async getAll(uid: string): Promise<AcademicYear[]> {
    const snap = await getDocs(collection(this.db, `users/${uid}/academicYears`));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AcademicYear));
  }

  async getById(uid: string, id: string): Promise<AcademicYear | null> {
    const snap = await getDoc(doc(this.db, `users/${uid}/academicYears/${id}`));
    return snap.exists() ? { id: snap.id, ...snap.data() } as AcademicYear : null;
  }
  
  async findByYear(uid: string, year: number): Promise<AcademicYear | null> {
    const q = query(collection(this.db, `users/${uid}/academicYears`), where('year', '==', year));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as AcademicYear;
    }
    return null;
  }
  
  async preventDuplicateYear(uid: string, year: number): Promise<void> {
    const duplicate = await this.findByYear(uid, year);
    if (duplicate) {
      throw new Error(`O ano letivo de ${year} já existe.`);
    }
  }

  async create(uid: string, yearData: Omit<AcademicYear, 'createdAt' | 'updatedAt'>): Promise<AcademicYear> {
    await this.preventDuplicateYear(uid, yearData.year);
    
    const collectionRef = collection(this.db, `users/${uid}/academicYears`);
    const docRef = doc(collectionRef, yearData.id);
    const data: AcademicYear = { ...yearData, createdAt: Date.now(), updatedAt: Date.now() };
    
    await setDoc(docRef, data);
    return data;
  }

  async update(uid: string, id: string, yearData: Partial<AcademicYear>): Promise<AcademicYear> {
    const ref = doc(this.db, `users/${uid}/academicYears/${id}`);
    const data = { ...yearData, updatedAt: Date.now() };
    await updateDoc(ref, data);
    const snap = await getDoc(ref);
    return { id: snap.id, ...snap.data() } as AcademicYear;
  }
}
