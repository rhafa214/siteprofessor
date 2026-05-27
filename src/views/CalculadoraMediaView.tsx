import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
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

  useEffect(() => {
    if (!selectedTurma) return;

    // To correctly evaluate we need:
    // 1. All unique students across all these platforms.
    // 2. The grades themselves.
    const loadData = async () => {
      setLoading(true);
      try {
        const bKey = selectedBimestre.replace("º Bimestre", "");

        // Let's gather all data from localStorage as a fallback, Firebase as primary (to be fully accurate, we just read from localStorage for speed since the app mostly relies on localStorage and syncs to firebase)
        // Since we are reading local data mostly except for the sync tools, let's just use localStorage.

        let localTasks = localStorage.getItem(
          `taskAnalysis_${bKey}_${selectedTurma}`,
        );
        if (!localTasks && bKey === "2") {
          localTasks = localStorage.getItem(`taskAnalysis_${selectedTurma}`);
        }
        const taskData = localTasks
          ? JSON.parse(localTasks)
          : { students: [], tasks: [], grades: {} };
        
        setHasTasks(taskData.tasks && taskData.tasks.length > 0);

        let localMatific = localStorage.getItem(
          `matificAnalysis_${bKey}_${selectedTurma}`,
        );
        if (!localMatific && bKey === "2") {
          localMatific = localStorage.getItem(
            `matificAnalysis_${selectedTurma}`,
          );
        }
        const matificData = localMatific
          ? JSON.parse(localMatific)
          : { students: [], weeks: [], minutes: {} };

        let localPaulista = localStorage.getItem(`pp_${bKey}_${selectedTurma}`);
        if (!localPaulista && bKey === "2") {
          localPaulista = localStorage.getItem(`pp_${selectedTurma}`);
        }
        const paulistaData = localPaulista
          ? JSON.parse(localPaulista)
          : { students: [], exams: [], grades: {} };

        // Avaliação Bimestral
        const avalBimKey = `${selectedBimestre}_${selectedTurma}_bimestral`;
        const oldAvalBimKey = `${selectedTurma}_bimestral`;
        let avalGradesRaw = localStorage.getItem("assessments_grades");
        let avalData: any[] = [];
        if (avalGradesRaw) {
          const parsed = JSON.parse(avalGradesRaw);
          avalData =
            parsed[avalBimKey] ||
            (bKey === "2" ? parsed[oldAvalBimKey] : []) ||
            [];
        }

        // Simulado
        const avalSimKey = `${selectedBimestre}_${selectedTurma}_simulado`;
        const oldAvalSimKey = `${selectedTurma}_simulado`;
        let simData: any[] = [];
        if (avalGradesRaw) {
          const parsed = JSON.parse(avalGradesRaw);
          simData =
            parsed[avalSimKey] ||
            (bKey === "2" ? parsed[oldAvalSimKey] : []) ||
            [];
        }

        // Participação
        const pKey = `${selectedBimestre}_${selectedTurma}_participacao`;
        const oldPKey = `${selectedTurma}_participacao`;
        let participacaoData: any[] = [];
        if (avalGradesRaw) {
          const parsed = JSON.parse(avalGradesRaw);
          participacaoData =
            parsed[pKey] ||
            (bKey === "2" ? parsed[oldPKey] : []) ||
            [];
        }

        // Extract and merge all students:
        const studentsMap = new Map<string, any>();

        [
          ...taskData.students,
          ...matificData.students,
          ...paulistaData.students,
        ].forEach((s: any) => {
          if (!studentsMap.has(s.name.toLowerCase())) {
            studentsMap.set(s.name.toLowerCase(), { id: s.id, name: s.name });
          }
        });

        avalData.concat(simData, participacaoData).forEach((s: any) => {
          if (!studentsMap.has(s.studentName.toLowerCase())) {
            studentsMap.set(s.studentName.toLowerCase(), {
              id: s.id || `st_${Date.now()}`,
              name: s.studentName,
            });
          }
        });

        const studentsArr = Array.from(studentsMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name),
        );

        // For each student calculate the individual scores out of 10.
        const meta = studentsArr.map((student) => {
          // 1. Task (10%)
          // calculation from TaskAnalysis:
          let taskScore = 0;
          let taskCount = 0;
          const sTaskGrades = taskData.grades[student.id] || {};
          taskData.tasks.forEach((t: any) => {
            const g = sTaskGrades[t.id];
            if (g !== null && g !== undefined && !Number.isNaN(Number(g))) {
              taskScore += (Number(g) * 10) / 60;
              taskCount++;
            }
          });
          const notaTarefa = taskCount > 0 ? taskScore / taskCount : 10; // "quando não houver será uma nota de participação"

          // 2. Matific (10%)
          // calculation: 30 mins = 10
          let matScore = 0;
          let matCount = 0;
          const sMatGrades = matificData.minutes[student.id] || {};
          matificData.weeks.forEach((w: any) => {
            const m = sMatGrades[w.id];
            if (m !== null && m !== undefined && !Number.isNaN(Number(m))) {
              let g = (Number(m) / 30) * 10;
              if (g > 10) g = 10;
              matScore += g;
              matCount++;
            }
          });
          const notaMatific = matCount > 0 ? matScore / matCount : 0;

          // 3. Paulista (30%)
          let paulistaScore = 0;
          let paulistaMax = 0;
          const sPGrades = paulistaData.grades[student.id] || {};
          paulistaData.exams.forEach((ex: any) => {
            const g = sPGrades[ex.id];
            if (g !== null && g !== undefined) {
              paulistaScore += g;
              paulistaMax += ex.maxScore;
            }
          });
          const notaPaulista =
            paulistaMax > 0 ? (paulistaScore / paulistaMax) * 10 : 0;

          // 4. Avaliacao (30%)
          const aGradeRow = avalData.find(
            (a: any) =>
              a.studentName.toLowerCase() === student.name.toLowerCase(),
          );
          const notaAvaliacao =
            aGradeRow && typeof aGradeRow.grade === "number"
              ? aGradeRow.grade
              : 0;

          // 5. Simulado (20%)
          const sGradeRow = simData.find(
            (a: any) =>
              a.studentName.toLowerCase() === student.name.toLowerCase(),
          );
          const notaSimulado =
            sGradeRow && typeof sGradeRow.grade === "number"
              ? sGradeRow.grade
              : 0;

          // 6. Participação (10%)
          const pGradeRow = participacaoData.find(
            (a: any) =>
              a.studentName.toLowerCase() === student.name.toLowerCase(),
          );
          const notaParticipacao =
            pGradeRow && typeof pGradeRow.grade === "number"
              ? pGradeRow.grade
              : 0;

          let wAval = 0.3;
          let wPaul = 0.3;
          let wSim = 0.2;
          let wPart = 0.1;

          let wMatific = 0.05;
          let wTarefa = 0.05;

          if (taskData.tasks.length === 0) {
            wMatific = 0.1;
            wTarefa = 0;
          }

          // Media Final
          const mediaFinal =
            notaAvaliacao * wAval +
            notaPaulista * wPaul +
            notaSimulado * wSim +
            notaParticipacao * wPart +
            notaMatific * wMatific +
            notaTarefa * wTarefa;

          return {
            ...student,
            notaTarefa,
            notaMatific,
            notaPaulista,
            notaAvaliacao,
            notaSimulado,
            notaParticipacao, // new
            mediaFinal,
          };
        });

        setStudentsMeta(meta);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedBimestre, selectedTurma]);

  if (!selectedTurma) {
    return (
      <div className="flex flex-col h-full bg-slate-50/50">
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
                onClick={() => setSelectedTurma(turma)}
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
      </div>
    );
  }

  return (
    <div className="h-full bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
      <div className="p-4 md:p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 bg-slate-50">
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
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
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
                      {s.notaParticipacao !== undefined ? s.notaParticipacao.toFixed(1) : "0.0"}
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
