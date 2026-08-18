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

  // Fresh Matching (V4)
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

  // Mapping Consistency (V4)
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

  ambiguousReasons: {
    SAME_NAME_DIFFERENT_NUMBER: number;
    SAME_NUMBER_DIFFERENT_NAME: number;
    SAME_NORMALIZED_NAME_MISSING_NUMBER: number;
    INSUFFICIENT_IDENTIFIERS: number;
    OTHER: number;
  };

  // Identifier Safety (V4)
  identifierSafety: {
    unstableLegacyIdentifiers: number;
  };

  // Class Resolution (V4)
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

  // Assessment Audit (V4)
  assessmentAudit: {
    sourcesInspected: string[];
    containersDetected: Record<string, number>;
    entitiesDetected: Record<string, number>;
    unrecognizedRecords: Record<string, number>;
  };

  // Result Audit (V4)
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
  };

  // V4 Migration Gate
  MIGRATION_READY: boolean;
  blockingReasons: string[];
}
