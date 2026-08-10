export interface ClassGroup {
  id: string;
  academicYearId?: string;
  grade?: string;
  name: string;
  subject?: string;
  school?: string;
  createdAt?: number;
  updatedAt?: number;
  status?: 'ACTIVE' | 'ARCHIVED';
  
  legacySlug?: string;
  migrationMetadata?: {
    migrationRunId?: string;
    legacySourceKeys?: string[];
  };
}
