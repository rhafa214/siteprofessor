import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Plus, Trash2, Users, Save, CheckCircle2, ChevronRight, X, AlertCircle, FileText } from "lucide-react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { collection, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { useAlert } from "../contexts/AlertContext";

interface Student { id: string; name: string; }
interface Exam { id: string; title: string; maxScore: number; date: string; }
interface ClassData { students: Student[]; exams: Exam[]; grades: Record<string, Record<string, number | null>>; }

const defaultClassData: ClassData = { students: [], exams: [], grades: {} };

export default function ProvaPaulistaAnalysis({ selectedBimestre }: { selectedBimestre: string }) {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const { showAlert } = useAlert();
  
  const [turmasList] = useLocalStorage<string[]>(
    "classTurmasList",
    [
      "6°A - Orientação de estudos",
      "6°B - Matemática",
      "6°C - Matemática",
      "7°C - Matemática",
      "7°D - Tecnologia e Eletivas",
    ],
  );
  
  const [selectedTurma, setSelectedTurma] = useState<string | null>(null);
  const [classData, setClassData] = useState<ClassData>(defaultClassData);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!selectedTurma) return;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const bKey = selectedBimestre.replace("º Bimestre", "");
        if (user) {
          const docRef = doc(db, "users", user.uid, "paulistaAnalysis", `${bKey}_${selectedTurma}`);
          const snap = await getDoc(docRef);
          if (snap.exists()) { setClassData(snap.data() as ClassData); }
          else if (bKey === "2") {
            const oldRef = doc(db, "users", user.uid, "paulistaAnalysis", selectedTurma);
            const oldSnap = await getDoc(oldRef);
            if (oldSnap.exists()) {
              setClassData(oldSnap.data() as ClassData);
            } else {
              const localData = localStorage.getItem(`pp_${bKey}_${selectedTurma}`) || localStorage.getItem(`pp_${selectedTurma}`);
              setClassData(localData ? JSON.parse(localData) : defaultClassData);
            }
          }
          else {
            const localData = localStorage.getItem(`pp_${bKey}_${selectedTurma}`);
            setClassData(localData ? JSON.parse(localData) : defaultClassData);
          }
        } else {
          let localData = localStorage.getItem(`pp_${bKey}_${selectedTurma}`);
          if (!localData && bKey === "2") {
             localData = localStorage.getItem(`pp_${selectedTurma}`);
          }
          setClassData(localData ? JSON.parse(localData) : defaultClassData);
        }
      } catch (e) {
         console.error("Error loading task data", e);
      } finally { setIsLoading(false); }
    };
    loadData();
  }, [selectedTurma, user]);

  const saveClassData = async (newData: ClassData) => {
    setClassData(newData);
    const bKey = selectedBimestre.replace("º Bimestre", "");
    try {
      if (user) {
        setIsSaving(true);
        await setDoc(doc(db, "users", user.uid, "paulistaAnalysis", `${bKey}_${selectedTurma}`), newData);
        setIsSaving(false);
      }
      localStorage.setItem(`pp_${bKey}_${selectedTurma}`, JSON.stringify(newData));
    } catch (e) {
      console.error("Error saving data", e);
      setIsSaving(false);
    }
  };

  const [isAddingExam, setIsAddingExam] = useState(false);
  const [newExam, setNewExam] = useState<Exam>({ id: "", title: "", maxScore: 10, date: "" });
  const handleAddExam = () => {
    if (!newExam.title || newExam.maxScore <= 0) return;
    const id = `ex_${Date.now()}`;
    const newExams = [...classData.exams, { ...newExam, id, date: new Date().toISOString() }];
    saveClassData({ ...classData, exams: newExams });
    setNewExam({ id: "", title: "", maxScore: 10, date: "" });
    setIsAddingExam(false);
  };

  const syncStudents = async () => {
    if (!user) {
      showAlert("Faça login para sincronizar", "Aviso", "warning");
      return;
    }
    setIsLoading(true);
    try {
       const bKey = selectedBimestre.replace("º Bimestre", "");
       const taskRef = doc(db, "users", user.uid, "taskAnalysis", `${bKey}_${selectedTurma}`);
       const snap = await getDoc(taskRef);
       if (snap.exists() && snap.data().students) {
          const studentsFromTasks = snap.data().students;
          const newGrades = { ...classData.grades };
          studentsFromTasks.forEach((s: any) => { if (!newGrades[s.id]) newGrades[s.id] = {}; });
          saveClassData({ ...classData, students: studentsFromTasks, grades: newGrades });
          showAlert("Alunos sincronizados com sucesso!", "Sucesso", "success");
       } else {
          showAlert("Nenhum aluno encontrado no Controle de Tarefas para esta turma.", "Aviso", "warning");
       }
    } catch (err) {
       console.error(err);
       showAlert("Erro ao sincronizar", "Erro", "error");
    } finally { setIsLoading(false); }
  };

  const updateGrade = (studentId: string, examId: string, value: string) => {
    let numVal: number | null = value === "" ? null : parseFloat(value);
    const exam = classData.exams.find(e => e.id === examId);
    if (exam && numVal !== null && numVal > exam.maxScore) numVal = exam.maxScore;
    if (numVal !== null && numVal < 0) numVal = 0;
    const newGrades = { ...classData.grades, [studentId]: { ...classData.grades[studentId], [examId]: numVal } };
    saveClassData({ ...classData, grades: newGrades });
  };

  const calculateStudentAvg = (studentId: string) => {
    const sGrades = classData.grades[studentId] || {};
    let totalScore = 0;
    let totalMax = 0;
    classData.exams.forEach(ex => {
      const g = sGrades[ex.id];
      if (g !== undefined && g !== null) {
        totalScore += g;
        totalMax += ex.maxScore;
      }
    });
    if (totalMax === 0) return "-";
    return ((totalScore / totalMax) * 100).toFixed(1) + "%";
  };

  return (
    <div className="flex flex-col max-w-7xl mx-auto space-y-6 pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-indigo-100 text-indigo-700 rounded-2xl shadow-sm">
              <FileText size={28} />
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Prova Paulista
            </h1>
          </div>
          <p className="text-slate-500 font-medium">Acompanhe as notas da Prova Paulista e os descritores.</p>
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
            turmasList.map((turma) => (
              <motion.div
                key={turma}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group"
                onClick={() => setSelectedTurma(turma)}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <FileText size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 leading-tight">
                    {turma}
                  </h3>
                </div>
              </motion.div>
            ))
          )}
        </div>
      ) : (
      <div className="flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-t-2xl border-b border-slate-200">
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
            <div className="flex gap-2">
                <button onClick={syncStudents} className="px-4 py-2 bg-indigo-50 text-indigo-600 text-sm font-bold rounded-xl hover:bg-indigo-100 flex items-center gap-2">
                  <Users size={16} />Sincronizar
                </button>
                <button onClick={() => setIsAddingExam(true)} className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 flex items-center gap-2">
                  <Plus size={16} />Nova Prova
                </button>
            </div>
        </div>

        {isAddingExam && (
          <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-end gap-4">
            <div className="flex-1 max-w-sm">
              <label className="block text-xs font-bold text-slate-500 mb-1">Título da Prova</label>
              <input type="text" value={newExam.title} onChange={e => setNewExam({...newExam, title: e.target.value})} placeholder="Ex: 1º Bimestre" className="w-full px-3 py-2 rounded-lg border-none focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div className="w-32">
              <label className="block text-xs font-bold text-slate-500 mb-1">Nota Máxima</label>
              <input type="number" min="0" value={newExam.maxScore} onChange={e => setNewExam({...newExam, maxScore: Number(e.target.value)})} className="w-full px-3 py-2 rounded-lg border-none focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <button onClick={handleAddExam} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl h-10">Adicionar</button>
            <button onClick={() => setIsAddingExam(false)} className="px-4 py-2 text-slate-500 hover:text-slate-800 font-bold rounded-xl h-10">Cancelar</button>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4 relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80"><Loader2 className="animate-spin text-indigo-600 w-8 h-8" /></div>
          ) : classData.students.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
               <Users className="w-16 h-16 text-slate-200 mb-4" />
               <h3 className="text-xl font-bold text-slate-700 mb-2">Turma Vazia</h3>
               <p className="text-slate-500 mb-6">Você precisa ter alunos cadastrados nesta turma no Banco de Alunos ou Controle de Tarefas e Sincronizá-los.</p>
               <button onClick={syncStudents} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold">Importar Alunos Sincronizados</button>
            </div>
          ) : classData.exams.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
               <FileText className="w-16 h-16 text-slate-200 mb-4" />
               <h3 className="text-xl font-bold text-slate-700 mb-2">Nenhuma Prova Adicionada</h3>
               <p className="text-slate-500 mb-6">Adicione uma Prova Paulista para começar a registrar os resultados dos alunos.</p>
               <button onClick={() => setIsAddingExam(true)} className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold">Nova Prova Paulista</button>
            </div>
          ) : (
            <div className="min-w-max border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
               <div className="grid grid-cols-[300px_minmax(100px,1fr)] bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-600 items-center">
                  <div className="p-3 border-r border-slate-200 sticky left-0 bg-slate-50 z-10 flex justify-between items-center">
                     <span>ALUNO</span>
                     <span className="text-xs text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">% Acerto</span>
                  </div>
                  <div className="flex">
                     {classData.exams.map(ex => (
                        <div key={ex.id} className="min-w-[120px] p-3 border-r border-slate-200 flex-1 text-center truncate">
                           <div className="truncate" title={ex.title}>{ex.title}</div>
                           <div className="text-[10px] text-slate-400 font-medium">Máx: {ex.maxScore} pts</div>
                        </div>
                     ))}
                  </div>
               </div>
               
               {classData.students.map((student, i) => (
                  <div key={student.id} className={`grid grid-cols-[300px_minmax(100px,1fr)] border-b border-slate-100 transition-colors hover:bg-indigo-50/30 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                     <div className="p-3 border-r border-slate-200 sticky left-0 bg-inherit z-10 flex items-center justify-between font-medium text-sm text-slate-700">
                        <span className="truncate pr-2">{student.name}</span>
                        <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg text-xs">{calculateStudentAvg(student.id)}</span>
                     </div>
                     <div className="flex">
                        {classData.exams.map(ex => (
                          <div key={ex.id} className="min-w-[120px] p-2 border-r border-slate-200 flex-1 flex items-center justify-center">
                             <input type="number" min="0" max={ex.maxScore} value={classData.grades[student.id]?.[ex.id] ?? ""} onChange={e => updateGrade(student.id, ex.id, e.target.value)} className="w-16 text-center text-sm font-bold bg-transparent border-none focus:ring-2 focus:ring-indigo-500 rounded-lg p-1 outline-none" placeholder="--" />
                          </div>
                        ))}
                     </div>
                  </div>
               ))}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
