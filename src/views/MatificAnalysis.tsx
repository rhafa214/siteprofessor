import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Loader2,
  Gamepad2,
  Plus,
  Trash2,
  Users,
  Save,
  Upload,
  CheckCircle2,
  ChevronRight,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  Maximize,
  Minimize,
} from "lucide-react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { collection, doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { useAlert } from "../contexts/AlertContext";
import { extractTextFromFile } from "../lib/fileExtraction";

interface Student {
  id: string;
  name: string;
}

interface WeekAssessment {
  id: string;
  title: string;
  date: string;
}

interface ClassData {
  students: Student[];
  weeks: WeekAssessment[];
  minutes: Record<string, Record<string, number | null>>; // minutes[studentId][weekId] = minutes used
}

const defaultClassData: ClassData = { students: [], weeks: [], minutes: {} };

export default function MatificAnalysis({ selectedBimestre }: { selectedBimestre: string }) {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const { showAlert } = useAlert();
  const [turmasList, setTurmasList] = useLocalStorage<string[]>(
    "classTurmasList",
    [
      "6°A - Orientação de estudos",
      "6°B - Matemática",
      "6°C - Matemática",
      "7°C - Matemática",
      "8°A - Matemática",
      "Itinerário 1° e 2°",
    ],
  );
  const [selectedTurma, setSelectedTurma] = useState<string | null>(null);
  const [classData, setClassData] = useState<ClassData>(defaultClassData);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [studentMode, setStudentMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!selectedTurma) return;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const bKey = selectedBimestre.replace("º Bimestre", "");
        if (user) {
          const docRef = doc(db, "users", user.uid, "matificAnalysis", `${bKey}_${selectedTurma}`);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            setClassData(snap.data() as ClassData);
          } else if (bKey === "2") {
            const oldRef = doc(db, "users", user.uid, "matificAnalysis", selectedTurma);
            const oldSnap = await getDoc(oldRef);
            if (oldSnap.exists()) {
              setClassData(oldSnap.data() as ClassData);
            } else {
              const localData = localStorage.getItem(`matificAnalysis_${bKey}_${selectedTurma}`) || localStorage.getItem(`matificAnalysis_${selectedTurma}`);
              setClassData(localData ? JSON.parse(localData) : defaultClassData);
            }
          } else {
            const localData = localStorage.getItem(`matificAnalysis_${bKey}_${selectedTurma}`);
            setClassData(localData ? JSON.parse(localData) : defaultClassData);
          }
        } else {
          let localData = localStorage.getItem(`matificAnalysis_${bKey}_${selectedTurma}`);
          if (!localData && bKey === "2") {
             localData = localStorage.getItem(`matificAnalysis_${selectedTurma}`);
          }
          setClassData(localData ? JSON.parse(localData) : defaultClassData);
        }
      } catch (e) {
        console.error("Error loading matific data", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [selectedTurma, user]);

  const saveClassData = async (newData: ClassData) => {
    setClassData(newData);
    const bKey = selectedBimestre.replace("º Bimestre", "");
    try {
      if (user) {
        setIsSaving(true);
        await setDoc(doc(db, "users", user.uid, "matificAnalysis", `${bKey}_${selectedTurma!}`), newData);
        setIsSaving(false);
      }
      localStorage.setItem(`matificAnalysis_${bKey}_${selectedTurma}`, JSON.stringify(newData));
    } catch (e) {
      console.error("Error saving matific data", e);
      setIsSaving(false);
    }
  };

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [studentNamesInput, setStudentNamesInput] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const syncStudentsWithDatabase = async () => {
    if (!user || !selectedTurma) {
      showAlert("Você precisa estar logado para sincronizar com o banco em nuvem.", "Aviso", "warning");
      return;
    }
    
    try {
      setIsSyncing(true);
      const bKey = selectedBimestre.replace("º Bimestre", "");
      const snap = await getDoc(doc(db, "users", user.uid, "taskAnalysis", `${bKey}_${selectedTurma}`));
      if (snap.exists()) {
        const td = snap.data();
        if (td && td.students && Array.isArray(td.students)) {
           const existingIds = new Set(classData.students.map(s => s.id));
           const existingNames = new Set(classData.students.map(s => s.name.toLowerCase()));
           
           const newStudents = [...classData.students];
           const newMinutes = { ...classData.minutes };
           let added = 0;

           for (const st of td.students) {
             if (!existingNames.has(st.name.toLowerCase()) && !existingIds.has(st.id)) {
               newStudents.push({ id: st.id, name: st.name });
               newMinutes[st.id] = {};
               added++;
             } else if (existingIds.has(st.id)) {
               // Update name just in case
               const ext = newStudents.find(s => s.id === st.id);
               if (ext) ext.name = st.name;
             }
           }

           newStudents.sort((a, b) => a.name.localeCompare(b.name));
           
           if (added > 0) {
             saveClassData({ ...classData, students: newStudents, minutes: newMinutes });
             showAlert(`Sincronização concluída! ${added} novo(s) aluno(s) puxado(s) do banco de dados.`, "Sucesso", "success");
           } else {
             showAlert("Sincronização concluída! Todos os alunos do banco já estão na lista.", "Aviso", "info");
           }
        } else {
          showAlert("Nenhum aluno encontrado no banco de dados para esta turma (ou a turma não está no banco).", "Aviso", "warning");
        }
      } else {
        showAlert("Turma não encontrada no banco de dados de alunos. Adicione a turma no Controle de Tarefas ou Banco de Alunos primeiro.", "Aviso", "warning");
      }
    } catch (e) {
      console.error(e);
      showAlert("Erro ao sincronizar com o banco de alunos.", "Erro", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportStudents = async (mode: "replace" | "merge") => {
    if (!studentNamesInput.trim()) return;
    const lines = studentNamesInput.split("\n").map((l) => l.trim()).filter((l) => l);
    
    let newStudents = mode === "replace" ? [] : [...classData.students];
    const newMinutes = { ...classData.minutes };
    
    const addedStudents: {id: string, name: string}[] = [];

    // If replace, prune grades
    if (mode === "replace") {
      const existingStudents = classData.students || [];
      lines.forEach(name => {
         const existing = existingStudents.find((s: any) => s.name === name);
         if (existing) {
             newStudents.push(existing);
         } else {
             const newStudent = { id: `st_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`, name };
             newStudents.push(newStudent);
             addedStudents.push(newStudent);
             newMinutes[newStudent.id] = {};
         }
      });
      // Purge minutes of students no longer there
      Object.keys(newMinutes).forEach(studentId => {
         if (!newStudents.find((s: any) => s.id === studentId)) {
             delete newMinutes[studentId];
         }
      });
    } else {
      for (const name of lines) {
        if (!newStudents.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
          const newId = `st_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const newStudent = { id: newId, name };
          newStudents.push(newStudent);
          addedStudents.push(newStudent);
          newMinutes[newId] = {};
        }
      }
    }
    
    newStudents.sort((a, b) => a.name.localeCompare(b.name));
    await saveClassData({ ...classData, students: newStudents, minutes: newMinutes });
    
    // Alimenta o banco principal (Controle de Tarefas / Banco de Alunos) se logado
    if (user && selectedTurma && addedStudents.length > 0) {
       try {
         const bKey = selectedBimestre.replace("º Bimestre", "");
         const docRef = doc(db, "users", user.uid, "taskAnalysis", `${bKey}_${selectedTurma}`);
         const snap = await getDoc(docRef);
         if (snap.exists()) {
           const dbData = snap.data();
           const dbStudents = dbData.students || [];
           const updatedDbStudents = [...dbStudents];
           let changed = false;
           
           addedStudents.forEach(st => {
             if (!updatedDbStudents.some((s: any) => s.name.toLowerCase() === st.name.toLowerCase())) {
                updatedDbStudents.push(st);
                changed = true;
             }
           });
           
           if (changed) {
             updatedDbStudents.sort((a, b) => a.name.localeCompare(b.name));
             await updateDoc(docRef, { students: updatedDbStudents });
           }
         } else {
             // Se não existe a turma no banco, cria ela também
             await setDoc(docRef, {
                 students: addedStudents.sort((a, b) => a.name.localeCompare(b.name)),
                 tasks: [],
                 grades: {}
             });
         }
       } catch (e) {
         console.error("Erro ao sincronizar com banco central", e);
       }
    }
    
    setStudentNamesInput("");
    setIsImportModalOpen(false);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await extractTextFromFile(file);
      if (text) {
        const rows = text.split("\n").map((r) => r.trim()).filter((r) => r);
        let extractedNames: string[] = [];
        for (const row of rows) {
          if (row.toLowerCase().includes("situação") || row.toLowerCase().includes("nº de chamada")) continue;
          if (row.includes(";")) {
            const parts = row.split(";");
            if (parts.length >= 2) {
              const name = parts[1].trim();
              const status = parts.length >= 3 ? parts[2].trim().toLowerCase() : "ativo";
              if (name && isNaN(Number(name)) && status === "ativo") {
                extractedNames.push(name);
              }
            }
          } else {
            if (row.length > 2) extractedNames.push(row);
          }
        }
        setStudentNamesInput(extractedNames.join("\n"));
        setIsImportModalOpen(true);
      }
    } catch (err: any) {
      console.error(err);
      showAlert(err.message || "Erro ao ler arquivo.", "Erro", "error");
    } finally {
      e.target.value = "";
    }
  };

  const removeStudent = async (id: string) => {
    if (await confirm({ title: "Remover Aluno", message: "Tem certeza que deseja remover este aluno?" })) {
      const newStudents = classData.students.filter((s) => s.id !== id);
      const newMinutes = { ...classData.minutes };
      delete newMinutes[id];
      saveClassData({ ...classData, students: newStudents, minutes: newMinutes });
    }
  };

  const [isAddingWeek, setIsAddingWeek] = useState(false);
  const [newWeek, setNewWeek] = useState({ title: "", date: new Date().toISOString().split("T")[0] });

  const handleAddWeek = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWeek.title.trim()) return;
    const week: WeekAssessment = {
      id: `wk_${Date.now()}`,
      title: newWeek.title,
      date: newWeek.date,
    };
    saveClassData({ ...classData, weeks: [...classData.weeks, week] });
    setIsAddingWeek(false);
    setNewWeek({ title: "", date: new Date().toISOString().split("T")[0] });
  };

  const removeWeek = async (id: string) => {
    if (await confirm({ title: "Remover Semana", message: "Tem certeza que deseja remover esta semana?" })) {
      const newWeeks = classData.weeks.filter((w) => w.id !== id);
      const newMinutes = { ...classData.minutes };
      Object.keys(newMinutes).forEach((sId) => {
        delete newMinutes[sId][id];
      });
      saveClassData({ ...classData, weeks: newWeeks, minutes: newMinutes });
    }
  };

  const handleGradeChange = (studentId: string, weekId: string, val: string) => {
    let mins: number | null = null;
    if (val.trim() !== "") {
      mins = parseInt(val);
      if (isNaN(mins)) return;
      if (mins < 0) mins = 0;
    }

    const newMinutes = { ...classData.minutes };
    if (!newMinutes[studentId]) newMinutes[studentId] = {};
    newMinutes[studentId][weekId] = mins;
    setClassData({ ...classData, minutes: newMinutes });
  };

  const handleGradeBlur = () => saveClassData(classData);

  const calculateMedia = (studentId: string) => {
    const studentMins = classData.minutes[studentId] || {};
    let totalScore = 0;
    let scoredWeeks = 0;

    classData.weeks.forEach((w) => {
      const mins = studentMins[w.id];
      if (mins !== null && mins !== undefined && !Number.isNaN(Number(mins))) {
        let grade = (Number(mins) / 30) * 10;
        if (grade > 10) grade = 10; // Max out at 10
        totalScore += grade;
        scoredWeeks += 1;
      }
    });

    const weekCount = classData.weeks.length;
    if (weekCount === 0) return { final: 0, scoredWeeks: 0 };

    return {
      final: totalScore / weekCount, // Average of the weeks
      scoredWeeks,
    };
  };

  const handleDeleteTurma = async (e: React.MouseEvent, turma: string) => {
    e.stopPropagation();
    if (await confirm({ title: "Excluir Turma deste Bimestre", message: `Tem certeza que deseja excluir os dados desta turma do ${selectedBimestre} permanentemente?` })) {
      const bKey = selectedBimestre.replace("º Bimestre", "");
      localStorage.removeItem(`matificAnalysis_${bKey}_${turma}`);
    }
  };

  const getEmojiForMinutes = (mins: number | null | undefined) => {
    if (mins === null || mins === undefined) return "➖";
    if (mins < 10) return "😢";
    if (mins < 20) return "😐";
    if (mins < 30) return "🙂";
    return "🤩";
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl shadow-sm">
              <Gamepad2 size={28} />
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Controle Matific
            </h1>
          </div>
          <p className="text-slate-500 font-medium">
            Acompanhe o engajamento no Matific e obtenha médias. 30 minutos = Nota 10.
          </p>
        </div>
      </div>

      {!selectedTurma ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          {!turmasList || turmasList.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-dashed border-slate-300">
              <AlertCircle className="w-12 h-12 text-slate-400 mb-4" />
              <h2 className="text-xl font-bold text-slate-800 mb-2">Nenhuma Turma Adicionada</h2>
            </div>
          ) : (
            turmasList.map((turma) => {
              const bKey = selectedBimestre.replace("º Bimestre", "");
              const localData = localStorage.getItem(`matificAnalysis_${bKey}_${turma}`);
              let studentsCount = 0;
              let weeksCount = 0;
              if (localData) {
                try {
                  const parsed = JSON.parse(localData);
                  studentsCount = parsed.students?.length || 0;
                  weeksCount = parsed.weeks?.length || 0;
                } catch (e) {}
              }

              return (
                <motion.div
                  key={turma}
                  whileHover={{ y: -4 }}
                  onClick={() => setSelectedTurma(turma)}
                  className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group flex flex-col justify-between min-h-[160px] relative"
                >
                  <button
                    onClick={(e) => handleDeleteTurma(e, turma)}
                    className="absolute top-4 right-4 p-2 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                  <div>
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Users size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 tracking-tight mb-2 pr-8">{turma}</h3>
                    <div className="flex gap-4 text-xs font-bold text-slate-500">
                      <span className="flex items-center gap-1"><Users size={14} /> {studentsCount} Alunos</span>
                      <span className="flex items-center gap-1"><Gamepad2 size={14} /> {weeksCount} Semanas</span>
                    </div>
                  </div>
                  <div className="flex items-center text-sm font-bold text-blue-600 mt-4 gap-1">
                    Acessar Turma <ChevronRight size={16} />
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      ) : (
        <div className={isFullscreen ? "fixed inset-0 z-[100] bg-slate-50 overflow-y-auto p-4 md:p-8 flex flex-col gap-4" : "flex flex-col h-full min-h-0 gap-4"}>
          <div className="flex-none flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedTurma(null)}
                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors"
                title="Voltar para turmas"
              >
                <ChevronRight size={20} className="rotate-180" />
              </button>
              <h2 className="text-xl font-bold text-slate-800">{selectedTurma}</h2>
            </div>
            
            {/* Student Mode Toggle and Fullscreen */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  if (studentMode) setIsFullscreen(false);
                  setStudentMode(!studentMode);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-colors border ${studentMode ? "bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}
              >
                {studentMode ? (
                  <><EyeOff size={16} /> Ocultar Notas (Modo Aluno ON)</>
                ) : (
                  <><Eye size={16} /> Mostrar como Aluno (Modo Emojis)</>
                )}
              </button>
              {studentMode && (
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-colors border bg-white border-slate-200 text-slate-700 hover:bg-slate-50`}
                >
                  {isFullscreen ? <><Minimize size={16} /> Sair da Tela Cheia</> : <><Maximize size={16} /> Tela Cheia</>}
                </button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
              {!studentMode && (
                <div className="p-4 md:p-6 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => setIsImportModalOpen(true)}
                      className={`flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-sm shadow-sm transition-colors`}
                    >
                      <Users size={16} /> Alunos da Turma
                    </button>
                    {!studentMode && (
                      <button
                        onClick={syncStudentsWithDatabase}
                        disabled={isSyncing}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl font-bold text-sm shadow-sm transition-colors"
                      >
                        {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
                        {isSyncing ? "Sincronizando..." : "Puxar do Banco"}
                      </button>
                    )}
                    <button
                      onClick={() => setIsAddingWeek(!isAddingWeek)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white border border-blue-700 rounded-xl font-bold text-sm shadow-sm transition-colors hover:bg-blue-700"
                    >
                      <Plus size={16} /> Nova Semana
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    {isSaving ? <><Loader2 size={12} className="animate-spin" /> Salvando...</> : <><CheckCircle2 size={12} /> Salvo</>}
                  </div>
                </div>
              )}

              <AnimatePresence>
                {isAddingWeek && !studentMode && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-b border-blue-100 bg-blue-50/30 overflow-hidden">
                    <form onSubmit={handleAddWeek} className="p-6">
                      <h3 className="font-bold text-blue-900 mb-4">Adicionar Semana</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-xs font-bold text-blue-800 uppercase tracking-wide mb-1">Semana (Ex: Sem 1 - Abril)</label>
                          <input type="text" required value={newWeek.title} onChange={(e) => setNewWeek({ ...newWeek, title: e.target.value })} className="w-full border border-blue-200 rounded-xl px-3 py-2" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-blue-800 uppercase tracking-wide mb-1">Data Mínima</label>
                          <input type="date" required value={newWeek.date} onChange={(e) => setNewWeek({ ...newWeek, date: e.target.value })} className="w-full border border-blue-200 rounded-xl px-3 py-2" />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setIsAddingWeek(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-blue-100 rounded-xl">Cancelar</button>
                        <button type="submit" className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-xl"><Plus size={16} /> Adicionar</button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="overflow-auto flex-1 h-0">
                {classData.students.length === 0 ? (
                  <div className="p-16 text-center">
                    <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-700 mb-2">Nenhum aluno cadastrado</h3>
                  </div>
                ) : (
                  <table className={`w-full text-left border-collapse ${studentMode ? "table-fixed" : "min-w-[800px]"}`}>
                    <thead>
                      <tr className="bg-white border-b-2 border-slate-200 sticky top-0 z-10 shadow-sm">
                        <th className={`p-2 lg:p-4 font-bold text-slate-800 sticky left-0 bg-white z-20 shadow-[1px_0_0_#e2e8f0] ${studentMode ? "w-10" : "w-12"} text-center`}>#</th>
                        <th className={`p-2 lg:p-4 font-bold text-slate-800 sticky left-[40px] md:left-[48px] bg-white z-20 shadow-[1px_0_0_#e2e8f0] ${studentMode ? "w-1/4" : "min-w-[200px]"}`}>Nome</th>
                        {classData.weeks.map((week) => (
                          <th key={week.id} className={`p-1 lg:p-2 border-l border-slate-100 bg-slate-50 text-center ${studentMode ? "w-[8%]" : "min-w-[140px]"}`}>
                            <div className="flex flex-col items-center gap-1 relative group w-full overflow-hidden">
                              <span className={`font-bold text-blue-900 border-b border-blue-200 pb-1 mb-1 truncate w-full ${studentMode ? "text-[10px] lg:text-xs" : "text-sm"}`} title={week.title}>{week.title}</span>
                              <span className={`${studentMode ? "text-[8px] lg:text-[10px]" : "text-[10px]"} text-slate-500`}>{new Date(week.date + "T12:00:00").toLocaleDateString("pt-BR", {month: "numeric", day: "numeric"})}</span>
                              {!studentMode && (
                                <button onClick={() => removeWeek(week.id)} className="absolute -top-2 -right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 bg-white p-1 rounded-full shadow-sm">
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </th>
                        ))}
                        <th className={`p-2 lg:p-4 font-bold text-blue-900 border-l-2 border-blue-100 bg-blue-50/50 text-center ${studentMode ? "w-[12%]" : "w-24"}`}>
                          Média<br/><span className={`${studentMode ? "hidden" : "text-[10px]"} font-normal opacity-70`}>(0 a 10)</span>
                        </th>
                        {!studentMode && <th className="p-4 w-12 text-center text-slate-400"><Trash2 size={16} className="mx-auto" /></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {classData.students.map((student, idx) => {
                        const stats = calculateMedia(student.id);
                        return (
                          <tr key={student.id} className={`border-b border-slate-100 transition-colors group ${studentMode ? "" : "hover:bg-slate-50"}`}>
                            <td className={`p-2 lg:p-4 text-sm text-slate-400 font-mono text-center sticky left-0 z-10 shadow-[1px_0_0_#e2e8f0] ${studentMode ? "bg-white" : "bg-white group-hover:bg-slate-50"}`}>{idx + 1}</td>
                            <td className={`p-2 lg:p-4 text-xs lg:text-sm font-bold text-slate-700 truncate sticky left-[40px] md:left-[48px] z-10 shadow-[1px_0_0_#e2e8f0] ${studentMode ? "bg-white max-w-[120px] lg:max-w-[200px]" : "bg-white group-hover:bg-slate-50 max-w-[200px]"}`}>
                              {studentMode ? student.name.split(" ")[0] + "..." : student.name}
                            </td>
                            {classData.weeks.map((week) => {
                              const val = classData.minutes[student.id]?.[week.id];
                              let grade = val !== null && val !== undefined ? Math.min(10, (val / 30) * 10) : null;
                              
                              if (studentMode) {
                                return (
                                  <td key={week.id} className="p-1 lg:p-3 border-l border-slate-100 text-center text-xl lg:text-2xl" title={val ? `${val} minutos` : "Sem dados"}>
                                    {getEmojiForMinutes(val)}
                                  </td>
                                );
                              }

                              return (
                                <td key={week.id} className="p-3 border-l border-slate-100 align-top">
                                  <div className="flex flex-col items-center">
                                    <input
                                      type="number"
                                      min="0"
                                      value={val === null || val === undefined ? "" : val}
                                      onChange={(e) => handleGradeChange(student.id, week.id, e.target.value)}
                                      onBlur={handleGradeBlur}
                                      className="w-20 bg-transparent border-b-2 px-2 py-1 text-center font-bold text-sm focus:outline-none focus:bg-white focus:rounded focus:shadow-sm"
                                      placeholder="0 min"
                                    />
                                    {grade !== null && (
                                     <div className={`text-center font-bold text-[10px] mt-1 ${grade < 5 ? "text-red-500" : grade < 8 ? "text-emerald-500" : "text-emerald-700"}`}>
                                       Nota: {grade.toFixed(1)}
                                     </div>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                            <td className="p-2 lg:p-4 font-black border-l-2 border-blue-100 bg-blue-50/30 text-center h-full">
                              <div className="flex flex-col justify-center items-center h-full gap-1">
                                {studentMode ? (
                                  <span className="text-xl lg:text-2xl">{getEmojiForMinutes(stats.final > 0 ? (stats.final/10)*30 : null) !== "➖" ? (stats.final >= 8 ? "🤩" : stats.final >= 5 ? "🙂" : stats.final > 0 ? "😐" : "😢") : "➖"}</span>
                                ) : (
                                  <span className={`text-lg ${stats.scoredWeeks === 0 ? "text-slate-300" : stats.final < 5 ? "text-red-600" : stats.final < 8 ? "text-blue-500" : "text-blue-700"}`}>
                                    {stats.final.toFixed(1)}
                                  </span>
                                )}
                              </div>
                            </td>
                            {!studentMode && (
                              <td className="p-4 text-center">
                                <button onClick={() => removeStudent(student.id)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
                                  <X size={16} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pt-20 pb-4 px-4">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsImportModalOpen(false)}
            ></div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-w-xl w-full relative z-10 flex flex-col max-h-[85vh]"
            >
              <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">
                Atualizar Lista de Alunos
              </h2>
              <p className="text-slate-500 mb-6 font-medium leading-relaxed">
                Cole a lista de nomes abaixo ou faça upload de um CSV/TXT para a turma{" "}
                <span className="bg-slate-100 px-2 rounded">
                  {selectedTurma}
                </span>
                . Você pode optar por adicionar apenas os novos ou substituir a lista inteira.
              </p>

              <div className="flex-1 overflow-y-auto pr-2 mb-6 min-h-[250px]">
                <textarea
                  value={studentNamesInput}
                  onChange={(e) => setStudentNamesInput(e.target.value)}
                  className="w-full h-full min-h-[250px] p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm resize-none whitespace-pre"
                  placeholder={`Maria da Silva\nJoão Souza\n...`}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100 flex-wrap">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".csv,.txt,.pdf,.docx"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 border border-slate-200"
                >
                  <Upload size={18} /> Carregar Arquivo
                </button>
                <div className="flex-1 hidden md:block"></div>
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-3 text-slate-500 font-bold rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleImportStudents("merge")}
                  disabled={!studentNamesInput.trim()}
                  className="px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-200 disabled:opacity-50 disabled:shadow-none flex items-center gap-2 justify-center"
                >
                  Adicionar Novos
                </button>
                <button
                  onClick={() => handleImportStudents("replace")}
                  disabled={!studentNamesInput.trim()}
                  className="px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 disabled:opacity-50 disabled:shadow-none flex items-center gap-2 justify-center"
                >
                  Substituir Lista
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
