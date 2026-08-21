import fs from "fs";
import path from "path";

const targetFile = path.resolve("./src/views/CanonicalMatificAnalysisView.tsx");
let code = fs.readFileSync(targetFile, "utf8");

// 1. Add AcademicTermService import
if (!code.includes("AcademicTermService")) {
  code = code.replace(
    /import \{ MatificService.*?\n/,
    `$&import { AcademicTermService } from "../services/academic/AcademicTermService";\n`
  );
}

// 2. Add termService ref
if (!code.includes("termService = useRef")) {
  code = code.replace(
    /const matificService = useRef\(new MatificService\(\)\);/,
    `const matificService = useRef(new MatificService());\n  const termService = useRef(new AcademicTermService());`
  );
}

// 3. Replace getBimesterDates
code = code.replace(
  /const getBimesterDates = \(\)[\s\S]*?return \{ startDate, endDate \};\n  \};/,
  `const getTermConfig = () => {
    const selectedYear = years.find(y => y.id === selectedYearId);
    const yearNumber = selectedYear ? selectedYear.year : 2026;
    return termService.current.getTerm(yearNumber, selectedBimestre);
  };`
);

// 4. Update the generateWeeks function to use getTermConfig
code = code.replace(
  /const \{ startDate, endDate \} = getBimesterDates\(\);/g,
  `const term = getTermConfig();\n    if (!term) return;\n    const { startDate, endDate } = term;`
);

// 5. Update summary variables in week view
code = code.replace(
  /let alunosLancados = 0;\n[\s\S]*?const mediaMinutosStr = .*?;/,
  `let alunosLancados = 0;
  let metaAtingida = 0;
  let abaixoMeta = 0;
  let alunosZero = 0;
  let totalMinutos = 0;
  let totalAtividades = 0;

  if (weeks.length > 0) {
    const currentWeek = weeks[currentWeekIndex];
    roster.forEach(student => {
      const res = results[student.studentId];
      if (res && res.minutes !== null) {
        alunosLancados++;
        totalMinutos += res.minutes;
        if (res.minutes >= currentWeek.targetMinutes) metaAtingida++;
        else if (res.minutes > 0) abaixoMeta++;
        else if (res.minutes === 0) alunosZero++;
  
        if (res.activitiesCompleted) {
          totalAtividades += res.activitiesCompleted;
        }
      }
    });
  }

  const mediaMinutosStr = alunosLancados > 0 ? String(Math.round(totalMinutos / alunosLancados)) : "—";`
);

// 6. Update bimester table calculation
code = code.replace(
  /\{roster\.map\(student => \{[\s\S]*?return \(\n\s*<tr key=\{student\.studentId\}/,
  `{roster.map(student => {
  let plannedWeeks = 0;
  let launchedWeeks = 0;
  let zeroWeeks = 0;
  let belowTargetWeeks = 0;
  let targetReachedWeeks = 0;
  let totalMinutes = 0;
  let expectedMinutes = 0;
  let totalActivities = 0;

  weeks.forEach(w => {
    if (w.countsTowardGoal) {
      plannedWeeks++;
      
      const sRes = termResults.find(r => r.weekId === w.id && r.studentId === student.studentId);
      if (sRes && sRes.minutes !== null) {
        launchedWeeks++;
        expectedMinutes += w.targetMinutes; // ONLY ADD TO EXPECTED IF LAUNCHED
        totalMinutes += sRes.minutes;
        
        if (sRes.minutes === 0) zeroWeeks++;
        else if (sRes.minutes < w.targetMinutes) belowTargetWeeks++;
        else targetReachedWeeks++;
        
        if (sRes.activitiesCompleted) totalActivities += sRes.activitiesCompleted;
      }
    }
  });

  const missingWeeks = plannedWeeks - launchedWeeks;
  const percent = expectedMinutes > 0 ? Math.round((totalMinutes / expectedMinutes) * 100) : 0;

  return (
    <tr key={student.studentId}`
);

// 7. Update table headers
code = code.replace(
  /<th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-200">Total Minutos<\/th>\n\s*<th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-200">% Meta<\/th>/,
  `<th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-200">Previstas</th>
                    <th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-200">Lançadas</th>
                    <th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-200">Sem Lanç.</th>
                    <th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-200">Zeros</th>
                    <th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-200">Meta Atingida</th>
                    <th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-200">Minutos / Meta</th>
                    <th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-200">% Meta</th>`
);

// 8. Update table row cells
code = code.replace(
  /<td className="p-4 text-center text-sm font-bold text-slate-600 border-l border-slate-50">\{weeks\.filter\(w => w\.countsTowardGoal\)\.length\}<\/td>\n\s*<td className="p-4 text-center text-sm font-bold text-slate-600 border-l border-slate-50">\{totalActivities\}<\/td>\n\s*<td className="p-4 text-center text-sm font-bold text-slate-600 border-l border-slate-50">\{totalMinutes\} \/ \{expectedMins\}<\/td>[\s\S]*?<\/td>/,
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

// Fix generation button subtitle
code = code.replace(
  /const \{ startDate, endDate \} = getBimesterDates\(\);/g,
  `const term = getTermConfig();
    const startDate = term?.startDate;
    const endDate = term?.endDate;`
);

fs.writeFileSync(targetFile, code, "utf8");
console.log("CanonicalMatificAnalysisView patched");
