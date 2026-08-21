import fs from 'fs';

const content = `import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Gamepad2, Users, Save, ChevronLeft, ChevronRight, CalendarDays, Ban } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useAlert } from "../contexts/AlertContext";
import { AcademicRosterService, CanonicalStudentRoster } from "../services/academic/AcademicRosterService";
import { StudentRepository, EnrollmentRepository, AcademicYearRepository, ClassGroupRepository } from "../data/repositories";
import { MatificService, CanonicalMatificWeek, CanonicalMatificWeeklyResult } from "../services/academic/MatificService";
import { AcademicYear, ClassGroup } from "../domain";

export default function CanonicalMatificAnalysisView({ selectedBimestre }: { selectedBimestre: string }) {
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [selectedTurma, setSelectedTurma] = useState<string>("");
  const [academicYearId, setAcademicYearId] = useState<string>("");
  
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [roster, setRoster] = useState<CanonicalStudentRoster[]>([]);
  
  const [weeks, setWeeks] = useState<CanonicalMatificWeek[]>([]);
  const [currentWeekId, setCurrentWeekId] = useState<string>("");
  const [results, setResults] = useState<Record<string, { minutes: number | null; activitiesCompleted: number | null }>>({}); 
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [setupStartDate, setSetupStartDate] = useState("");
  const [setupEndDate, setSetupEndDate] = useState("");

  const rosterService = useRef(new AcademicRosterService(new StudentRepository(), new EnrollmentRepository()));
  const matificService = useRef(new MatificService());
  const yearRepo = useRef(new AcademicYearRepository());
  const classGroupRepo = useRef(new ClassGroupRepository());

  const termId = selectedBimestre || "1º Bimestre";

  useEffect(() => {
    if (user) {
      yearRepo.current.getAll(user.uid).then(years => {
        setAcademicYears(years);
        if (years.length > 0) {
          setAcademicYearId(years[0].id);
        }
      });
    }
  }, [user]);

  useEffect(() => {
    if (user && academicYearId) {
      classGroupRepo.current.getByAcademicYear(user.uid, academicYearId).then(groups => {
        setClassGroups(groups);
      });
    } else {
      setClassGroups([]);
    }
  }, [user, academicYearId]);

  useEffect(() => {
    if (!selectedTurma || !user) return;
    loadRosterAndWeeks();
  }, [selectedTurma, user, termId]);

  const loadRosterAndWeeks = async () => {
    if (!user || !selectedTurma) return;
    setIsLoading(true);
    try {
      const activeRoster = await rosterService.current.getActiveRoster(user.uid, academicYearId, selectedTurma);
      activeRoster.sort((a, b) => {
        if (a.callNumber !== null && b.callNumber !== null) return a.callNumber - b.callNumber;
        if (a.callNumber !== null) return -1;
        if (b.callNumber !== null) return 1;
        return a.name.localeCompare(b.name);
      });
      setRoster(activeRoster);

      const dbWeeks = await matificService.current.getWeeks(user.uid, academicYearId, termId, selectedTurma);
      setWeeks(dbWeeks);
      
      if (dbWeeks.length > 0) {
        setCurrentWeekId(dbWeeks[0].id);
        await loadWeekResults(dbWeeks[0].id);
      } else {
        setCurrentWeekId("");
        setResults({});
      }
    } catch (e: any) {
      console.error(e);
      showAlert("Erro ao carregar dados.", "Erro", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const loadWeekResults = async (weekId: string) => {
    if (!user) return;
    const dbResults = await matificService.current.getResultsForWeek(user.uid, weekId);
    const resMap: Record<string, { minutes: number | null; activitiesCompleted: number | null }> = {};
    dbResults.forEach(r => {
      resMap[r.studentId] = { minutes: r.minutes, activitiesCompleted: r.activitiesCompleted };
    });
    setResults(resMap);
  };

  const handleGenerateWeeks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedTurma || !setupStartDate || !setupEndDate) return;
    setIsLoading(true);
    try {
      const newWeeks = await matificService.current.generateWeeksFromDates(
        user.uid,
        academicYearId,
        termId,
        selectedTurma,
        setupStartDate,
        setupEndDate
      );
      setWeeks(newWeeks);
      if (newWeeks.length > 0) {
        setCurrentWeekId(newWeeks[0].id);
        await loadWeekResults(newWeeks[0].id);
      }
    } catch (e: any) {
      console.error(e);
      showAlert("Erro ao gerar semanas.", "Erro", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveWeek = async () => {
    if (!user || !currentWeekId) return;
    setIsSaving(true);
    try {
      const dataToSave = Object.keys(results).map(studentId => ({
        studentId,
        minutes: results[studentId].minutes,
        activitiesCompleted: results[studentId].activitiesCompleted
      }));
      await matificService.current.saveWeeklyResults(user.uid, currentWeekId, dataToSave);
      showAlert("Semana salva com sucesso!", "Sucesso", "success");
    } catch (e: any) {
      console.error(e);
      showAlert("Erro ao salvar semana.", "Erro", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResultChange = (studentId: string, field: "minutes" | "activitiesCompleted", val: string) => {
    const num = val === "" ? null : parseInt(val, 10);
    setResults(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { minutes: null, activitiesCompleted: null }),
        [field]: num
      }
    }));
  };

  const handleToggleWeekCount = async () => {
    if (!user || !currentWeekId) return;
    const week = weeks.find(w => w.id === currentWeekId);
    if (!week) return;
    try {
      await matificService.current.toggleWeekCountsTowardGoal(user.uid, currentWeekId, !week.countsTowardGoal);
      setWeeks(prev => prev.map(w => w.id === currentWeekId ? { ...w, countsTowardGoal: !w.countsTowardGoal } : w));
    } catch(e) {
      console.error(e);
    }
  };

  const goToWeek = async (weekId: string) => {
    setCurrentWeekId(weekId);
    await loadWeekResults(weekId);
  };

  // --- RENDERING VIEWS ---

  if (!selectedTurma) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8 pt-24 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl shadow-sm">
                <Gamepad2 size={28} />
              </div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                Matific Canônico
              </h1>
            </div>
            <p className="text-slate-500 font-medium">Selecione uma turma do seu Cadastro Acadêmico.</p>
          </div>
          <div className="w-full md:w-64">
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Ano Letivo</label>
            <select
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 font-bold rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
            >
              {academicYears.map(y => (
                <option key={y.id} value={y.id}>{y.year}</option>
              ))}
              {academicYears.length === 0 && <option value="">Sem anos letivos</option>}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classGroups.map(group => (
            <div key={group.id} onClick={() => setSelectedTurma(group.id)} className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group/card">
              <h3 className="font-bold text-slate-800 mb-2 text-xl group-hover/card:text-blue-600 transition-colors">{group.name}</h3>
              <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
                {group.grade && <span>Ano: {group.grade}</span>}
                {group.section && <span>Turma: {group.section}</span>}
              </div>
            </div>
          ))}
          {classGroups.length === 0 && (
            <div className="col-span-full p-8 text-center bg-slate-50 rounded-3xl border border-slate-200 border-dashed">
              <p className="text-slate-500 font-medium">Nenhuma turma encontrada para este ano letivo no Cadastro Acadêmico.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8 pt-24 space-y-6 h-screen flex flex-col">
        <div>
          <button onClick={() => setSelectedTurma("")} className="text-sm font-bold text-slate-400 hover:text-slate-600 mb-4 inline-flex items-center gap-1">
             &larr; Voltar
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl shadow-sm">
              <Gamepad2 size={28} />
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Matific — {classGroups.find(c => c.id === selectedTurma)?.name || selectedTurma}
            </h1>
          </div>
          <p className="text-slate-500 font-medium">
            {termId} • {roster.length} alunos ativos.
          </p>
        </div>

        <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm max-w-xl mx-auto w-full mt-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarDays size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Configurar {termId}</h2>
            <p className="text-sm text-slate-500">Defina a data inicial e final do bimestre para gerar as semanas de acompanhamento do Matific.</p>
          </div>
          <form onSubmit={handleGenerateWeeks} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Data Inicial</label>
                <input type="date" required value={setupStartDate} onChange={e => setSetupStartDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Data Final</label>
                <input type="date" required value={setupEndDate} onChange={e => setSetupEndDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm" />
              </div>
            </div>
            <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
              Gerar Semanas
            </button>
          </form>
        </div>
      </div>
    );
  }

  const currentWeek = weeks.find(w => w.id === currentWeekId);
  const currentWeekIndex = weeks.findIndex(w => w.id === currentWeekId);
  const hasPrev = currentWeekIndex > 0;
  const hasNext = currentWeekIndex < weeks.length - 1;

  // Summaries
  let alunosComLancamento = 0;
  let alunosAtingiramMeta = 0;
  let alunosAbaixoMeta = 0;
  let alunosZero = 0;
  let totalMinutos = 0;
  let totalAtividades = 0;

  if (currentWeek) {
    roster.forEach(student => {
      const res = results[student.studentId];
      if (res && res.minutes !== null) {
        alunosComLancamento++;
        totalMinutos += res.minutes;
        if (res.activitiesCompleted) totalAtividades += res.activitiesCompleted;
        
        if (res.minutes === 0) {
          alunosZero++;
        } else if (res.minutes < currentWeek.targetMinutes) {
          alunosAbaixoMeta++;
        } else {
          alunosAtingiramMeta++;
        }
      }
    });
  }
  
  const getStatusBadge = (minutes: number | null, target: number) => {
    if (minutes === null) return <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">S/ Lanc.</span>;
    if (minutes === 0) return <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-1 rounded-lg">Não fez (0)</span>;
    if (minutes < target) return <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-lg">Abaixo ({minutes})</span>;
    return <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg">Meta ({minutes})</span>;
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 pt-24 space-y-6 h-screen flex flex-col">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <button onClick={() => setSelectedTurma("")} className="text-sm font-bold text-slate-400 hover:text-slate-600 mb-4 inline-flex items-center gap-1">
             &larr; Voltar
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl shadow-sm">
              <Gamepad2 size={28} />
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Matific — {classGroups.find(c => c.id === selectedTurma)?.name || selectedTurma}
            </h1>
          </div>
          <p className="text-slate-500 font-medium">
            {termId} • {roster.length} alunos ativos.
          </p>
        </div>
        
        {currentWeek && (
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button 
              disabled={!hasPrev} 
              onClick={() => goToWeek(weeks[currentWeekIndex - 1].id)}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="px-4 py-1 text-center min-w-[200px]">
              <div className="text-sm font-bold text-slate-800">Semana {currentWeek.weekNumber}</div>
              <div className="text-xs font-bold text-slate-400">
                {currentWeek.startDate.split("-").reverse().slice(0,2).join("/")} a {currentWeek.endDate.split("-").reverse().slice(0,2).join("/")}
              </div>
            </div>
            <button 
              disabled={!hasNext} 
              onClick={() => goToWeek(weeks[currentWeekIndex + 1].id)}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      {currentWeek && (
        <>
          <div className="flex items-center justify-between shrink-0">
             <div className="flex items-center gap-4">
               <div className="text-sm font-bold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                 Meta semanal: <span className="text-blue-600">{currentWeek.targetMinutes} min</span>
               </div>
               <button 
                 onClick={handleToggleWeekCount}
                 className={\`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors \${
                   currentWeek.countsTowardGoal 
                     ? "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100" 
                     : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                 }\`}
               >
                 <Ban size={14} />
                 {currentWeek.countsTowardGoal ? "Não contabilizar semana" : "Semana não contabilizada"}
               </button>
             </div>
             <button 
               onClick={handleSaveWeek}
               disabled={isSaving}
               className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
             >
               {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
               {isSaving ? "Salvando..." : "Salvar Semana"}
             </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 shrink-0">
            <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm text-center">
              <div className="text-xs font-bold text-slate-400 uppercase mb-1">Lançados</div>
              <div className="text-lg font-black text-slate-700">{alunosComLancamento}/{roster.length}</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl shadow-sm text-center">
              <div className="text-xs font-bold text-emerald-600/70 uppercase mb-1">Meta Atingida</div>
              <div className="text-lg font-black text-emerald-700">{alunosAtingiramMeta}</div>
            </div>
            <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl shadow-sm text-center">
              <div className="text-xs font-bold text-amber-600/70 uppercase mb-1">Abaixo Meta</div>
              <div className="text-lg font-black text-amber-700">{alunosAbaixoMeta}</div>
            </div>
            <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl shadow-sm text-center">
              <div className="text-xs font-bold text-rose-600/70 uppercase mb-1">Não fez (0)</div>
              <div className="text-lg font-black text-rose-700">{alunosZero}</div>
            </div>
            <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl shadow-sm text-center">
              <div className="text-xs font-bold text-blue-600/70 uppercase mb-1">Min. Totais</div>
              <div className="text-lg font-black text-blue-700">{totalMinutos}</div>
            </div>
            <div className="bg-purple-50 border border-purple-100 p-3 rounded-xl shadow-sm text-center">
              <div className="text-xs font-bold text-purple-600/70 uppercase mb-1">Ativ. Totais</div>
              <div className="text-lg font-black text-purple-700">{totalAtividades}</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col flex-1 h-0">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 sticky top-0 z-20 shadow-[0_1px_0_0_#f1f5f9]">
                    <th className="p-4 font-bold text-slate-700 text-sm sticky left-0 bg-slate-50 shadow-[1px_0_0_0_#f1f5f9] z-30">Nº | Aluno</th>
                    <th className="p-4 font-bold text-slate-700 text-sm text-center w-32 border-l border-slate-200">Minutos</th>
                    <th className="p-4 font-bold text-slate-700 text-sm text-center w-32 border-l border-slate-200">Atividades</th>
                    <th className="p-4 font-bold text-slate-700 text-sm text-center w-32 border-l border-slate-200">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map(student => {
                    const res = results[student.studentId] || { minutes: null, activitiesCompleted: null };
                    
                    return (
                      <tr key={student.studentId} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-medium text-slate-700 text-sm sticky left-0 bg-white shadow-[1px_0_0_0_#f1f5f9] z-10 truncate">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400 w-5 text-right">{student.callNumber || "-"}</span>
                            {student.name}
                          </div>
                        </td>
                        <td className="p-3 border-l border-slate-50">
                          <input
                            type="number"
                            min="0"
                            value={res.minutes === null ? "" : res.minutes}
                            onChange={e => handleResultChange(student.studentId, "minutes", e.target.value)}
                            className="w-full bg-slate-50 border-b-2 border-slate-200 px-2 py-1.5 text-center font-bold text-sm focus:outline-none focus:bg-white focus:border-blue-400 focus:rounded-t transition-all"
                            placeholder="-"
                          />
                        </td>
                        <td className="p-3 border-l border-slate-50">
                          <input
                            type="number"
                            min="0"
                            value={res.activitiesCompleted === null ? "" : res.activitiesCompleted}
                            onChange={e => handleResultChange(student.studentId, "activitiesCompleted", e.target.value)}
                            className="w-full bg-slate-50 border-b-2 border-slate-200 px-2 py-1.5 text-center font-bold text-sm focus:outline-none focus:bg-white focus:border-purple-400 focus:rounded-t transition-all"
                            placeholder="-"
                          />
                        </td>
                        <td className="p-4 text-center border-l border-slate-50">
                           {getStatusBadge(res.minutes, currentWeek.targetMinutes)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
`;
fs.writeFileSync('src/views/CanonicalMatificAnalysisView.tsx', content);
