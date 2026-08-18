import { ClassGroup, Student, MatchConfidence } from '../../domain';

export interface LegacyStudentData {
  id: number;
  numero: number;
  nome: string;
  turma?: string;
  [key: string]: unknown;
}

export function generateOpaqueId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function mapLegacyClassToClassGroup(legacyClassName: string, academicYearId?: string): ClassGroup {
  const normalizedSlug = legacyClassName.trim().toLowerCase().replace(/\s+/g, '-');
  return {
    id: generateOpaqueId(),
    name: legacyClassName.trim(),
    academicYearId,
    status: 'ACTIVE',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    legacySlug: normalizedSlug,
    migrationMetadata: {
      legacySourceKeys: [legacyClassName]
    }
  };
}

export function mapLegacyStudentToStudent(legacyStudent: LegacyStudentData, classGroupId: string): Student {
  const numericId = legacyStudent.id ?? legacyStudent.numero ?? 0;
  
  return {
    id: generateOpaqueId(),
    classGroupId,
    name: (legacyStudent.nome || '').trim(),
    number: legacyStudent.numero ?? numericId,
    status: 'ACTIVE',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata: {
      observacao: typeof legacyStudent.observacao === 'string' ? legacyStudent.observacao : undefined,
    },
    migrationMetadata: {
      legacyIds: [String(numericId)],
    }
  };
}

export function resolveClassCandidates(legacyNames: string[]): { name: string, slug: string }[] {
  const map = new Map<string, string>();
  for (const name of legacyNames) {
    if (!name) continue;
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (!map.has(slug)) {
      map.set(slug, name.trim());
    }
  }
  return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
}

// Single robust method to identify legacy records
export function generateLegacyRecordIdentifier(
  legacyClassId: string, 
  legacyObj: Record<string, unknown>, 
  index: number
): { identifier: string; isStable: boolean } {
  let identifier = '';
  let isStable = true;
  
  // We use the older format that matches PREPARED mappings to avoid mapping missing errors
  // Previously we used: `${legacyId}_${String(legacyObj.id || legacyObj.numero || Math.random())}`
  // Let's create a robust version that falls back to stable hash instead of random.
  
  // But wait! If the mappings are already in DB using Math.random(), we CANNOT match them exactly!
  // That's why we must report legacyKeyFormatMismatch and mappingNotFound.
  // Actually, we must use the EXACT logic the old code used to attempt a lookup if possible.
  // We don't have the random value, so those are lost. We just use the stable fallback now.
  
  const hasId = legacyObj.id !== undefined && legacyObj.id !== null;
  const hasNumber = legacyObj.numero !== undefined && legacyObj.numero !== null;
  
  if (hasId) {
    identifier = `${legacyClassId}_${legacyObj.id}`;
  } else if (hasNumber) {
    identifier = `${legacyClassId}_${legacyObj.numero}`;
  } else {
    // If we have to use fallback, it's unstable.
    const stableName = String(legacyObj.nome || '').trim().toLowerCase();
    identifier = `${legacyClassId}_fallback_${index}_${stableName}`;
    isStable = false;
  }
  
  return { identifier, isStable };
}

export function calculateStudentMatchConfidence(s1: Student, s2: Student): { confidence: MatchConfidence; reason: string } {
  if (s1.id && s2.id && s1.id === s2.id) return { confidence: 'EXACT', reason: 'EXACT_ID_MATCH' };
  
  const sameClass = s1.classGroupId === s2.classGroupId;
  const name1 = s1.name.trim().toLowerCase();
  const name2 = s2.name.trim().toLowerCase();
  
  if (!sameClass) {
    return { confidence: 'DISTINCT', reason: 'DIFFERENT_CLASS' };
  }
  
  // Empty names cannot be matched automatically
  if (!name1 || !name2) {
    return { confidence: 'AMBIGUOUS', reason: 'INSUFFICIENT_IDENTIFIERS' };
  }
  
  const sameName = name1 === name2;
  const hasValidNum1 = s1.number !== undefined && s1.number !== null && s1.number !== 0;
  const hasValidNum2 = s2.number !== undefined && s2.number !== null && s2.number !== 0;
  
  const sameNumber = hasValidNum1 && hasValidNum2 && s1.number === s2.number;
  const differentNumber = hasValidNum1 && hasValidNum2 && s1.number !== s2.number;
  
  if (sameName) {
    if (differentNumber) {
      return { confidence: 'AMBIGUOUS', reason: 'SAME_NAME_DIFFERENT_NUMBER' };
    }
    // High confidence requires BOTH to have valid identifiers OR one to be perfectly subsumed
    if (!hasValidNum1 && !hasValidNum2) {
      return { confidence: 'AMBIGUOUS', reason: 'SAME_NORMALIZED_NAME_MISSING_NUMBER' };
    }
    return { confidence: 'HIGH_CONFIDENCE', reason: 'HIGH_CONFIDENCE_MATCH' };
  } else {
    if (sameNumber) {
      return { confidence: 'AMBIGUOUS', reason: 'SAME_NUMBER_DIFFERENT_NAME' };
    }
  }
  
  return { confidence: 'DISTINCT', reason: 'DIFFERENT_NAME_AND_NUMBER' };
}
