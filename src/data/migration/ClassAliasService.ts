import { getFirestore, doc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';
import { app } from '../../lib/firebase';
import { ClassAliasDecision } from '../../domain/migration';

export async function loadClassAliases(uid: string): Promise<Record<string, ClassAliasDecision>> {
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, `users/${uid}/migrationReviewDecisions/classAliases/decisions`));
  const result: Record<string, ClassAliasDecision> = {};
  snap.forEach(d => {
    result[d.id] = d.data() as ClassAliasDecision;
  });
  return result;
}

export async function saveClassAlias(uid: string, decision: ClassAliasDecision): Promise<void> {
  const db = getFirestore(app);
  await setDoc(doc(db, `users/${uid}/migrationReviewDecisions/classAliases/decisions`, decision.fingerprint), decision);
}

export async function clearClassAlias(uid: string, fingerprint: string): Promise<void> {
  const db = getFirestore(app);
  await deleteDoc(doc(db, `users/${uid}/migrationReviewDecisions/classAliases/decisions`, fingerprint));
}
