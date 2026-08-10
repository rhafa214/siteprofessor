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
  ambiguousMatches: any[];
  warnings: string[];
  errors: string[];
  recordsSkipped: number;
}
