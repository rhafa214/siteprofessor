import { ClassGroup, Student, MatchConfidence } from '../../domain';

export interface LegacyStudentData {
  id: number;
  numero: number;
  nome: string;
  turma?: string;
  [key: string]: unknown;
}

export function generateOpaqueId(): string {
  // In a real env, crypto.randomUUID() should be used.
  // Using a fallback for testing
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
    name: (legacyStudent.nome || 'Aluno sem nome').trim(),
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
  // Pure function to extract unique class groups based on slug
  const map = new Map<string, string>();
  for (const name of legacyNames) {
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (!map.has(slug)) {
      map.set(slug, name.trim());
    }
  }
  return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
}

export function calculateStudentMatchConfidence(s1: Student, s2: Student): MatchConfidence {
  // If they have the exact same canonical ID (already mapped)
  if (s1.id && s2.id && s1.id === s2.id) return 'EXACT';
  
  const sameClass = s1.classGroupId === s2.classGroupId;
  const name1 = s1.name.trim().toLowerCase();
  const name2 = s2.name.trim().toLowerCase();
  const sameName = name1 === name2;
  
  // Consider 0 as "missing/invalid" number from legacy fallbacks
  const hasValidNum1 = s1.number !== undefined && s1.number !== null && s1.number !== 0;
  const hasValidNum2 = s2.number !== undefined && s2.number !== null && s2.number !== 0;
  
  const sameNumber = hasValidNum1 && hasValidNum2 && s1.number === s2.number;
  const differentNumber = hasValidNum1 && hasValidNum2 && s1.number !== s2.number;
  
  if (!sameClass) {
    // If they are in different classes, they are DISTINCT students, even if they have the same name.
    return 'DISTINCT';
  }
  
  // They are in the same class.
  if (sameName) {
    if (differentNumber) {
      // Same name, but explicitly different numbers.
      // This is a SAME_NAME_DIFFERENT_NUMBER conflict.
      return 'AMBIGUOUS';
    }
    // Same name, and numbers either match or at least one is missing.
    // This is safe to merge.
    return 'HIGH_CONFIDENCE';
  } else {
    // Different names in the same class.
    if (sameNumber) {
      // Different names, but same explicit student number. 
      // Two students cannot have the same active number in a class.
      return 'AMBIGUOUS';
    }
  }
  
  return 'DISTINCT';
}
