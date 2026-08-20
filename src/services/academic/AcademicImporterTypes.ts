import { AcademicYear, ClassGroup, Student, Enrollment } from '../../domain';

export type ImportAction = 
  | 'CREATE_STUDENT'
  | 'CREATE_ENROLLMENT'
  | 'UPDATE_ENROLLMENT'
  | 'UPDATE_CALL_NUMBER'
  | 'UPDATE_STATUS'
  | 'CLASS_CHANGE'
  | 'UNCHANGED'
  | 'IGNORE_EXACT_DUPLICATE'
  | 'REVIEW_REQUIRED';

export type ConflictReason = 
  | 'IDENTITY_CONFLICT'
  | 'IDENTITY_NAME_CONFLICT'
  | 'DUPLICATE_ACTIVE_CONFLICT'
  | 'STATUS_HISTORY_CONFLICT'
  | 'MISSING_STRONG_IDENTIFIER'
  | 'UNKNOWN_STATUS';

export interface ParsedRow {
  callNumber?: number | null;
  name: string;
  normalizedName: string;
  ra: string | null;
  raDigit?: string | null;
  status: string;
  normalizedStatus: 'ACTIVE' | 'TRANSFERRED' | 'REASSIGNED' | 'INACTIVE' | 'UNKNOWN';
}

export interface SheetOption {
  name: string;
  data: any[][];
}

export interface ImportCandidate {
  rawRow: any;
  parsed: ParsedRow;
  action: ImportAction;
  conflictReason?: ConflictReason;
  existingStudent?: Student;
  existingEnrollment?: Enrollment;
  classGroupChange?: { fromClassGroupId: string }; 
}

export interface IStudentRepository {
  getById(uid: string, id: string): Promise<Student | null>;
  findByExternalId(uid: string, key: string, value: string): Promise<Student | null>;
}

export interface IEnrollmentRepository {
  getActiveByClassGroup(uid: string, classGroupId: string): Promise<Enrollment[]>;
  findByStudentAndClassGroup(uid: string, studentId: string, classGroupId: string): Promise<Enrollment | null>;
  getActiveByStudentAndYear(uid: string, studentId: string, academicYearId: string): Promise<Enrollment | null>;
}

export interface ParseResult {
  yearFound?: number;
  candidates: ImportCandidate[];
  errors: string[];
  warnings: string[];
  sheetsFound?: SheetOption[];
  stats: {
    rowsRead: number;
    ignoredBlankRows: number;
    reviewRequiredRows: number;
    historicalDuplicateRows: number;
    uniqueStudents: number;
    activeStudents: number;
    nonActiveStudents: number;
    newStudents: number;
    existingStudents: number;
    updatedEnrollments: number;
    classChanges: number;
    ignoredDuplicates: number;
    conflicts: number;
    notPresentInNewFile: number;
  };
}
