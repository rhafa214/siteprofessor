export interface ClassGroup {
  id: string;
  academicYearId?: string;
  name: string;
  grade?: string;
  section?: string;
  subject?: string;
  school?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: number;
  updatedAt: number;
  legacySlug?: string;
  migrationMetadata?: any;
}
