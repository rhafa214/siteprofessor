export type AssessmentType = 'EXAM' | 'HOMEWORK' | 'EXTERNAL_PLATFORM' | 'PARTICIPATION' | 'OTHER';

export interface Assessment {
  id: string;
  classGroupId: string;
  academicYearId?: string;
  bimester?: number;
  type: AssessmentType;
  title: string;
  date?: string;
  maxScore?: number;
  weight?: number;
  metadata?: unknown;
  createdAt?: number;
  updatedAt?: number;
  migrationMetadata?: {
    migrationRunId?: string;
    legacySourceKeys?: string[];
  };
}

export interface AssessmentResult {
  id: string;
  assessmentId: string;
  studentId: string;
  score?: number;
  status: 'SUBMITTED' | 'MISSING' | 'EXCUSED';
  metadata?: unknown;
  createdAt?: number;
  updatedAt?: number;
  migrationMetadata?: {
    migrationRunId?: string;
    legacySourceKeys?: string[];
  };
}
