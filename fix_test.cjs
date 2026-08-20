const fs = require('fs');
let content = fs.readFileSync('scripts/testAcademicImporter.ts', 'utf8');
content = content.replace(/\/\/ append test[\s\S]*/g, '');
content = content.replace(/console\.log\("All tests passed successfully\."\);\n\}/g, `
  // Test N: "Não comparecido" parsing and counting
  const dataN = [
    ["Nº de chamada", "Nome do Aluno", "RA", "Dig. RA", "Situação do Aluno"],
    ["1", "ALUNO N1", "00N1", "1", "Não comparecido"],
    ["2", "ALUNO N2", "00N2", "2", "NÃO COMPARECIDO"],
    ["3", "ALUNO N3", "00N3", "3", "nao comparecido"],
    ["4", "ALUNO N4", "00N4", "4", "Não   Comparecido"],
    ["5", "ALUNO N5", "00N5", "5", "Ativo"],
    ["5", "ALUNO N5", "00N5", "5", "Não comparecido"],
    ["6", "ALUNO N6", "00N6", "6", "Não comparecido"], 
    ["6", "ALUNO N6", "00N6", "6", "Ativo"],
    ["7", "ALUNO N7", "00N7", "7", "BatataFrita"]
  ];

  const extrN = extractFromAoA(dataN);
  const { candidates: candN, stats: statsN } = await (service as any).buildCandidates('uid', extrN.parsedRows, ay, cg);
  
  if (candN.find(c => c.parsed.ra === '00N1')?.parsed.normalizedStatus !== 'INACTIVE') throw new Error("Test N1 failed");
  if (candN.find(c => c.parsed.ra === '00N2')?.parsed.normalizedStatus !== 'INACTIVE') throw new Error("Test N2 failed");
  if (candN.find(c => c.parsed.ra === '00N3')?.parsed.normalizedStatus !== 'INACTIVE') throw new Error("Test N3 failed");
  if (candN.find(c => c.parsed.ra === '00N4')?.parsed.normalizedStatus !== 'INACTIVE') throw new Error("Test N4 failed");
  if (candN.find(c => c.parsed.ra === '00N5')?.parsed.normalizedStatus !== 'INACTIVE') throw new Error("Test N5 failed");
  if (candN.find(c => c.parsed.ra === '00N6')?.parsed.normalizedStatus !== 'ACTIVE') throw new Error("Test N6 failed");
  if (candN.find(c => c.parsed.ra === '00N7')?.conflictReason !== 'UNKNOWN_STATUS') throw new Error("Test N7 failed");

  console.log("All tests passed successfully.");
}
runTests().catch(console.error);
`);
fs.writeFileSync('scripts/testAcademicImporter.ts', content);
