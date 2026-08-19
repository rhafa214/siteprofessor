export interface Enrollment {
  id: string;
  studentId: string;
  classGroupId: string;
  academicYearId: string;
  callNumber?: number | null;
  status: 'ACTIVE' | 'TRANSFERRED' | 'REASSIGNED' | 'INACTIVE';
  sourceStatus?: string;
  createdAt: number;
  updatedAt: number;
}
