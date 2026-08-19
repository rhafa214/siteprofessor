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

export interface ParseResult {
  yearFound?: number;
  candidates: ImportCandidate[];
  errors: string[];
  warnings: string[];
  sheetsFound?: SheetOption[];
  stats: {
    rowsRead: number;
    validRows: number;
    ignoredBlankRows: number;
    reviewRequiredRows: number;
    total: number;
    active: number;
    inactive: number;
    newStudents: number;
    existingStudents: number;
    updatedEnrollments: number;
    classChanges: number;
    ignoredDuplicates: number;
    conflicts: number;
    notPresentInNewFile: number;
  };
}
