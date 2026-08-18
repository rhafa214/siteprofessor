import { LegacyAcademicSnapshot } from './LegacyDataCollector';
import { 
  resolveClassCandidates, 
  calculateStudentMatchConfidence, 
  mapLegacyClassToClassGroup, 
  mapLegacyStudentToStudent, 
  generateOpaqueId,
  generateLegacyRecordIdentifier,
  extractLegacyStudentName,
  generateDeterministicFingerprint
} from '../mappers/legacyMappers';
import { MigrationPreview, Student, ClassGroup, ClassAliasDecision } from '../../domain';
import { MigrationMapping } from './MigrationMappingService';

interface StudentCandidate {
  student: Student;
  legacySource: string;
  legacyRecordIdentifier: string;
  sourceLocalId: string;
}

export interface DryRunResult {
  preview: MigrationPreview;
  newMappings: MigrationMapping[];
}

function isDynamicKey(key: string): boolean {
  if (/^\d+$/.test(key)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) return true;
  if (key.length > 15 && !key.includes(' ') && !key.includes('_')) return true;
  const k = key.toLowerCase();
  if (['id', 'uuid', 'uid', 'userid', 'studentid', 'alunoid'].includes(k)) return true;
  return false;
}

function getShapeSignature(leaf: any, depth = 0): { type: string, fields?: Record<string, string>, depth: number } {
  if (depth > 5) return { type: 'max_depth', depth };
  if (leaf === null) return { type: 'null', depth };
  if (Array.isArray(leaf)) return { type: 'array', depth };
  if (typeof leaf !== 'object') return { type: typeof leaf, depth };
  
  const fields: Record<string, string> = {};
  let maxDepth = depth;
  for (const k of Object.keys(leaf)) {
    const safeKey = isDynamicKey(k) ? '<DYNAMIC_KEY>' : k;
    const childSig = getShapeSignature(leaf[k], depth + 1);
    fields[safeKey] = childSig.type === 'object' ? 'object' : childSig.type;
    if (childSig.depth > maxDepth) maxDepth = childSig.depth;
  }
  return { type: 'object', fields, depth: maxDepth };
}

function hashSignature(fields: Record<string, string>): string {
  const keys = Object.keys(fields).sort();
  return btoa(keys.map(k => `${k}:${fields[k]}`).join('|')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function generateMigrationPreview(
  snapshot: LegacyAcademicSnapshot, 
  existingMappings: Record<string, MigrationMapping>,
  classAliases: Record<string, ClassAliasDecision>,
  runId: string
): Promise<DryRunResult> {
  const warnings: string[] = [...snapshot.warnings];
  const errors: string[] = [...snapshot.errors];
  
  const newMappings: MigrationMapping[] = [];
  
  // ---------------------------------------------------------
  // 1. Resolve ClassGroups & Collect Field Coverage
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

  const matificClassPatternAudit = {
    totalPatterns: 0,
    uniquelyResolvedPatterns: 0,
    ambiguousPatterns: 0,
    unresolvedPatterns: 0,
    recordsByResolution: {
      uniquelyResolved: 0,
      ambiguous: 0,
      unresolved: 0
    }
  };

  const classReview = {
    patternsDetected: 0,
    automaticPatternsResolved: 0,
    manualDecisionsLoaded: Object.values(classAliases).length,
    manualDecisionsApplied: 0,
    pendingPatterns: 0,
    unresolvedPatterns: 0,
    recordsResolvedAutomatically: 0,
    recordsResolvedManually: 0,
    recordsStillUnresolved: 0
  };

  const _unresolvedClassPatterns: Array<{ fingerprint: string; legacyReference: string; source: string; recordsAffected: number }> = [];

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

  const strongIdCoverage = {
    sourceLocalOnly: 0,
    crossSourceStable: 0,
    missing: 0
  };

  const studentFieldCoverage: Record<string, any> = {
    taskAnalysis: { records: 0, usableName: 0, sourceLocalId: 0, crossSourceStableId: 0, number: 0, classReference: 0 },
    matificAnalysis: { records: 0, usableName: 0, sourceLocalId: 0, crossSourceStableId: 0, number: 0, classReference: 0 },
    pp_: { records: 0, usableName: 0, sourceLocalId: 0, crossSourceStableId: 0, number: 0, classReference: 0 }
  };

  // ---------------------------------------------------------
  // 2. Collect Students
  // ---------------------------------------------------------
  const allStudentCandidates: StudentCandidate[] = [];
  const studentSourceRecords: Record<string, number> = { taskAnalysis: 0, matificAnalysis: 0, pp_: 0 };
  let unstableLegacyIdentifiers = 0;
  
  const processSourceForStudents = async (sourceName: string, dataMap: Record<string, unknown>) => {
    let sourceCount = 0;
    
    // Pattern resolving map just for Matific
    const matificPatterns = new Map<string, { candidates: ClassGroup[], records: number }>();
    
    for (const [legacyClassId, data] of Object.entries(dataMap)) {
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
      
      let classGroupId = 'UNRESOLVED';
      let classResolved = false;

      if (!legacyClassId) {
         unresolvedClassAssignments += studentsInThisGroup;
         unresolvedClassReasons.EMPTY_CLASS_REFERENCE += studentsInThisGroup;
         unresolvedClassesBySource[sourceName] = (unresolvedClassesBySource[sourceName] || 0) + studentsInThisGroup;
         classReview.recordsStillUnresolved += studentsInThisGroup;
         
         if (sourceName === 'matificAnalysis') {
             matificPatterns.set('_EMPTY_', { candidates: [], records: studentsInThisGroup });
         }
      } else {
        const fingerprint = await generateDeterministicFingerprint(legacyClassId);
        classReview.patternsDetected++;
        
        const matches = proposedClassGroups.filter(c => c.name === legacyClassId || c.legacySlug === legacyClassId);
        
        if (matches.length === 1) {
          classGroupId = matches[0].id;
          classResolved = true;
          classReview.automaticPatternsResolved++;
          classReview.recordsResolvedAutomatically += studentsInThisGroup;
        } else {
          // Manual fallback
          const decision = classAliases[fingerprint];
          if (decision && decision.status === 'CONFIRMED') {
            classGroupId = decision.canonicalClassGroupId;
            classResolved = true;
            classReview.manualDecisionsApplied++;
            classReview.recordsResolvedManually += studentsInThisGroup;
          } else {
            if (decision && decision.status === 'PENDING') {
               classReview.pendingPatterns++;
            } else {
               classReview.unresolvedPatterns++;
            }
            classReview.recordsStillUnresolved += studentsInThisGroup;
            unresolvedClassAssignments += studentsInThisGroup;
            unresolvedClassReasons.CLASS_NAME_NOT_FOUND += studentsInThisGroup;
            unresolvedClassesBySource[sourceName] = (unresolvedClassesBySource[sourceName] || 0) + studentsInThisGroup;
            
            // Only add unique unresolved patterns to the UI list
            if (!_unresolvedClassPatterns.find(p => p.fingerprint === fingerprint)) {
                _unresolvedClassPatterns.push({
                    fingerprint,
                    legacyReference: legacyClassId,
                    source: sourceName,
                    recordsAffected: studentsInThisGroup
                });
            } else {
                const pat = _unresolvedClassPatterns.find(p => p.fingerprint === fingerprint);
                if (pat) pat.recordsAffected += studentsInThisGroup;
            }
          }
        }
        
        if (sourceName === 'matificAnalysis') {
             const existing = matificPatterns.get(legacyClassId) || { candidates: matches, records: 0 };
             existing.records += studentsInThisGroup;
             matificPatterns.set(legacyClassId, existing);
        }
      }
      
      studentList.forEach((item, index) => {
        if (item && typeof item === 'object') {
          sourceCount++;
          const legacyObj = item as Record<string, unknown>;
          
          const { identifier, isStable } = generateLegacyRecordIdentifier(legacyClassId, legacyObj, index);
          if (!isStable) unstableLegacyIdentifiers++;
          
          const st = mapLegacyStudentToStudent(legacyObj as any, classGroupId);
          
          const sourceLocalId = String(legacyObj.id || legacyObj.numero || '');
          allStudentCandidates.push({ student: st, legacySource: sourceName, legacyRecordIdentifier: identifier, sourceLocalId });

          // Structural field audit
          const hasId = legacyObj.id !== undefined && legacyObj.id !== null;
          const hasNum = legacyObj.numero !== undefined && legacyObj.numero !== null;
          const extractedName = extractLegacyStudentName(legacyObj);
          
          if (studentFieldCoverage[sourceName]) {
             studentFieldCoverage[sourceName].records++;
             if (hasId) studentFieldCoverage[sourceName].sourceLocalId++;
             if (hasNum) studentFieldCoverage[sourceName].number++;
             if (extractedName) studentFieldCoverage[sourceName].usableName++;
             if (legacyClassId) studentFieldCoverage[sourceName].classReference++;
          }

          // Completeness Audit
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
          
          if (hasId) {
             strongIdCoverage.sourceLocalOnly++;
          } else {
             strongIdCoverage.missing++;
          }
        }
      });
    }
    
    if (sourceName === 'matificAnalysis') {
        matificClassPatternAudit.totalPatterns = matificPatterns.size;
        matificPatterns.forEach((info, key) => {
            if (info.candidates.length === 1) {
                matificClassPatternAudit.uniquelyResolvedPatterns++;
                matificClassPatternAudit.recordsByResolution.uniquelyResolved += info.records;
            } else if (info.candidates.length > 1) {
                matificClassPatternAudit.ambiguousPatterns++;
                matificClassPatternAudit.recordsByResolution.ambiguous += info.records;
            } else {
                matificClassPatternAudit.unresolvedPatterns++;
                matificClassPatternAudit.recordsByResolution.unresolved += info.records;
            }
        });
    }

    studentSourceRecords[sourceName] = sourceCount;
  };

  await processSourceForStudents('taskAnalysis', snapshot.firestoreData.taskAnalysis || {});
  await processSourceForStudents('matificAnalysis', snapshot.firestoreData.matificAnalysis || {});
  await processSourceForStudents('pp_', snapshot.firestoreData.pp_ || {});

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
  let ambiguousEdges = 0;

  allStudentCandidates.forEach((candidate, i) => {
    let matchedId = '';
    
    for (const [tempCanonicalId, existingGroup] of freshResolvedStudents.entries()) {
      const existing = existingGroup[0].student;
      const existingSource = existingGroup[0].legacySource;
      const existingLocalId = existingGroup[0].sourceLocalId;
      pairComparisons++;
      
      const { confidence, reason } = calculateStudentMatchConfidence(
         candidate.student, existing, 
         candidate.legacySource, existingSource,
         candidate.sourceLocalId, existingLocalId
      );
      
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
        ambiguousEdges++;
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

  const ambiguityGraphMetrics = {
    edges: ambiguousEdges,
    components: ambiguousConnectedComponents,
    recordsInsideComponents: ambiguousRecordsSet.size,
    largestComponentSize: largestAmbiguousGroupSize
  };

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
  
  const resultLeafProfiler = {
    totalLeaves: 0,
    leafTypes: { number: 0, string: 0, object: 0, array: 0, null: 0, other: 0 } as Record<string, number>,
    objectShapeSignatures: {} as Record<string, any>
  };
  const resultFieldPaths: Record<string, Record<string, number>> = {};

  const profileLeaf = (leaf: any, path: string, depth: number) => {
    if (depth > 5) return;
    resultLeafProfiler.totalLeaves++;
    
    let type: string = typeof leaf;
    if (leaf === null) type = 'null';
    else if (Array.isArray(leaf)) type = 'array';
    
    if (resultLeafProfiler.leafTypes[type] !== undefined) {
       resultLeafProfiler.leafTypes[type]++;
    } else {
       resultLeafProfiler.leafTypes.other = (resultLeafProfiler.leafTypes.other || 0) + 1;
    }
    
    if (type === 'object' && leaf !== null && !Array.isArray(leaf)) {
       const sig = getShapeSignature(leaf, 0);
       if (sig.fields) {
         const hash = hashSignature(sig.fields);
         if (!resultLeafProfiler.objectShapeSignatures[hash]) {
           resultLeafProfiler.objectShapeSignatures[hash] = {
             hash, count: 0, depth: sig.depth, fields: sig.fields
           };
         }
         resultLeafProfiler.objectShapeSignatures[hash].count++;
       }
       
       for (const k of Object.keys(leaf)) {
          const safeKey = isDynamicKey(k) ? '<DYNAMIC_KEY>' : k;
          const newPath = path ? `${path}.${safeKey}` : safeKey;
          const valType = leaf[k] === null ? 'null' : Array.isArray(leaf[k]) ? 'array' : typeof leaf[k];
          
          if (!resultFieldPaths[newPath]) resultFieldPaths[newPath] = {};
          resultFieldPaths[newPath][valType] = (resultFieldPaths[newPath][valType] || 0) + 1;
          
          profileLeaf(leaf[k], newPath, depth + 1);
       }
    } else if (path) {
       if (!resultFieldPaths[path]) resultFieldPaths[path] = {};
       resultFieldPaths[path][type] = (resultFieldPaths[path][type] || 0) + 1;
    }
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
    structuralShapes: {} as Record<string, any>,
    resultAdapterValidation: {
      candidateLeaves: 0,
      recognizedLeaves: 0,
      unrecognizedLeaves: 0,
      schemaVariants: {} as Record<string, number>
    },
    resultLeafProfiler,
    resultFieldPaths
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
        
        if (!resultKey && sourceName === 'localstorage_assessments_grades') {
          if (Object.keys(data).length > 0 && !data.title && !data.name) {
             resultKey = '_ROOT_AS_RESULTS_'; 
          }
        }

        if (resultKey) {
          const resultObj = resultKey === '_ROOT_AS_RESULTS_' ? data : data[resultKey];
          const resultKeys = Object.keys(resultObj);
          
          let leavesValid = 0;
          let leavesInvalid = 0;

          resultKeys.forEach(studentId => {
             resultAudit.resultAdapterValidation.candidateLeaves++;
             const grade = resultObj[studentId];
             
             // Profiler deep structural analysis without values
             profileLeaf(grade, '', 0);
             
             const isNumber = typeof grade === 'number';
             const isStringNumber = typeof grade === 'string' && !isNaN(Number(grade));
             const isObjectWithScore = typeof grade === 'object' && grade !== null && (grade.score !== undefined || grade.nota !== undefined);
             
             if (isNumber || isStringNumber || isObjectWithScore) {
                resultAudit.resultAdapterValidation.recognizedLeaves++;
                leavesValid++;
                const variantName = isNumber ? 'number' : (isStringNumber ? 'stringNumber' : 'objectWithScore');
                resultAudit.resultAdapterValidation.schemaVariants[variantName] = (resultAudit.resultAdapterValidation.schemaVariants[variantName] || 0) + 1;
             } else {
                resultAudit.resultAdapterValidation.unrecognizedLeaves++;
                leavesInvalid++;
             }
          });
          
          // DO NOT BLINDLY SET RESULT_SCHEMA_RECOGNIZED if leaves are not fully valid
          const containerFullyRecognized = leavesValid > 0 && leavesInvalid === 0;
          
          if (containerFullyRecognized) {
             resultAudit.schemaStatus.RESULT_SCHEMA_RECOGNIZED++;
          } else {
             resultAudit.schemaStatus.RESULT_SCHEMA_UNRECOGNIZED++;
          }
          
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
  
  const RESULT_SCHEMA_VALIDATED = Object.values(resultAudit.unrecognizedRecords).length === 0 && resultAudit.resultAdapterValidation.unrecognizedLeaves === 0 && resultAudit.resultAdapterValidation.recognizedLeaves > 0;
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
    
    studentFieldCoverage,
    
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
    
    ambiguityGraph: ambiguityGraphMetrics,
    
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
    classReview,
    _unresolvedClassPatterns,
    _canonicalClassGroups: proposedClassGroups,
    matificClassPatternAudit,
    ambiguityClassCorrelation,
    identifierCompleteness,
    strongIdCoverage,
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

export interface UnresolvedClassPattern {
    fingerprint: string;
    legacyReference: string;
    source: string;
    recordsAffected: number;
}

export async function extractClassReviewPatterns(
    snapshot: LegacyAcademicSnapshot,
    proposedClassGroups: ClassGroup[],
    classAliases: Record<string, ClassAliasDecision>
): Promise<UnresolvedClassPattern[]> {
    const _unresolvedClassPatterns: UnresolvedClassPattern[] = [];

    const processSource = async (sourceName: string, dataMap: Record<string, unknown>) => {
        for (const [legacyClassId, data] of Object.entries(dataMap)) {
            let studentList: unknown[] = [];
            if (Array.isArray(data)) studentList = data;
            else if (data && typeof data === 'object') {
              const obj = data as Record<string, unknown>;
              if (Array.isArray(obj.alunos)) studentList = obj.alunos;
              else if (Array.isArray(obj.students)) studentList = obj.students;
              else if (Array.isArray(obj.items)) studentList = obj.items;
            }
            
            const studentsInThisGroup = studentList.length;
            if (studentsInThisGroup === 0 || !legacyClassId) continue;
            
            const fingerprint = await generateDeterministicFingerprint(legacyClassId);
            const matches = proposedClassGroups.filter(c => c.name === legacyClassId || c.legacySlug === legacyClassId);
            
            if (matches.length === 1) {
                continue; // Automatically resolved
            }
            
            // For UI, we still want to show CONFIRMED aliases so the user can clear them.
            // Wait, the user said: "Ao abrir /migration-admin, deve ser possível chegar à seção: REVISÃO DE TURMAS MATIFIC ANTES de qualquer Dry-Run V7. Ela deve mostrar somente padrões unresolved/review necessários."
            // AND "Depois que o usuário confirmar os aliases, a UI deve mostrar: CONFIRMED e permitir alterar/limpar."
            // So we MUST return patterns even if they are CONFIRMED in the dictionary, so the UI can render them and show the "CONFIRMED" badge, allowing the user to clear it.
            // If they are mapped automatically (length === 1), they shouldn't show up. But if they needed manual mapping, they should.
            
            if (!_unresolvedClassPatterns.find(p => p.fingerprint === fingerprint)) {
                _unresolvedClassPatterns.push({
                    fingerprint,
                    legacyReference: legacyClassId,
                    source: sourceName,
                    recordsAffected: studentsInThisGroup
                });
            } else {
                const pat = _unresolvedClassPatterns.find(p => p.fingerprint === fingerprint);
                if (pat) pat.recordsAffected += studentsInThisGroup;
            }
        }
    };
    
    await processSource('taskAnalysis', snapshot.firestoreData.taskAnalysis || {});
    await processSource('matificAnalysis', snapshot.firestoreData.matificAnalysis || {});
    await processSource('pp_', snapshot.firestoreData.pp_ || {});
    
    return _unresolvedClassPatterns;
}

export function getProposedClassGroups(existingMappings: Record<string, import('../../domain/migration').MigrationMapping>): ClassGroup[] {
  const rawClassNames = new Set<string>();
  const proposedClassGroups: ClassGroup[] = [];
  Object.values(existingMappings).forEach(mapping => {
     if ((mapping as any).canonicalClassGroupId && (mapping as any).legacyClassGroupSlug) {
        if (!rawClassNames.has((mapping as any).canonicalClassGroupId)) {
            rawClassNames.add((mapping as any).canonicalClassGroupId);
            proposedClassGroups.push({
                id: (mapping as any).canonicalClassGroupId,
                name: (mapping as any).canonicalClassGroupId, // Assuming name is ID for canonical
                legacySlug: (mapping as any).legacyClassGroupSlug,
                createdAt: 0,
                updatedAt: 0
            });
        }
     }
  });
  return proposedClassGroups;
}
