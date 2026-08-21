import { extractTextFromFile } from "../../lib/fileExtraction";

export interface MatificParsedRow {
  rawName: string;
  minutes: number;
}

export async function parseMatificFile(file: File): Promise<MatificParsedRow[]> {
  const text = await extractTextFromFile(file);
  const rows = text.split("\n").map(r => r.trim()).filter(r => r);
  const results: MatificParsedRow[] = [];
  
  for (const row of rows) {
    const rowLower = row.toLowerCase();
    if (
      rowLower.includes("situação") ||
      rowLower.includes("nº de chamada") ||
      rowLower.includes("r.a.") ||
      rowLower.includes("alunos;") ||
      rowLower.includes("filtros") ||
      rowLower.includes("ano letivo") ||
      rowLower.includes("nome") ||
      rowLower.includes("minutos") ||
      rowLower.includes("tempo")
    ) {
      continue;
    }

    if (
      rowLower.includes("transferido") ||
      rowLower.includes("transferência") ||
      rowLower.includes("remanejado") ||
      rowLower.includes("remanejamento") ||
      rowLower.includes("abandono") ||
      rowLower.includes("inativo") ||
      rowLower.includes("falecido") ||
      rowLower.includes("não comparecimento") ||
      rowLower.includes("baixa")
    ) {
      continue;
    }

    const parts = row.split(/[\t;,]/).map(p => p.trim()).filter(p => p);
    
    let name = "";
    let minutes: number | null = null;
    
    for (const part of parts) {
      const num = Number(part.replace(/,/g, '.')); // handle brazilian decimal? well minutes is usually int
      if (!isNaN(num) && part !== "" && !part.match(/^[0-9xX\-]{5,}$/)) { // avoid RA
        if (minutes === null) minutes = Math.round(num);
      } else if (part.length > 2 && isNaN(Number(part)) && !part.toLowerCase().includes("ativo")) {
        if (!name) name = part;
      }
    }
    
    if (!name) {
      const match = row.match(/^\d+[\s\-\.\t]+(.+)/);
      name = match ? match[1].trim() : row.trim();
      name = name.replace(/(?:\s+\d[\d\.\-xX\s]+)?(?:\s+ativo)$/i, "").trim(); 
      name = name.replace(/- ativo$/i, "").trim();
    }
    
    if (name && name.length > 2 && minutes !== null) {
      results.push({ rawName: name, minutes });
    }
  }
  
  return results;
}
