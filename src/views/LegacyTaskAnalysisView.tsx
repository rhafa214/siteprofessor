import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Loader2,
  ClipboardCheck,
  Plus,
  Trash2,
  Users,
  Save,
  Upload,
  CheckCircle2,
  ChevronRight,
  X,
  AlertCircle,
} from "lucide-react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { collection, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { useAlert } from "../contexts/AlertContext";
import { extractTextFromFile } from "../lib/fileExtraction";
import { extractStudents } from "../studentExtractor";
import BimestralReportView from "../components/BimestralReportView";

interface Student {
  id: string;
  name: string;
}

interface TaskAssessment {
  id: string;
  title: string;
  maxScore: number;
  date: string;
}

interface ClassData {
  students: Student[];
  tasks: TaskAssessment[];
  grades: Record<string, Record<string, number | null>>; // grades[studentId][taskId] = score
}

// Default empty class
const defaultClassData: ClassData = { students: [], tasks: [], grades: {} };

export default function LegacyTaskAnalysisView({
  selectedBimestre,
}: {
  selectedBimestre: string;
}) {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const { showAlert } = useAlert();
  const [subTab, setSubTab] = useState<"lancamento" | "relatorio">(
    "lancamento",
  );
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

  // Load data for the selected turma
  useEffect(() => {
    if (!selectedTurma) return;

    // Load from local or Firebase
    const loadData = async () => {
      setIsLoading(true);
      const bKey = selectedBimestre.replace("º Bimestre", "");
      try {
        if (user) {
          const docRef = doc(
            db,
            "users",
            user.uid,
            "taskAnalysis",
            `${bKey}_${selectedTurma}`,
          );
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            setClassData(snap.data() as ClassData);
          } else if (bKey === "2") {
            const oldRef = doc(
              db,
              "users",
              user.uid,
              "taskAnalysis",
              selectedTurma,
            );
            const oldSnap = await getDoc(oldRef);
            if (oldSnap.exists()) {
              setClassData(oldSnap.data() as ClassData);
            } else {
              const localData =
                localStorage.getItem(`taskAnalysis_${bKey}_${selectedTurma}`) ||
                localStorage.getItem(`taskAnalysis_${selectedTurma}`);
              setClassData(
                localData ? JSON.parse(localData) : defaultClassData,
              );
            }
          } else {
            // Check local storage fallback
            const localData = localStorage.getItem(
              `taskAnalysis_${bKey}_${selectedTurma}`,
            );
            setClassData(localData ? JSON.parse(localData) : defaultClassData);
          }
        } else {
          let localData = localStorage.getItem(
            `taskAnalysis_${bKey}_${selectedTurma}`,
          );
          if (!localData && bKey === "2") {
            localData = localStorage.getItem(`taskAnalysis_${selectedTurma}`);
          }
          setClassData(localData ? JSON.parse(localData) : defaultClassData);
        }
      } catch (e) {
        console.error("Error loading task data", e);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedTurma, user]);

  // Save changes
  const saveClassData = async (newData: ClassData) => {
    console.warn("Legacy mode is read-only. Bypassing saveClassData.");
    showAlert("O modo legado é somente leitura. Edições foram desabilitadas.", "Aviso", "info");
  };

  // ----------------------------------------
  // STUDENTS MANAGEMENT
  // ----------------------------------------
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [studentNamesInput, setStudentNamesInput] = useState("");

  const handleImportStudents = (mode: "replace" | "merge") => {
    if (!studentNamesInput.trim()) return;

    const lines = extractStudents(studentNamesInput);

    let newStudents = mode === "replace" ? [] : [...classData.students];
    const newGrades = { ...classData.grades };

    // If replace, prune grades of removed students
    if (mode === "replace") {
      const existingStudents = classData.students || [];
      lines.forEach((name) => {
        const existing = existingStudents.find((s: any) => s.name === name);
        if (existing) {
          newStudents.push(existing);
        } else {
          newStudents.push({
            id: `st_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name,
          });
        }
      });
      // Purge grades of students no longer there
      Object.keys(newGrades).forEach((studentId) => {
        if (!newStudents.find((s: any) => s.id === studentId)) {
          delete newGrades[studentId];
        }
      });
    } else {
      // Merge mode
      for (const name of lines) {
        if (
          !newStudents.some((s) => s.name.toLowerCase() === name.toLowerCase())
        ) {
          const newId = `st_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          newStudents.push({ id: newId, name });
          newGrades[newId] = {};
        }
      }
    }

    newStudents.sort((a, b) => a.name.localeCompare(b.name));
    saveClassData({ ...classData, students: newStudents, grades: newGrades });
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
        const extractedNames = extractStudents(text);
        setStudentNamesInput(extractedNames.join("\n"));
        setIsImportModalOpen(true);
      }
    } catch (err: any) {
      console.error(err);
      showAlert(
        err.message ||
          "Erro ao ler arquivo. Tente copiar e colar os nomes na caixa de texto.",
        "Erro",
        "error",
      );
    } finally {
      e.target.value = "";
    }
  };

  const removeStudent = async (id: string) => {
    if (
      await confirm({
        title: "Remover Aluno",
        message:
          "Tem certeza que deseja remover este aluno e todas as suas notas?",
        isDestructive: true,
      })
    ) {
      const newStudents = classData.students.filter((s) => s.id !== id);
      const newGrades = { ...classData.grades };
      delete newGrades[id];
      saveClassData({ ...classData, students: newStudents, grades: newGrades });
    }
  };

  // ----------------------------------------
  // TASKS MANAGEMENT
  // ----------------------------------------
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    maxScore: 10,
    date: new Date().toISOString().split("T")[0],
  });

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    const task: TaskAssessment = {
      id: `tk_${Date.now()}`,
      title: newTask.title,
      maxScore: newTask.maxScore,
      date: newTask.date,
    };

    saveClassData({ ...classData, tasks: [...classData.tasks, task] });
    setIsAddingTask(false);
    setNewTask({
      title: "",
      maxScore: 10,
      date: new Date().toISOString().split("T")[0],
    });
  };

  const removeTask = async (id: string) => {
    if (
      await confirm({
        title: "Remover Tarefa",
        message:
          "Tem certeza que deseja remover esta tarefa? Todas as notas associadas serão apagadas.",
        isDestructive: true,
      })
    ) {
      const newTasks = classData.tasks.filter((t) => t.id !== id);
      const newGrades = { ...classData.grades };
      Object.keys(newGrades).forEach((sId) => {
        delete newGrades[sId][id];
      });
      saveClassData({ ...classData, tasks: newTasks, grades: newGrades });
    }
  };

  // ----------------------------------------
  // GRADING
  // ----------------------------------------
  const handleGradeChange = (
    studentId: string,
    taskId: string,
    val: string,
  ) => {
    let score: number | null = null;
    if (val.trim() !== "") {
      score = parseFloat(val);
      if (isNaN(score)) return;
      if (score < 0) score = 0;
      if (score > 60) score = 60;
    }

    const newGrades = { ...classData.grades };
    if (!newGrades[studentId]) newGrades[studentId] = {};
    newGrades[studentId][taskId] = score;

    // We only update local state immediately and save on blur or debounce to avoid lag.
    // Actually for simplicity, we can do it on change if the grid isn't massive.
    setClassData({ ...classData, grades: newGrades });
  };

  const handleGradeBlur = () => {
    saveClassData(classData);
  };

  // Utility to calculate media
  const calculateMedia = (studentId: string) => {
    const studentGrades = classData.grades[studentId] || {};
    let totalScore = 0;
    let totalConverted = 0;
    let scoredTasks = 0;

    classData.tasks.forEach((t) => {
      const g = studentGrades[t.id];
      if (g !== null && g !== undefined && !Number.isNaN(Number(g))) {
        totalScore += Number(g);
        totalConverted += (Number(g) * 10) / 60;
        scoredTasks += 1;
      }
    });

    const taskCount = classData.tasks.length;
    if (taskCount === 0)
      return { final: 0, percentage: 0, converted10: 0, scoredTasks: 0 };

    return {
      final: totalScore,
      percentage: (totalScore / (taskCount * 60)) * 100,
      converted10: totalConverted / taskCount,
      scoredTasks,
    };
  };

  const handleDeleteTurma = async (e: React.MouseEvent, turma: string) => {
    e.stopPropagation();
    if (
      await confirm({
        title: "Excluir Turma deste Bimestre",
        message: `Tem certeza que deseja excluir os dados da turma "${turma}" para o ${selectedBimestre}? Isso apagará todas as tarefas e notas associadas a este período.`,
        isDestructive: true,
      })
    ) {
      const bKey = selectedBimestre.replace("º Bimestre", "");
      localStorage.removeItem(`taskAnalysis_${bKey}_${turma}`);
      // Em uma aplicação real, excluiríamos do Firebase também ou da listagem global,
      // mas aqui a listagem é global para todos os bimestres.
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-[1600px] mx-auto space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl shadow-sm">
              <ClipboardCheck size={28} />
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-4">
              Controle de Tarefas
              <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-md border border-amber-200">
                Registro legado — somente leitura
              </span>
            </h1>
          </div>
          <p className="text-slate-500 font-medium">
            Visualização do histórico antigo. As edições estão desabilitadas.
          </p>
        </div>
      </div>

      {!selectedTurma ? (
        <div className="flex flex-col h-full bg-slate-50/50">
          <div className="px-4 pt-4 shrink-0">
            <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit max-w-full overflow-x-auto">
              <button
                onClick={() => setSubTab("lancamento")}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${subTab === "lancamento" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Lançamento de Notas
              </button>
              <button
                onClick={() => setSubTab("relatorio")}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${subTab === "relatorio" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Relatório Geral (Séries)
              </button>
            </div>
          </div>

          {subTab === "relatorio" ? (
            <div className="p-4 flex-1 overflow-auto">
              <BimestralReportView
                gradesData={turmasList.reduce((acc, t) => {
                  const bKey = selectedBimestre.replace("º Bimestre", "");
                  let localData = localStorage.getItem(`taskAnalysis_${bKey}_${t}`);
                  if (!localData && bKey === "2") {
                    localData = localStorage.getItem(`taskAnalysis_${t}`);
                  }
                  if (localData) {
                    try {
                      const parsedClass = JSON.parse(localData) as ClassData;
                      acc[t] = parsedClass.students.map((s) => {
                         let totalVal = 0;
                         let scoredTasks = 0;
                         parsedClass.tasks.forEach(tsk => {
                           const val = parsedClass.grades[s.id]?.[tsk.id];
                           if (val !== null && val !== undefined && !Number.isNaN(Number(val))) {
                             totalVal += Number(val);
                             scoredTasks += 1;
                           }
                         });
                         const finalGrade = scoredTasks > 0 ? (totalVal * 10) / 60 : 0;
                         return { id: s.id, studentName: s.name, grade: Number(finalGrade.toFixed(1)) };
                      });
                    } catch (e) {}
                  }
                  return acc;
                }, {} as any)}
                selectedBimestre={selectedBimestre}
                turmasList={turmasList || []}
                dataKeyFormat={(t) => t}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 p-4">
              {!turmasList || turmasList.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-dashed border-slate-300">
                  <AlertCircle className="w-12 h-12 text-slate-400 mb-4" />
                  <h2 className="text-xl font-bold text-slate-800 mb-2">
                    Nenhuma Turma Adicionada
                  </h2>
                  <p className="text-slate-500 text-sm">
                    Acesse a página de Registro de Aulas para gerenciar suas turmas
                    e eles aparecerão aqui.
                  </p>
                </div>
              ) : (
                turmasList.map((turma) => {
                  const bKey = selectedBimestre.replace("º Bimestre", "");
                  let localData = localStorage.getItem(
                    `taskAnalysis_${bKey}_${turma}`,
                  );
                  if (!localData && bKey === "2") {
                    localData = localStorage.getItem(`taskAnalysis_${turma}`);
                  }
                  let studentsCount = 0;
                  let tasksCount = 0;
                  let hasLocalData = false;
                  if (localData) {
                    try {
                      const parsed = JSON.parse(localData);
                      studentsCount = parsed.students?.length || 0;
                      tasksCount = parsed.tasks?.length || 0;
                      hasLocalData = true;
                    } catch (e) {}
                  }

                  return (
                    <motion.div
                      key={turma}
                      whileHover={{ y: -4 }}
                      onClick={() => {
                        setSelectedTurma(turma);
                        setSubTab("lancamento");
                      }}
                      className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm cursor-pointer hover:shadow-md hover:border-emerald-200 transition-all group flex flex-col justify-between min-h-[160px] relative"
                    >
                      <div>
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <Users size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 tracking-tight mb-2 pr-8">
                          {turma}
                        </h3>
                        <div className="flex gap-4 text-xs font-bold text-slate-500">
                          {hasLocalData ? (
                            <>
                              <span className="flex items-center gap-1">
                                <Users size={14} /> {studentsCount} Alunos
                              </span>
                              <span className="flex items-center gap-1">
                                <ClipboardCheck size={14} /> {tasksCount} Tarefas
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-400">
                              Clique para consultar o histórico
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center text-sm font-bold text-emerald-600 mt-4 gap-1">
                        Acessar Turma <ChevronRight size={16} />
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex-none flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedTurma(null)}
                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors"
                title="Voltar para turmas"
              >
                <ChevronRight size={20} className="rotate-180" />
              </button>
              <h2 className="text-xl font-bold text-slate-800">
                {selectedTurma}
              </h2>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
              <button
                onClick={() => setSubTab("lancamento")}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${subTab === "lancamento" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Lançamento
              </button>
              <button
                onClick={() => setSubTab("relatorio")}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${subTab === "relatorio" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Relatório da Turma
              </button>
            </div>
          </div>

          {subTab === "relatorio" ? (
            <div className="p-4 flex-1 overflow-auto bg-slate-50">
              <BimestralReportView
                gradesData={{
                  [selectedTurma]: classData.students.map((s) => {
                    const val = calculateMedia(s.id);
                    return {
                      id: s.id,
                      studentName: s.name,
                      grade: Number(val.converted10.toFixed(1)),
                    };
                  }),
                }}
                selectedBimestre={selectedBimestre}
                selectedTurma={selectedTurma}
                dataKeyFormat={(t) => t}
              />
            </div>
          ) : (
            <>
              {isLoading ? (
                <div className="flex justify-center p-12">
                  <Loader2
                    className="animate-spin text-emerald-600"
                    size={32}
                  />
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
                  {/* Header Controls */}
                  <div className="p-4 md:p-6 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      {/* Ocultado no Legado */}
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                      <CheckCircle2 size={12} /> Somente leitura
                    </div>
                  </div>

                  {/* Main Grid */}
                  <div className="overflow-auto flex-1 h-0">
                    {classData.students.length === 0 ? (
                      <div className="p-16 text-center">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-slate-700 mb-2">
                          Histórico Vazio
                        </h3>
                        <p className="text-slate-500">
                          Não foram encontrados registros legados de alunos e tarefas para esta turma neste período.
                        </p>
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                          <tr className="bg-white border-b-2 border-slate-200 sticky top-0 z-10 shadow-sm">
                            <th className="p-4 font-bold text-slate-800 sticky left-0 bg-white z-20 shadow-[1px_0_0_#e2e8f0] w-12 text-center">
                              #
                            </th>
                            <th className="p-4 font-bold text-slate-800 sticky left-[48px] bg-white z-20 shadow-[1px_0_0_#e2e8f0]">
                              Nome do Aluno
                            </th>

                            {classData.tasks.map((task) => (
                              <th
                                key={task.id}
                                className="p-4 border-l border-slate-100 bg-slate-50 group min-w-[140px]"
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <div className="flex flex-col">
                                    <span
                                      className="text-sm font-bold text-indigo-900 border-b border-indigo-200 pb-1 mb-1 truncate max-w-[120px]"
                                      title={task.title}
                                    >
                                      {task.title}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      {new Date(
                                        task.date + "T12:00:00",
                                      ).toLocaleDateString("pt-BR")}
                                    </span>
                                  </div>
                                  <div className="text-slate-400 opacity-50 p-1.5">
                                    {/* Ocultado no Legado */}
                                  </div>
                                </div>
                              </th>
                            ))}
                            <th className="p-4 font-bold text-indigo-900 border-l-2 border-indigo-100 bg-indigo-50/50 w-24 text-center">
                              Média
                              <br />
                              <span className="text-[10px] font-normal opacity-70">
                                (0 a 10)
                              </span>
                            </th>
                            <th className="p-4 w-12 text-center text-slate-400">
                              {/* Trash header omitted */}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {classData.students.map((student, idx) => {
                            const stats = calculateMedia(student.id);
                            return (
                              <tr
                                key={student.id}
                                className="border-b border-slate-100 hover:bg-slate-50 transition-colors group"
                              >
                                <td className="p-4 text-sm text-slate-400 font-mono text-center sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[1px_0_0_#e2e8f0]">
                                  {idx + 1}
                                </td>
                                <td className="p-4 text-sm font-bold text-slate-700 truncate max-w-[200px] sticky left-[48px] bg-white group-hover:bg-slate-50 z-10 shadow-[1px_0_0_#e2e8f0]">
                                  {student.name}
                                </td>

                                {classData.tasks.map((task) => {
                                  const val =
                                    classData.grades[student.id]?.[task.id];
                                  const converted =
                                    val !== null && val !== undefined
                                      ? ((val * 10) / 60).toFixed(1)
                                      : null;
                                  return (
                                    <td
                                      key={task.id}
                                      className="p-3 border-l border-slate-100 align-top"
                                    >
                                      <input
                                        type="number"
                                        readOnly
                                        value={
                                          val === null || val === undefined
                                            ? ""
                                            : val
                                        }
                                        className={`w-full bg-transparent border-b-2 px-2 py-1 text-center font-bold text-sm focus:outline-none transition-all cursor-default opacity-90 ${
                                          val === undefined ||
                                          val === null ||
                                          String(val) === ""
                                            ? "border-dashed border-slate-200 text-slate-400 focus:border-indigo-500"
                                            : Number(converted) < 5
                                              ? "border-red-200 text-red-600 bg-red-50/50 focus:border-red-500"
                                              : Number(converted) < 8
                                                ? "border-emerald-200 text-emerald-500 bg-emerald-50/50 focus:border-emerald-400"
                                                : "border-emerald-300 text-emerald-700 bg-emerald-100/50 focus:border-emerald-500"
                                        }`}
                                        placeholder="--"
                                      />
                                      {converted !== null &&
                                        converted !== undefined &&
                                        String(val) !== "" && (
                                          <div
                                            className={`text-center font-bold text-[10px] mt-1 ${
                                              Number(converted) < 5
                                                ? "text-red-500"
                                                : Number(converted) < 8
                                                  ? "text-emerald-500"
                                                  : "text-emerald-700"
                                            }`}
                                          >
                                            Nota: {converted}
                                          </div>
                                        )}
                                    </td>
                                  );
                                })}
                                <td className="p-4 font-black border-l-2 border-indigo-100 bg-indigo-50/30 text-center flex flex-col justify-center h-full gap-1">
                                  <span
                                    className={`text-lg ${
                                      stats.scoredTasks === 0
                                        ? "text-slate-300"
                                        : stats.converted10 < 5
                                          ? "text-red-600"
                                          : stats.converted10 < 8
                                            ? "text-emerald-500"
                                            : "text-emerald-700"
                                    }`}
                                    title={`Soma: ${stats.final.toFixed(1)} pontos`}
                                  >
                                    {stats.converted10.toFixed(1)}
                                  </span>
                                  {stats.scoredTasks > 0 && (
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      Soma: {stats.final.toFixed(1)}
                                    </span>
                                  )}
                                </td>
                                <td className="p-4 text-center text-slate-400 opacity-50">
                                  {/* Ocultado no Legado */}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </>
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
              className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-w-xl w-full relative z-10 flex flex-col max-h-[90vh] overflow-hidden"
            >
              <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2 shrink-0">
                Atualizar Lista de Alunos
              </h2>
              <p className="text-slate-500 mb-6 font-medium leading-relaxed shrink-0">
                Cole a lista de nomes abaixo ou faça upload de um CSV/TXT para a
                turma{" "}
                <span className="bg-slate-100 px-2 rounded">
                  {selectedTurma}
                </span>
                . Você pode optar por adicionar apenas os novos ou substituir a
                lista inteira.
              </p>

              <div className="flex-1 min-h-0 mb-6 overflow-y-auto">
                <textarea
                  value={studentNamesInput}
                  onChange={(e) => setStudentNamesInput(e.target.value)}
                  className="w-full h-full min-h-[150px] p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm resize-none whitespace-pre"
                  placeholder={`Maria da Silva\nJoão Souza\n...`}
                />
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-5 border-t border-slate-100 shrink-0">
                <div className="flex justify-center w-full md:w-auto shrink-0">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".csv,.txt,.pdf,.docx"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full md:w-auto px-5 py-2.5 bg-slate-50 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 border border-slate-200 text-sm whitespace-nowrap"
                  >
                    <Upload size={16} /> Upload Arquivo
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row flex-wrap justify-center md:justify-end items-center gap-2 w-full md:w-auto shrink-0">
                  <button
                    onClick={() => setIsImportModalOpen(false)}
                    className="w-full sm:w-auto px-4 py-2.5 text-slate-500 font-bold rounded-xl hover:bg-slate-100 transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleImportStudents("replace")}
                    disabled={!studentNamesInput.trim()}
                    className="w-full sm:w-auto px-4 py-2.5 bg-rose-50 text-rose-700 font-bold rounded-xl hover:bg-rose-100 transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
                  >
                    Substituir Todos
                  </button>
                  <button
                    onClick={() => handleImportStudents("merge")}
                    disabled={!studentNamesInput.trim()}
                    className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 text-sm whitespace-nowrap"
                  >
                    Adicionar Novos
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
