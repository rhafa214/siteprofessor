export interface AcademicYear {
  id: string;
  year: number;
  name: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'PLANNED' | 'COMPLETED';
  startDate?: string;
  endDate?: string;
  createdAt: number;
  updatedAt: number;
  migrationMetadata?: any;
}
