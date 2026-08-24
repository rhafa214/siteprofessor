export type AssessmentCategory = 'BIMESTRAL' | 'SIMULADO' | 'PARTICIPACAO';

export interface CanonicalAssessmentSheet {
  id: string; // e.g., sheet_${academicYearId}_${termId}_${classGroupId}_${category}
  uid: string;
  academicYearId: string;
  termId: string;
  classGroupId: string;
  category: AssessmentCategory;
  title: string;
  date: string | null;
  maxScore: number;
  createdAt: number;
  updatedAt: number;
}

export interface CanonicalAssessmentResult {
  id: string; // e.g., result_${assessmentId}_${studentId}
  uid: string;
  assessmentId: string;
  studentId: string;
  grade: number | null;
  createdAt: number;
  updatedAt: number;
}
