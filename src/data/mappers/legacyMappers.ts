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
  // Simplified matching logic for dry-run
  if (s1.id === s2.id) return 'EXACT';
  
  const sameNumber = s1.number !== undefined && s1.number === s2.number;
  const sameName = s1.name.toLowerCase() === s2.name.toLowerCase();
  
  if (sameNumber && sameName) return 'HIGH_CONFIDENCE';
  if (sameName || sameNumber) return 'AMBIGUOUS';
  
  return 'DISTINCT';
}
