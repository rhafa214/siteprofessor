export type ViewType = 'dashboard' | 'diario' | 'agenda' | 'arquivos' | 'plano' | 'tarefas';

export const DATAS_OFICIAIS = {
  provas: [
    { nome: "Prova Paulista - 1º Bim", data: "2026-04-13" },
    { nome: "Prova Paulista - 2º Bim", data: "2026-06-15" },
    { nome: "Prova Paulista - 3º Bim", data: "2026-09-21" },
    { nome: "SARESP", data: "2026-11-03" }
  ],
  recesso: "2026-07-07"
};

export function getHolidays(year: number): Record<string, string> {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  const pascoa = new Date(year, month - 1, day);
  const sSanta = new Date(pascoa); sSanta.setDate(pascoa.getDate() - 2);
  const carnVal = new Date(pascoa); carnVal.setDate(pascoa.getDate() - 47);
  const corpVal = new Date(pascoa); corpVal.setDate(pascoa.getDate() + 60);
  
  return { 
    "0-1": "Ano Novo", 
    "3-1": "Aniversário 🎂", 
    [`${carnVal.getMonth()}-${carnVal.getDate()}`]: "Carnaval", 
    [`${sSanta.getMonth()}-${sSanta.getDate()}`]: "Sexta Santa", 
    "3-21": "Tiradentes", 
    "4-1": "Trabalho", 
    [`${corpVal.getMonth()}-${corpVal.getDate()}`]: "Corpus Christi", 
    "8-7": "Independência", 
    "8-29": "Padroeiro ⛪", 
    "11-25": "Natal" 
  };
}

export function getSmartPhrase(): string {
  const now = new Date(); 
  const feriados = getHolidays(now.getFullYear()); 
  const hojeK = `${now.getMonth()}-${now.getDate()}`;
  
  if (feriados[hojeK]) return `HOJE É FERIADO! (${feriados[hojeK]}) 🌴`;
  
  let vindo = null, dias = 0;
  for (let i = 1; i <= 5; i++) {
      let c = new Date(now); c.setDate(now.getDate() + i); let k = `${c.getMonth()}-${c.getDate()}`;
      if (feriados[k]) { vindo = feriados[k]; dias = i; break; }
  }
  
  const r = (a: string[]) => a[Math.floor(Math.random() * a.length)];
  if (vindo) return dias === 1 ? r([`Amanhã você tem um respiro! 🙌`, `Amanhã é folga! 🏖️`]) : r([`Essa semana é mais curta! ✨`, `Faltam ${dias} dias para o feriado! 🚀`]);
  
  const p: Record<number, string[]> = { 
    1: ["Segunda... Calma! ☕", "Boa semana, Professor!"], 
    5: ["S E X T O U ! 🎉 Finalmente!", "Último esforço da semana!"], 
    2: ["Terça-feira!", "Foco total na aula!"], 
    3: ["Quarta: o topo da montanha!", "Metade do caminho!"], 
    4: ["Quinta! Quase lá.", "A semana passou voando!"] 
  };
  return r(p[now.getDay()] || ["Boa aula, Professor!"]);
}
