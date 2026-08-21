import fs from "fs";
import path from "path";

const targetFile = path.resolve("./src/views/CanonicalMatificAnalysisView.tsx");
let code = fs.readFileSync(targetFile, "utf8");

code = code.replace(
  /<td className="p-4 text-center text-sm font-bold text-slate-600 border-l border-slate-50">\{countedWeeksCount\}<\/td>[\s\S]*?<td className="p-4 text-center text-sm font-bold text-purple-600 border-l border-slate-50">\{totalActs\}<\/td>/,
  `<td className="p-4 text-center text-sm font-bold text-slate-600 border-l border-slate-50">{plannedWeeks}</td>
      <td className="p-4 text-center text-sm font-bold text-slate-600 border-l border-slate-50">{launchedWeeks}</td>
      <td className="p-4 text-center text-sm font-bold text-slate-400 border-l border-slate-50">{missingWeeks}</td>
      <td className="p-4 text-center text-sm font-bold text-rose-600 border-l border-slate-50">{zeroWeeks}</td>
      <td className="p-4 text-center text-sm font-bold text-emerald-600 border-l border-slate-50">{targetReachedWeeks}</td>
      <td className="p-4 text-center text-sm font-bold text-slate-600 border-l border-slate-50">{totalMinutes} / {expectedMinutes}</td>
      <td className="p-4 text-center border-l border-slate-50">
        <span className={\`px-2 py-1 rounded-lg text-xs font-bold \${percent >= 100 ? "bg-emerald-100 text-emerald-700" : percent >= 75 ? "bg-blue-100 text-blue-700" : percent >= 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}\`}>
          {percent}%
        </span>
      </td>`
);

// We need to also patch the headers for the second table to match these columns!
// Let's find the headers of the second table.
code = code.replace(
  /<th className="p-4 font-bold text-slate-700 text-sm sticky left-0 bg-slate-50 shadow-\[1px_0_0_0_#f1f5f9\] z-30">Nº \| Aluno<\/th>\n\s*<th className="p-4 font-bold text-slate-700 text-sm text-center w-32 border-l border-slate-200">Semanas Contabilizadas<\/th>[\s\S]*?<th className="p-4 font-bold text-slate-700 text-sm text-center w-32 border-l border-slate-200">Total Atividades<\/th>/,
  `<th className="p-4 font-bold text-slate-700 text-sm sticky left-0 bg-slate-50 shadow-[1px_0_0_0_#f1f5f9] z-30">Nº | Aluno</th>
                        <th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-200">Previstas</th>
                        <th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-200">Lançadas</th>
                        <th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-200">Sem Lanç.</th>
                        <th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-200">Zeros</th>
                        <th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-200">Meta Atingida</th>
                        <th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-200">Minutos / Meta</th>
                        <th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-200">% Meta</th>`
);

fs.writeFileSync(targetFile, code, "utf8");
