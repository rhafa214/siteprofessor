import { LegacyAcademicSnapshot } from './LegacyDataCollector';
import { generateMigrationPreview } from './MigrationDryRun';
import { loadPreparedMappings, savePreparedMappings } from './MigrationMappingService';
import { MigrationManifest, MigrationPreview } from '../../domain';
import { db } from '../../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export async function backupLegacySnapshot(snapshot: LegacyAcademicSnapshot): Promise<string> {
  const backupId = `bkp_${snapshot.userId}_${Date.now()}`;
  if (typeof window === 'undefined') {
    return backupId;
  }
  
  try {
    const chunkStr = JSON.stringify(snapshot);
    const CHUNK_SIZE = 500000;
    const chunks = [];
    for (let i = 0; i < chunkStr.length; i += CHUNK_SIZE) {
      chunks.push(chunkStr.slice(i, i + CHUNK_SIZE));
    }

    const manifest = {
      id: backupId,
      createdAt: snapshot.capturedAt,
      schemaVersion: 0,
      sourceCount: snapshot.sources.length,
      chunkCount: chunks.length,
      status: 'WRITING'
    };

    await setDoc(doc(db, `users/${snapshot.userId}/backups/${backupId}`), manifest);

    for (let i = 0; i < chunks.length; i++) {
      await setDoc(doc(db, `users/${snapshot.userId}/backups/${backupId}/chunks/chunk_${i}`), {
        index: i,
        data: chunks[i]
      });
    }

    const verifyDoc = await getDoc(doc(db, `users/${snapshot.userId}/backups/${backupId}`));
    if (verifyDoc.exists() && verifyDoc.data().chunkCount === chunks.length) {
      await setDoc(doc(db, `users/${snapshot.userId}/backups/${backupId}`), { status: 'COMPLETE' }, { merge: true });
      return backupId;
    } else {
      throw new Error("Backup verification failed.");
    }
  } catch (e) {
    console.error("Backup failed", e);
    throw e;
  }
}

export async function runMigrationDryRun(snapshot: LegacyAcademicSnapshot, runId: string): Promise<MigrationPreview> {
  const existingMappings = await loadPreparedMappings(snapshot.userId);
  const { preview, newMappings } = generateMigrationPreview(snapshot, existingMappings, {}, runId);
  await savePreparedMappings(snapshot.userId, newMappings);
  return preview;
}

export async function createMigrationManifest(preview: MigrationPreview, backupId: string, runId: string, userId: string): Promise<MigrationManifest> {
  const manifest: MigrationManifest = {
    id: runId,
    startedAt: Date.now(),
    sourceSchemaVersion: 0,
    targetSchemaVersion: 1,
    status: 'DRY_RUN_COMPLETE',
    backupId,
    warnings: preview.warnings,
    errors: preview.errors
  };

  if (typeof window !== 'undefined') {
     await setDoc(doc(db, `users/${userId}/migrations/${runId}`), manifest);
  }
  return manifest;
}
