import { collection, doc, setDoc, getDocs, query, where, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../../lib/firebase";

export interface CanonicalMatificImport {
  id: string;
  uid: string;
  academicYearId: string;
  classGroupId: string;
  title: string;
  date: string;
  createdAt: number;
}

export interface CanonicalMatificResult {
  id: string;
  uid: string;
  importId: string;
  studentId: string;
  minutes: number;
  academicYearId: string;
  classGroupId: string;
  createdAt: number;
  updatedAt: number;
}

export class MatificService {
  async getImportsByClassGroup(uid: string, academicYearId: string, classGroupId: string): Promise<CanonicalMatificImport[]> {
    const q = query(
      collection(db, "users", uid, "matificImports"),
      where("academicYearId", "==", academicYearId),
      where("classGroupId", "==", classGroupId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CanonicalMatificImport)).sort((a, b) => a.createdAt - b.createdAt);
  }

  async getResultsByClassGroup(uid: string, academicYearId: string, classGroupId: string): Promise<CanonicalMatificResult[]> {
    const q = query(
      collection(db, "users", uid, "matificResults"),
      where("academicYearId", "==", academicYearId),
      where("classGroupId", "==", classGroupId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CanonicalMatificResult));
  }

  async saveImportAndResults(
    uid: string,
    importData: Omit<CanonicalMatificImport, 'id' | 'createdAt' | 'uid'>,
    results: { studentId: string; minutes: number }[]
  ): Promise<void> {
    const batch = writeBatch(db);
    
    const importRef = doc(collection(db, "users", uid, "matificImports"));
    const newImport: CanonicalMatificImport = {
      ...importData,
      id: importRef.id,
      uid,
      createdAt: Date.now()
    };
    batch.set(importRef, newImport);

    for (const r of results) {
      const resultRef = doc(collection(db, "users", uid, "matificResults"));
      const newResult: CanonicalMatificResult = {
        id: resultRef.id,
        uid,
        importId: importRef.id,
        studentId: r.studentId,
        minutes: r.minutes,
        academicYearId: importData.academicYearId,
        classGroupId: importData.classGroupId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      batch.set(resultRef, newResult);
    }

    await batch.commit();
  }

  async createManualImport(uid: string, academicYearId: string, classGroupId: string, title: string, date: string): Promise<CanonicalMatificImport> {
    const importRef = doc(collection(db, "users", uid, "matificImports"));
    const newImport: CanonicalMatificImport = {
      id: importRef.id,
      uid,
      academicYearId,
      classGroupId,
      title,
      date,
      createdAt: Date.now()
    };
    await setDoc(importRef, newImport);
    return newImport;
  }

  async deleteImport(uid: string, importId: string) {
    const batch = writeBatch(db);
    batch.delete(doc(db, "users", uid, "matificImports", importId));
    
    const q = query(collection(db, "users", uid, "matificResults"), where("importId", "==", importId));
    const snap = await getDocs(q);
    snap.docs.forEach(d => {
      batch.delete(d.ref);
    });

    await batch.commit();
  }

  async createOrUpdateResult(uid: string, academicYearId: string, classGroupId: string, importId: string, studentId: string, minutes: number) {
    const q = query(
      collection(db, "users", uid, "matificResults"),
      where("importId", "==", importId),
      where("studentId", "==", studentId)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      const resultRef = doc(collection(db, "users", uid, "matificResults"));
      await setDoc(resultRef, {
        id: resultRef.id,
        uid,
        importId,
        studentId,
        minutes,
        academicYearId,
        classGroupId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      } as CanonicalMatificResult);
    } else {
      const docRef = snap.docs[0].ref;
      await updateDoc(docRef, { minutes, updatedAt: Date.now() });
    }
  }
}
