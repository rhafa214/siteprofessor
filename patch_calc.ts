import fs from "fs";

const content = `import React, { useState, useEffect } from "react";
import { Calculator, ChevronRight, Download, Users, AlertCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { BimestralGradeService, StudentGradeMeta } from "../services/academic/BimestralGradeService";
import { AcademicRosterService } from "../services/academic/AcademicRosterService";
import { CanonicalAssessmentService } from "../services/academic/CanonicalAssessmentService";
import { GradePlanService } from "../services/academic/GradePlanService";
import { CanonicalGradeComponent } from "../domain/assessment/GradePlanTypes";
import BimestralReportView from "../components/BimestralReportView";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function CalculadoraMediaView({ selectedBimestre }: { selectedBimestre: string }) {
  const { user } = useAuth();
  const [turmasList, setTurmasList] = useState<{id: string, name: string}[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<string | null>(null);
  const [studentsMeta, setStudentsMeta] = useState<StudentGradeMeta[]>([]);
  const [planComponents, setPlanComponents] = useState<CanonicalGradeComponent[]>([]);
  const [loading, setLoading] = useState(false);
  const [subTab, setSubTab] = useState<"tabela" | "relatorio">("tabela");

  const [termId, setTermId] = useState<string>("term_3"); // Hardcoded fallback if not found
  const [academicYearId, setAcademicYearId] = useState<string>("year_2024"); // Hardcoded fallback

  // Resolve Term and Year, then ClassGroups
  useEffect(() => {
    if (!user) return;
    const loadInit = async () => {
      // Simplification: We fetch classes dynamically
      const q = query(collection(db, "users", user.uid, "classGroups"), where("status", "==", "ACTIVE"));
      const snap = await getDocs(q);
      const classes = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
      if (classes.length > 0) {
         setTurmasList(classes);
      } else {
         // Fallback legacy names
         const legacy = localStorage.getItem("classTurmasList");
         if (legacy) setTurmasList(JSON.parse(legacy).map((n: string) => ({ id: n, name: n })));
      }
    };
    loadInit();
  }, [user]);

  useEffect(() => {
    if (!user || !selectedTurma || !selectedBimestre) return;

    const calculate = async () => {
      setLoading(true);
      try {
        const bgService = new BimestralGradeService(
          new AcademicRosterService(),
          new CanonicalAssessmentService(),
          new GradePlanService()
        );
        
        // Find bkey
        const bKey = selectedBimestre.replace("º Bimestre", "").trim();
        const tId = \`term_\${bKey}\`; // very simplified termId resolution for now

        const turmaName = turmasList.find(t => t.id === selectedTurma)?.name || selectedTurma;
        
        const result = await bgService.calculateForClass(
          user.uid,
          academicYearId,
          selectedTurma,
          tId,
          bKey,
          turmaName
        );

        setStudentsMeta(result.students);
        setPlanComponents(result.components);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    calculate();
  }, [user, selectedTurma, selectedBimestre, academicYearId]);

  if (!selectedTurma) {
    return (
      <div className="flex-1 overflow-auto bg-slate-50/50 p-6 flex flex-col gap-6">
        <h1 className="text-2xl font-black text-slate-800">Calculadora de Média Final</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {turmasList.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTurma(t.id)}
              className="p-6 bg-white rounded-3xl border border-slate-100 hover:border-teal-200 hover:shadow-lg transition-all text-left group flex justify-between items-center"
            >
              <div>
                <h3 className="font-bold text-slate-700 text-lg">{t.name}</h3>
                <p className="text-sm text-slate-400 mt-1">Calcular notas do {selectedBimestre}</p>
              </div>
              <ChevronRight className="text-slate-300 group-hover:text-teal-500 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50/50 p-6 flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <button
            onClick={() => setSelectedTurma(null)}
            className="text-sm font-bold text-teal-600 hover:text-teal-700 mb-2 flex items-center gap-1"
          >
            ← Voltar para turmas
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                Média Final: {turmasList.find(t => t.id === selectedTurma)?.name || selectedTurma}
              </h1>
              <p className="text-sm font-medium text-slate-500 mt-1">{selectedBimestre}</p>
            </div>
          </div>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setSubTab("tabela")}
            className={\`px-4 py-2 rounded-lg text-sm font-bold transition-colors \${
              subTab === "tabela" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }\`}
          >
            Tabela de Notas
          </button>
          <button
            onClick={() => setSubTab("relatorio")}
            className={\`px-4 py-2 rounded-lg text-sm font-bold transition-colors \${
              subTab === "relatorio" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }\`}
          >
            Relatório p/ Pais
          </button>
        </div>
      </div>

      {subTab === "tabela" && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 overflow-hidden flex flex-col">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <Calculator className="w-8 h-8 mb-4 opacity-50 animate-pulse" />
              <p className="font-medium">Calculando médias...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    <th className="px-4 py-3 font-bold text-slate-600 sticky left-0 bg-slate-50/80 shadow-[1px_0_0_#e2e8f0] z-10 w-48">
                      Aluno
                    </th>
                    {planComponents.map(c => (
                      <th key={c.id} className="px-4 py-3 font-bold text-slate-600 text-center border-l border-slate-100 bg-slate-50/80 z-10">
                        {c.label}<br/><span className="text-[10px] text-slate-400 font-normal">{c.weight}%</span>
                      </th>
                    ))}
                    <th className="px-4 py-3 font-black text-teal-700 text-center border-l-2 border-teal-100 bg-teal-50/50 z-10">
                      Média Final
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentsMeta.map(s => (
                     <tr key={s.studentId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2 sticky left-0 bg-white shadow-[1px_0_0_#e2e8f0] truncate max-w-[200px] font-medium text-slate-700">
                          {s.name}
                        </td>
                        {planComponents.map(c => {
                           const comp = s.components[c.key];
                           return (
                             <td key={c.key} className="px-4 py-2 text-center border-l border-slate-100 text-slate-600 font-medium">
                               {comp?.isLancado ? comp.grade?.toFixed(1) : <span className="text-slate-300 text-xs">—</span>}
                             </td>
                           );
                        })}
                        <td className={\`px-4 py-2 text-center border-l-2 border-teal-100 font-bold \${s.mediaFinal < 5 ? "text-rose-600 bg-rose-50/50" : "text-teal-700 bg-teal-50/50"}\`}>
                          {s.mediaFinal.toFixed(1)}
                        </td>
                     </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subTab === "relatorio" && (
        <BimestralReportView
          selectedBimestre={selectedBimestre}
          turmaName={turmasList.find(t => t.id === selectedTurma)?.name || selectedTurma}
          studentsMeta={studentsMeta}
        />
      )}
    </div>
  );
}
`;
fs.writeFileSync("src/views/CalculadoraMediaView.tsx", content);
