export interface AcademicYear {
  id: string;
  year: number;
  startDate?: string;
  endDate?: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
  createdAt?: number;
  updatedAt?: number;
  migrationMetadata?: {
    migrationRunId?: string;
    legacySourceKeys?: string[];
  };
}
