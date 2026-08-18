export interface MigrationManifest {
  id: string; // migrationRunId
  startedAt: number;
  completedAt?: number;
  sourceSchemaVersion: number;
  targetSchemaVersion: number;
  status: 'PREPARING' | 'BACKED_UP' | 'DRY_RUN_COMPLETE' | 'MIGRATING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  backupId?: string;
  createdCounts?: Record<string, number>;
  updatedCounts?: Record<string, number>;
  conflictCounts?: Record<string, number>;
  warnings?: string[];
  errors?: string[];
}

export interface MigrationMapping {
  legacySource: string;
  legacyRecordIdentifier: string;
  canonicalEntityType: string;
  canonicalId: string;
  migrationRunId: string;
}

export type MatchConfidence = 'EXACT' | 'HIGH_CONFIDENCE' | 'AMBIGUOUS' | 'DISTINCT';

export interface MigrationPreview {
  classGroupsDetected: number;
  studentsDetected: number;
  assessmentsDetected: number;
  resultsDetected: number;
  planningsDetected: number;
  warnings: string[];
  errors: string[];
  recordsSkipped: number;
  studentSourceRecords: Record<string, number>;

  studentFieldCoverage: Record<string, {
    records: number;
    usableName: number;
    sourceLocalId: number;
    crossSourceStableId: number;
    number: number;
    classReference: number;
  }>;

  freshMatching: {
    recordsAnalyzed: number;
    pairComparisons: number;
    exactMatches: number;
    highConfidenceMatches: number;
    ambiguousPairs: number;
    distinctPairs: number;
    ambiguousGroups: number;
    ambiguousConnectedComponents: number;
    largestAmbiguousGroupSize: number;
    ambiguousRecords: number;
    distinctRecords: number;
    reviewRequiredGroups: number;
    proposedUniqueStudents: number;
  };

  ambiguityGraph: {
    edges: number;
    components: number;
    recordsInsideComponents: number;
    largestComponentSize: number;
  };

  mappingConsistency: {
    preparedMappingsLoaded: number;
    preparedStudentMappings: number;
    consistentRecords: number;
    mismatchRecords: number;
    mismatchGroups: number;
    preparedMergeButFreshDistinct: number;
    preparedDistinctButFreshMerge: number;
    preparedMappingMissing: number;
    stalePreparedMappings: number;
    mappingLookup: {
      exactKeyMatches: number;
      sourceMismatch: number;
      identifierMismatch: number;
      entityTypeMismatch: number;
      legacyKeyFormatMismatch: number;
      mappingNotFound: number;
      otherMismatch: number;
    };
  };

  mappingReconciliation: {
    SAFE_TO_KEEP: number;
    NEEDS_REBUILD: number;
    NEEDS_MANUAL_REVIEW: number;
    preparedTopology: {
      canonicalGroupsRepresented: number;
      singletonPreparedGroups: number;
      multiRecordPreparedGroups: number;
      largestPreparedGroupSize: number;
      recordsInsideMultiRecordPreparedGroups: number;
    };
    mappingMismatchReasons: {
      LEGACY_ALGORITHM_MERGE: number;
      SAME_PREPARED_CANONICAL_ID: number;
      FRESH_RULE_CHANGED: number;
      SOURCE_COLLISION: number;
      OTHER: number;
    };
    freshTopology: {
      proposedUniqueStudents: number;
      freshMergedGroups: number;
      freshSingletonGroups: number;
    };
  };

  matificClassPatternAudit: {
    totalPatterns: number;
    uniquelyResolvedPatterns: number;
    ambiguousPatterns: number;
    unresolvedPatterns: number;
    recordsByResolution: {
      uniquelyResolved: number;
      ambiguous: number;
      unresolved: number;
    };
  };

  ambiguityClassCorrelation: {
    largestGroupRecords: number;
    largestGroupAlsoUnresolvedClass: number;
    unresolvedRecordsInsideAnyAmbiguousGroup: number;
    resolvedRecordsInsideLargestAmbiguousGroup: number;
  };

  identifierCompleteness: {
    recordsWithStrongId: number;
    recordsWithNumber: number;
    recordsWithUsableName: number;
    recordsWithMissingName: number;
    recordsWithPlaceholderName: number;
    recordsWithOnlySourceIdentity: number;
    recordsWithClassResolved: number;
    recordsWithClassUnresolved: number;
  };

  strongIdCoverage: {
    sourceLocalOnly: number;
    crossSourceStable: number;
    missing: number;
  };

  ambiguousBySourcePair: Record<string, number>;
  
  ambiguousByClassResolution: {
    bothResolvedSameClass: number;
    bothResolvedDifferentClass: number;
    oneUnresolved: number;
    bothUnresolved: number;
  };

  ambiguousReasons: {
    SAME_NAME_DIFFERENT_NUMBER: number;
    SAME_NUMBER_DIFFERENT_NAME: number;
    SAME_NORMALIZED_NAME_MISSING_NUMBER: number;
    INSUFFICIENT_IDENTIFIERS: number;
    OTHER: number;
  };

  identifierSafety: {
    unstableLegacyIdentifiers: number;
  };

  classResolution: {
    unresolvedClassAssignments: number;
    unresolvedClassesBySource: Record<string, number>;
    unresolvedClassReasons: {
      CLASS_NAME_NOT_FOUND: number;
      CLASS_ID_NOT_FOUND: number;
      GRADE_MISMATCH: number;
      ACADEMIC_YEAR_MISMATCH: number;
      EMPTY_CLASS_REFERENCE: number;
      NORMALIZATION_MISMATCH: number;
      OTHER: number;
    };
  };

  assessmentAudit: {
    sourcesInspected: string[];
    containersDetected: Record<string, number>;
    entitiesDetected: Record<string, number>;
    unrecognizedRecords: Record<string, number>;
    structuralShapes?: Record<string, any>;
  };

  resultAudit: {
    sourcesInspected: string[];
    sourcesWithRecords: string[];
    containersDetected: Record<string, number>;
    entitiesDetected: Record<string, number>;
    unrecognizedRecords: Record<string, number>;
    schemaStatus: {
      RESULT_NOT_EXPECTED: number;
      RESULT_CONTAINER_EMPTY: number;
      RESULT_SCHEMA_RECOGNIZED: number;
      RESULT_SCHEMA_UNRECOGNIZED: number;
    };
    structuralShapes?: Record<string, any>;
    resultAdapterValidation: {
      candidateLeaves: number;
      recognizedLeaves: number;
      unrecognizedLeaves: number;
      schemaVariants: Record<string, number>;
    };
  };

  MIGRATION_READY: boolean;
  blockingReasons: string[];
}
