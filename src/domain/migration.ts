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
  // Original fields
  classGroupsDetected: number;
  studentsDetected: number;
  assessmentsDetected: number;
  resultsDetected: number;
  planningsDetected: number;
  warnings: string[];
  errors: string[];
  recordsSkipped: number;

  // New V2 Sanitized Metrics
  studentSourceRecords: Record<string, number>;
  matching: {
    pairComparisons: number;
    exactMatches: number;
    highConfidenceMatches: number;
    ambiguousPairs: number;
    ambiguousGroups: number;
    ambiguousRecords: number;
    distinctRecords: number;
    reviewRequiredGroups: number;
  };
  conflictsByType: Record<string, number>;
  
  assessmentSourcesPresent: string[];
  assessmentSourceRecordCounts: Record<string, number>;
  resultSourcesPresent: string[];
  resultSourceRecordCounts: Record<string, number>;
}
