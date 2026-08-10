import { db } from '../../lib/firebase';
import { collection, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';

export interface MigrationMapping {
  legacySource: string;
  legacyRecordIdentifier: string;
  canonicalEntityType: 'CLASS_GROUP' | 'STUDENT' | 'ASSESSMENT' | 'ASSESSMENT_RESULT' | 'PLANNING' | 'LESSON';
  proposedCanonicalId: string;
  createdAt: number;
  migrationRunId: string;
  status: 'PREPARED' | 'MIGRATED' | 'INVALIDATED';
}

export function generateMappingKey(legacySource: string, legacyRecordIdentifier: string, canonicalEntityType: string): string {
  // Creating a safe document ID
  const raw = `${legacySource}::${legacyRecordIdentifier}::${canonicalEntityType}`;
  return encodeURIComponent(raw).replace(/\./g, '%2E');
}

export async function loadPreparedMappings(userId: string): Promise<Record<string, MigrationMapping>> {
  if (typeof window === 'undefined' || !userId) return {};
  const mappings: Record<string, MigrationMapping> = {};
  
  try {
    const snap = await getDocs(collection(db, `users/${userId}/migrationMappings`));
    snap.forEach(d => {
      const data = d.data() as MigrationMapping;
      if (data.status === 'PREPARED' || data.status === 'MIGRATED') {
        const key = generateMappingKey(data.legacySource, data.legacyRecordIdentifier, data.canonicalEntityType);
        mappings[key] = data;
      }
    });
  } catch (e) {
    console.warn("Failed to load migration mappings", e);
  }
  return mappings;
}

export async function savePreparedMappings(userId: string, mappings: MigrationMapping[]): Promise<void> {
  if (typeof window === 'undefined' || !userId || mappings.length === 0) return;
  
  try {
    let count = 0;
    let currentBatch = writeBatch(db);
    
    for (const m of mappings) {
      const docId = generateMappingKey(m.legacySource, m.legacyRecordIdentifier, m.canonicalEntityType);
      currentBatch.set(doc(db, `users/${userId}/migrationMappings/${docId}`), m, { merge: true });
      count++;
      
      if (count % 500 === 0) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
      }
    }
    
    if (count % 500 !== 0) {
      await currentBatch.commit();
    }
  } catch (e) {
    console.error("Failed to save migration mappings", e);
    throw e;
  }
}
