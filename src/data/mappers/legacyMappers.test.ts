import { mapLegacyClassToClassGroup, mapLegacyStudentToStudent, LegacyStudentData, resolveClassCandidates, calculateStudentMatchConfidence } from './legacyMappers';

export function runMapperTests() {
  console.log("Running Pure Mapper Tests...");

  // Test Class Mapper
  const legacyClass = " 6º A ";
  const classGroup = mapLegacyClassToClassGroup(legacyClass);
  if (!classGroup.id) throw new Error("Class ID mapping failed (should be opaque)");
  if (classGroup.name !== "6º A") throw new Error("Class name mapping failed");
  if (classGroup.legacySlug !== "6º-a") throw new Error("Class slug mapping failed");
  console.log("Class mapper passed.");

  // Test Student Mapper
  const legacyStudent: LegacyStudentData = {
    id: 10,
    numero: 5,
    nome: "João Silva",
    observacao: "Transferido"
  };
  const student = mapLegacyStudentToStudent(legacyStudent, classGroup.id);
  
  if (!student.id) throw new Error("Student ID mapping failed (should be opaque)");
  if (student.name !== "João Silva") throw new Error("Student name mapping failed");
  if (student.number !== 5) throw new Error("Student number mapping failed");
  
  const metadata = student.metadata as any;
  if (metadata?.observacao !== "Transferido") throw new Error("Student metadata mapping failed");
  
  console.log("Student mapper passed.");

  // Test Class Candidates
  const candidates = resolveClassCandidates(["6A", "6 A", " 6 a "]);
  if (candidates.length !== 2) throw new Error("Class resolution failed (expected 2 unique slugs: 6a, 6-a)");
  console.log("Class candidate resolution passed.");
  
  // Test Match Confidence
  const s1 = { ...student, id: 'id1', name: "Maria", number: 10 };
  const s2 = { ...student, id: 'id2', name: "Maria", number: 10 };
  const s3 = { ...student, id: 'id3', name: "Maria", number: 11 };
  
  if (calculateStudentMatchConfidence(s1, s2).confidence !== 'HIGH_CONFIDENCE') throw new Error("Confidence test 1 failed");
  if (calculateStudentMatchConfidence(s1, s3).confidence !== 'AMBIGUOUS') throw new Error("Confidence test 2 failed");
  console.log("Student matching confidence passed.");
}
