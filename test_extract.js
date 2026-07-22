const fs = require('fs');
const input = `Alunos;22/07/2026 14:04

Filtros

Ano Letivo;2026

Nº de chamada;Nome do Aluno;Situação do Aluno
1;ANA GRAZIELY DOS SANTOS OLIVEIRA;Ativo
2;ANA LIVIA TERRA MENEZES;Ativo
3;BRYAN GABRIEL DAMASIO;Ativo
4;DAVI DOS PASSOS OLIVEIRA;Ativo
5;DAVI FERNANDES GABRIEL;Ativo
6;ELIZA VENÂNCIO NUNES;Ativo
7;ENRICO COSTA FABBRI DE ALMEIDA;Ativo
8;GABRIEL ANTONIO CEZAR DOS SANTOS;Remanejamento
9;GABRIEL HENRIQUE MACHADO;Ativo
10;GIOVANNA GROKOSKI MOTA;Ativo
11;ISABELA NUNES ALVES;Ativo
12;ISABELLA BEATRIZ FERREIRA;Transferido
13;JOAO CARLOS SEABRA MONTEIRO;Ativo
14;JOAO PEDRO DA SILVA;Ativo
15;LARISSA CRISTINA DA SILVA SANTOS;Ativo
16;LORENA SOARES DEMETRIO;Ativo
17;LUAN KELVIN DUTRA DE MORAES PEREIRA;Transferido
18;MANUELY ALMEIDA POMAROLI;Ativo
19;MARCELO AUGUSTO FOGACA MACHADO;Ativo
20;MARIA ALICE LOBO MACHADO;Ativo
21;MARIA CLARA DA GUIA CAVALCA;Ativo
22;MARIA EDUARDA MATTOS ASSUNCAO PRESTES;Remanejamento
23;MARIA FERNANDA FOGACA SOARES;Ativo
24;MIGUEL SILVA BUENO;Ativo
25;NICOLAS KAUE PONTES DE MORAES;Ativo
26;NICOLY LORY OLIVEIRA SANTOS;Ativo
27;PABLO HENRIQUE RODRIGUÊS DE SENA;Ativo
28;RAPHAEL ARAVENA MIRANDA DANTAS;Ativo
29;RAPHAELA BEZERRA ARANDA PINHEIRO;Ativo
30;RHUAN SAMUEL DAMAZIO DUARTE;Ativo
31;RYAN MANOEL DOS SANTOS;Ativo
32;SAMUEL CHAGAS PINHEIRO;Ativo
33;SAMUEL HENRIQUE FERREIRA SOARES;Ativo
34;SAMUEL VITOR AMARAL DA SILVA;BAIXA - TRANSFERÊNCIA
35;SOFIA ALVES NOGUEIRA;Ativo
36;THAEME NALESSO;Ativo
37;THIAGO HENRIQUE DOS SANTOS COLHIASSI;Ativo
38;YASMIM GONCALVES PIRES;Transferido
39;MARIA EDUARDA DOMINGUES DOS SANTOS;Ativo
40;MARIA EDUARDA IVO RIBEIRO;Ativo
41;TAMIRIS THEODORO CAETANO;Não Comparecimento
42;LORENA BYANA SOARES DA SILVA;Ativo
`;
const text = input;
const rows = text
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r);
  
  const extractedNames = [];
  
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
      rowLower.includes("data")
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
      rowLower.includes("não comparecimento")
    ) {
      continue;
    }

    // Dividir a linha por vírgula, ponto e vírgula, ou tab (padrão SED/Excel)
    const parts = row.split(/[\t;,]/).map((p) => p.trim()).filter((p) => p);
    
    let name = "";
    if (parts.length >= 2) {
      for (let i = 0; i < parts.length; i++) {
        if (
          parts[i].length > 4 && 
          isNaN(Number(parts[i])) && 
          !parts[i].toLowerCase().includes("ativo") && 
          !parts[i].match(/^[0-9xX\-]+$/)
        ) {
          name = parts[i];
          break;
        }
      }
    } else {
      const match = row.match(/^\d+[\s\-\.\t]+(.+)/);
      name = match ? match[1].trim() : row.trim();
      name = name.replace(/(?:\s+\d[\d\.\-xX\s]+)?(?:\s+ativo)$/i, "").trim(); 
      name = name.replace(/- ativo$/i, "").trim();
    }
    
    if (name && name.length > 2) {
      if (!extractedNames.includes(name)) {
        extractedNames.push(name);
      }
    }
  }
console.log(extractedNames);
