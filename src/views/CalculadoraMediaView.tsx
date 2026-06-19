import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Calculator,
  ChevronRight,
  Download,
  Users,
  AlertCircle,
} from "lucide-react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import BimestralReportView from "../components/BimestralReportView";

export default function CalculadoraMediaView({
  selectedBimestre,
}: {
  selectedBimestre: string;
}) {
  const { user } = useAuth();
  const [turmasList] = useLocalStorage<string[]>("classTurmasList", []);
  const [selectedTurma, setSelectedTurma] = useState<string | null>(null);
  const [studentsMeta, setStudentsMeta] = useState<any[]>([]);
  const [hasTasks, setHasTasks] = useState(true);
  const [loading, setLoading] = useState(false);
  const [subTab, setSubTab] = useState<"tabela" | "relatorio">("tabela");

  const calculateForTurma = (turma: string, bBimestre: string) => {
    const bKey = bBimestre.replace("º Bimestre", "");

    let localTasks = localStorage.getItem(`taskAnalysis_${bKey}_${turma}`);
    if (!localTasks && bKey === "2") localTasks = localStorage.getItem(`taskAnalysis_${turma}`);
    const taskData = localTasks ? JSON.parse(localTasks) : { students: [], tasks: [], grades: {} };

    let localMatific = localStorage.getItem(`matificAnalysis_${bKey}_${turma}`);
    if (!localMatific && bKey === "2") localMatific = localStorage.getItem(`matificAnalysis_${turma}`);
    const matificData = localMatific ? JSON.parse(localMatific) : { students: [], weeks: [], minutes: {} };

    let localPaulista = localStorage.getItem(`pp_${bKey}_${turma}`);
    if (!localPaulista && bKey === "2") localPaulista = localStorage.getItem(`pp_${turma}`);
    const paulistaData = localPaulista ? JSON.parse(localPaulista) : { students: [], exams: [], grades: {} };

    let avalGradesRaw = localStorage.getItem("assessments_grades");
    let avalData: any[] = [];
    let simData: any[] = [];
    let participacaoData: any[] = [];
    if (avalGradesRaw) {
      const parsed = JSON.parse(avalGradesRaw);
      avalData = parsed[`${bBimestre}_${turma}_bimestral`] || (bKey === "2" ? parsed[`${turma}_bimestral`] : []) || [];
      simData = parsed[`${bBimestre}_${turma}_simulado`] || (bKey === "2" ? parsed[`${turma}_simulado`] : []) || [];
      participacaoData = parsed[`${bBimestre}_${turma}_participacao`] || (bKey === "2" ? parsed[`${turma}_participacao`] : []) || [];
    }

    const studentsMap = new Map<string, any>();
    [...taskData.students, ...matificData.students, ...paulistaData.students].forEach((s: any) => {
      if (!studentsMap.has(s.name.toLowerCase())) studentsMap.set(s.name.toLowerCase(), { id: s.id, name: s.name });
    });
    avalData.concat(simData, participacaoData).forEach((s: any) => {
      if (!studentsMap.has(s.studentName.toLowerCase())) {
        studentsMap.set(s.studentName.toLowerCase(), { id: s.id || `st_${Date.now()}`, name: s.studentName });
      }
    });

    const studentsArr = Array.from(studentsMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    return studentsArr.map((student) => {
      let taskScore = 0; let taskCount = 0;
      const sTaskGrades = taskData.grades[student.id] || {};
      taskData.tasks.forEach((t: any) => {
        const g = sTaskGrades[t.id];
        if (g !== null && g !== undefined && !Number.isNaN(Number(g))) { taskScore += (Number(g) * 10) / 60; taskCount++; }
      });
      const notaTarefa = taskCount > 0 ? taskScore / taskCount : 10;

      let matScore = 0; let matCount = 0;
      const sMatGrades = matificData.minutes[student.id] || {};
      matificData.weeks.forEach((w: any) => {
        const m = sMatGrades[w.id];
        if (m !== null && m !== undefined && !Number.isNaN(Number(m))) {
          let g = (Number(m) / 30) * 10; if (g > 10) g = 10; matScore += g; matCount++;
        }
      });
      const notaMatific = matCount > 0 ? matScore / matCount : 0;

      let paulistaScore = 0; let paulistaMax = 0;
      const sPGrades = paulistaData.grades[student.id] || {};
      paulistaData.exams.forEach((ex: any) => {
        const g = sPGrades[ex.id];
        if (g !== null && g !== undefined) { paulistaScore += g; paulistaMax += ex.maxScore; }
      });
      const notaPaulista = paulistaMax > 0 ? (paulistaScore / paulistaMax) * 10 : 0;

      const avalGradeRow = avalData.find((a: any) => a.studentName.toLowerCase() === student.name.toLowerCase());
      const notaAvaliacao = avalGradeRow && typeof avalGradeRow.grade === "number" ? avalGradeRow.grade : 0;

      const simGradeRow = simData.find((a: any) => a.studentName.toLowerCase() === student.name.toLowerCase());
      const notaSimulado = simGradeRow && typeof simGradeRow.grade === "number" ? simGradeRow.grade : 0;

      const pGradeRow = participacaoData.find((a: any) => a.studentName.toLowerCase() === student.name.toLowerCase());
      const notaParticipacao = pGradeRow && typeof pGradeRow.grade === "number" ? pGradeRow.grade : 0;

      let wMatific = 0.05; let wTarefa = 0.05;
      if (taskData.tasks.length === 0) { wMatific = 0.1; wTarefa = 0; }

      const mediaFinal = (notaAvaliacao * 0.3) + (notaPaulista * 0.3) + (notaSimulado * 0.2) + (notaParticipacao * 0.1) + (notaMatific * wMatific) + (notaTarefa * wTarefa);

      return { ...student, notaTarefa, notaMatific, notaPaulista, notaAvaliacao, notaSimulado, notaParticipacao, mediaFinal };
    });
  };

  useEffect(() => {
    if (!selectedTurma) return;
    setLoading(true);
    try {
      const meta = calculateForTurma(selectedTurma, selectedBimestre);
      setStudentsMeta(meta);

      const bKey = selectedBimestre.replace("º Bimestre", "");
      let localTasks = localStorage.getItem(`taskAnalysis_${bKey}_${selectedTurma}`);
      if (!localTasks && bKey === "2") {
        localTasks = localStorage.getItem(`taskAnalysis_${selectedTurma}`);
      }
      const taskData = localTasks ? JSON.parse(localTasks) : { tasks: [] };
      setHasTasks(taskData.tasks && taskData.tasks.length > 0);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedBimestre, selectedTurma]);

  if (!selectedTurma) {
    return (
      <div className="flex flex-col h-full bg-slate-50/50">
        <div className="px-4 pt-4 shrink-0">
          <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit max-w-full overflow-x-auto">
            <button
              onClick={() => setSubTab("tabela")}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${subTab === "tabela" ? "bg-white text-teal-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Listagem de Turmas
            </button>
            <button
              onClick={() => setSubTab("relatorio")}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${subTab === "relatorio" ? "bg-white text-teal-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Relatório Geral (Séries)
            </button>
          </div>
        </div>

        {subTab === "relatorio" ? (
          <div className="p-4 flex-1 overflow-auto">
            <BimestralReportView
              gradesData={turmasList.reduce((acc, turma) => {
                const meta = calculateForTurma(turma, selectedBimestre);
                acc[turma] = meta.map(s => ({
                  id: s.id,
                  studentName: s.name,
                  grade: Number(s.mediaFinal.toFixed(1))
                }));
                return acc;
              }, {} as any)}
              selectedBimestre={selectedBimestre}
              turmasList={turmasList || []}
              dataKeyFormat={(t) => t}
            />
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {!turmasList || turmasList.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-dashed border-slate-300">
                <Calculator className="w-12 h-12 text-slate-400 mb-4" />
                <h2 className="text-xl font-bold text-slate-800 mb-2">
                  Nenhuma Turma Adicionada
                </h2>
              </div>
            ) : (
              turmasList.map((turma) => (
                <motion.div
                  key={turma}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group"
                  onClick={() => {
                    setSelectedTurma(turma);
                    setSubTab("tabela");
                  }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                      <Calculator size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 leading-tight">
                      {turma}
                    </h3>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
      <div className="p-4 md:p-6 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shrink-0 bg-slate-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedTurma(null)}
            className="p-2 bg-white hover:bg-slate-100 text-slate-600 rounded-xl transition-colors border border-slate-200"
          >
            <ChevronRight size={20} className="rotate-180" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {selectedTurma}
            </h2>
            <p className="text-xs text-slate-500">
              Média Consolidada ({selectedBimestre})
            </p>
          </div>
        </div>
        <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => setSubTab("tabela")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${subTab === "tabela" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Tabela de Notas
          </button>
          <button
            onClick={() => setSubTab("relatorio")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${subTab === "relatorio" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Relatório Estatístico
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 bg-slate-50/50">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin text-teal-600 border-4 border-current border-t-transparent rounded-full w-8 h-8"></div>
          </div>
        ) : studentsMeta.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <Users className="w-16 h-16 text-slate-200 mb-4" />
            <h3 className="text-xl font-bold text-slate-700 mb-2">
              Turma Vazia
            </h3>
            <p className="text-slate-500 mb-6">
              Cadastre alunos nas outras avaliações desta turma e as médias
              aparecerão aqui automaticamente.
            </p>
          </div>
        ) : subTab === "relatorio" ? (
          <BimestralReportView
            gradesData={{
              [selectedTurma]: studentsMeta.map((s) => ({
                id: s.id,
                studentName: s.name,
                grade: s.mediaFinal,
              })),
            }}
            selectedBimestre={selectedBimestre}
            selectedTurma={selectedTurma}
            dataKeyFormat={(t) => t}
          />
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-sm">
            <table className="w-full min-w-[800px] text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 sticky left-0 bg-slate-50 shadow-[1px_0_0_#e2e8f0]">
                    ALUNO
                  </th>
                  <th className="px-4 py-3 text-center border-l bg-orange-50/50 text-orange-800 border-slate-200">
                    Avaliação <br />
                    <span className="text-[10px] font-normal">(30%)</span>
                  </th>
                  <th className="px-4 py-3 text-center border-l bg-indigo-50/50 text-indigo-800 border-slate-200">
                    Prova Pta. <br />
                    <span className="text-[10px] font-normal">(30%)</span>
                  </th>
                  <th className="px-4 py-3 text-center border-l bg-amber-50/50 text-amber-800 border-slate-200">
                    Simulado <br />
                    <span className="text-[10px] font-normal">(20%)</span>
                  </th>
                  <th className="px-4 py-3 text-center border-l bg-pink-50/50 text-pink-800 border-slate-200">
                    Particip. <br />
                    <span className="text-[10px] font-normal">(10%)</span>
                  </th>
                  <th className="px-4 py-3 text-center border-l bg-blue-50/50 text-blue-800 border-slate-200">
                    Matific <br />
                    <span className="text-[10px] font-normal">
                      ({hasTasks ? "5%" : "10%"})
                    </span>
                  </th>
                  <th className="px-4 py-3 text-center border-l bg-emerald-50/50 text-emerald-800 border-slate-200">
                    Tarefas <br />
                    <span className="text-[10px] font-normal">
                      ({hasTasks ? "5%" : "0%"})
                    </span>
                  </th>
                  <th className="px-4 py-3 text-center border-l bg-teal-50 text-teal-900 border-teal-200 text-base">
                    Média Final
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentsMeta.map((s, idx) => (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-2 sticky left-0 bg-white shadow-[1px_0_0_#e2e8f0] truncate max-w-[200px] font-medium text-slate-700">
                      {s.name}
                    </td>
                    <td className="px-4 py-2 text-center border-l border-slate-100">
                      {s.notaAvaliacao.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-center border-l border-slate-100">
                      {s.notaPaulista.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-center border-l border-slate-100">
                      {s.notaSimulado.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-center border-l border-slate-100 font-medium">
                      {s.notaParticipacao !== undefined
                        ? s.notaParticipacao.toFixed(1)
                        : "0.0"}
                    </td>
                    <td className="px-4 py-2 text-center border-l border-slate-100">
                      {s.notaMatific.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-center border-l border-slate-100">
                      {s.notaTarefa.toFixed(1)}
                    </td>
                    <td
                      className={`px-4 py-2 text-center border-l-2 font-black text-lg ${s.mediaFinal < 5 ? "text-red-600 bg-red-50/30 border-red-100" : "text-teal-700 bg-teal-50/30 border-teal-100"}`}
                    >
                      {s.mediaFinal.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
