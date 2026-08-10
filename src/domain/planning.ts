export type PlanningType = 'ANNUAL' | 'BIMESTRAL' | 'WEEKLY' | 'LESSON';

export interface Planning {
  id: string;
  type: PlanningType;
  classGroupId?: string;
  academicYearId?: string;
  bimester?: number;
  title: string;
  content: string;
  status: 'DRAFT' | 'FINAL';
  createdAt?: number;
  updatedAt?: number;
  metadata?: unknown;
  migrationMetadata?: {
    migrationRunId?: string;
    legacySourceKeys?: string[];
  };
}
