export function extractStudents(importText: string): string[] {
  const rows = importText
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r);
  const extractedNames: string[] = [];

  for (const row of rows) {
    const rowLower = row.toLowerCase();
    
    // Ignorar cabeçalhos
    if (
      rowLower.includes("situação") ||
      rowLower.includes("nº de chamada") ||
      rowLower.includes("r.a.") ||
      rowLower.includes("alunos;") ||
      rowLower.includes("filtros") ||
      rowLower.includes("ano letivo") ||
      rowLower.includes("data") ||
      rowLower.includes("nome do aluno")
    ) {
      continue;
    }

    // Filtrar ignorando alunos que não estão ATIVOS
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

    // Dividir a linha por vírgula, ponto e vírgula, ou tab (padrão SED/Excel)
    const parts = row.split(/[\t;,]/).map((p) => p.trim()).filter((p) => p);
    
    let name = "";

    if (parts.length >= 2) {
      // Procurar o primeiro texto contínuo longo que não seja numérico e não seja "ativo" 
      for (let i = 0; i < parts.length; i++) {
        if (
          parts[i].length > 4 && 
          isNaN(Number(parts[i])) && 
          !parts[i].toLowerCase().includes("ativo") && 
          !parts[i].match(/^[0-9xX\-]+$/) // Evitar falsos positivos como números de RA com X
        ) {
          name = parts[i];
          break;
        }
      }
    } else {
      // Se copiou as colunas todas juntas por erro e não tem tabs
      // Tenta remover os números da frente: ex "12 - João da Silva"
      const match = row.match(/^\d+[\s\-\.\t]+(.+)/);
      name = match ? match[1].trim() : row.trim();
      
      // Limpar "ativo" ou número do RA do final que pode ter grudado
      name = name.replace(/(?:\s+\d[\d\.\-xX\s]+)?(?:\s+ativo)$/i, "").trim(); 
      name = name.replace(/- ativo$/i, "").trim();
    }

    if (name && name.length > 2) {
      if (!extractedNames.includes(name)) { // Evitar duplicações acidentais no mesmo extract
        extractedNames.push(name);
      }
    }
  }

  return extractedNames;
}
