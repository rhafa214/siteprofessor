import { AcademicYear, ClassGroup, Student, Enrollment } from '../../domain';
import { StudentRepository, EnrollmentRepository } from '../../data/repositories';

export interface CanonicalStudentRoster {
  studentId: string;
  enrollmentId?: string;
  name: string;
  normalizedName: string;
  callNumber: number | null;
}

export class AcademicRosterService {
  constructor(
    private studentRepo: StudentRepository,
    private enrollmentRepo: EnrollmentRepository
  ) {}

  async getActiveRoster(uid: string, academicYearId: string, classGroupId: string): Promise<CanonicalStudentRoster[]> {
    // get all active enrollments for the class
    const enrollments = await this.enrollmentRepo.getActiveByClassGroup(uid, classGroupId);
    
    const roster: CanonicalStudentRoster[] = [];
    
    for (const enrollment of enrollments) {
      if (enrollment.academicYearId !== academicYearId) continue;
      
      const student = await this.studentRepo.getById(uid, enrollment.studentId);
      if (student) {
        roster.push({
          studentId: student.id,
          enrollmentId: enrollment.id,
          name: student.name,
          normalizedName: student.normalizedName,
          callNumber: enrollment.callNumber !== undefined ? enrollment.callNumber : null
        });
      }
    }

    // Sort by call number, then name
    roster.sort((a, b) => {
      if (a.callNumber !== null && b.callNumber !== null) {
        if (a.callNumber !== b.callNumber) return a.callNumber - b.callNumber;
      } else if (a.callNumber !== null) {
        return -1;
      } else if (b.callNumber !== null) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });

    return roster;
  }
}
