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
import { extractTextFromFile } from "../lib/fileExtraction";

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

export default function TaskAnalysis() {
  const { user } = useAuth();
  const { confirm } = useConfirm();
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
      try {
        if (user) {
          const docRef = doc(
            db,
            "users",
            user.uid,
            "taskAnalysis",
            selectedTurma,
          );
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            setClassData(snap.data() as ClassData);
          } else {
            // Check local storage fallback
            const localData = localStorage.getItem(
              `taskAnalysis_${selectedTurma}`,
            );
            setClassData(localData ? JSON.parse(localData) : defaultClassData);
          }
        } else {
          const localData = localStorage.getItem(
            `taskAnalysis_${selectedTurma}`,
          );
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
    setClassData(newData);
    try {
      if (user) {
        // Save to firebase
        setIsSaving(true);
        await setDoc(
          doc(db, "users", user.uid, "taskAnalysis", selectedTurma),
          newData,
        );
        setIsSaving(false);
      }
      // Always save to local storage as backup
      localStorage.setItem(
        `taskAnalysis_${selectedTurma}`,
        JSON.stringify(newData),
      );
    } catch (e) {
      console.error("Error saving task data", e);
      setIsSaving(false);
    }
  };

  // ----------------------------------------
  // STUDENTS MANAGEMENT
  // ----------------------------------------
  const [isAddingStudents, setIsAddingStudents] = useState(false);
  const [studentNamesInput, setStudentNamesInput] = useState("");

  const handleAddStudents = () => {
    if (!studentNamesInput.trim()) return;

    const lines = studentNamesInput
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l);
    const newStudents = [...classData.students];
    const newGrades = { ...classData.grades };

    for (const name of lines) {
      // Basic check to see if student already exists by name
      if (
        !newStudents.some((s) => s.name.toLowerCase() === name.toLowerCase())
      ) {
        const newId = `st_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        newStudents.push({ id: newId, name });
        newGrades[newId] = {};
      }
    }

    // Sort students alphabetically
    newStudents.sort((a, b) => a.name.localeCompare(b.name));

    saveClassData({ ...classData, students: newStudents, grades: newGrades });
    setStudentNamesInput("");
    setIsAddingStudents(false);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await extractTextFromFile(file);

      if (text) {
        const rows = text
          .split("\n")
          .map((r) => r.trim())
          .filter((r) => r);
        let extractedNames: string[] = [];

        for (const row of rows) {
          if (
            row.toLowerCase().includes("situação") ||
            row.toLowerCase().includes("nº de chamada")
          ) {
            continue; // Pular cabeçalho
          }

          if (row.includes(";")) {
            // CSV: 1;NOME DO ALUNO;Ativo
            const parts = row.split(";");
            if (parts.length >= 2) {
              const name = parts[1].trim();
              const status =
                parts.length >= 3 ? parts[2].trim().toLowerCase() : "ativo";
              if (name && isNaN(Number(name)) && status === "ativo") {
                extractedNames.push(name);
              }
            }
          } else {
            if (row.length > 2) {
              extractedNames.push(row);
            }
          }
        }

        setStudentNamesInput(extractedNames.join("\n"));
        setIsAddingStudents(true);
      }
    } catch (err: any) {
      console.error(err);
      alert(
        err.message ||
          "Erro ao ler arquivo. Tente copiar e colar os nomes na caixa de texto.",
      );
    } finally {
      e.target.value = "";
    }
  };

  const removeStudent = async (id: string) => {
    if (
      await confirm({
        title: "Remover Aluno",
        message: "Tem certeza que deseja remover este aluno e todas as suas notas?",
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
        message: "Tem certeza que deseja remover esta tarefa? Todas as notas associadas serão apagadas.",
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
        title: "Excluir Turma",
        message: `Tem certeza que deseja excluir a turma "${turma}" permanentemente? Isso apagará todas as tarefas e notas associadas.`,
        isDestructive: true,
      })
    ) {
      const newList = (turmasList || []).filter((t) => t !== turma);
      setTurmasList(newList);
      localStorage.removeItem(`taskAnalysis_${turma}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto space-y-6 pb-24"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl shadow-sm">
              <ClipboardCheck size={28} />
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Controle de Tarefas
            </h1>
          </div>
          <p className="text-slate-500 font-medium">
            Acompanhe a entrega de trabalhos e componha a média final de cada
            aluno.
          </p>
        </div>
      </div>

      {!selectedTurma ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
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
              const localData = localStorage.getItem(`taskAnalysis_${turma}`);
              let studentsCount = 0;
              let tasksCount = 0;
              if (localData) {
                try {
                  const parsed = JSON.parse(localData);
                  studentsCount = parsed.students?.length || 0;
                  tasksCount = parsed.tasks?.length || 0;
                } catch (e) {}
              }

              return (
                <motion.div
                  key={turma}
                  whileHover={{ y: -4 }}
                  onClick={() => setSelectedTurma(turma)}
                  className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm cursor-pointer hover:shadow-md hover:border-emerald-200 transition-all group flex flex-col justify-between min-h-[160px] relative"
                >
                  <button
                    onClick={(e) => handleDeleteTurma(e, turma)}
                    className="absolute top-4 right-4 p-2 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                    title="Excluir Turma"
                  >
                    <Trash2 size={18} />
                  </button>
                  <div>
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Users size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 tracking-tight mb-2 pr-8">
                      {turma}
                    </h3>
                    <div className="flex gap-4 text-xs font-bold text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users size={14} /> {studentsCount} Alunos
                      </span>
                      <span className="flex items-center gap-1">
                        <ClipboardCheck size={14} /> {tasksCount} Tarefas
                      </span>
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
      ) : (
        <div className="flex flex-col h-full min-h-0 gap-4">
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
          </div>

          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="animate-spin text-emerald-600" size={32} />
            </div>
          ) : (
            <div className="flex-1 bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-0">
              {/* Header Controls */}
              <div className="p-4 md:p-6 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsAddingStudents(!isAddingStudents)}
                    className={`flex items-center gap-2 px-4 py-2 bg-white border rounded-xl font-bold text-sm shadow-sm transition-colors ${isAddingStudents ? "border-emerald-500 text-emerald-700" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                  >
                    <Users size={16} /> Adicionar Alunos
                  </button>
                  <button
                    onClick={() => setIsAddingTask(!isAddingTask)}
                    className={`flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white border border-indigo-700 rounded-xl font-bold text-sm shadow-sm transition-colors hover:bg-indigo-700`}
                  >
                    <Plus size={16} /> Nova Tarefa/Av.
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                  {isSaving && (
                    <>
                      <Loader2 size={12} className="animate-spin" /> Salvando...
                    </>
                  )}
                  {!isSaving && (
                    <>
                      <CheckCircle2 size={12} /> Salvo
                    </>
                  )}
                </div>
              </div>

              {/* Adding Panels */}
              <AnimatePresence>
                {isAddingStudents && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-b border-slate-100 bg-white overflow-hidden"
                  >
                    <div className="p-6">
                      <div className="flex items-end justify-between mb-4">
                        <h3 className="font-bold text-slate-800">
                          Cadastro Rápido de Alunos
                        </h3>
                        <div className="flex gap-2">
                          <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".csv,.txt,.docx"
                            onChange={handleFileUpload}
                          />
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors border border-emerald-200"
                          >
                            <Upload size={14} /> Importar (CSV, TXT, DOCX)
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">
                        Cole a lista de nomes dos alunos abaixo (um por linha):
                      </p>
                      <textarea
                        className="w-full h-32 p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm resize-none mb-3"
                        value={studentNamesInput}
                        onChange={(e) => setStudentNamesInput(e.target.value)}
                        placeholder="Nome do Aluno 1&#10;Nome do Aluno 2&#10;..."
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setIsAddingStudents(false)}
                          className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleAddStudents}
                          className="px-4 py-2 text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-xl flex items-center gap-2"
                        >
                          <Save size={16} /> Salvar Lista
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {isAddingTask && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-b border-indigo-100 bg-indigo-50/30 overflow-hidden"
                  >
                    <form onSubmit={handleAddTask} className="p-6">
                      <h3 className="font-bold text-indigo-900 mb-4">
                        Adicionar Nova Tarefa ou Avaliação
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-indigo-800 uppercase tracking-wide mb-1">
                            Título/Descrição
                          </label>
                          <input
                            type="text"
                            required
                            value={newTask.title}
                            onChange={(e) =>
                              setNewTask({ ...newTask, title: e.target.value })
                            }
                            className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                            placeholder="Ex: Trabalho de Pesquisa"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-indigo-800 uppercase tracking-wide mb-1">
                            Data
                          </label>
                          <input
                            type="date"
                            required
                            value={newTask.date}
                            onChange={(e) =>
                              setNewTask({ ...newTask, date: e.target.value })
                            }
                            className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsAddingTask(false)}
                          className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-indigo-100 rounded-xl"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl flex items-center gap-2"
                        >
                          <Plus size={16} /> Adicionar
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main Grid */}
              <div className="overflow-auto flex-1 h-0">
                {classData.students.length === 0 ? (
                  <div className="p-16 text-center">
                    <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-700 mb-2">
                      Nenhum aluno cadastrado nesta turma
                    </h3>
                    <p className="text-slate-500">
                      Clique em "Adicionar Alunos" para colar a lista da sua
                      turma.
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
                              <button
                                onClick={() => removeTask(task.id)}
                                className="text-slate-400 hover:text-red-600 transition-colors p-1.5 bg-white rounded-md shadow-sm border border-slate-200"
                                title="Remover Tarefa"
                              >
                                <Trash2 size={12} />
                              </button>
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
                          <Trash2 size={16} className="mx-auto" />
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
                                    min="0"
                                    max="60"
                                    step="0.1"
                                    value={
                                      val === null || val === undefined
                                        ? ""
                                        : val
                                    }
                                    onChange={(e) =>
                                      handleGradeChange(
                                        student.id,
                                        task.id,
                                        e.target.value,
                                      )
                                    }
                                    onBlur={handleGradeBlur}
                                    className={`w-full bg-transparent border-b-2 px-2 py-1 text-center font-bold text-sm focus:outline-none focus:bg-white focus:rounded focus:shadow-sm transition-all ${
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
                            <td className="p-4 text-center">
                              <button
                                onClick={() => removeStudent(student.id)}
                                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                title="Remover Aluno"
                              >
                                <X size={16} />
                              </button>
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
        </div>
      )}
    </motion.div>
  );
}
