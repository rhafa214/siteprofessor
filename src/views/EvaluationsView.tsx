import React, { useState } from "react";
import MatificAnalysis from "./MatificAnalysis";
import TaskAnalysis from "./TaskAnalysis";
import ProvaPaulistaAnalysis from "./ProvaPaulistaAnalysis";
import SchoolAssessments from "./SchoolAssessments";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator, ClipboardCheck, FileText, BarChart, BrainCircuit, Loader2, BookOpen, Trophy } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useAlert } from "../contexts/AlertContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useLocalStorage } from "../hooks/useLocalStorage";

// Temporary placeholder for Media / IA report
import { GoogleGenAI } from "@google/genai";

function MediaView() {
  const { user } = useAuth();
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
  const [selectedTurma, setSelectedTurma] = useLocalStorage<string | null>("media_selectedTurma", null);
  const [loading, setLoading] = useState(false);
  const [aiReport, setAiReport] = useState("");

  const generateReport = async () => {
    if (!user) {
      showAlert("Faça login para gerar o relatório.", "Atenção", "warning");
      return;
    }
    setLoading(true);
    setAiReport("");
    try {
      const taskDoc = await getDoc(doc(db, "users", user.uid, "taskAnalysis", selectedTurma!));
      const matificDoc = await getDoc(doc(db, "users", user.uid, "matificAnalysis", selectedTurma!));
      const paulistaDoc = await getDoc(doc(db, "users", user.uid, "paulistaAnalysis", selectedTurma!));
      
      const payload = {
         turma: selectedTurma,
         tarefas: taskDoc.exists() ? taskDoc.data() : null,
         matific: matificDoc.exists() ? matificDoc.data() : null,
         provaPaulista: paulistaDoc.exists() ? paulistaDoc.data() : null
      };

      const response = await fetch("/api/generate-eval-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("Erro na geração do relatório");
      const data = await response.json();
      setAiReport(data.report);
    } catch (e: any) {
      console.error(e);
      showAlert("Falha ao gerar: " + e.message, "Erro", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!selectedTurma) {
    return (
      <div className="flex flex-col h-full bg-slate-50/50">
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {!turmasList || turmasList.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-dashed border-slate-300">
              <BarChart className="w-12 h-12 text-slate-400 mb-4" />
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
                    <BarChart size={24} />
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

  // Placeholder data for best grades chart
  const bestStudents = [
    { name: "Ana Beatriz", grade: 9.8, color: "bg-indigo-500" },
    { name: "João Pedro", grade: 9.5, color: "bg-blue-500" },
    { name: "Maria Clara", grade: 9.2, color: "bg-emerald-500" },
    { name: "Lucas Silva", grade: 8.9, color: "bg-purple-500" }
  ];

  return (
    <div className="h-full bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedTurma(null)}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors"
            title="Voltar para turmas"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right rotate-180"><path d="m9 18 6-6-6-6"/></svg>
          </button>
          <h2 className="text-xl font-bold text-slate-800">{selectedTurma}</h2>
        </div>
      </div>

      <div className="text-center mb-8">
         <BarChart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
         <h3 className="text-xl font-bold text-slate-700 mb-2">Relatório das Turmas</h3>
         <p className="text-slate-500 max-w-lg mx-auto mb-6">Analise as médias consolidadas (Avaliações, Matific, Prova Paulista) e veja o histórico de desempenho.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 max-w-5xl mx-auto w-full">
        {/* Gráfico de Melhores Notas */}
        <div className="flex-1 bg-slate-50 p-6 rounded-2xl border border-slate-100">
          <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Trophy size={18} className="text-amber-500" />
            Evolução / Melhores Notas
          </h4>
          <div className="flex flex-col gap-4">
            {bestStudents.map((s, idx) => (
              <div key={idx} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                   <span className="font-medium text-slate-700">{s.name}</span>
                   <span className="font-bold text-slate-900">{s.grade}</span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                     <motion.div 
                       initial={{ width: 0 }}
                       animate={{ width: `${(s.grade / 10) * 100}%` }}
                       transition={{ duration: 1, ease: "easeOut" }}
                       className={`h-full rounded-full ${s.color}`}
                     />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Relatório IA */}
        <div className="flex-1 bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 flex flex-col items-center text-center">
           <div className="flex items-center gap-3 text-indigo-600 font-bold mb-4">
              <BrainCircuit size={24} />
              Feedback Sintético (Jarvis)
           </div>
           {aiReport ? (
             <div className="w-full text-slate-700 bg-white p-4 rounded-xl border border-slate-200 shadow-sm prose prose-indigo text-left text-sm max-h-64 overflow-auto">
               <div dangerouslySetInnerHTML={{ __html: aiReport.replace(/\n/g, '<br/>') }} />
             </div>
           ) : (
             <p className="text-sm text-slate-600 max-w-sm mb-6">
                O Jarvis cruzará os dados disponíveis no painel e criará uma rápida resenha pedagógica do desempenho geral de {selectedTurma}.
             </p>
           )}
           
           <button onClick={generateReport} disabled={loading} className="mt-auto px-6 py-3 w-full bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Gerar Relatório Resumo"}
           </button>
        </div>
      </div>
    </div>
  );
}

export default function EvaluationsView() {
  const [activeTab, setActiveTab] = useState<"tarefas" | "matific" | "paulista" | "media" | "bimestral" | "simulado" | null>(null);

  if (activeTab) {
    return (
      <div className="h-full flex flex-col bg-slate-50/50">
        <div className="bg-white border-b border-slate-200 p-4 shrink-0 flex items-center gap-4">
          <button
            onClick={() => setActiveTab(null)}
            className="p-2 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors"
            title="Voltar para módulos"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-left"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              {activeTab === "tarefas" && "Controle de Tarefas"}
              {activeTab === "matific" && "Matific"}
              {activeTab === "paulista" && "Prova Paulista"}
              {activeTab === "media" && "Relatório das Turmas"}
              {activeTab === "bimestral" && "Avaliação Bimestral"}
              {activeTab === "simulado" && "Simulado"}
            </h1>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto relative p-4 md:p-6 pb-24">
          {activeTab === "tarefas" && <TaskAnalysis />}
          {activeTab === "matific" && <MatificAnalysis />}
          {activeTab === "paulista" && <ProvaPaulistaAnalysis />}
          {activeTab === "media" && <MediaView />}
          {activeTab === "bimestral" && <SchoolAssessments defaultTab="bimestral" />}
          {activeTab === "simulado" && <SchoolAssessments defaultTab="simulado" />}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6 z-10 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Central de Avaliações
            </h1>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              Gestão de notas, engajamento e relatórios de alunos
            </p>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group flex flex-col items-center justify-center text-center h-48 gap-4"
            onClick={() => setActiveTab("bimestral")}
          >
            <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
              <BookOpen size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 leading-tight group-hover:text-orange-600 transition-colors">
              Avaliação
            </h3>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group flex flex-col items-center justify-center text-center h-48 gap-4"
            onClick={() => setActiveTab("simulado")}
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <ClipboardCheck size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 leading-tight group-hover:text-amber-600 transition-colors">
              Simulado
            </h3>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group flex flex-col items-center justify-center text-center h-48 gap-4"
            onClick={() => setActiveTab("tarefas")}
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ClipboardCheck size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 leading-tight group-hover:text-emerald-600 transition-colors">
              Tarefas
            </h3>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group flex flex-col items-center justify-center text-center h-48 gap-4"
            onClick={() => setActiveTab("matific")}
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Calculator size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">
              Matific
            </h3>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group flex flex-col items-center justify-center text-center h-48 gap-4"
            onClick={() => setActiveTab("paulista")}
          >
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <FileText size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors">
              Prova Paulista
            </h3>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group flex flex-col items-center justify-center text-center h-48 gap-4"
            onClick={() => setActiveTab("media")}
          >
            <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <BarChart size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 leading-tight group-hover:text-purple-600 transition-colors">
              Relatório das Turmas
            </h3>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
