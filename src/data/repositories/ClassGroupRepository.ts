import { getFirestore, doc, collection, getDocs, getDoc, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { app } from '../../lib/firebase';
import { ClassGroup } from '../../domain';

export class ClassGroupRepository {
  private db = getFirestore(app);

  async getByAcademicYear(uid: string, academicYearId: string): Promise<ClassGroup[]> {
    const q = query(collection(this.db, `users/${uid}/classGroups`), where('academicYearId', '==', academicYearId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ClassGroup));
  }

  async getById(uid: string, id: string): Promise<ClassGroup | null> {
    const snap = await getDoc(doc(this.db, `users/${uid}/classGroups/${id}`));
    return snap.exists() ? { id: snap.id, ...snap.data() } as ClassGroup : null;
  }
  
  async findLogicalDuplicate(uid: string, academicYearId: string, name: string, grade?: string, section?: string): Promise<ClassGroup | null> {
    const existing = await this.getByAcademicYear(uid, academicYearId);
    
    const normalizedName = name.trim().toLowerCase();
    const normalizedGrade = grade?.trim().toLowerCase();
    const normalizedSection = section?.trim().toLowerCase();
    
    for (const c of existing) {
      if (c.name.trim().toLowerCase() === normalizedName) {
        return c;
      }
      if (normalizedGrade && normalizedSection && 
          c.grade?.trim().toLowerCase() === normalizedGrade && 
          c.section?.trim().toLowerCase() === normalizedSection) {
        return c;
      }
    }
    
    return null;
  }
  
  async preventDuplicateLogicalClass(uid: string, classGroup: Omit<ClassGroup, 'createdAt' | 'updatedAt'>): Promise<void> {
    if (!classGroup.academicYearId) {
      throw new Error("academicYearId é obrigatório na nova arquitetura.");
    }
    const duplicate = await this.findLogicalDuplicate(uid, classGroup.academicYearId, classGroup.name, classGroup.grade, classGroup.section);
    if (duplicate) {
      throw new Error(`Turma já existe neste ano letivo. (Conflito com a turma: ${duplicate.name})`);
    }
  }

  async create(uid: string, classGroup: Omit<ClassGroup, 'createdAt' | 'updatedAt'>): Promise<ClassGroup> {
    await this.preventDuplicateLogicalClass(uid, classGroup);
    
    const collectionRef = collection(this.db, `users/${uid}/classGroups`);
    const docRef = doc(collectionRef, classGroup.id);
    const data: ClassGroup = { ...classGroup, createdAt: Date.now(), updatedAt: Date.now() };
    
    await setDoc(docRef, data);
    return data;
  }
}
