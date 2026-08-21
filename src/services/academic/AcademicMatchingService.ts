import { CanonicalStudentRoster } from './AcademicRosterService';

export interface FileRecord {
  rawName: string;
}

export interface MatchResult {
  matched: { fileRecord: FileRecord; student: CanonicalStudentRoster }[];
  unmatched: { fileRecord: FileRecord; reason: 'UNMATCHED_STUDENT' | 'AMBIGUOUS_STUDENT_MATCH' }[];
  missingStudents: CanonicalStudentRoster[];
}

export class AcademicMatchingService {
  matchImportedRecords(
    extractedNames: string[],
    roster: CanonicalStudentRoster[]
  ): MatchResult {
    const matched: { fileRecord: FileRecord; student: CanonicalStudentRoster }[] = [];
    const unmatched: { fileRecord: FileRecord; reason: 'UNMATCHED_STUDENT' | 'AMBIGUOUS_STUDENT_MATCH' }[] = [];
    
    // To track which roster students were matched
    const matchedStudentIds = new Set<string>();

    for (const rawName of extractedNames) {
      const normalizedRaw = this.normalizeName(rawName);
      
      // Try exact normalized match
      const exactMatches = roster.filter(s => this.normalizeName(s.name) === normalizedRaw || s.normalizedName === normalizedRaw);
      
      if (exactMatches.length === 1) {
        matched.push({ fileRecord: { rawName }, student: exactMatches[0] });
        matchedStudentIds.add(exactMatches[0].studentId);
      } else if (exactMatches.length > 1) {
        unmatched.push({ fileRecord: { rawName }, reason: 'AMBIGUOUS_STUDENT_MATCH' });
      } else {
        // No match found
        unmatched.push({ fileRecord: { rawName }, reason: 'UNMATCHED_STUDENT' });
      }
    }

    const missingStudents = roster.filter(s => !matchedStudentIds.has(s.studentId));

    return {
      matched,
      unmatched,
      missingStudents
    };
  }

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, ' ')
      .trim();
  }
}
