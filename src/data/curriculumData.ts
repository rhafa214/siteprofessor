export interface CurriculumItem {
  ano: number;
  bimestre: number;
  aula: number | string;
  titulo: string;
  conteudo: string[];
  objetivos: string[];
  habilidades: string[];
  aprendizagem: string;
}

export const curriculumData: CurriculumItem[] = [
  {
    ano: 6,
    bimestre: 1,
    aula: 1,
    titulo: "Os números naturais em situações do cotidiano",
    conteudo: [
      "Leitura, representação, identificação e utilização de números naturais."
    ],
    objetivos: [
      "Reconhecer o sistema de numeração decimal, como o que prevaleceu no mundo ocidental.",
      "Reconhecer características do sistema de numeração decimal (base, valor posicional e função do zero).",
      "Ler e representar números naturais de até 6 ordens, em registros numéricos, em língua materna.",
      "Identificar a utilização dos números em situações do cotidiano.",
      "Ler e interpretar informações em diferentes tipos de gráficos (linhas ou colunas)."
    ],
    habilidades: ["EF06MA01", "EF06MA02"],
    aprendizagem: "AE1 - Compor e decompor números naturais de diferentes ordens, reconhecendo as características do sistema de numeração decimal."
  },
  {
    ano: 6,
    bimestre: 1,
    aula: 2,
    titulo: "Estratégias de composição e decomposição de números naturais – Parte 1",
    conteudo: [
      "Leitura, escrita, composição e decomposição de números naturais (ordens e classes)."
    ],
    objetivos: [
      "Reconhecer características do sistema de numeração decimal (base, valor posicional e função do zero).",
      "Ler, escrever, compor e decompor números de 6 ordens ou mais (por meio de adições).",
      "Identificar a utilização desses números em situações do cotidiano.",
      "Ler e interpretar informações em diferentes tipos de gráficos (linhas ou colunas)."
    ],
    habilidades: ["EF06MA01", "EF06MA02"],
    aprendizagem: "AE1 - Compor e decompor números naturais de diferentes ordens..."
  },
  {
    ano: 6,
    bimestre: 1,
    aula: 3,
    titulo: "Estratégias de composição e decomposição de números naturais – Parte 2",
    conteudo: [
      "Leitura, escrita, composição e decomposição de números naturais (ordens e classes)."
    ],
    objetivos: [
      "Ler, escrever, compor e decompor números de 6 ordens ou mais (por meio de adições e multiplicações de potências de 10)."
    ],
    habilidades: ["EF06MA01", "EF06MA02"],
    aprendizagem: "AE1 - Compor e decompor números naturais de diferentes ordens..."
  },
  {
    ano: 6,
    bimestre: 1,
    aula: 4,
    titulo: "Resolução de problemas envolvendo o sistema de numeração decimal – Parte 1",
    conteudo: [
      "Resolução de problemas do mundo real envolvendo leitura, escrita, composição e decomposição de números naturais."
    ],
    objetivos: [
      "Resolver problemas envolvendo leitura, escrita, composição e decomposição de números de 6 ordens ou mais."
    ],
    habilidades: ["EF06MA01", "EF06MA02"],
    aprendizagem: "AE1 - Compor e decompor números naturais de diferentes ordens..."
  },
  {
    ano: 6,
    bimestre: 2,
    aula: 1,
    titulo: "Frações como resultado de uma divisão",
    conteudo: [
      "Interpretação de frações em situações do cotidiano.",
      "Representação de frações como resultado de uma divisão entre dois números naturais."
    ],
    objetivos: [
      "Compreender uma fração como resultado de uma divisão."
    ],
    habilidades: ["EF05MA03"],
    aprendizagem: "AE5 - Resolver problemas envolvendo cálculo da fração de uma quantidade..."
  },
  {
    ano: 7,
    bimestre: 1,
    aula: 1,
    titulo: "Resolução de problemas envolvendo adição e subtração com números naturais",
    conteudo: [
      "Adição e subtração com números naturais.",
      "Reta numérica."
    ],
    objetivos: [
      "Compreender procedimentos de cálculo mental e escrito envolvendo adição e subtração.",
      "Resolver problemas envolvendo adição e subtração por meio de estratégias pessoais diversas."
    ],
    habilidades: ["EF07MA01"],
    aprendizagem: "AE1 - Resolver problemas que envolvam múltiplos e divisores de números naturais, em contextos reais."
  },
  {
    ano: 7,
    bimestre: 2,
    aula: 1,
    titulo: "Relações entre frações e números decimais",
    conteudo: [
      "Reconhecimento de frações como resultado de uma divisão entre dois números naturais.",
      "Relação entre frações e números decimais."
    ],
    objetivos: [
      "Reconhecer que os números racionais positivos podem ser expressos nas formas fracionária e decimal."
    ],
    habilidades: ["EF06MA08", "EF07MA10"],
    aprendizagem: "AE6 - Resolver problemas envolvendo as quatro operações fundamentais com números racionais nas formas fracionária e decimal..."
  }
];
