import { LegacyAcademicSnapshot } from './LegacyDataCollector';
import { 
  resolveClassCandidates, 
  calculateStudentMatchConfidence, 
  mapLegacyClassToClassGroup, 
  mapLegacyStudentToStudent, 
  generateOpaqueId,
  generateLegacyRecordIdentifier
} from '../mappers/legacyMappers';
import { MigrationPreview, Student, ClassGroup } from '../../domain';
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
  
  const newMappings: MigrationMapping[] = [];
  
  // ---------------------------------------------------------
  // 1. Resolve ClassGroups
  // ---------------------------------------------------------
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
    cg.id = `temp_class_${c.slug}`;
    return cg;
  });

  const unresolvedClassesBySource: Record<string, number> = { taskAnalysis: 0, matificAnalysis: 0, pp_: 0, other: 0 };
  const unresolvedClassReasons = {
    CLASS_NAME_NOT_FOUND: 0,
    CLASS_ID_NOT_FOUND: 0,
    GRADE_MISMATCH: 0,
    ACADEMIC_YEAR_MISMATCH: 0,
    EMPTY_CLASS_REFERENCE: 0,
    NORMALIZATION_MISMATCH: 0,
    OTHER: 0
  };
  let unresolvedClassAssignments = 0;

  // ---------------------------------------------------------
  // 2. Collect Students
  // ---------------------------------------------------------
  const allStudentCandidates: StudentCandidate[] = [];
  const studentSourceRecords: Record<string, number> = { taskAnalysis: 0, matificAnalysis: 0, pp_: 0 };
  let unstableLegacyIdentifiers = 0;
  
  const processSourceForStudents = (sourceName: string, dataMap: Record<string, unknown>) => {
    let sourceCount = 0;
    Object.entries(dataMap).forEach(([legacyClassId, data]) => {
      let studentList: unknown[] = [];
      if (Array.isArray(data)) studentList = data;
      else if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        if (Array.isArray(obj.alunos)) studentList = obj.alunos;
        else if (Array.isArray(obj.students)) studentList = obj.students;
        else if (Array.isArray(obj.items)) studentList = obj.items;
      }
      
      studentList.forEach((item, index) => {
        if (item && typeof item === 'object') {
          sourceCount++;
          const legacyObj = item as Record<string, unknown>;
          
          let classGroupId = 'UNRESOLVED';
          if (!legacyClassId) {
             unresolvedClassAssignments++;
             unresolvedClassReasons.EMPTY_CLASS_REFERENCE++;
             unresolvedClassesBySource[sourceName] = (unresolvedClassesBySource[sourceName] || 0) + 1;
          } else {
            const matchedClass = proposedClassGroups.find(c => c.name === legacyClassId || c.legacySlug === legacyClassId);
            if (matchedClass) {
              classGroupId = matchedClass.id;
            } else {
              unresolvedClassAssignments++;
              unresolvedClassReasons.CLASS_NAME_NOT_FOUND++;
              unresolvedClassesBySource[sourceName] = (unresolvedClassesBySource[sourceName] || 0) + 1;
            }
          }
          
          const { identifier, isStable } = generateLegacyRecordIdentifier(legacyClassId, legacyObj, index);
          if (!isStable) unstableLegacyIdentifiers++;
          
          const st = mapLegacyStudentToStudent(legacyObj as any, classGroupId);
          allStudentCandidates.push({ student: st, legacySource: sourceName, legacyRecordIdentifier: identifier });
        }
      });
    });
    studentSourceRecords[sourceName] = sourceCount;
  };

  processSourceForStudents('taskAnalysis', snapshot.firestoreData.taskAnalysis);
  processSourceForStudents('matificAnalysis', snapshot.firestoreData.matificAnalysis);
  processSourceForStudents('pp_', snapshot.firestoreData.pp_);

  // ---------------------------------------------------------
  // 3. Fresh Matching Pass
  // ---------------------------------------------------------
  const freshResolvedStudents = new Map<string, StudentCandidate[]>();
  const recordsAnalyzed = allStudentCandidates.length;
  
  let pairComparisons = 0;
  let exactMatches = 0;
  let highConfidenceMatches = 0;
  let ambiguousPairs = 0;
  let distinctPairs = 0;
  
  const ambiguousReasons = {
    SAME_NAME_DIFFERENT_NUMBER: 0,
    SAME_NUMBER_DIFFERENT_NAME: 0,
    SAME_NORMALIZED_NAME_MISSING_NUMBER: 0,
    INSUFFICIENT_IDENTIFIERS: 0,
    OTHER: 0
  };

  // Connected components for ambiguous relationships
  // We map index of candidate to a list of ambiguous candidate indices
  const ambiguousGraph = new Map<number, number[]>();

  allStudentCandidates.forEach((candidate, i) => {
    let matchedId = '';
    
    // Instead of comparing against all candidates, we compare against ONE representative of each established group.
    // However, to correctly map all pairs for ambiguous clusters, let's track the groups it was compared to.
    
    for (const [tempCanonicalId, existingGroup] of freshResolvedStudents.entries()) {
      const existing = existingGroup[0].student;
      pairComparisons++;
      
      const { confidence, reason } = calculateStudentMatchConfidence(candidate.student, existing);
      
      if (confidence === 'EXACT') {
        exactMatches++;
        matchedId = tempCanonicalId;
        break;
      } else if (confidence === 'HIGH_CONFIDENCE') {
        highConfidenceMatches++;
        matchedId = tempCanonicalId;
        break;
      } else if (confidence === 'AMBIGUOUS') {
        ambiguousPairs++;
        if (reason in ambiguousReasons) {
           ambiguousReasons[reason as keyof typeof ambiguousReasons]++;
        } else {
           ambiguousReasons.OTHER++;
        }
        
        // Add to graph
        // To build connected components correctly, we link all items in the existing group to candidate
        // But for simplicity in counting connected components, we can just link the representative's index to candidate's index.
        const repIndex = allStudentCandidates.findIndex(c => c.legacyRecordIdentifier === existingGroup[0].legacyRecordIdentifier);
        if (!ambiguousGraph.has(i)) ambiguousGraph.set(i, []);
        if (!ambiguousGraph.has(repIndex)) ambiguousGraph.set(repIndex, []);
        ambiguousGraph.get(i)!.push(repIndex);
        ambiguousGraph.get(repIndex)!.push(i);
        
      } else if (confidence === 'DISTINCT') {
        distinctPairs++;
      }
    }
    
    if (!matchedId) {
      matchedId = `temp_student_${generateOpaqueId()}`;
    }
    
    candidate.student.id = matchedId;
    if (!freshResolvedStudents.has(matchedId)) {
      freshResolvedStudents.set(matchedId, []);
    }
    freshResolvedStudents.get(matchedId)!.push(candidate);
  });

  // Calculate connected components for ambiguous groups
  const visited = new Set<number>();
  let ambiguousConnectedComponents = 0;
  let largestAmbiguousGroupSize = 0;
  const ambiguousRecordsSet = new Set<string>();

  ambiguousGraph.forEach((neighbors, node) => {
    if (!visited.has(node)) {
      ambiguousConnectedComponents++;
      let currentSize = 0;
      const queue = [node];
      visited.add(node);
      
      while (queue.length > 0) {
        const curr = queue.shift()!;
        currentSize++;
        ambiguousRecordsSet.add(allStudentCandidates[curr].legacyRecordIdentifier);
        
        const nbs = ambiguousGraph.get(curr) || [];
        for (const nb of nbs) {
          if (!visited.has(nb)) {
            visited.add(nb);
            queue.push(nb);
          }
        }
      }
      
      if (currentSize > largestAmbiguousGroupSize) {
        largestAmbiguousGroupSize = currentSize;
      }
    }
  });

  // ---------------------------------------------------------
  // 4. Mapping Consistency Check
  // ---------------------------------------------------------
  const mappingLookup = {
    exactKeyMatches: 0,
    sourceMismatch: 0,
    identifierMismatch: 0,
    entityTypeMismatch: 0,
    legacyKeyFormatMismatch: 0,
    mappingNotFound: 0,
    otherMismatch: 0
  };

  const preparedMappingsLoaded = Object.keys(existingMappings).length;
  let preparedStudentMappings = 0;
  let consistentRecords = 0;
  let mismatchRecords = 0;
  let mismatchGroups = 0;
  let preparedMergeButFreshDistinct = 0;
  let preparedDistinctButFreshMerge = 0;
  let preparedMappingMissing = 0;
  let stalePreparedMappings = 0;

  const studentExistingMappings = new Map<string, string>();
  Object.values(existingMappings).forEach(m => {
    if (m.canonicalEntityType === 'STUDENT') {
      preparedStudentMappings++;
      studentExistingMappings.set(`${m.legacySource}_${m.legacyRecordIdentifier}`, m.proposedCanonicalId);
    }
  });

  const existingGroupsByCanonicalId = new Map<string, Set<string>>();
  studentExistingMappings.forEach((canonicalId, legacyKey) => {
    if (!existingGroupsByCanonicalId.has(canonicalId)) {
      existingGroupsByCanonicalId.set(canonicalId, new Set());
    }
    existingGroupsByCanonicalId.get(canonicalId)!.add(legacyKey);
  });

  freshResolvedStudents.forEach((candidates, tempCanonicalId) => {
    const freshGroupIds = new Set(candidates.map(c => `${c.legacySource}_${c.legacyRecordIdentifier}`));
    let mappedCanonicalIds = new Set<string>();
    let missingInGroup = 0;
    
    candidates.forEach(c => {
      const legacyKey = `${c.legacySource}_${c.legacyRecordIdentifier}`;
      const existingCanonicalId = studentExistingMappings.get(legacyKey);
      
      if (existingCanonicalId) {
        mappedCanonicalIds.add(existingCanonicalId);
        mappingLookup.exactKeyMatches++;
      } else {
        missingInGroup++;
        mappingLookup.mappingNotFound++;
        // Maybe format mismatch? Check if any mapping has parts of it
        const hasFormatMismatch = Object.values(existingMappings).some(m => m.legacyRecordIdentifier.includes(c.legacyRecordIdentifier) || c.legacyRecordIdentifier.includes(m.legacyRecordIdentifier));
        if (hasFormatMismatch) mappingLookup.legacyKeyFormatMismatch++;
      }
    });

    if (missingInGroup > 0) {
      preparedMappingMissing += missingInGroup;
    }

    if (mappedCanonicalIds.size > 1) {
      preparedDistinctButFreshMerge += freshGroupIds.size;
      mismatchGroups++;
      mismatchRecords += freshGroupIds.size;
    } else if (mappedCanonicalIds.size === 1) {
      const canonicalId = Array.from(mappedCanonicalIds)[0];
      const existingGroupIds = existingGroupsByCanonicalId.get(canonicalId)!;
      
      if (existingGroupIds.size > freshGroupIds.size) {
        preparedMergeButFreshDistinct += existingGroupIds.size - freshGroupIds.size;
        mismatchGroups++;
        mismatchRecords += freshGroupIds.size;
      } else {
        consistentRecords += freshGroupIds.size;
      }
    }
  });

  // ---------------------------------------------------------
  // 5. Assessment and Results Audit
  // ---------------------------------------------------------
  const assessmentAudit = {
    sourcesInspected: ['firestore_apostilas', 'firestore_assessments_grades', 'localstorage_assessments_grades'],
    containersDetected: {} as Record<string, number>,
    entitiesDetected: {} as Record<string, number>,
    unrecognizedRecords: {} as Record<string, number>
  };
  
  const resultAudit = {
    sourcesInspected: ['firestore_apostilas', 'firestore_assessments_grades', 'localstorage_assessments_grades'],
    sourcesWithRecords: [] as string[],
    containersDetected: {} as Record<string, number>,
    entitiesDetected: {} as Record<string, number>,
    unrecognizedRecords: {} as Record<string, number>,
    schemaStatus: {
      RESULT_NOT_EXPECTED: 0,
      RESULT_CONTAINER_EMPTY: 0,
      RESULT_SCHEMA_RECOGNIZED: 0,
      RESULT_SCHEMA_UNRECOGNIZED: 0
    }
  };

  let totalAssessments = 0;
  let totalResults = 0;

  const processEvaluations = (sourceName: string, dataMap: Record<string, unknown> | undefined, expectedShape: 'results' | 'notas' = 'results') => {
    if (!dataMap) return;
    const keys = Object.keys(dataMap);
    if (keys.length === 0) return;
    
    assessmentAudit.containersDetected[sourceName] = keys.length;
    let validEntities = 0;
    let unrecognizedAssessments = 0;
    
    let sourceResultEntities = 0;
    let sourceResultUnrecognized = 0;
    let resultNotExpected = 0;
    let resultEmpty = 0;
    
    keys.forEach(k => {
      const data = dataMap[k] as any;
      if (data && typeof data === 'object') {
        validEntities++;
        
        // specific source adapter logic: some sources might legitimately not have results, 
        // or have them named differently. For the sake of the audit, we check both 'results' and 'notas'.
        const resultKey = data.results ? 'results' : (data.notas ? 'notas' : null);
        
        if (resultKey) {
          resultAudit.schemaStatus.RESULT_SCHEMA_RECOGNIZED++;
          const resultKeys = Object.keys(data[resultKey]);
          if (resultKeys.length > 0) {
            sourceResultEntities += resultKeys.length;
          } else {
            resultAudit.schemaStatus.RESULT_CONTAINER_EMPTY++;
            resultEmpty++;
          }
        } else {
           // We'll mark as unrecognized for now, but in reality some assessments might just not have results yet.
           if (sourceName === 'firestore_apostilas') {
              resultAudit.schemaStatus.RESULT_NOT_EXPECTED++;
           } else {
              resultAudit.schemaStatus.RESULT_SCHEMA_UNRECOGNIZED++;
              sourceResultUnrecognized++;
           }
        }
      } else {
        unrecognizedAssessments++;
      }
    });
    
    if (validEntities > 0) assessmentAudit.entitiesDetected[sourceName] = validEntities;
    if (unrecognizedAssessments > 0) assessmentAudit.unrecognizedRecords[sourceName] = unrecognizedAssessments;
    
    totalAssessments += validEntities;
    
    if (sourceResultEntities > 0) {
      resultAudit.sourcesWithRecords.push(sourceName);
      resultAudit.entitiesDetected[sourceName] = sourceResultEntities;
      totalResults += sourceResultEntities;
    }
    
    if (sourceResultUnrecognized > 0) {
      resultAudit.unrecognizedRecords[sourceName] = sourceResultUnrecognized;
    }
  };

  processEvaluations('firestore_apostilas', snapshot.firestoreData.apostilas);
  processEvaluations('firestore_assessments_grades', snapshot.firestoreData.assessments_grades);
  processEvaluations('localstorage_assessments_grades', snapshot.localStorageData.assessments_grades as Record<string, unknown>);

  // ---------------------------------------------------------
  // 6. Plannings
  // ---------------------------------------------------------
  let planningsDetected = 0;
  if (snapshot.localStorageData.eduPlans_v2) planningsDetected++;
  
  // ---------------------------------------------------------
  // Gate Evaluation
  // ---------------------------------------------------------
  const blockingReasons: string[] = [];
  
  const MAPPING_CONSISTENCY_OK = mismatchRecords === 0 && mismatchGroups === 0 && preparedMergeButFreshDistinct === 0 && preparedDistinctButFreshMerge === 0;
  if (!MAPPING_CONSISTENCY_OK) blockingReasons.push('MAPPING_INCONSISTENT');
  
  const IDENTIFIERS_STABLE = unstableLegacyIdentifiers === 0;
  if (!IDENTIFIERS_STABLE) blockingReasons.push('UNSTABLE_IDENTIFIERS');
  
  const CLASS_ASSIGNMENTS_RESOLVED = unresolvedClassAssignments === 0;
  if (!CLASS_ASSIGNMENTS_RESOLVED) blockingReasons.push('UNRESOLVED_CLASSES');
  
  const ASSESSMENT_SCHEMA_VALIDATED = Object.values(assessmentAudit.unrecognizedRecords).length === 0;
  if (!ASSESSMENT_SCHEMA_VALIDATED) blockingReasons.push('ASSESSMENT_SCHEMA_INVALID');
  
  const RESULT_SCHEMA_VALIDATED = Object.values(resultAudit.unrecognizedRecords).length === 0;
  if (!RESULT_SCHEMA_VALIDATED) blockingReasons.push('RESULT_SCHEMA_INVALID');
  
  if (ambiguousConnectedComponents > 0) {
    blockingReasons.push('AMBIGUOUS_REVIEW_REQUIRED');
  }
  
  const MIGRATION_READY = 
    MAPPING_CONSISTENCY_OK && 
    IDENTIFIERS_STABLE && 
    CLASS_ASSIGNMENTS_RESOLVED && 
    ASSESSMENT_SCHEMA_VALIDATED && 
    RESULT_SCHEMA_VALIDATED && 
    errors.length === 0 &&
    ambiguousConnectedComponents === 0;

  const preview: MigrationPreview = {
    classGroupsDetected: rawClassNames.size,
    studentsDetected: allStudentCandidates.length,
    assessmentsDetected: totalAssessments,
    resultsDetected: totalResults,
    planningsDetected,
    warnings,
    errors,
    recordsSkipped: 0,
    studentSourceRecords,
    
    freshMatching: {
      recordsAnalyzed,
      pairComparisons,
      exactMatches,
      highConfidenceMatches,
      ambiguousPairs,
      distinctPairs,
      ambiguousGroups: ambiguousConnectedComponents,
      ambiguousConnectedComponents,
      largestAmbiguousGroupSize,
      ambiguousRecords: ambiguousRecordsSet.size,
      distinctRecords: freshResolvedStudents.size,
      reviewRequiredGroups: ambiguousConnectedComponents,
      proposedUniqueStudents: freshResolvedStudents.size
    },
    
    mappingConsistency: {
      preparedMappingsLoaded,
      preparedStudentMappings,
      consistentRecords,
      mismatchRecords,
      mismatchGroups,
      preparedMergeButFreshDistinct,
      preparedDistinctButFreshMerge,
      preparedMappingMissing,
      stalePreparedMappings,
      mappingLookup
    },
    
    ambiguousReasons,
    
    identifierSafety: {
      unstableLegacyIdentifiers
    },
    
    classResolution: {
      unresolvedClassAssignments,
      unresolvedClassesBySource,
      unresolvedClassReasons
    },
    
    assessmentAudit,
    resultAudit,
    
    MIGRATION_READY,
    blockingReasons
  };
  
  return { preview, newMappings };
}
