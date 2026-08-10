export interface Student {
  id: string;
  classGroupId: string;
  name: string;
  number?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'TRANSFERRED';
  createdAt?: number;
  updatedAt?: number;
  metadata?: unknown;
  migrationMetadata?: {
    migrationRunId?: string;
    legacyIds?: string[];
    sources?: string[];
  };
}
