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
  
  const newMappings: MigrationMapping[] = [];
  
  // Metrics
  const studentSourceRecords: Record<string, number> = {
    taskAnalysis: 0,
    matificAnalysis: 0,
    pp_: 0
  };
  
  let pairComparisons = 0;
  let exactMatches = 0;
  let highConfidenceMatches = 0;
  let distinctRecords = 0;
  
  const conflictsByType: Record<string, number> = {
    SAME_NAME_DIFFERENT_NUMBER: 0,
    SAME_NUMBER_DIFFERENT_NAME: 0
  };

  const ambiguousPairsList: any[] = [];
  const ambiguousGroupsMap = new Map<string, Set<string>>(); // canonicalId -> set of legacy identifiers
  const ambiguousRecordsSet = new Set<string>();

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

  // 2. Resolve Students
  const allStudentCandidates: StudentCandidate[] = [];
  
  const processSourceForStudents = (sourceName: string, dataMap: Record<string, unknown>) => {
    let sourceCount = 0;
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
          sourceCount++;
          const legacyObj = item as Record<string, unknown>;
          const matchedClass = proposedClassGroups.find(c => c.name === legacyId || c.legacySlug === legacyId) || proposedClassGroups[0];
          const classGroupId = matchedClass ? matchedClass.id : 'unknown';
          
          const numericIdStr = String(legacyObj.id || legacyObj.numero || Math.random());
          const identifier = `${legacyId}_${numericIdStr}`;
          
          const st = mapLegacyStudentToStudent(legacyObj as any, classGroupId);
          if (st.name) {
            allStudentCandidates.push({ student: st, legacySource: sourceName, legacyRecordIdentifier: identifier });
          }
        }
      });
    });
    studentSourceRecords[sourceName] = sourceCount;
  };

  processSourceForStudents('taskAnalysis', snapshot.firestoreData.taskAnalysis);
  processSourceForStudents('matificAnalysis', snapshot.firestoreData.matificAnalysis);
  processSourceForStudents('pp_', snapshot.firestoreData.pp_);

  const resolvedStudents = new Map<string, StudentCandidate[]>();
  
  allStudentCandidates.forEach(candidate => {
    let matchedId = '';
    const existingKey = generateMappingKey(candidate.legacySource, candidate.legacyRecordIdentifier, 'STUDENT');
    if (existingMappings[existingKey]) {
        matchedId = existingMappings[existingKey].proposedCanonicalId;
    }
    
    if (!matchedId) {
        for (const [canonicalId, existingGroup] of resolvedStudents.entries()) {
          const existing = existingGroup[0].student;
          pairComparisons++;
          
          const confidence = calculateStudentMatchConfidence(candidate.student, existing);
          
          if (confidence === 'EXACT') {
            exactMatches++;
            matchedId = canonicalId;
            break;
          } else if (confidence === 'HIGH_CONFIDENCE') {
            highConfidenceMatches++;
            matchedId = canonicalId;
            break;
          } else if (confidence === 'AMBIGUOUS') {
            const sameName = candidate.student.name.trim().toLowerCase() === existing.name.trim().toLowerCase();
            const reason = sameName ? 'SAME_NAME_DIFFERENT_NUMBER' : 'SAME_NUMBER_DIFFERENT_NAME';
            
            conflictsByType[reason] = (conflictsByType[reason] || 0) + 1;
            
            ambiguousPairsList.push({
              source1: existingGroup[0],
              source2: candidate,
              reason
            });
            
            if (!ambiguousGroupsMap.has(canonicalId)) {
              ambiguousGroupsMap.set(canonicalId, new Set([existingGroup[0].legacyRecordIdentifier]));
              ambiguousRecordsSet.add(existingGroup[0].legacyRecordIdentifier);
            }
            ambiguousGroupsMap.get(canonicalId)!.add(candidate.legacyRecordIdentifier);
            ambiguousRecordsSet.add(candidate.legacyRecordIdentifier);
          }
        }
    }
    
    if (!matchedId) {
      matchedId = resolveId(candidate.legacySource, candidate.legacyRecordIdentifier, 'STUDENT');
      distinctRecords++;
    } else {
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
    if (!resolvedStudents.has(matchedId)) {
      resolvedStudents.set(matchedId, []);
    }
    resolvedStudents.get(matchedId)!.push(candidate);
  });

  // 3. Assess evaluations and results
  let assessmentsDetected = 0;
  let resultsDetected = 0;
  const assessmentSourceRecordCounts: Record<string, number> = {};
  const resultSourceRecordCounts: Record<string, number> = {};
  
  const processEvaluations = (sourceName: string, dataMap: Record<string, unknown> | undefined) => {
    if (!dataMap) return;
    const keys = Object.keys(dataMap);
    if (keys.length === 0) return;
    
    assessmentsDetected += keys.length;
    assessmentSourceRecordCounts[sourceName] = keys.length;
    
    let rCount = 0;
    keys.forEach(k => {
      const data = dataMap[k] as any;
      if (data && data.results) {
        rCount += Object.keys(data.results).length;
      }
    });
    resultsDetected += rCount;
    resultSourceRecordCounts[sourceName] = rCount;
  };

  processEvaluations('firestore_apostilas', snapshot.firestoreData.apostilas);
  processEvaluations('firestore_assessments_grades', snapshot.firestoreData.assessments_grades);
  processEvaluations('localstorage_assessments_grades', snapshot.localStorageData.assessments_grades as Record<string, unknown>);

  // 4. Plannings
  let planningsDetected = 0;
  if (snapshot.localStorageData.eduPlans_v2) planningsDetected++;
  
  const preview: MigrationPreview = {
    classGroupsDetected: rawClassNames.size,
    studentsDetected: allStudentCandidates.length,
    assessmentsDetected,
    resultsDetected,
    planningsDetected,
    warnings,
    errors,
    recordsSkipped,
    
    studentSourceRecords,
    matching: {
      pairComparisons,
      exactMatches,
      highConfidenceMatches,
      ambiguousPairs: ambiguousPairsList.length,
      ambiguousGroups: ambiguousGroupsMap.size,
      ambiguousRecords: ambiguousRecordsSet.size,
      distinctRecords,
      reviewRequiredGroups: ambiguousGroupsMap.size
    },
    conflictsByType,
    
    assessmentSourcesPresent: Object.keys(assessmentSourceRecordCounts),
    assessmentSourceRecordCounts,
    resultSourcesPresent: Object.keys(resultSourceRecordCounts),
    resultSourceRecordCounts
  };
  
  return { preview, newMappings };
}
