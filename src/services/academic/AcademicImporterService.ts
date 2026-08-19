import { getFirestore, writeBatch, doc, collection } from 'firebase/firestore';
import { app } from '../../lib/firebase';
import { ParsedRow, ImportCandidate, ParseResult, ImportAction, SheetOption } from './AcademicImporterTypes';
import { parseFileToSheets, filterCompatibleSheets, extractFromAoA } from './AcademicImporterParser';
import { AcademicYear, ClassGroup, Student, Enrollment } from '../../domain';

export class AcademicImporterService {
  constructor(
    private studentRepo: any,
    private enrollmentRepo: any
  ) {}

  public async analyzeFile(uid: string, file: File, academicYear: AcademicYear, classGroup: ClassGroup, selectedSheetName?: string): Promise<{ result?: ParseResult, sheets?: SheetOption[], errors: string[] }> {
    try {
      const sheets = await parseFileToSheets(file);
      const { compatible, errors } = filterCompatibleSheets(sheets);
      
      if (errors.length > 0) return { errors };

      let targetSheet: SheetOption;
      
      if (compatible.length === 1) {
        targetSheet = compatible[0];
      } else if (compatible.length > 1) {
        if (!selectedSheetName) {
           return { sheets: compatible, errors: [] }; // Need manual selection
        }
        const found = compatible.find(s => s.name === selectedSheetName);
        if (!found) return { errors: ["Aba selecionada inválida."] };
        targetSheet = found;
      } else {
        return { errors: ["Erro desconhecido ao processar abas."] };
      }

      const extracted = extractFromAoA(targetSheet.data);
      if (extracted.errors.length > 0) return { errors: extracted.errors };

      if (extracted.yearFound && extracted.yearFound !== academicYear.year) {
        return { errors: [`Conflito de Ano Letivo: o arquivo indica ${extracted.yearFound}, mas a turma pertence ao ano de ${academicYear.year}. Importação cancelada por segurança.`] };
      }

      const { candidates, stats } = await this.buildCandidates(uid, extracted.parsedRows, academicYear, classGroup);

      stats.ignoredBlankRows = extracted.ignoredBlankRows;
      stats.rowsRead = extracted.parsedRows.length;

      return { 
        result: {
          yearFound: extracted.yearFound,
          candidates,
          errors: [],
          warnings: extracted.warnings,
          stats
        },
        errors: []
      };

    } catch (err: any) {
      return { errors: [err.message || "Falha ao processar arquivo"] };
    }
  }

  private emptyStats() {
    return {
      rowsRead: 0,
      ignoredBlankRows: 0,
      historicalDuplicateRows: 0,
      reviewRequiredRows: 0,
      uniqueStudents: 0,
      activeStudents: 0,
      nonActiveStudents: 0,
      newStudents: 0,
      existingStudents: 0,
      updatedEnrollments: 0,
      classChanges: 0,
      ignoredDuplicates: 0,
      conflicts: 0,
      notPresentInNewFile: 0,
    };
  }

  private deduplicateRows(rows: ParsedRow[]): ParsedRow[][] {
    const groups: Record<string, ParsedRow[]> = {};
    const noRaGroups: ParsedRow[] = [];
    
    for (const r of rows) {
      if (!r.ra) {
        noRaGroups.push(r);
      } else {
        if (!groups[r.ra]) groups[r.ra] = [];
        groups[r.ra].push(r);
      }
    }
    
    const result = Object.values(groups);
    // Add each NO_RA row as its own group so it can be flagged individually
    for (const noRa of noRaGroups) {
      result.push([noRa]);
    }
    
    return result;
  }

  private async buildCandidates(uid: string, rawRows: ParsedRow[], academicYear: AcademicYear, classGroup: ClassGroup) {
    const groupedRows = this.deduplicateRows(rawRows);
    const candidates: ImportCandidate[] = [];
    const stats = this.emptyStats();

    const activeEnrollments = await this.enrollmentRepo.getActiveByClassGroup(uid, classGroup.id);
    const raSetInFile = new Set(rawRows.filter(r => r.ra).map(r => r.ra!));
    
    let countActiveMissing = 0;
    for (const enr of activeEnrollments) {
       const student = await this.studentRepo.getById(uid, enr.studentId);
       if (student?.externalIds?.ra && !raSetInFile.has(student.externalIds.ra)) {
          countActiveMissing++;
       }
    }
    stats.notPresentInNewFile = countActiveMissing;

    for (const groupRows of groupedRows) {
      // The last row is the canonical current state
      const resolvedRow = groupRows[groupRows.length - 1];
      
      if (!resolvedRow.ra) {
         candidates.push({ rawRow: null, parsed: resolvedRow, action: 'REVIEW_REQUIRED', conflictReason: 'MISSING_STRONG_IDENTIFIER' });
         stats.conflicts++;
         stats.reviewRequiredRows++;
         stats.uniqueStudents++;
         continue;
      }

      if (groupRows.length > 1) {
         stats.historicalDuplicateRows += (groupRows.length - 1);
         
         let hasInternalConflict = false;
         for (let i = 0; i < groupRows.length - 1; i++) {
             const r = groupRows[i];
             if (r.raDigit && resolvedRow.raDigit && r.raDigit !== resolvedRow.raDigit) hasInternalConflict = true;
             if (r.normalizedName && resolvedRow.normalizedName && r.normalizedName !== resolvedRow.normalizedName) hasInternalConflict = true;
         }
         
         if (hasInternalConflict) {
             candidates.push({ rawRow: null, parsed: resolvedRow, action: 'REVIEW_REQUIRED', conflictReason: 'IDENTITY_NAME_CONFLICT' });
             stats.conflicts++;
             stats.reviewRequiredRows++;
             stats.uniqueStudents++;
             continue;
         }
      }

      stats.uniqueStudents++;

      if (resolvedRow.normalizedStatus === 'UNKNOWN') {
        candidates.push({ rawRow: null, parsed: resolvedRow, action: 'REVIEW_REQUIRED', conflictReason: 'UNKNOWN_STATUS' });
        stats.conflicts++;
        stats.reviewRequiredRows++;
        continue;
      }

      if (resolvedRow.normalizedStatus === 'ACTIVE') stats.activeStudents++;
      else stats.nonActiveStudents++;

      const existingStudent = await this.studentRepo.findByExternalId(uid, 'ra', resolvedRow.ra);
      
      if (!existingStudent) {
        candidates.push({ rawRow: null, parsed: resolvedRow, action: 'CREATE_STUDENT' });
        stats.newStudents++;
      } else {
        
        // RA Digit check
        const existingDigit = existingStudent.externalIds?.raDigit;
        if (existingDigit && resolvedRow.raDigit && existingDigit !== resolvedRow.raDigit) {
          candidates.push({ rawRow: null, parsed: resolvedRow, action: 'REVIEW_REQUIRED', conflictReason: 'IDENTITY_CONFLICT', existingStudent });
          stats.conflicts++;
          stats.reviewRequiredRows++;
          continue;
        }

        // Exact Name Check
        if (existingStudent.normalizedName && resolvedRow.normalizedName) {
           const norm1 = existingStudent.normalizedName;
           const norm2 = resolvedRow.normalizedName;
           
           if (norm1 !== norm2) {
              candidates.push({ rawRow: null, parsed: resolvedRow, action: 'REVIEW_REQUIRED', conflictReason: 'IDENTITY_NAME_CONFLICT', existingStudent });
              stats.conflicts++;
              stats.reviewRequiredRows++;
              continue;
           }
        }

        stats.existingStudents++;

        const existingEnrollmentInCG = await this.enrollmentRepo.findByStudentAndClassGroup(uid, existingStudent.id, classGroup.id);
        
        if (existingEnrollmentInCG) {
          if (existingEnrollmentInCG.status === resolvedRow.normalizedStatus && existingEnrollmentInCG.callNumber === (resolvedRow.callNumber ?? null)) {
             candidates.push({ rawRow: null, parsed: resolvedRow, action: 'UNCHANGED', existingStudent, existingEnrollment: existingEnrollmentInCG });
             stats.ignoredDuplicates++;
          } else {
             candidates.push({ rawRow: null, parsed: resolvedRow, action: 'UPDATE_ENROLLMENT', existingStudent, existingEnrollment: existingEnrollmentInCG });
             stats.updatedEnrollments++;
          }
        } else {
          let classChangeFromId: string | undefined;
          const activeInYear = await this.enrollmentRepo.getActiveByStudentAndYear(uid, existingStudent.id, academicYear.id);
          
          if (activeInYear && activeInYear.classGroupId !== classGroup.id && resolvedRow.normalizedStatus === 'ACTIVE') {
             classChangeFromId = activeInYear.classGroupId;
          }

          if (classChangeFromId) {
            candidates.push({ rawRow: null, parsed: resolvedRow, action: 'CLASS_CHANGE', existingStudent, classGroupChange: { fromClassGroupId: classChangeFromId } });
            stats.classChanges++;
          } else {
            candidates.push({ rawRow: null, parsed: resolvedRow, action: 'CREATE_ENROLLMENT', existingStudent });
          }
        }
      }
    }

    return { candidates, stats };
  }

  public async commitImport(uid: string, academicYear: AcademicYear, classGroup: ClassGroup, candidates: ImportCandidate[]): Promise<void> {
    const db = getFirestore(app);
    const batches: any[] = [];
    let currentBatch = writeBatch(db);
    let count = 0;

    const commitAndReset = () => {
      batches.push(currentBatch.commit());
      currentBatch = writeBatch(db);
      count = 0;
    };

    const addOp = () => {
      count++;
      if (count >= 400) commitAndReset();
    };

    for (const cand of candidates) {
      if (cand.action === 'UNCHANGED' || cand.action === 'REVIEW_REQUIRED') continue;

      let studentId = cand.existingStudent?.id;
      
      if (cand.action === 'CREATE_STUDENT') {
        studentId = doc(collection(db, 'users')).id; 
        const studentRef = doc(db, `users/${uid}/students/${studentId}`);
        currentBatch.set(studentRef, {
          id: studentId,
          name: cand.parsed.name,
          normalizedName: cand.parsed.normalizedName,
          externalIds: {
            ra: cand.parsed.ra!,
            raDigit: cand.parsed.raDigit || undefined
          },
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        addOp();
      }

      if (cand.action === 'CREATE_STUDENT' || cand.action === 'CREATE_ENROLLMENT') {
        const enrId = doc(collection(db, 'users')).id;
        const enrRef = doc(db, `users/${uid}/enrollments/${enrId}`);
        currentBatch.set(enrRef, {
          id: enrId,
          studentId,
          classGroupId: classGroup.id,
          academicYearId: academicYear.id,
          callNumber: cand.parsed.callNumber ?? null,
          status: cand.parsed.normalizedStatus,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        addOp();
      }

      if (cand.action === 'UPDATE_ENROLLMENT' && cand.existingEnrollment) {
        const enrRef = doc(db, `users/${uid}/enrollments/${cand.existingEnrollment.id}`);
        currentBatch.update(enrRef, {
          callNumber: cand.parsed.callNumber ?? null,
          status: cand.parsed.normalizedStatus,
          updatedAt: Date.now()
        });
        addOp();
      }

      if (cand.action === 'CLASS_CHANGE' && studentId && cand.classGroupChange) {
        const oldEnr = await this.enrollmentRepo.getActiveByStudentAndYear(uid, studentId, academicYear.id);
        if (oldEnr) {
           const oldRef = doc(db, `users/${uid}/enrollments/${oldEnr.id}`);
           currentBatch.update(oldRef, { status: 'REASSIGNED', updatedAt: Date.now() });
           addOp();
        }
        const newEnrId = doc(collection(db, 'users')).id;
        const newRef = doc(db, `users/${uid}/enrollments/${newEnrId}`);
        currentBatch.set(newRef, {
          id: newEnrId,
          studentId,
          classGroupId: classGroup.id,
          academicYearId: academicYear.id,
          callNumber: cand.parsed.callNumber ?? null,
          status: cand.parsed.normalizedStatus,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        addOp();
      }
    }

    if (count > 0) batches.push(currentBatch.commit());
    await Promise.all(batches);
  }
}
