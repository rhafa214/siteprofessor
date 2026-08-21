import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Gamepad2, Plus, Trash2, Users, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { useAlert } from "../contexts/AlertContext";
import { AcademicRosterService, CanonicalStudentRoster } from "../services/academic/AcademicRosterService";
import { StudentRepository, EnrollmentRepository } from "../data/repositories";
import { MatificService, CanonicalMatificImport } from "../services/academic/MatificService";
import { AcademicMatchingService, MatchResult } from "../services/academic/AcademicMatchingService";
import { parseMatificFile, MatificParsedRow } from "../services/academic/MatificFileParser";


export default function CanonicalMatificAnalysisView({ selectedBimestre }: { selectedBimestre: string }) {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const { showAlert } = useAlert();

  const [selectedTurma, setSelectedTurma] = useState<string>("");
  const [academicYearId, setAcademicYearId] = useState<string>("2026"); // Mocked for now, canonical flow usually requires selection

  const [roster, setRoster] = useState<CanonicalStudentRoster[]>([]);
  const [imports, setImports] = useState<CanonicalMatificImport[]>([]);
  const [results, setResults] = useState<Record<string, Record<string, number>>>({}); // [studentId][importId]
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isAddingWeek, setIsAddingWeek] = useState(false);
  const [newWeek, setNewWeek] = useState({ title: "", date: "" });
  
  const rosterService = useRef(new AcademicRosterService(new StudentRepository(), new EnrollmentRepository()));
  const matificService = useRef(new MatificService());
  const matchService = useRef(new AcademicMatchingService());

  // Import flow states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<MatchResult | null>(null);
  const [pendingResults, setPendingResults] = useState<MatificParsedRow[]>([]);
  const [importTitle, setImportTitle] = useState("");
  const [importDate, setImportDate] = useState("");

  const turmasList = [
    "6°A - Orientação de estudos",
    "6°B - Matemática",
    "6°C - Matemática",
    "7°C - Matemática",
    "8°A - Matemática",
    "Itinerário 1° e 2°",
  ];

  // We should actually get academicYear and classGroup from somewhere, but to preserve UI, we'll map selectedTurma to classGroupId
  const classGroupId = selectedTurma; 

  useEffect(() => {
    if (!selectedTurma || !user) return;
    loadCanonicalData();
  }, [selectedTurma, user]);

  const loadCanonicalData = async () => {
    if (!user || !classGroupId) return;
    setIsLoading(true);
    try {
      const activeRoster = await rosterService.current.getActiveRoster(user.uid, academicYearId, classGroupId);
      
      // Sort roster
      activeRoster.sort((a, b) => {
        if (a.callNumber !== null && b.callNumber !== null) return a.callNumber - b.callNumber;
        if (a.callNumber !== null) return -1;
        if (b.callNumber !== null) return 1;
        return a.name.localeCompare(b.name);
      });
      setRoster(activeRoster);

      const dbImports = await matificService.current.getImportsByClassGroup(user.uid, academicYearId, classGroupId);
      setImports(dbImports);

      const dbResults = await matificService.current.getResultsByClassGroup(user.uid, academicYearId, classGroupId);
      const resMap: Record<string, Record<string, number>> = {};
      dbResults.forEach(r => {
        if (!resMap[r.studentId]) resMap[r.studentId] = {};
        resMap[r.studentId][r.importId] = r.minutes;
      });
      setResults(resMap);
    } catch (e: any) {
      console.error(e);
      showAlert("Erro ao carregar dados canônicos.", "Erro", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddWeek = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !classGroupId || !newWeek.title || !newWeek.date) return;
    try {
      setIsSaving(true);
      await matificService.current.createManualImport(user.uid, academicYearId, classGroupId, newWeek.title, newWeek.date);
      setNewWeek({ title: "", date: "" });
      setIsAddingWeek(false);
      await loadCanonicalData();
    } catch (e: any) {
      console.error(e);
      showAlert("Erro ao adicionar semana", "Erro", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const removeWeek = async (id: string) => {
    if (!user) return;
    if (await confirm({ title: "Remover Semana", message: "Tem certeza? Todos os resultados desta semana serão apagados." })) {
      try {
        setIsSaving(true);
        await matificService.current.deleteImport(user.uid, id);
        await loadCanonicalData();
      } catch (e: any) {
        console.error(e);
        showAlert("Erro ao remover semana", "Erro", "error");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleScoreChange = (studentId: string, importId: string, val: string) => {
    let mins: number | null = null;
    if (val.trim() !== "") {
      mins = parseInt(val);
      if (isNaN(mins)) return;
      if (mins < 0) mins = 0;
    }
    
    setResults(prev => {
      const next = { ...prev };
      if (!next[studentId]) next[studentId] = {};
      if (mins === null) {
        delete next[studentId][importId]; // visually remove
      } else {
        next[studentId][importId] = mins;
      }
      return next;
    });
  };

  const handleGradeBlur = async (studentId: string, importId: string, val: string) => {
    if (!user || !classGroupId) return;
    let mins = parseInt(val);
    if (isNaN(mins) || mins < 0) mins = 0;
    try {
      setIsSaving(true);
      await matificService.current.createOrUpdateResult(user.uid, academicYearId, classGroupId, importId, studentId, mins);
    } catch (e) {
      console.error(e);
      showAlert("Erro ao salvar nota", "Erro", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const parsedRows = await parseMatificFile(file);
      const names = parsedRows.map(r => r.rawName);
      const matchRes = matchService.current.matchImportedRecords(names, roster);
      
      setPendingResults(parsedRows);
      setImportPreview(matchRes);
      setImportTitle(`Importação Matific`);
      setImportDate(new Date().toISOString().split('T')[0]);
      setIsImportModalOpen(true);
    } catch (err: any) {
      console.error(err);
      showAlert(err.message || "Erro ao ler arquivo.", "Erro", "error");
    } finally {
      e.target.value = "";
    }
  };

  const confirmImport = async () => {
    if (!user || !importPreview || !classGroupId) return;
    try {
      setIsSaving(true);
      const finalResults: { studentId: string; minutes: number }[] = [];
      
      for (const m of importPreview.matched) {
        const parsed = pendingResults.find(r => r.rawName === m.fileRecord.rawName);
        if (parsed) {
          finalResults.push({ studentId: m.student.studentId, minutes: parsed.minutes });
        }
      }

      await matificService.current.saveImportAndResults(user.uid, {
        academicYearId,
        classGroupId,
        title: importTitle,
        date: importDate
      }, finalResults);

      setIsImportModalOpen(false);
      setImportPreview(null);
      await loadCanonicalData();
      showAlert("Importação concluída com sucesso!", "Sucesso", "success");
    } catch (e: any) {
      console.error(e);
      showAlert("Erro ao salvar importação.", "Erro", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const getEmojiForMinutes = (mins: number | null | undefined) => {
    if (mins === null || mins === undefined) return "➖";
    if (mins >= 30) return "🌟";
    if (mins >= 20) return "👍";
    if (mins > 0) return "🤏";
    return "😴";
  };

  if (!selectedTurma) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8 pt-24 space-y-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl shadow-sm">
            <Gamepad2 size={28} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            Controle Matific
          </h1>
        </div>
        <p className="text-slate-500 font-medium">Selecione uma turma para carregar o roster canônico.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {turmasList.map(turma => (
            <div key={turma} onClick={() => setSelectedTurma(turma)} className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm cursor-pointer hover:shadow-md transition-all">
              <h3 className="font-bold text-slate-800 mb-4">{turma}</h3>
              <p className="text-sm text-slate-500">Abrir turma</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

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
              Matific — {selectedTurma}
            </h1>
          </div>
          <p className="text-slate-500 font-medium">
            {roster.length} alunos ativos.
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col flex-1 h-0">
        <div className="p-4 md:p-6 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3 flex-wrap">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".csv,.txt,.xlsx,.xls" />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-sm shadow-sm transition-colors">
              <Upload size={16} /> Importar Resultados
            </button>
            <button onClick={() => setIsAddingWeek(!isAddingWeek)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white border border-blue-700 rounded-xl font-bold text-sm shadow-sm transition-colors hover:bg-blue-700">
              <Plus size={16} /> Nova Semana
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            {isSaving ? <><Loader2 size={12} className="animate-spin" /> Salvando...</> : <><CheckCircle2 size={12} /> Salvo</>}
          </div>
        </div>

        <AnimatePresence>
          {isAddingWeek && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-b border-blue-100 bg-blue-50/30 overflow-hidden shrink-0">
              <form onSubmit={handleAddWeek} className="p-6">
                <h3 className="font-bold text-blue-900 mb-4">Adicionar Nova Semana Matific</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-blue-800 uppercase tracking-wide mb-1">Título/Período</label>
                    <input type="text" required value={newWeek.title} onChange={e => setNewWeek({ ...newWeek, title: e.target.value })} className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium" placeholder="Ex: 11 a 15 de maio" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 uppercase tracking-wide mb-1">Data Referência</label>
                    <input type="date" required value={newWeek.date} onChange={e => setNewWeek({ ...newWeek, date: e.target.value })} className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setIsAddingWeek(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-blue-100 rounded-xl">Cancelar</button>
                  <button type="submit" className="px-4 py-2 text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-xl flex items-center gap-2"><Plus size={16} /> Adicionar</button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="overflow-auto flex-1 h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : roster.length === 0 ? (
            <div className="p-16 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-700 mb-2">Turma sem alunos ativos</h3>
              <p className="text-slate-500">O cadastro acadêmico canônico não possui alunos ativos nesta turma.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="p-4 font-bold text-slate-700 text-sm sticky left-0 bg-slate-50/95 backdrop-blur z-10 w-64 shadow-[1px_0_0_0_#f1f5f9]">
                    Aluno
                  </th>
                  {imports.map(imp => (
                    <th key={imp.id} className="p-4 font-bold text-slate-700 text-sm text-center min-w-[120px] border-l border-slate-100 group">
                      <div className="flex flex-col items-center">
                        <span className="line-clamp-1">{imp.title}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                            {new Date(imp.date + "T12:00:00").toLocaleDateString("pt-BR")}
                          </span>
                          <button onClick={() => removeWeek(imp.id)} className="text-slate-400 hover:text-red-600 transition-colors p-1 bg-white rounded-md shadow-sm border border-slate-200 opacity-0 group-hover:opacity-100" title="Remover Importação"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    </th>
                  ))}
                  <th className="p-4 font-bold text-slate-700 text-sm text-center border-l border-slate-100 bg-blue-50/50 min-w-[100px]">Média</th>
                </tr>
              </thead>
              <tbody>
                {roster.map(student => {
                  let totalScore = 0;
                  let scoredWeeks = 0;
                  imports.forEach(imp => {
                    const mins = results[student.studentId]?.[imp.id];
                    if (mins !== undefined && mins !== null) {
                      let grade = (mins / 30) * 10;
                      if (grade > 10) grade = 10;
                      totalScore += grade;
                      scoredWeeks += 1;
                    }
                  });
                  const media = scoredWeeks > 0 ? (totalScore / scoredWeeks).toFixed(1) : "-";

                  return (
                    <tr key={student.studentId} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-medium text-slate-700 text-sm sticky left-0 bg-white shadow-[1px_0_0_0_#f1f5f9] z-10 truncate">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 w-5 text-right">{student.callNumber || "-"}</span>
                          {student.name}
                        </div>
                      </td>
                      {imports.map(imp => {
                        const val = results[student.studentId]?.[imp.id];
                        return (
                          <td key={imp.id} className="p-4 border-l border-slate-50">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-lg" title="Status de engajamento">{getEmojiForMinutes(val)}</span>
                              <input
                                type="number"
                                min="0"
                                value={val === null || val === undefined ? "" : val}
                                onChange={e => handleScoreChange(student.studentId, imp.id, e.target.value)}
                                onBlur={e => handleGradeBlur(student.studentId, imp.id, e.target.value)}
                                className={`w-16 bg-transparent border-b-2 px-1 py-1 text-center font-bold text-sm focus:outline-none focus:bg-white focus:rounded focus:shadow-sm transition-all ${val === undefined || val === null || String(val) === "" ? "border-slate-200 text-slate-700" : val >= 30 ? "border-emerald-300 text-emerald-700 bg-emerald-50/50" : val >= 20 ? "border-blue-300 text-blue-700 bg-blue-50/50" : "border-amber-300 text-amber-700 bg-amber-50/50"}`}
                              />
                            </div>
                          </td>
                        );
                      })}
                      <td className="p-4 text-center font-black text-blue-600 border-l border-slate-50 bg-blue-50/30">
                        {media}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isImportModalOpen && importPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pt-20 pb-4 px-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsImportModalOpen(false)}></div>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-full">
              <div className="p-6 border-b border-slate-100 flex items-center gap-4 shrink-0">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center"><Upload size={24} /></div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">MATIFIC — IMPORTAÇÃO</h2>
                  <p className="text-sm font-bold text-slate-500">Ano: {academicYearId} • Turma: {selectedTurma} • {roster.length} ativos</p>
                </div>
              </div>
              <div className="p-6 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Título da Importação</label>
                    <input type="text" value={importTitle} onChange={e => setImportTitle(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Data</label>
                    <input type="date" value={importDate} onChange={e => setImportDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div className="bg-slate-50 p-4 rounded-2xl">
                      <div className="text-2xl font-black text-slate-700">{pendingResults.length}</div>
                      <div className="text-xs font-bold text-slate-500 uppercase">Registros no arquivo</div>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-2xl">
                      <div className="text-2xl font-black text-emerald-600">{importPreview.matched.length}</div>
                      <div className="text-xs font-bold text-emerald-600/70 uppercase">Associados auto</div>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-2xl">
                      <div className="text-2xl font-black text-amber-600">{importPreview.unmatched.filter(u => u.reason === 'AMBIGUOUS_STUDENT_MATCH').length}</div>
                      <div className="text-xs font-bold text-amber-600/70 uppercase">Para revisão</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl">
                      <div className="text-2xl font-black text-slate-500">{importPreview.missingStudents.length}</div>
                      <div className="text-xs font-bold text-slate-400 uppercase">Sem resultado</div>
                    </div>
                  </div>

                  {importPreview.unmatched.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mt-6">
                      <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                        <AlertCircle size={16} /> Não associados ({importPreview.unmatched.length})
                      </h4>
                      <ul className="text-sm text-amber-700 space-y-1 max-h-32 overflow-y-auto">
                        {importPreview.unmatched.map((u, i) => (
                          <li key={i}>• {u.fileRecord.rawName} <span className="opacity-50 text-xs">({u.reason})</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                <button onClick={() => setIsImportModalOpen(false)} className="px-5 py-2.5 text-slate-500 font-bold rounded-xl hover:bg-slate-50 transition-colors text-sm">CANCELAR</button>
                <button onClick={confirmImport} disabled={!importTitle || importPreview.matched.length === 0} className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm">CONFIRMAR IMPORTAÇÃO</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
