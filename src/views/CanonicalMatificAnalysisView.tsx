import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Save, Ban, Calendar, CheckCircle2 } from "lucide-react";
import { AcademicYear, ClassGroup } from "../domain";
import { AcademicYearRepository, ClassGroupRepository, StudentRepository, EnrollmentRepository } from "../data/repositories";
import { AcademicRosterService, CanonicalStudentRoster } from "../services/academic/AcademicRosterService";
import { MatificService, CanonicalMatificWeek, CanonicalMatificWeeklyResult } from "../services/academic/MatificService";
import { AcademicTermService } from "../services/academic/AcademicTermService";
import { DATAS_OFICIAIS } from "../lib/constants";
import { useAuth } from "../contexts/AuthContext";

interface Props {
  selectedBimestre: string;
}

export default function CanonicalMatificAnalysisView({ selectedBimestre }: Props) {
  const { user } = useAuth();

  const yearRepo = useRef(new AcademicYearRepository());
  const classRepo = useRef(new ClassGroupRepository());
  const rosterService = useRef(new AcademicRosterService(new StudentRepository(), new EnrollmentRepository()));
  const matificService = useRef(new MatificService());
  const termService = useRef(new AcademicTermService());

  const [isLoading, setIsLoading] = useState(true);
  const [isClassLoading, setIsClassLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  const [roster, setRoster] = useState<CanonicalStudentRoster[]>([]);
  const [weeks, setWeeks] = useState<CanonicalMatificWeek[]>([]);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  
  const [results, setResults] = useState<Record<string, { minutes: number | null, activitiesCompleted: number | null }>>({});
  const [termResults, setTermResults] = useState<CanonicalMatificWeeklyResult[]>([]);
  
  const [viewMode, setViewMode] = useState<"weekly" | "bimester">("weekly");
  const [lastSavedMark, setLastSavedMark] = useState<number>(Date.now());

  useEffect(() => {
    if (!user) return;
    const loadYears = async () => {
      setIsLoading(true);
      try {
        const y = await yearRepo.current.getAll(user.uid);
        setYears(y.sort((a, b) => b.year - a.year));
        if (y.length > 0) setSelectedYearId(y[0].id);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    loadYears();
  }, [user]);

  useEffect(() => {
    if (!user || !selectedYearId) {
      setClasses([]);
      setSelectedClassId("");
      return;
    }
    const loadClasses = async () => {
      try {
        const c = await classRepo.current.getByAcademicYear(user.uid, selectedYearId);
        setClasses(c.sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedClassId("");
        setRoster([]);
      } catch (e) {
        console.error(e);
      }
    };
    loadClasses();
  }, [selectedYearId, user]);

  useEffect(() => {
    if (!user || !selectedYearId || !selectedClassId) {
      setRoster([]);
      setWeeks([]);
      setResults({});
      setTermResults([]);
      return;
    }
    loadData();
  }, [selectedYearId, selectedClassId, selectedBimestre, user]);

  const getBimesterPrefix = () => {
    return selectedBimestre.split(" ")[0];
  };

  const getBimesterDates = () => {
    const prefix = getBimesterPrefix();
    const range = (DATAS_OFICIAIS.calendario.bimestres as any)[prefix];
    if (!range) return null;
    const [startStr, endStr] = range.split(" a ");
    
    // Attempt to extract year from AcademicYear entity, default to 2026
    const selectedYear = years.find(y => y.id === selectedYearId);
    const yearStr = selectedYear ? selectedYear.year.toString() : "2026";
    
    const formatToYYYYMMDD = (ddmm: string) => {
      const [d, m] = ddmm.split("/");
      return `${yearStr}-${m}-${d}`;
    };

    return {
      label: range,
      startDate: formatToYYYYMMDD(startStr),
      endDate: formatToYYYYMMDD(endStr)
    };
  };

  const loadData = async () => {
    if (!user || !selectedYearId || !selectedClassId) return;
    
    setIsClassLoading(true);
    try {
      const activeRoster = await rosterService.current.getActiveRoster(
        user.uid,
        selectedYearId,
        selectedClassId
      );
      activeRoster.sort((a, b) => {
        const numA = a.callNumber || 999;
        const numB = b.callNumber || 999;
        return numA - numB;
      });
      setRoster(activeRoster);

      const existingWeeks = await matificService.current.getWeeks(
        user.uid, 
        selectedYearId, 
        selectedBimestre, 
        selectedClassId
      );
      
      existingWeeks.sort((a, b) => a.weekNumber - b.weekNumber);
      setWeeks(existingWeeks);
      
      if (existingWeeks.length > 0) {
        setCurrentWeekIndex(0);
        await loadResultsForWeek(existingWeeks[0].id);
        
        const allTermRes = await matificService.current.getAllResultsForTerm(
          user.uid,
          selectedYearId,
          selectedBimestre,
          selectedClassId
        );
        setTermResults(allTermRes);
      } else {
        setResults({});
        setTermResults([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsClassLoading(false);
    }
  };

  const loadResultsForWeek = async (weekId: string) => {
    if (!user) return;
    try {
      const res = await matificService.current.getResultsForWeek(user.uid, weekId);
      const newResultsState: Record<string, { minutes: number | null, activitiesCompleted: number | null }> = {};
      res.forEach(r => {
        newResultsState[r.studentId] = {
          minutes: r.minutes,
          activitiesCompleted: r.activitiesCompleted
        };
      });
      setResults(newResultsState);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (weeks.length > 0 && currentWeekIndex >= 0 && currentWeekIndex < weeks.length) {
      loadResultsForWeek(weeks[currentWeekIndex].id);
    }
  }, [currentWeekIndex, lastSavedMark]);

  const handleGenerateWeeks = async () => {
    if (!user || !selectedYearId || !selectedClassId) return;
    const dates = getBimesterDates();
    if (!dates) return;

    setIsClassLoading(true);
    try {
      await matificService.current.generateWeeksFromDates(
        user.uid,
        selectedYearId,
        selectedBimestre,
        selectedClassId,
        dates.startDate,
        dates.endDate
      );
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsClassLoading(false);
    }
  };

  const handleResultChange = (studentId: string, field: "minutes" | "activitiesCompleted", value: string) => {
    setResults(prev => {
      const current = prev[studentId] || { minutes: null, activitiesCompleted: null };
      const parsed = value === "" ? null : parseInt(value, 10);
      return {
        ...prev,
        [studentId]: {
          ...current,
          [field]: parsed
        }
      };
    });
  };

  const handleSaveWeek = async () => {
    if (!user || weeks.length === 0) return;
    const currentWeek = weeks[currentWeekIndex];
    if (!currentWeek) return;

    setIsSaving(true);
    try {
      const resultsArray: CanonicalMatificWeeklyResult[] = roster.map(student => {
        const r = results[student.studentId] || { minutes: null, activitiesCompleted: null };
        return {
          id: "", 
          uid: user.uid,
          weekId: currentWeek.id,
          studentId: student.studentId,
          minutes: r.minutes,
          activitiesCompleted: r.activitiesCompleted,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      });

      await matificService.current.saveWeeklyResults(user.uid, currentWeek.id, resultsArray);
      
      const allTermRes = await matificService.current.getAllResultsForTerm(
        user.uid,
        selectedYearId,
        selectedBimestre,
        selectedClassId
      );
      setTermResults(allTermRes);
      
      setLastSavedMark(Date.now());
      alert("Semana salva com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar semana.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleWeekCounting = async () => {
    if (!user || weeks.length === 0) return;
    const currentWeek = weeks[currentWeekIndex];
    setIsSaving(true);
    try {
      const updatedValue = !currentWeek.countsTowardGoal;
      await matificService.current.updateWeekStatus(user.uid, currentWeek.id, updatedValue);
      setWeeks(prev => {
        const nw = [...prev];
        nw[currentWeekIndex].countsTowardGoal = updatedValue;
        return nw;
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center text-slate-500 h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
        Carregando dados...
      </div>
    );
  }

  const bimesterDates = getBimesterDates();

  // Weekly Summary calculations
  let alunosLancados = 0;
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

  const mediaMinutos = alunosLancados > 0 ? Math.round(totalMinutos / alunosLancados) : 0;

  const formatDate = (ds: string) => {
    const [y, m, d] = ds.split("-");
    return `${d}/${m}`;
  };

  const getStatusBadge = (minutes: number | null, target: number) => {
    if (minutes === null) return <span className="text-slate-400 font-bold text-xs bg-slate-100 px-2 py-1 rounded-lg">S/ Lanc.</span>;
    if (minutes === 0) return <span className="text-rose-700 font-bold text-xs bg-rose-100 px-2 py-1 rounded-lg">Não fez (0)</span>;
    if (minutes >= target) return <span className="text-emerald-700 font-bold text-xs bg-emerald-100 px-2 py-1 rounded-lg">Meta ({minutes})</span>;
    return <span className="text-amber-700 font-bold text-xs bg-amber-100 px-2 py-1 rounded-lg">Abaixo ({minutes})</span>;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-6">
      
      {/* HEADER CONTROLS (Year & Class Selection) */}
      <div className="flex items-center gap-4 mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
          <Calendar className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-black text-slate-800 leading-tight">Matific Canônico</h2>
          <div className="text-xs font-bold text-slate-400">{selectedBimestre}</div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="w-48">
            <select 
              value={selectedYearId} 
              onChange={e => setSelectedYearId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="">Selecione o Ano...</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.year}</option>)}
            </select>
          </div>
          <div className="w-56">
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
              disabled={!selectedYearId}
            >
              <option value="">Selecione uma turma...</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {(!selectedYearId || !selectedClassId) && (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8 text-slate-300" />
          </div>
          <p className="font-medium">Selecione o ano letivo e a turma para visualizar os lançamentos do Matific.</p>
        </div>
      )}

      {selectedYearId && selectedClassId && isClassLoading && (
        <div className="flex-1 flex items-center justify-center text-slate-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
          Carregando dados da turma...
        </div>
      )}

      {selectedYearId && selectedClassId && !isClassLoading && weeks.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-sm border border-slate-200 text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              Nenhuma Semana Gerada
            </h3>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              As semanas letivas do <strong>{selectedBimestre}</strong> ainda não foram configuradas.
              O calendário pedagógico oficial estipula este período entre <strong>{bimesterDates?.label || "datas não encontradas"}</strong>.
            </p>
            
            <button
              onClick={handleGenerateWeeks}
              disabled={!bimesterDates || isClassLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              Gerar Semanas Automaticamente
            </button>
          </div>
        </div>
      )}

      {selectedYearId && selectedClassId && !isClassLoading && weeks.length > 0 && (
        <>
          <div className="flex items-center justify-end mb-4 bg-slate-100 p-1 rounded-xl self-end">
            <button
              onClick={() => setViewMode("weekly")}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === "weekly" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Semanas
            </button>
            <button
              onClick={() => setViewMode("bimester")}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === "bimester" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Resumo do Bimestre
            </button>
          </div>

          {viewMode === "weekly" && (
            <>
              <div className="flex items-center justify-between mb-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center">
                  <button 
                    onClick={() => setCurrentWeekIndex(Math.max(0, currentWeekIndex - 1))}
                    disabled={currentWeekIndex === 0}
                    className="p-3 text-slate-400 hover:text-blue-600 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  
                  <div className="text-center min-w-[220px]">
                    <div className="text-sm font-black text-slate-800">
                      Semana {weeks[currentWeekIndex].weekNumber}
                      {!weeks[currentWeekIndex].countsTowardGoal && (
                        <span className="ml-2 text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full uppercase">Não Contabilizada</span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-400">
                      {formatDate(weeks[currentWeekIndex].startDate)} a {formatDate(weeks[currentWeekIndex].endDate)} • Meta: {weeks[currentWeekIndex].targetMinutes} min
                    </div>
                  </div>

                  <button 
                    onClick={() => setCurrentWeekIndex(Math.min(weeks.length - 1, currentWeekIndex + 1))}
                    disabled={currentWeekIndex === weeks.length - 1}
                    className="p-3 text-slate-400 hover:text-blue-600 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex items-center gap-2 pr-2">
                  <button
                    onClick={toggleWeekCounting}
                    disabled={isSaving}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${weeks[currentWeekIndex].countsTowardGoal ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-rose-100 text-rose-700 hover:bg-rose-200"}`}
                    title="Semanas não contabilizadas não entram no somatório de metas do bimestre"
                  >
                    <Ban className="w-4 h-4" />
                    {weeks[currentWeekIndex].countsTowardGoal ? "Não contabilizar" : "Semana ignorada"}
                  </button>
                  <button
                    onClick={handleSaveWeek}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? "Salvando..." : "Salvar Semana"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-4">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl shadow-sm text-center">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Lançados</div>
                  <div className="text-lg font-black text-slate-800">{alunosLancados} <span className="text-sm font-bold text-slate-400">/ {roster.length}</span></div>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl shadow-sm text-center">
                  <div className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-wide mb-1">Meta Atingida</div>
                  <div className="text-lg font-black text-emerald-700">{metaAtingida}</div>
                </div>
                <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl shadow-sm text-center">
                  <div className="text-[10px] font-bold text-amber-600/70 uppercase tracking-wide mb-1">Abaixo Meta</div>
                  <div className="text-lg font-black text-amber-700">{abaixoMeta}</div>
                </div>
                <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl shadow-sm text-center">
                  <div className="text-[10px] font-bold text-rose-600/70 uppercase tracking-wide mb-1">Zero (Não fez)</div>
                  <div className="text-lg font-black text-rose-700">{alunosZero}</div>
                </div>
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl shadow-sm text-center">
                  <div className="text-[10px] font-bold text-blue-600/70 uppercase tracking-wide mb-1">Min. Totais</div>
                  <div className="text-lg font-black text-blue-700">{totalMinutos}</div>
                </div>
                <div className="bg-cyan-50 border border-cyan-100 p-3 rounded-xl shadow-sm text-center">
                  <div className="text-[10px] font-bold text-cyan-600/70 uppercase tracking-wide mb-1">Média (min)</div>
                  <div className="text-lg font-black text-cyan-700">{mediaMinutos}</div>
                </div>
                <div className="bg-purple-50 border border-purple-100 p-3 rounded-xl shadow-sm text-center">
                  <div className="text-[10px] font-bold text-purple-600/70 uppercase tracking-wide mb-1">Ativ. Totais</div>
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
                               {getStatusBadge(res.minutes, weeks[currentWeekIndex].targetMinutes)}
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
          
          {viewMode === "bimester" && (
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col flex-1 h-0">
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 sticky top-0 z-20 shadow-[0_1px_0_0_#f1f5f9]">
                      <th className="p-4 font-bold text-slate-700 text-sm sticky left-0 bg-slate-50 shadow-[1px_0_0_0_#f1f5f9] z-30">Nº | Aluno</th>
                      <th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-200">Semanas Contabilizadas</th>
                      <th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-200">Meta Atingida</th>
                      <th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-200">Minutos / Meta</th>
                      <th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-200">% Meta</th>
                      <th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-200">Atividades Totais</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map(student => {
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
    <tr key={student.studentId} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-medium text-slate-700 text-sm sticky left-0 bg-white shadow-[1px_0_0_0_#f1f5f9] z-10 truncate">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-400 w-5 text-right">{student.callNumber || "-"}</span>
                              {student.name}
                            </div>
                          </td>
                          <td className="p-4 text-center text-sm font-bold text-slate-600 border-l border-slate-50">{plannedWeeks}</td>
      <td className="p-4 text-center text-sm font-bold text-slate-600 border-l border-slate-50">{launchedWeeks}</td>
      <td className="p-4 text-center text-sm font-bold text-slate-400 border-l border-slate-50">{missingWeeks}</td>
      <td className="p-4 text-center text-sm font-bold text-rose-600 border-l border-slate-50">{zeroWeeks}</td>
      <td className="p-4 text-center text-sm font-bold text-emerald-600 border-l border-slate-50">{targetReachedWeeks}</td>
      <td className="p-4 text-center text-sm font-bold text-slate-600 border-l border-slate-50">{totalMinutes} / {expectedMinutes}</td>
      <td className="p-4 text-center border-l border-slate-50">
        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${percent >= 100 ? "bg-emerald-100 text-emerald-700" : percent >= 75 ? "bg-blue-100 text-blue-700" : percent >= 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
          {percent}%
        </span>
      </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
