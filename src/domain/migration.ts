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
  // Legacy Stats
  classGroupsDetected: number;
  studentsDetected: number;
  assessmentsDetected: number;
  resultsDetected: number;
  planningsDetected: number;
  warnings: string[];
  errors: string[];
  recordsSkipped: number;

  studentSourceRecords: Record<string, number>;

  // Fresh Matching (V3)
  freshMatching: {
    recordsAnalyzed: number;
    pairComparisons: number;
    exactMatches: number;
    highConfidenceMatches: number;
    ambiguousPairs: number;
    ambiguousGroups: number;
    ambiguousRecords: number;
    distinctRecords: number;
    reviewRequiredGroups: number;
    proposedUniqueStudents: number;
  };

  // Mapping Consistency (V3)
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
  };

  conflictsByType: Record<string, number>;

  // Identifier Safety (V3)
  identifierSafety: {
    unstableLegacyIdentifiers: number;
  };

  // Class Resolution (V3)
  classResolution: {
    unresolvedClassAssignments: number;
  };

  // Assessment Audit (V3)
  assessmentAudit: {
    sourcesInspected: string[];
    containersDetected: Record<string, number>;
    entitiesDetected: Record<string, number>;
    unrecognizedRecords: Record<string, number>;
  };

  // Result Audit (V3)
  resultAudit: {
    sourcesInspected: string[];
    sourcesWithRecords: string[];
    containersDetected: Record<string, number>;
    entitiesDetected: Record<string, number>;
    unrecognizedRecords: Record<string, number>;
  };
}
