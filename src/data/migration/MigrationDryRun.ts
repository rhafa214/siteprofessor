import { LegacyAcademicSnapshot } from './LegacyDataCollector';
import { resolveClassCandidates, calculateStudentMatchConfidence, mapLegacyClassToClassGroup, mapLegacyStudentToStudent, generateOpaqueId } from '../mappers/legacyMappers';
import { MigrationPreview, Student, ClassGroup, Assessment, AssessmentResult, Planning, Lesson } from '../../domain';
import { MigrationMapping, generateMappingKey } from './MigrationMappingService';

interface StudentCandidate {
  student: Student;
  legacySource: string;
  legacyRecordIdentifier: string;
}

export interface DryRunResult {
  preview: MigrationPreview;
  newMappings: MigrationMapping[];
}

export function generateMigrationPreview(
  snapshot: LegacyAcademicSnapshot, 
  existingMappings: Record<string, MigrationMapping>,
  runId: string
): DryRunResult {
  const warnings: string[] = [...snapshot.warnings];
  const errors: string[] = [...snapshot.errors];
  const recordsSkipped = 0;
  const ambiguousMatches: unknown[] = [];
  const newMappings: MigrationMapping[] = [];
  
  // Helper to resolve ID
  const resolveId = (source: string, identifier: string, type: 'CLASS_GROUP' | 'STUDENT' | 'ASSESSMENT' | 'ASSESSMENT_RESULT' | 'PLANNING' | 'LESSON') => {
    const key = generateMappingKey(source, identifier, type);
    if (existingMappings[key]) {
      return existingMappings[key].proposedCanonicalId;
    }
    const newId = generateOpaqueId();
    const mapping: MigrationMapping = {
      legacySource: source,
      legacyRecordIdentifier: identifier,
      canonicalEntityType: type,
      proposedCanonicalId: newId,
      createdAt: Date.now(),
      migrationRunId: runId,
      status: 'PREPARED'
    };
    newMappings.push(mapping);
    existingMappings[key] = mapping;
    return newId;
  };

  // 1. Resolve ClassGroups
  const rawClassNames = new Set<string>();
  
  if (Array.isArray(snapshot.localStorageData.classTurmasList)) {
    snapshot.localStorageData.classTurmasList.forEach((c: unknown) => {
      if (typeof c === 'string') rawClassNames.add(c);
    });
  }
  
  Object.keys(snapshot.firestoreData.taskAnalysis || {}).forEach(k => rawClassNames.add(k));
  
  const classCandidates = resolveClassCandidates(Array.from(rawClassNames));
  const proposedClassGroups: ClassGroup[] = classCandidates.map(c => {
    const cg = mapLegacyClassToClassGroup(c.name);
    cg.id = resolveId('classTurmasList', c.slug, 'CLASS_GROUP');
    return cg;
  });
  
  // 2. Resolve Students (UNION from taskAnalysis, matificAnalysis, pp_)
  const allStudentCandidates: StudentCandidate[] = [];
  
  const processSourceForStudents = (sourceName: string, dataMap: Record<string, unknown>) => {
    Object.entries(dataMap).forEach(([legacyId, data]) => {
      let studentList: unknown[] = [];
      if (Array.isArray(data)) studentList = data;
      else if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        if (Array.isArray(obj.alunos)) studentList = obj.alunos;
        else if (Array.isArray(obj.students)) studentList = obj.students;
        else if (Array.isArray(obj.items)) studentList = obj.items;
      }
      
      studentList.forEach(item => {
        if (item && typeof item === 'object') {
          const legacyObj = item as Record<string, unknown>;
          const matchedClass = proposedClassGroups.find(c => c.name === legacyId || c.legacySlug === legacyId) || proposedClassGroups[0];
          const classGroupId = matchedClass ? matchedClass.id : 'unknown';
          
          const numericIdStr = String(legacyObj.id || legacyObj.numero || Math.random());
          const identifier = `${legacyId}_${numericIdStr}`;
          
          const st = mapLegacyStudentToStudent(legacyObj as any, classGroupId); // Cast fine here for mapper
          if (st.name) {
            allStudentCandidates.push({ student: st, legacySource: sourceName, legacyRecordIdentifier: identifier });
          }
        }
      });
    });
  };

  processSourceForStudents('taskAnalysis', snapshot.firestoreData.taskAnalysis);
  processSourceForStudents('matificAnalysis', snapshot.firestoreData.matificAnalysis);
  processSourceForStudents('pp_', snapshot.firestoreData.pp_);

  // Match Students
  let exact = 0;
  let highConf = 0;
  let distinct = 0;
  
  const resolvedStudents = new Map<string, Student>(); 
  
  allStudentCandidates.forEach(candidate => {
    let matchedId = '';
    
    // First, check if there's already a mapping
    const existingKey = generateMappingKey(candidate.legacySource, candidate.legacyRecordIdentifier, 'STUDENT');
    if (existingMappings[existingKey]) {
        matchedId = existingMappings[existingKey].proposedCanonicalId;
    }
    
    if (!matchedId) {
        for (const [id, existing] of resolvedStudents.entries()) {
          const confidence = calculateStudentMatchConfidence(candidate.student, existing);
          if (confidence === 'EXACT') {
            exact++;
            matchedId = existing.id;
            break;
          } else if (confidence === 'HIGH_CONFIDENCE') {
            highConf++;
            matchedId = existing.id;
            break;
          } else if (confidence === 'AMBIGUOUS') {
            ambiguousMatches.push({
              source1: existing,
              source2: candidate.student,
              reason: 'SAME_NAME_DIFFERENT_NUMBER'
            });
          }
        }
    }
    
    if (!matchedId) {
      matchedId = resolveId(candidate.legacySource, candidate.legacyRecordIdentifier, 'STUDENT');
      distinct++;
    } else {
       // Save mapping to same ID
       const newKey = generateMappingKey(candidate.legacySource, candidate.legacyRecordIdentifier, 'STUDENT');
       if (!existingMappings[newKey]) {
          const mapping: MigrationMapping = {
            legacySource: candidate.legacySource,
            legacyRecordIdentifier: candidate.legacyRecordIdentifier,
            canonicalEntityType: 'STUDENT',
            proposedCanonicalId: matchedId,
            createdAt: Date.now(),
            migrationRunId: runId,
            status: 'PREPARED'
          };
          newMappings.push(mapping);
          existingMappings[newKey] = mapping;
       }
    }
    candidate.student.id = matchedId;
    resolvedStudents.set(matchedId, candidate.student);
  });

  // 3. Resolve Assessments & Results
  let assessmentsDetected = 0;
  let resultsDetected = 0;

  // 4. Plannings
  let planningsDetected = 0;
  if (snapshot.localStorageData.eduPlans_v2) planningsDetected++;
  
  const preview = {
    classGroupsDetected: rawClassNames.size,
    studentsDetected: allStudentCandidates.length,
    assessmentsDetected,
    resultsDetected,
    planningsDetected,
    ambiguousMatches,
    warnings,
    errors,
    recordsSkipped
  };
  
  return { preview, newMappings };
}
