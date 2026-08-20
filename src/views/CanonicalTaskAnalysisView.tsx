import React, { useState, useEffect, useRef } from "react";
import { AcademicYear, ClassGroup } from "../domain";
import { AcademicYearRepository, ClassGroupRepository, StudentRepository, EnrollmentRepository } from "../data/repositories";
import { AcademicRosterService, CanonicalStudentRoster } from "../services/academic/AcademicRosterService";
import { TaskAnalysisService, CanonicalTaskAssessment, CanonicalTaskResult } from "../services/academic/TaskAnalysisService";
import { TaskAnalysisMatchingService, MatchResult } from "../services/academic/TaskAnalysisMatchingService";
import { useAuth } from "../contexts/AuthContext";
import { useAlert } from "../contexts/AlertContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { Loader2, Plus, Users, ClipboardCheck, Trash2, ChevronRight, Upload, X, Save, AlertCircle } from "lucide-react";
import { extractTextFromFile } from "../lib/fileExtraction";
import { extractStudents } from "../studentExtractor";
import { motion, AnimatePresence } from "motion/react";

export default function CanonicalTaskAnalysisView({
  selectedBimestre,
}: {
  selectedBimestre: string;
}) {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { confirm } = useConfirm();

  // Repositories & Services
  const yearRepo = useRef(new AcademicYearRepository());
  const classRepo = useRef(new ClassGroupRepository());
  const rosterService = useRef(new AcademicRosterService(new StudentRepository(), new EnrollmentRepository()));
  const taskService = useRef(new TaskAnalysisService());
  const matchService = useRef(new TaskAnalysisMatchingService());

  // State
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  
  const [roster, setRoster] = useState<CanonicalStudentRoster[]>([]);
  const [tasks, setTasks] = useState<CanonicalTaskAssessment[]>([]);
  const [results, setResults] = useState<Record<string, Record<string, number | null>>>({}); // studentId -> assessmentId -> score
  
  const [isLoading, setIsLoading] = useState(true);
  const [isClassLoading, setIsClassLoading] = useState(false);

  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", maxScore: 10, date: new Date().toISOString().split("T")[0] });

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const loadYears = async () => {
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
      setTasks([]);
      setResults({});
      return;
    }
    const loadData = async () => {
      setIsClassLoading(true);
      try {
        const r = await rosterService.current.getActiveRoster(user.uid, selectedYearId, selectedClassId);
        setRoster(r);
        
        const t = await taskService.current.getAssessments(user.uid, selectedYearId, selectedClassId);
        setTasks(t);

        const newResults: Record<string, Record<string, number | null>> = {};
        for (const task of t) {
          const res = await taskService.current.getResultsForAssessment(user.uid, task.id);
          for (const rx of res) {
            if (!newResults[rx.studentId]) newResults[rx.studentId] = {};
            newResults[rx.studentId][task.id] = rx.score;
          }
        }
        setResults(newResults);
      } catch (e) {
        console.error(e);
      } finally {
        setIsClassLoading(false);
      }
    };
    loadData();
  }, [selectedClassId, user, selectedBimestre]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim() || !user || !selectedYearId || !selectedClassId) return;

    const task: CanonicalTaskAssessment = {
      id: `tk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      academicYearId: selectedYearId,
      classGroupId: selectedClassId,
      title: newTask.title,
      maxScore: newTask.maxScore,
      date: newTask.date,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await taskService.current.saveAssessment(user.uid, task);
    setTasks([...tasks, task]);
    setIsAddingTask(false);
    setNewTask({ title: "", maxScore: 10, date: new Date().toISOString().split("T")[0] });
  };

  const removeTask = async (id: string) => {
    if (await confirm({ title: "Remover Tarefa", message: "Tem certeza? Todas as notas serão apagadas.", isDestructive: true })) {
      if (user) {
        await taskService.current.deleteAssessment(user.uid, id);
        setTasks(tasks.filter(t => t.id !== id));
      }
    }
  };

  const handleGradeChange = (studentId: string, taskId: string, value: string) => {
    const val = value.replace(",", ".");
    const num = parseFloat(val);
    const newScore = isNaN(num) ? null : num;

    setResults(prev => {
      const p = { ...prev };
      if (!p[studentId]) p[studentId] = {};
      p[studentId][taskId] = newScore;
      return p;
    });
  };

  const saveGrade = async (studentId: string, taskId: string, score: number | null) => {
    if (!user) return;
    const result: CanonicalTaskResult = {
      id: `res_${studentId}_${taskId}`,
      assessmentId: taskId,
      studentId: studentId,
      score: score,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const validIds = new Set(roster.map(s => s.studentId));
    await taskService.current.saveResult(user.uid, result, validIds);
  };

  const handleGradeBlur = (e: React.FocusEvent<HTMLInputElement>, studentId: string, taskId: string) => {
    const val = results[studentId]?.[taskId];
    saveGrade(studentId, taskId, val !== undefined ? val : null);
  };

  // -- Import Logic --
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await extractTextFromFile(file);
      if (text) {
        setImportText(text);
        processImportText(text);
      }
    } catch (err: any) {
      console.error(err);
      showAlert("Erro ao ler arquivo.", "Erro", "error");
    } finally {
      e.target.value = "";
    }
  };

  const processImportText = (text: string) => {
    const extractedNames = extractStudents(text);
    const match = matchService.current.matchImportedRecords(extractedNames, roster);
    setMatchResult(match);
  };

  const confirmImport = async () => {
    if (!matchResult || !user || !selectedYearId || !selectedClassId) return;
    
    const task: CanonicalTaskAssessment = {
      id: `tk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      academicYearId: selectedYearId,
      classGroupId: selectedClassId,
      title: `Importação ${new Date().toLocaleDateString()}`,
      maxScore: 10,
      date: new Date().toISOString().split("T")[0],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await taskService.current.saveAssessment(user.uid, task);
    setTasks([...tasks, task]);

    const newRes = { ...results };
    for (const match of matchResult.matched) {
      const studentId = match.student.studentId;
      const res: CanonicalTaskResult = {
        id: `res_${studentId}_${task.id}`,
        assessmentId: task.id,
        studentId: studentId,
        score: task.maxScore, // Assign max score by default for completed activity
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      const validIds = new Set(roster.map(s => s.studentId));
      await taskService.current.saveResult(user.uid, res, validIds);
      
      if (!newRes[studentId]) newRes[studentId] = {};
      newRes[studentId][task.id] = task.maxScore;
    }
    
    setResults(newRes);
    setIsImportModalOpen(false);
    setMatchResult(null);
    setImportText("");
    showAlert("Resultados importados com sucesso!", "Sucesso", "success");
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>;

  return (
    <div className="flex flex-col h-full bg-slate-50/50 relative">
      {/* Top Bar for selection */}
      <div className="p-4 bg-white border-b border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-end mt-12">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase">Ano Letivo</label>
          <select 
            value={selectedYearId} 
            onChange={e => setSelectedYearId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500"
          >
            {years.map(y => <option key={y.id} value={y.id}>{y.year}</option>)}
          </select>
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase">Turma</label>
          <select 
            value={selectedClassId} 
            onChange={e => setSelectedClassId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500"
            disabled={!selectedYearId}
          >
            <option value="">Selecione uma turma...</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {selectedClassId && (
          <div className="flex-1 flex flex-col md:flex-row items-center justify-between bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 gap-4">
            <div className="flex items-center gap-2 text-emerald-700 font-bold whitespace-nowrap">
              <Users size={18} />
              <span>{roster.length} alunos ativos</span>
            </div>
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors whitespace-nowrap"
            >
              IMPORTAR / ANALISAR ATIVIDADE
            </button>
          </div>
        )}
      </div>

      {isClassLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-emerald-500 w-8 h-8" />
        </div>
      ) : selectedClassId && roster.length > 0 ? (
        <div className="p-4 flex-1 overflow-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr>
                    <th className="p-4 border-b border-slate-100 bg-slate-50/80 font-bold text-slate-500 w-12 sticky left-0 z-20">Nº</th>
                    <th className="p-4 border-b border-slate-100 bg-slate-50/80 font-bold text-slate-500 sticky left-[48px] z-20">Nome do Aluno</th>
                    {tasks.map(task => (
                      <th key={task.id} className="p-4 border-b border-l border-slate-100 bg-slate-50/80 font-bold text-slate-700 text-center relative group min-w-[120px]">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs uppercase tracking-wider text-slate-400">{new Date(task.date).toLocaleDateString()}</span>
                          <span className="truncate max-w-full px-2" title={task.title}>{task.title}</span>
                          <span className="text-xs text-indigo-500">Max: {task.maxScore}</span>
                        </div>
                        <button onClick={() => removeTask(task.id)} className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                      </th>
                    ))}
                    <th className="p-4 border-b border-l border-slate-100 bg-slate-50/80 w-[200px]">
                      <button onClick={() => setIsAddingTask(true)} className="flex items-center justify-center gap-2 w-full py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-sm font-bold transition-colors">
                        <Plus size={16} /> Nova Tarefa
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isAddingTask && (
                    <tr className="bg-indigo-50/30">
                      <td colSpan={tasks.length + 3} className="p-0">
                        <form onSubmit={handleAddTask} className="p-4 flex flex-wrap items-end gap-4">
                          <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-bold text-indigo-800 uppercase mb-1">Título</label>
                            <input type="text" required value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} className="w-full border-indigo-200 rounded-xl px-3 py-1.5 text-sm" placeholder="Título" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-indigo-800 uppercase mb-1">Max Pontos</label>
                            <input type="number" required value={newTask.maxScore} onChange={e => setNewTask({...newTask, maxScore: Number(e.target.value)})} className="w-24 border-indigo-200 rounded-xl px-3 py-1.5 text-sm" min="0" step="0.1" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-indigo-800 uppercase mb-1">Data</label>
                            <input type="date" required value={newTask.date} onChange={e => setNewTask({...newTask, date: e.target.value})} className="border-indigo-200 rounded-xl px-3 py-1.5 text-sm" />
                          </div>
                          <div className="flex gap-2">
                            <button type="submit" className="px-4 py-1.5 bg-indigo-600 text-white font-bold rounded-xl text-sm">Salvar</button>
                            <button type="button" onClick={() => setIsAddingTask(false)} className="px-4 py-1.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-sm">Cancelar</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                  {roster.map((student, idx) => (
                    <tr key={student.studentId} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                      <td className="p-4 text-sm text-slate-400 font-mono text-center sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[1px_0_0_#e2e8f0]">
                        {student.callNumber !== null ? student.callNumber : '--'}
                      </td>
                      <td className="p-4 text-sm font-bold text-slate-700 truncate max-w-[200px] sticky left-[48px] bg-white group-hover:bg-slate-50 z-10 shadow-[1px_0_0_#e2e8f0]">
                        {student.name}
                      </td>
                      {tasks.map(task => {
                        const val = results[student.studentId]?.[task.id];
                        return (
                          <td key={task.id} className="p-3 border-l border-slate-100 align-top">
                            <input
                              type="number"
                              min="0"
                              max={task.maxScore}
                              step="0.1"
                              value={val === null || val === undefined ? "" : val}
                              onChange={e => handleGradeChange(student.studentId, task.id, e.target.value)}
                              onBlur={e => handleGradeBlur(e, student.studentId, task.id)}
                              className="w-full bg-transparent border-b-2 px-2 py-1 text-center font-bold text-sm focus:outline-none focus:bg-white focus:rounded focus:shadow-sm transition-all border-dashed border-slate-200 text-slate-700 focus:border-indigo-500"
                              placeholder="--"
                            />
                          </td>
                        );
                      })}
                      <td className="border-l border-slate-100 bg-slate-50/30"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : selectedClassId ? (
         <div className="p-8 text-center text-slate-500">Nenhum aluno ativo nesta turma.</div>
      ) : (
         <div className="p-8 text-center text-slate-500">Selecione uma turma para começar.</div>
      )}

      {/* IMPORT MODAL */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pt-20 pb-4 px-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsImportModalOpen(false)}></div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-w-xl w-full relative z-10 flex flex-col max-h-[90vh] overflow-hidden"
            >
              <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2 shrink-0">Importar Atividade</h2>
              
              {!matchResult ? (
                <>
                  <p className="text-slate-500 mb-6 font-medium leading-relaxed shrink-0">
                    Cole uma lista de nomes de alunos que completaram a atividade ou envie um arquivo.
                  </p>
                  <div className="flex-1 overflow-auto min-h-[200px] mb-6">
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder="Ex:&#10;João da Silva&#10;Maria Aparecida"
                      className="w-full h-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                    <div className="w-full sm:w-auto">
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".csv,.txt,.pdf,.docx" />
                      <button onClick={() => fileInputRef.current?.click()} className="w-full sm:w-auto px-5 py-2.5 bg-slate-50 text-slate-700 font-bold rounded-xl hover:bg-slate-100 flex items-center justify-center gap-2 border border-slate-200 text-sm">
                        <Upload size={16} /> Upload Arquivo
                      </button>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button onClick={() => setIsImportModalOpen(false)} className="w-full sm:w-auto px-4 py-2.5 text-slate-500 font-bold rounded-xl hover:bg-slate-100 text-sm">Cancelar</button>
                      <button onClick={() => processImportText(importText)} disabled={!importText.trim()} className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 text-sm">
                        Analisar
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 overflow-auto flex flex-col h-full">
                  <div className="mb-6 space-y-3">
                    <div className="flex justify-between p-3 bg-emerald-50 text-emerald-800 rounded-xl text-sm font-bold">
                      <span>Associados automaticamente:</span>
                      <span>{matchResult.matched.length}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-red-50 text-red-800 rounded-xl text-sm font-bold">
                      <span>Para revisão (Não encontrados / Ambíguos):</span>
                      <span>{matchResult.unmatched.length}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-slate-50 text-slate-600 rounded-xl text-sm font-bold">
                      <span>Sem resultado na turma:</span>
                      <span>{matchResult.missingStudents.length}</span>
                    </div>
                  </div>

                  {matchResult.unmatched.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-bold text-red-800 mb-2 flex items-center gap-2"><AlertCircle size={16} /> Precisam de revisão</h3>
                      <div className="bg-red-50 border border-red-100 rounded-xl divide-y divide-red-100">
                        {matchResult.unmatched.map((u, i) => (
                          <div key={i} className="p-3 text-sm text-red-700 font-medium flex justify-between items-center">
                            <span>{u.fileRecord.rawName}</span>
                            <span className="text-xs bg-red-100 px-2 py-1 rounded font-bold">
                              {u.reason === 'UNMATCHED_STUDENT' ? 'Não encontrado' : 'Ambíguo'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-auto pt-4 flex gap-2 justify-end shrink-0 border-t border-slate-100">
                    <button onClick={() => setMatchResult(null)} className="px-4 py-2 text-slate-500 font-bold rounded-xl hover:bg-slate-100 text-sm">Voltar</button>
                    <button onClick={confirmImport} className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2 text-sm shadow-sm">
                      <Save size={16} /> Gravar Resultados
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
