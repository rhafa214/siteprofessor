import { DATAS_OFICIAIS } from "../../lib/constants";

export interface AcademicTerm {
  academicYear: number;
  termNumber: string;
  label: string;
  startDate: string;
  endDate: string;
}

export class AcademicTermService {
  getTerms(year: number): AcademicTerm[] {
    const terms: AcademicTerm[] = [];
    const bimestres = DATAS_OFICIAIS.calendario.bimestres as Record<string, string>;
    
    for (const [prefix, range] of Object.entries(bimestres)) {
      const [startStr, endStr] = range.split(" a ");
      
      const formatToYYYYMMDD = (ddmm: string) => {
        const [d, m] = ddmm.split("/");
        return `${year}-${m}-${d}`;
      };

      terms.push({
        academicYear: year,
        termNumber: prefix,
        label: `${prefix} Bimestre`,
        startDate: formatToYYYYMMDD(startStr),
        endDate: formatToYYYYMMDD(endStr)
      });
    }
    return terms;
  }

  getTerm(year: number, termLabel: string): AcademicTerm | null {
    const prefix = termLabel.split(" ")[0]; // "1º Bimestre" -> "1º"
    const terms = this.getTerms(year);
    return terms.find(t => t.termNumber === prefix || t.label === termLabel) || null;
  }
}
