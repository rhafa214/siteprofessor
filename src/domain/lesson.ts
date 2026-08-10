export interface Lesson {
  id: string;
  classGroupId: string;
  academicYearId?: string;
  bimester?: number;
  date: string;
  title: string;
  content?: string;
  homework?: string;
  createdAt?: number;
  updatedAt?: number;
  migrationMetadata?: {
    migrationRunId?: string;
    legacySourceKeys?: string[];
  };
}
