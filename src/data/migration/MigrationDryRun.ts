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
  
  // ---------------------------------------------------------
  // Metrics Setup
  // ---------------------------------------------------------
  const studentSourceRecords: Record<string, number> = {
    taskAnalysis: 0,
    matificAnalysis: 0,
    pp_: 0
  };
  
  let recordsAnalyzed = 0;
  let pairComparisons = 0;
  let exactMatches = 0;
  let highConfidenceMatches = 0;
  let distinctRecords = 0;
  
  const conflictsByType: Record<string, number> = {
    SAME_NAME_DIFFERENT_NUMBER: 0,
    SAME_NUMBER_DIFFERENT_NAME: 0
  };

  const ambiguousPairsList: any[] = [];
  const ambiguousGroupsMap = new Map<string, Set<string>>(); // temporaryCanonicalId -> set of legacy identifiers
  const ambiguousRecordsSet = new Set<string>();
  
  let unstableLegacyIdentifiers = 0;
  let unresolvedClassAssignments = 0;

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
    // Temporary ID for analysis
    cg.id = `temp_class_${c.slug}`;
    return cg;
  });

  // ---------------------------------------------------------
  // 2. Collect Students
  // ---------------------------------------------------------
  const allStudentCandidates: StudentCandidate[] = [];
  
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
          const matchedClass = proposedClassGroups.find(c => c.name === legacyClassId || c.legacySlug === legacyClassId);
          if (matchedClass) {
            classGroupId = matchedClass.id;
          } else {
            unresolvedClassAssignments++;
          }
          
          let identifier = '';
          if (legacyObj.id !== undefined && legacyObj.id !== null) {
            identifier = `${legacyClassId}_id_${legacyObj.id}`;
          } else if (legacyObj.numero !== undefined && legacyObj.numero !== null) {
            identifier = `${legacyClassId}_num_${legacyObj.numero}_${legacyObj.nome}`;
          } else {
            // Stable fallback hash without random
            const stableName = String(legacyObj.nome || '').trim().toLowerCase();
            identifier = `${legacyClassId}_fallback_${index}_${stableName}`;
            unstableLegacyIdentifiers++;
          }
          
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

  // ---------------------------------------------------------
  // 3. Fresh Matching Pass (Independent of PREPARED mappings)
  // ---------------------------------------------------------
  const freshResolvedStudents = new Map<string, StudentCandidate[]>();
  recordsAnalyzed = allStudentCandidates.length;
  
  allStudentCandidates.forEach(candidate => {
    let matchedId = '';
    
    // We do NOT check existingMappings here! This is a pure analysis pass.
    for (const [tempCanonicalId, existingGroup] of freshResolvedStudents.entries()) {
      const existing = existingGroup[0].student;
      pairComparisons++;
      
      const confidence = calculateStudentMatchConfidence(candidate.student, existing);
      
      // We don't use EXACT here because it relies on predefined canonical IDs
      // which we are not using for fresh matching. We only rely on HIGH_CONFIDENCE.
      if (confidence === 'HIGH_CONFIDENCE') {
        highConfidenceMatches++;
        matchedId = tempCanonicalId;
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
        
        if (!ambiguousGroupsMap.has(tempCanonicalId)) {
          ambiguousGroupsMap.set(tempCanonicalId, new Set([existingGroup[0].legacyRecordIdentifier]));
          ambiguousRecordsSet.add(existingGroup[0].legacyRecordIdentifier);
        }
        ambiguousGroupsMap.get(tempCanonicalId)!.add(candidate.legacyRecordIdentifier);
        ambiguousRecordsSet.add(candidate.legacyRecordIdentifier);
      }
    }
    
    if (!matchedId) {
      // Create new temporary canonical group
      matchedId = `temp_student_${generateOpaqueId()}`;
      distinctRecords++;
    }
    
    candidate.student.id = matchedId;
    if (!freshResolvedStudents.has(matchedId)) {
      freshResolvedStudents.set(matchedId, []);
    }
    freshResolvedStudents.get(matchedId)!.push(candidate);
  });

  // ---------------------------------------------------------
  // 4. Mapping Consistency Check
  // ---------------------------------------------------------
  let preparedMappingsLoaded = Object.keys(existingMappings).length;
  let preparedStudentMappings = 0;
  
  let consistentRecords = 0;
  let mismatchRecords = 0;
  let mismatchGroups = 0;
  let preparedMergeButFreshDistinct = 0;
  let preparedDistinctButFreshMerge = 0;
  let preparedMappingMissing = 0;
  let stalePreparedMappings = 0;

  // Group existing mappings by legacyRecordIdentifier for quick lookup
  const studentExistingMappings = new Map<string, string>();
  Object.values(existingMappings).forEach(m => {
    if (m.canonicalEntityType === 'STUDENT') {
      preparedStudentMappings++;
      studentExistingMappings.set(m.legacyRecordIdentifier, m.proposedCanonicalId);
    }
  });

  // To check consistency, we see if the grouping generated by fresh matching
  // aligns perfectly with the grouping in existing mappings.
  // Group fresh mappings by their fresh (temp) canonical ID -> Set of legacy record identifiers
  
  const existingGroupsByCanonicalId = new Map<string, Set<string>>();
  studentExistingMappings.forEach((canonicalId, legacyId) => {
    if (!existingGroupsByCanonicalId.has(canonicalId)) {
      existingGroupsByCanonicalId.set(canonicalId, new Set());
    }
    existingGroupsByCanonicalId.get(canonicalId)!.add(legacyId);
  });

  // Now compare fresh groups to existing groups
  freshResolvedStudents.forEach((candidates, tempCanonicalId) => {
    // Collect all legacy identifiers in this fresh group
    const freshGroupIds = new Set(candidates.map(c => c.legacyRecordIdentifier));
    
    let mappedCanonicalIds = new Set<string>();
    let missingMappings = 0;
    
    candidates.forEach(c => {
      const existingCanonicalId = studentExistingMappings.get(c.legacyRecordIdentifier);
      if (existingCanonicalId) {
        mappedCanonicalIds.add(existingCanonicalId);
      } else {
        missingMappings++;
      }
    });

    if (missingMappings > 0) {
      preparedMappingMissing += missingMappings;
      mismatchRecords += missingMappings;
    }

    if (mappedCanonicalIds.size > 1) {
      // Fresh matching grouped them together, but existing mappings put them in different groups
      preparedDistinctButFreshMerge += freshGroupIds.size;
      mismatchGroups++;
      mismatchRecords += freshGroupIds.size;
    } else if (mappedCanonicalIds.size === 1) {
      // Fresh matching put them together, and existing mappings also put them in ONE group.
      // But we must verify if the existing group contains MORE records than the fresh group.
      const canonicalId = Array.from(mappedCanonicalIds)[0];
      const existingGroupIds = existingGroupsByCanonicalId.get(canonicalId)!;
      
      if (existingGroupIds.size > freshGroupIds.size) {
        // Existing mapping grouped MORE records together than fresh matching did.
        // This means existing mapping merged records that fresh matching considers distinct.
        preparedMergeButFreshDistinct += existingGroupIds.size - freshGroupIds.size;
        mismatchGroups++;
        mismatchRecords += freshGroupIds.size;
      } else {
        consistentRecords += freshGroupIds.size;
      }
    }
  });

  // ---------------------------------------------------------
  // 5. Assessment and Results Audit (V3)
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
    unrecognizedRecords: {} as Record<string, number>
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
    
    keys.forEach(k => {
      const data = dataMap[k] as any;
      if (data && typeof data === 'object') {
        validEntities++;
        if (data.results && typeof data.results === 'object') {
          const resultKeys = Object.keys(data.results);
          sourceResultEntities += resultKeys.length;
        } else {
          // It might have results stored differently, let's flag if we can't find .results
          sourceResultUnrecognized++;
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
  // New Mappings Generation (only for genuinely new unmatched, if we were creating them, 
  // but this is just dry run, so we don't save new mappings if they contradict.
  // Wait, we actually don't generate new UUIDs here if there are mismatches, 
  // we just block. So newMappings is empty.
  // ---------------------------------------------------------

  const preview: MigrationPreview = {
    // Legacy Stats
    classGroupsDetected: rawClassNames.size,
    studentsDetected: allStudentCandidates.length,
    assessmentsDetected: totalAssessments,
    resultsDetected: totalResults,
    planningsDetected,
    warnings,
    errors,
    recordsSkipped,
    
    studentSourceRecords,
    
    // Fresh Matching (V3)
    freshMatching: {
      recordsAnalyzed,
      pairComparisons,
      exactMatches, // Will be 0 in fresh matching
      highConfidenceMatches,
      ambiguousPairs: ambiguousPairsList.length,
      ambiguousGroups: ambiguousGroupsMap.size,
      ambiguousRecords: ambiguousRecordsSet.size,
      distinctRecords,
      reviewRequiredGroups: ambiguousGroupsMap.size,
      proposedUniqueStudents: freshResolvedStudents.size
    },
    
    // Mapping Consistency (V3)
    mappingConsistency: {
      preparedMappingsLoaded,
      preparedStudentMappings,
      consistentRecords,
      mismatchRecords,
      mismatchGroups,
      preparedMergeButFreshDistinct,
      preparedDistinctButFreshMerge,
      preparedMappingMissing,
      stalePreparedMappings
    },
    
    conflictsByType,
    
    identifierSafety: {
      unstableLegacyIdentifiers
    },
    
    classResolution: {
      unresolvedClassAssignments
    },
    
    assessmentAudit,
    resultAudit
  };
  
  return { preview, newMappings };
}
