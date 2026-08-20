import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { ParsedRow, SheetOption } from './AcademicImporterTypes';

export function normalizeString(str: string): string {
  if (!str) return '';
  return str.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ');
}

export function parseStatus(status: string): ParsedRow['normalizedStatus'] {
  const s = normalizeString(status);
  if (s.includes('ativo') && !s.includes('inativo')) return 'ACTIVE';
  if (s.includes('transferido') || s.includes('transferencia')) return 'TRANSFERRED';
  if (s.includes('remanejamento') || s.includes('remanejado')) return 'REASSIGNED';
  if (s.includes('inativo') || s.includes('nao comparecido')) return 'INACTIVE';
  return 'UNKNOWN';
}

function extractRA(raString: string): string {
  if (raString === undefined || raString === null) return '';
  return String(raString).trim();
}

function mapRowToParsed(row: any, headerMap: Record<string, number>): ParsedRow | 'BLANK' | 'MISSING_RA' {
  // Check if completely blank row
  const hasAnyValue = row.some((v: any) => v !== undefined && v !== null && String(v).trim() !== '');
  if (!hasAnyValue) return 'BLANK';

  const raVal = row[headerMap['ra']];
  const raStr = extractRA(raVal);
  
  const raDigitVal = row[headerMap['raDigit']];
  const raDigitStr = raDigitVal !== undefined && raDigitVal !== null && String(raDigitVal).trim() !== '' ? String(raDigitVal).trim() : null;
  
  const nameVal = row[headerMap['name']];
  const nameStr = nameVal !== undefined && nameVal !== null ? String(nameVal).trim() : '';
  
  const statusVal = row[headerMap['status']];
  const statusStr = statusVal !== undefined && statusVal !== null ? String(statusVal).trim() : '';

  let callNumber: number | null = null;
  if (headerMap['callNumber'] !== undefined) {
    const callNumberVal = row[headerMap['callNumber']];
    if (callNumberVal !== undefined && callNumberVal !== null && String(callNumberVal).trim() !== '') {
      const parsedNum = parseInt(String(callNumberVal).trim(), 10);
      if (!isNaN(parsedNum)) {
        callNumber = parsedNum;
      }
    }
  }

  // If RA is missing but there is some data (name or status)
  if (!raStr && (nameStr || statusStr)) {
    return {
      callNumber,
      name: nameStr,
      normalizedName: normalizeString(nameStr),
      ra: null,
      raDigit: raDigitStr,
      status: statusStr,
      normalizedStatus: parseStatus(statusStr)
    };
  }

  // If no RA and no meaningful data, treat as blank
  if (!raStr) return 'BLANK';

  return {
    callNumber,
    name: nameStr,
    normalizedName: normalizeString(nameStr),
    ra: raStr,
    raDigit: raDigitStr,
    status: statusStr,
    normalizedStatus: parseStatus(statusStr)
  };
}

export async function parseFileToSheets(file: File): Promise<SheetOption[]> {
  return new Promise((resolve, reject) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'csv') {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: false, // We'll handle blanks ourselves to ensure counts
        complete: (results) => {
          resolve([{ name: 'CSV', data: results.data as any[][] }]);
        },
        error: (err) => {
          reject(err);
        }
      });
    } else if (extension === 'xls' || extension === 'xlsx') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        if (!data) {
          reject(new Error("Failed to read file"));
          return;
        }
        try {
          const workbook = XLSX.read(data, { type: 'array' });
          const sheets: SheetOption[] = [];
          
          for (const name of workbook.SheetNames) {
            const sheet = workbook.Sheets[name];
            const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
            sheets.push({ name, data: aoa });
          }
          
          resolve(sheets);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    } else {
      reject(new Error("Formato de arquivo não suportado."));
    }
  });
}

function checkCompatibility(aoa: any[][]) {
  let yearFound: number | undefined;
  let headerRowIndex = -1;
  const headerMap: Record<string, number> = {};
  
  for (let i = 0; i < Math.min(aoa.length, 30); i++) {
    const row = aoa[i];
    if (!row || !Array.isArray(row)) continue;
    
    const rowText = row.join(' ').toLowerCase();
    
    // detect year
    if (rowText.includes('ano letivo')) {
       for (const cell of row) {
         if (typeof cell === 'string' && cell.toLowerCase().includes('ano letivo')) {
             const m = cell.match(/20\d{2}/);
             if (m) yearFound = parseInt(m[0], 10);
         } else if (typeof cell === 'number' && cell >= 2000 && cell <= 2100) {
             yearFound = cell;
         } else if (typeof cell === 'string') {
             const m = cell.match(/20\d{2}/);
             if (m) yearFound = parseInt(m[0], 10);
         }
       }
    }

    const cellNorms = row.map(c => normalizeString(String(c)));
    
    const hasCall = cellNorms.findIndex(c => c === 'nº de chamada' || c === 'n° de chamada' || c.includes('chamada') || c === 'no' || c === 'nº');
    const hasName = cellNorms.findIndex(c => c === 'nome do aluno' || c === 'nome' || c === 'aluno');
    const hasRa = cellNorms.findIndex(c => c === 'ra' || c === 'r.a.' || c === 'r.a');
    const hasRaDigit = cellNorms.findIndex(c => c.includes('dig. ra') || c.includes('digito') || c.includes('dig ra'));
    const hasStatus = cellNorms.findIndex(c => c.includes('situacao') || c.includes('situação') || c.includes('status'));

    // ONLY compatible if REQUIRED headers are found
    if (hasName !== -1 && hasRa !== -1 && hasStatus !== -1) {
      headerRowIndex = i;
      if (hasCall !== -1) headerMap['callNumber'] = hasCall;
      headerMap['name'] = hasName;
      headerMap['ra'] = hasRa;
      if (hasRaDigit !== -1) headerMap['raDigit'] = hasRaDigit;
      headerMap['status'] = hasStatus;
      break;
    }
  }

  return { isCompatible: headerRowIndex !== -1, headerRowIndex, headerMap, yearFound };
}

export function filterCompatibleSheets(sheets: SheetOption[]): { compatible: SheetOption[], errors: string[] } {
  const compatible = sheets.filter(s => checkCompatibility(s.data).isCompatible);
  if (compatible.length === 0) {
    return { compatible: [], errors: ["Cabeçalho oficial não encontrado. O arquivo deve conter colunas para Nome, RA e Situação."] };
  }
  return { compatible, errors: [] };
}

export function extractFromAoA(aoa: any[][]): { yearFound?: number; parsedRows: ParsedRow[], ignoredBlankRows: number, warnings: string[], errors: string[] } {
  const { isCompatible, headerRowIndex, headerMap, yearFound } = checkCompatibility(aoa);

  if (!isCompatible) {
    return { errors: ["Cabeçalho oficial não encontrado."], parsedRows: [], ignoredBlankRows: 0, warnings: [] };
  }

  const warnings: string[] = [];
  if (headerMap['callNumber'] === undefined) warnings.push("Arquivo sem Nº de chamada.");
  if (headerMap['raDigit'] === undefined) warnings.push("Arquivo sem Dígito RA.");

  const parsedRows: ParsedRow[] = [];
  let ignoredBlankRows = 0;
  
  for (let i = headerRowIndex + 1; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row || !Array.isArray(row) || row.length === 0) {
      ignoredBlankRows++;
      continue;
    }
    
    const parsed = mapRowToParsed(row, headerMap);
    if (parsed === 'BLANK') {
      ignoredBlankRows++;
    } else if (parsed === 'MISSING_RA') {
      // This case is now handled by returning the object with ra = null
    } else {
      parsedRows.push(parsed);
    }
  }
  
  return { yearFound, parsedRows, ignoredBlankRows, warnings, errors: [] };
}
