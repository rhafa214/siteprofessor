import { ClassGroup, Student, MatchConfidence } from '../../domain';

export interface LegacyStudentData {
  id?: number | string;
  numero?: number | string;
  nome?: string;
  name?: string;
  studentName?: string;
  aluno?: string | { nome?: string; name?: string };
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

export function extractLegacyStudentName(legacyStudent: LegacyStudentData): string {
  let name = legacyStudent.nome || legacyStudent.name || legacyStudent.studentName || '';
  if (!name && legacyStudent.aluno) {
    if (typeof legacyStudent.aluno === 'string') {
      name = legacyStudent.aluno;
    } else if (typeof legacyStudent.aluno === 'object') {
      name = legacyStudent.aluno.nome || legacyStudent.aluno.name || '';
    }
  }
  return String(name).trim();
}

export function mapLegacyStudentToStudent(legacyStudent: LegacyStudentData, classGroupId: string): Student {
  const numericId = legacyStudent.id ?? legacyStudent.numero ?? 0;
  
  return {
    id: generateOpaqueId(),
    classGroupId,
    name: extractLegacyStudentName(legacyStudent),
    number: Number(legacyStudent.numero ?? numericId),
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
  
  const hasId = legacyObj.id !== undefined && legacyObj.id !== null;
  const hasNumber = legacyObj.numero !== undefined && legacyObj.numero !== null;
  
  if (hasId) {
    identifier = `${legacyClassId}_${legacyObj.id}`;
  } else if (hasNumber) {
    identifier = `${legacyClassId}_${legacyObj.numero}`;
  } else {
    // If we have to use fallback, it's unstable.
    const name = legacyObj.nome || legacyObj.name || legacyObj.studentName || '';
    const stableName = String(name).trim().toLowerCase();
    identifier = `${legacyClassId}_fallback_${index}_${stableName}`;
    isStable = false;
  }
  
  return { identifier, isStable };
}

export function calculateStudentMatchConfidence(
  s1: Student, 
  s2: Student,
  source1: string,
  source2: string,
  sourceLocalId1: string,
  sourceLocalId2: string
): { confidence: MatchConfidence; reason: string } {
  // UNRESOLVED x UNRESOLVED != SAME_CLASS
  const isUnresolved1 = s1.classGroupId === 'UNRESOLVED';
  const isUnresolved2 = s2.classGroupId === 'UNRESOLVED';
  
  const sameClass = (!isUnresolved1 && !isUnresolved2 && s1.classGroupId === s2.classGroupId);
  
  // Same source semantics
  if (source1 === source2) {
    if (sourceLocalId1 && sourceLocalId2 && sourceLocalId1 !== sourceLocalId2) {
       return { confidence: 'DISTINCT', reason: 'SAME_SOURCE_DIFFERENT_LOCAL_ID' };
    }
  }

  // Cross source semantics
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
  const hasValidNum1 = s1.number !== undefined && s1.number !== null && s1.number !== 0 && !isNaN(s1.number);
  const hasValidNum2 = s2.number !== undefined && s2.number !== null && s2.number !== 0 && !isNaN(s2.number);
  
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
