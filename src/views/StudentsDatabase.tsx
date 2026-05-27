import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  Search,
  Book,
  ChevronRight,
  ChevronDown,
  GraduationCap,
  Loader2,
  Trash2,
  Upload,
  FileText,
} from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { useAlert } from "../contexts/AlertContext";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { extractTextFromFile } from "../lib/fileExtraction";
import { extractStudents } from "../studentExtractor";

interface StudentData {
  id: string;
  name: string;
  turma: string;
}

export default function StudentsDatabase() {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const { showAlert } = useAlert();
  const [students, setStudents] = useState<StudentData[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [expandedTurmas, setExpandedTurmas] = useState<Record<string, boolean>>(
    {},
  );

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTargetTurma, setImportTargetTurma] = useState<string | null>(
    null,
  );
  const [importText, setImportText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStudents = async () => {
    setIsLoading(true);
    if (user) {
      try {
        const snap = await getDocs(
          collection(db, "users", user.uid, "taskAnalysis"),
        );
        const allStudents: StudentData[] = [];

        snap.forEach((d) => {
          const turmaName = d.id;
          const data = d.data();

          if (data && data.students) {
            data.students.forEach((s: any) => {
              allStudents.push({
                id: s.id,
                name: s.name,
                turma: turmaName,
              });
            });
          }
        });

        allStudents.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(allStudents);
      } catch (e) {
        console.error("Error fetching students", e);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchStudents();
  }, [user]);

  const handleDeleteTurma = async (turmaId: string) => {
    if (!user) return;
    if (
      await confirm({
        title: "Excluir Turma",
        message: `Tem certeza que deseja excluir a turma "${turmaId}" e TODOS os seus alunos e notas?`,
      })
    ) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "taskAnalysis", turmaId));
        setStudents((prev) => prev.filter((s) => s.turma !== turmaId));

        try {
          const stored = window.localStorage.getItem("classTurmasList");
          if (stored) {
            const list = JSON.parse(stored);
            if (Array.isArray(list)) {
              const updated = list.filter((t) => t !== turmaId);
              window.localStorage.setItem(
                "classTurmasList",
                JSON.stringify(updated),
              );
              window.dispatchEvent(new Event("local-storage"));
            }
          }
        } catch (e) {}
      } catch (e) {
        console.error("Error deleting turma:", e);
        showAlert("Erro ao excluir turma.", "Erro", "error");
      }
    }
  };

  const removeStudent = async (turmaId: string, studentId: string) => {
    if (
      !(await confirm({
        title: "Remover Aluno",
        message: "Tem certeza que deseja remover este aluno da turma?",
      }))
    )
      return;

    if (user) {
      try {
        const docRef = doc(db, "users", user.uid, "taskAnalysis", turmaId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          const newStudents = data.students.filter(
            (s: any) => s.id !== studentId,
          );
          const newGrades = { ...data.grades };
          delete newGrades[studentId];
          await updateDoc(docRef, { students: newStudents, grades: newGrades });

          setStudents((prev) =>
            prev.filter((s) => !(s.id === studentId && s.turma === turmaId)),
          );
        }
      } catch (e) {
        console.error("Error removing student", e);
      }
    }
  };

  const handleOpenImport = (turma: string) => {
    setImportTargetTurma(turma);
    setImportText("");
    setIsImportModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const text = await extractTextFromFile(file);
        if (text) {
          setImportText(text);
        }
      } catch (err: any) {
        showAlert(err.message || "Erro ao ler arquivo.", "Erro", "error");
      }
    }
  };

  const handleImportStudents = async (mode: "replace" | "merge") => {
    if (!importTargetTurma || !user) return;

    const extractedNames = extractStudents(importText);

    try {
      const docRef = doc(
        db,
        "users",
        user.uid,
        "taskAnalysis",
        importTargetTurma,
      );
      const snap = await getDoc(docRef);

      let classData = {
        students: [] as any[],
        tasks: [] as any[],
        grades: {} as Record<string, any>,
      };
      if (snap.exists()) {
        classData = snap.data() as any;
      }

      const existingStudents = classData.students || [];
      const newStudentsList = mode === "replace" ? [] : [...existingStudents];

      extractedNames.forEach((name) => {
        const existing = classData.students?.find((s: any) => s.name === name);
        if (existing) {
          if (mode === "replace") {
            newStudentsList.push(existing);
          }
        } else {
          newStudentsList.push({ id: crypto.randomUUID(), name });
        }
      });

      const newGrades = { ...classData.grades };
      Object.keys(newGrades).forEach((studentId) => {
        if (!newStudentsList.find((s: any) => s.id === studentId)) {
          delete newGrades[studentId];
        }
      });

      await setDoc(docRef, {
        ...classData,
        students: newStudentsList,
        grades: newGrades,
      });

      setIsImportModalOpen(false);
      await fetchStudents();
    } catch (e) {
      console.error("Error importing students", e);
      showAlert("Houve um erro ao importar a lista.", "Erro", "error");
    }
  };

  const toggleTurma = (turma: string) => {
    setExpandedTurmas((prev) => ({ ...prev, [turma]: !prev[turma] }));
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.turma.toLowerCase().includes(search.toLowerCase()),
  );

  const groupedStudents = filteredStudents.reduce(
    (acc, student) => {
      if (!acc[student.turma]) {
        acc[student.turma] = [];
      }
      acc[student.turma].push(student);
      return acc;
    },
    {} as Record<string, StudentData[]>,
  );

  // Determine Turmas to display, even empty ones if search is empty, but we only have students.
  // We'll just show what's in groupedStudents.

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto space-y-6 pb-24"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl shadow-sm">
              <Users size={28} />
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Banco de Alunos
            </h1>
          </div>
          <p className="text-slate-500 font-medium">
            Cadastros e turmas organizados de forma simples e rápida.
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <input
              type="text"
              placeholder="Buscar aluno por nome ou turma..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-sm"
            />
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
          </div>
          <div className="text-sm font-bold text-slate-500 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
            <GraduationCap size={16} className="text-blue-600" />
            {students.length} Alunos Cadastrados
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="animate-spin mb-4 text-blue-600" size={32} />
              <p className="font-medium">Carregando banco de dados...</p>
            </div>
          ) : Object.keys(groupedStudents).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Users className="mb-4 opacity-20" size={64} />
              <p className="text-lg font-bold text-slate-600 mb-2">
                Nenhum aluno encontrado
              </p>
              <p className="text-sm">
                Abra a janela de "Controle de Tarefas" para cadastrar alunos das
                turmas.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedStudents)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([turma, turmaStudents]) => {
                  const isExpanded = expandedTurmas[turma] || search.length > 0;
                  return (
                    <div
                      key={turma}
                      className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
                    >
                      <div
                        className={`p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? "bg-slate-50 border-b border-slate-100" : ""}`}
                        onClick={() => toggleTurma(turma)}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg transition-colors ${isExpanded ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}
                          >
                            <Book size={20} />
                          </div>
                          <h2 className="text-lg font-bold text-slate-800">
                            {turma}
                          </h2>
                          <span className="text-xs font-bold text-slate-500 bg-slate-200/50 px-2.5 py-1 rounded-lg">
                            {turmaStudents.length}{" "}
                            {turmaStudents.length === 1 ? "aluno" : "alunos"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isExpanded && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenImport(turma);
                                }}
                                className="bg-white text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-indigo-50 shadow-sm flex items-center gap-2 transition-colors mr-1"
                                title="Substituir todos os alunos da turma"
                              >
                                <Upload size={16} /> Substituir Lista
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTurma(turma);
                                }}
                                className="bg-white text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-red-50 shadow-sm flex items-center gap-2 transition-colors mr-2"
                                title="Excluir Turma"
                              >
                                <Trash2 size={16} /> Excluir
                              </button>
                            </>
                          )}
                          <div
                            className={`text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                          >
                            <ChevronDown size={24} />
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-50/30">
                              {turmaStudents.map((student) => (
                                <div
                                  key={student.id}
                                  className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-sm group"
                                >
                                  <span className="font-semibold text-slate-700 uppercase text-sm leading-tight group-hover:text-blue-700 transition-colors">
                                    {student.name}
                                  </span>
                                  <button
                                    onClick={() =>
                                      removeStudent(turma, student.id)
                                    }
                                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                    title="Remover Aluno"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

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
                Cole a lista de nomes abaixo ou faça upload de um CSV/PDF para a
                turma{" "}
                <span className="bg-slate-100 px-2 rounded">
                  {importTargetTurma}
                </span>
                . Você pode optar por adicionar apenas os novos ou substituir a
                lista inteira. Alunos com nomes já existentes manterão suas
                notas.
              </p>

              <div className="flex-1 min-h-0 mb-6 overflow-y-auto">
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
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
                    <FileText size={16} /> Upload Arquivo
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
                    disabled={!importText.trim()}
                    className="w-full sm:w-auto px-4 py-2.5 bg-rose-50 text-rose-700 font-bold rounded-xl hover:bg-rose-100 transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
                  >
                    Substituir Todos
                  </button>
                  <button
                    onClick={() => handleImportStudents("merge")}
                    disabled={!importText.trim()}
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
