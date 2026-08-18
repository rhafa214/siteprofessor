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
import { MigrationMapping } from './MigrationMappingService';

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

  const matificClassResolutionAudit = {
    records: 0,
    classReferencePresent: 0,
    classReferenceMissing: 0,
    uniqueLegacyClassReferencePatterns: 0,
    normalizationResolved: 0,
    aliasResolved: 0,
    stillUnresolved: 0
  };

  const identifierCompleteness = {
    recordsWithStrongId: 0,
    recordsWithNumber: 0,
    recordsWithUsableName: 0,
    recordsWithMissingName: 0,
    recordsWithPlaceholderName: 0,
    recordsWithOnlySourceIdentity: 0,
    recordsWithClassResolved: 0,
    recordsWithClassUnresolved: 0
  };

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
      
      const studentsInThisGroup = studentList.length;
      if (studentsInThisGroup === 0) return;

      if (sourceName === 'matificAnalysis') {
        matificClassResolutionAudit.uniqueLegacyClassReferencePatterns++;
        if (!legacyClassId) {
          matificClassResolutionAudit.classReferenceMissing += studentsInThisGroup;
        } else {
          matificClassResolutionAudit.classReferencePresent += studentsInThisGroup;
        }
      }
      
      studentList.forEach((item, index) => {
        if (item && typeof item === 'object') {
          sourceCount++;
          if (sourceName === 'matificAnalysis') matificClassResolutionAudit.records++;
          
          const legacyObj = item as Record<string, unknown>;
          
          let classGroupId = 'UNRESOLVED';
          let classResolved = false;
          if (!legacyClassId) {
             unresolvedClassAssignments++;
             unresolvedClassReasons.EMPTY_CLASS_REFERENCE++;
             unresolvedClassesBySource[sourceName] = (unresolvedClassesBySource[sourceName] || 0) + 1;
             if (sourceName === 'matificAnalysis') matificClassResolutionAudit.stillUnresolved++;
          } else {
            const matchedClass = proposedClassGroups.find(c => c.name === legacyClassId || c.legacySlug === legacyClassId);
            if (matchedClass) {
              classGroupId = matchedClass.id;
              classResolved = true;
              if (sourceName === 'matificAnalysis') matificClassResolutionAudit.normalizationResolved++;
            } else {
              unresolvedClassAssignments++;
              unresolvedClassReasons.CLASS_NAME_NOT_FOUND++;
              unresolvedClassesBySource[sourceName] = (unresolvedClassesBySource[sourceName] || 0) + 1;
              if (sourceName === 'matificAnalysis') matificClassResolutionAudit.stillUnresolved++;
            }
          }
          
          const { identifier, isStable } = generateLegacyRecordIdentifier(legacyClassId, legacyObj, index);
          if (!isStable) unstableLegacyIdentifiers++;
          
          const st = mapLegacyStudentToStudent(legacyObj as any, classGroupId);
          allStudentCandidates.push({ student: st, legacySource: sourceName, legacyRecordIdentifier: identifier });

          // Identifier Completeness Audit
          const hasId = legacyObj.id !== undefined && legacyObj.id !== null;
          const hasNum = legacyObj.numero !== undefined && legacyObj.numero !== null;
          const nameTrim = st.name.trim().toLowerCase();
          
          if (hasId) identifierCompleteness.recordsWithStrongId++;
          if (hasNum) identifierCompleteness.recordsWithNumber++;
          
          if (!nameTrim) identifierCompleteness.recordsWithMissingName++;
          else if (nameTrim === 'aluno sem nome') identifierCompleteness.recordsWithPlaceholderName++;
          else identifierCompleteness.recordsWithUsableName++;
          
          if (!hasId && !hasNum && (!nameTrim || nameTrim === 'aluno sem nome')) {
            identifierCompleteness.recordsWithOnlySourceIdentity++;
          }
          
          if (classResolved) identifierCompleteness.recordsWithClassResolved++;
          else identifierCompleteness.recordsWithClassUnresolved++;
        }
      });
    });
    studentSourceRecords[sourceName] = sourceCount;
  };

  processSourceForStudents('taskAnalysis', snapshot.firestoreData.taskAnalysis || {});
  processSourceForStudents('matificAnalysis', snapshot.firestoreData.matificAnalysis || {});
  processSourceForStudents('pp_', snapshot.firestoreData.pp_ || {});

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

  const ambiguousBySourcePair: Record<string, number> = {};
  const ambiguousByClassResolution = {
    bothResolvedSameClass: 0,
    bothResolvedDifferentClass: 0,
    oneUnresolved: 0,
    bothUnresolved: 0
  };

  const ambiguousGraph = new Map<number, number[]>();

  allStudentCandidates.forEach((candidate, i) => {
    let matchedId = '';
    
    for (const [tempCanonicalId, existingGroup] of freshResolvedStudents.entries()) {
      const existing = existingGroup[0].student;
      const existingSource = existingGroup[0].legacySource;
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
        
        const srcPair = [candidate.legacySource, existingSource].sort().join('-');
        ambiguousBySourcePair[srcPair] = (ambiguousBySourcePair[srcPair] || 0) + 1;

        const candUnres = candidate.student.classGroupId === 'UNRESOLVED';
        const existUnres = existing.classGroupId === 'UNRESOLVED';
        if (candUnres && existUnres) ambiguousByClassResolution.bothUnresolved++;
        else if (candUnres || existUnres) ambiguousByClassResolution.oneUnresolved++;
        else if (candidate.student.classGroupId === existing.classGroupId) ambiguousByClassResolution.bothResolvedSameClass++;
        else ambiguousByClassResolution.bothResolvedDifferentClass++;

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

  const visited = new Set<number>();
  let ambiguousConnectedComponents = 0;
  let largestAmbiguousGroupSize = 0;
  const ambiguousRecordsSet = new Set<string>();
  
  let recordsInLargestGroup: number[] = [];

  ambiguousGraph.forEach((neighbors, node) => {
    if (!visited.has(node)) {
      ambiguousConnectedComponents++;
      const currentGroupIndices: number[] = [];
      const queue = [node];
      visited.add(node);
      
      while (queue.length > 0) {
        const curr = queue.shift()!;
        currentGroupIndices.push(curr);
        ambiguousRecordsSet.add(allStudentCandidates[curr].legacyRecordIdentifier);
        
        const nbs = ambiguousGraph.get(curr) || [];
        for (const nb of nbs) {
          if (!visited.has(nb)) {
            visited.add(nb);
            queue.push(nb);
          }
        }
      }
      
      if (currentGroupIndices.length > largestAmbiguousGroupSize) {
        largestAmbiguousGroupSize = currentGroupIndices.length;
        recordsInLargestGroup = currentGroupIndices;
      }
    }
  });

  const ambiguityClassCorrelation = {
    largestGroupRecords: largestAmbiguousGroupSize,
    largestGroupAlsoUnresolvedClass: 0,
    unresolvedRecordsInsideAnyAmbiguousGroup: 0,
    resolvedRecordsInsideLargestAmbiguousGroup: 0
  };

  recordsInLargestGroup.forEach(idx => {
    const cand = allStudentCandidates[idx];
    if (cand.student.classGroupId === 'UNRESOLVED') {
      ambiguityClassCorrelation.largestGroupAlsoUnresolvedClass++;
    } else {
      ambiguityClassCorrelation.resolvedRecordsInsideLargestAmbiguousGroup++;
    }
  });

  ambiguousRecordsSet.forEach(identifier => {
    const cand = allStudentCandidates.find(c => c.legacyRecordIdentifier === identifier);
    if (cand && cand.student.classGroupId === 'UNRESOLVED') {
      ambiguityClassCorrelation.unresolvedRecordsInsideAnyAmbiguousGroup++;
    }
  });


  // ---------------------------------------------------------
  // 4. Mapping Consistency Check & Reconciliation
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

  const mappingReconciliation = {
    SAFE_TO_KEEP: 0,
    NEEDS_REBUILD: 0,
    NEEDS_MANUAL_REVIEW: 0,
    preparedTopology: {
      canonicalGroupsRepresented: existingGroupsByCanonicalId.size,
      singletonPreparedGroups: 0,
      multiRecordPreparedGroups: 0,
      largestPreparedGroupSize: 0,
      recordsInsideMultiRecordPreparedGroups: 0
    },
    mappingMismatchReasons: {
      LEGACY_ALGORITHM_MERGE: 0,
      SAME_PREPARED_CANONICAL_ID: 0,
      FRESH_RULE_CHANGED: 0,
      SOURCE_COLLISION: 0,
      OTHER: 0
    },
    freshTopology: {
      proposedUniqueStudents: freshResolvedStudents.size,
      freshMergedGroups: 0,
      freshSingletonGroups: 0
    }
  };

  existingGroupsByCanonicalId.forEach(group => {
    if (group.size === 1) mappingReconciliation.preparedTopology.singletonPreparedGroups++;
    else {
      mappingReconciliation.preparedTopology.multiRecordPreparedGroups++;
      mappingReconciliation.preparedTopology.recordsInsideMultiRecordPreparedGroups += group.size;
    }
    if (group.size > mappingReconciliation.preparedTopology.largestPreparedGroupSize) {
      mappingReconciliation.preparedTopology.largestPreparedGroupSize = group.size;
    }
  });

  freshResolvedStudents.forEach((candidates, tempCanonicalId) => {
    if (candidates.length === 1) mappingReconciliation.freshTopology.freshSingletonGroups++;
    else mappingReconciliation.freshTopology.freshMergedGroups++;

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
      }
    });

    if (missingInGroup > 0) {
      preparedMappingMissing += missingInGroup;
    }

    if (mappedCanonicalIds.size > 1) {
      preparedDistinctButFreshMerge += freshGroupIds.size;
      mismatchGroups++;
      mismatchRecords += freshGroupIds.size;
      mappingReconciliation.NEEDS_REBUILD += freshGroupIds.size;
      mappingReconciliation.mappingMismatchReasons.FRESH_RULE_CHANGED += freshGroupIds.size;
    } else if (mappedCanonicalIds.size === 1) {
      const canonicalId = Array.from(mappedCanonicalIds)[0];
      const existingGroupIds = existingGroupsByCanonicalId.get(canonicalId)!;
      
      if (existingGroupIds.size > freshGroupIds.size) {
        preparedMergeButFreshDistinct += (existingGroupIds.size - freshGroupIds.size);
        mismatchGroups++;
        mismatchRecords += freshGroupIds.size;
        mappingReconciliation.NEEDS_REBUILD += freshGroupIds.size;
        mappingReconciliation.mappingMismatchReasons.LEGACY_ALGORITHM_MERGE += freshGroupIds.size;
      } else {
        consistentRecords += freshGroupIds.size;
        mappingReconciliation.SAFE_TO_KEEP += freshGroupIds.size;
      }
    } else if (missingInGroup > 0) {
      mappingReconciliation.NEEDS_REBUILD += freshGroupIds.size;
    }
  });

  // ---------------------------------------------------------
  // 5. Assessment and Results Audit
  // ---------------------------------------------------------
  const assessmentAudit = {
    sourcesInspected: ['firestore_apostilas', 'firestore_assessments_grades', 'localstorage_assessments_grades'],
    containersDetected: {} as Record<string, number>,
    entitiesDetected: {} as Record<string, number>,
    unrecognizedRecords: {} as Record<string, number>,
    structuralShapes: {} as Record<string, any>
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
    },
    structuralShapes: {} as Record<string, any>
  };

  let totalAssessments = 0;
  let totalResults = 0;

  const processEvaluations = (sourceName: string, dataMap: Record<string, unknown> | undefined) => {
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
    
    let capturedShape = false;

    keys.forEach(k => {
      const data = dataMap[k] as any;
      if (data && typeof data === 'object') {
        validEntities++;
        
        if (!capturedShape) {
           const shape: any = {};
           Object.keys(data).forEach(field => {
               shape[field] = Array.isArray(data[field]) ? 'array' : typeof data[field];
           });
           assessmentAudit.structuralShapes[sourceName] = shape;
           capturedShape = true;
        }

        let resultKey = data.results ? 'results' : (data.notas ? 'notas' : null);
        
        // Specific adapter for localstorage_assessments_grades
        if (!resultKey && sourceName === 'localstorage_assessments_grades') {
          // It might just be a flat object of student_id -> grade, or it might have a specific shape
          // If it doesn't have metadata fields like "title" or "id", it might be purely a result map
          if (Object.keys(data).length > 0 && !data.title && !data.name) {
             resultKey = '_ROOT_AS_RESULTS_'; // Conceptual adapter
          }
        }

        if (resultKey) {
          resultAudit.schemaStatus.RESULT_SCHEMA_RECOGNIZED++;
          const resultObj = resultKey === '_ROOT_AS_RESULTS_' ? data : data[resultKey];
          const resultKeys = Object.keys(resultObj);
          if (resultKeys.length > 0) {
            sourceResultEntities += resultKeys.length;
          } else {
            resultAudit.schemaStatus.RESULT_CONTAINER_EMPTY++;
            resultEmpty++;
          }
          
          if (!resultAudit.structuralShapes[sourceName]) {
             resultAudit.structuralShapes[sourceName] = { 
               adapterUsed: resultKey,
               sampleKeysCount: resultKeys.length,
               sampleValueType: resultKeys.length > 0 ? typeof resultObj[resultKeys[0]] : 'unknown'
             };
          }

        } else {
           if (sourceName === 'firestore_apostilas') {
              resultAudit.schemaStatus.RESULT_NOT_EXPECTED++;
              resultNotExpected++;
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
    
    mappingReconciliation,
    matificClassResolutionAudit,
    ambiguityClassCorrelation,
    identifierCompleteness,
    ambiguousBySourcePair,
    ambiguousByClassResolution,
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
