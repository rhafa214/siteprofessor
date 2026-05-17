import React, { useState } from "react";
import MatificAnalysis from "./MatificAnalysis";
import TaskAnalysis from "./TaskAnalysis";
import ProvaPaulistaAnalysis from "./ProvaPaulistaAnalysis";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator, ClipboardCheck, FileText, BarChart, BrainCircuit, Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useLocalStorage } from "../hooks/useLocalStorage";

// Temporary placeholder for Media / IA report
import { GoogleGenAI } from "@google/genai";

function MediaView() {
  const { user } = useAuth();
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
    if (!user) return alert("Faça login para gerar o relatório.");
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
      alert("Falha ao gerar: " + e.message);
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
         <h3 className="text-xl font-bold text-slate-700 mb-2">Médias e Relatório de Turma</h3>
         <p className="text-slate-500 max-w-lg mx-auto mb-6">Analise as médias consolidadas (Tarefas, Matific e Prova Paulista) e gere um relatório de desempenho individual e da evolução da turma com o Jarvis.</p>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50 p-6 rounded-xl border border-slate-100 flex flex-col items-center max-w-3xl mx-auto w-full">
         <div className="flex items-center gap-3 text-indigo-600 font-bold mb-4">
            <BrainCircuit size={24} />
            Relatório de Desempenho (Jarvis)
         </div>
         {aiReport ? (
           <div className="w-full text-slate-700 bg-white p-6 rounded-xl border border-slate-200 shadow-sm prose prose-indigo max-w-none text-left">
             <div dangerouslySetInnerHTML={{ __html: aiReport.replace(/\n/g, '<br/>') }} />
           </div>
         ) : (
           <p className="text-sm text-slate-600 text-center max-w-lg mb-8">
              O Jarvis irá analisar os dados de Controle de Tarefas, Matific e Prova Paulista para {selectedTurma}. Ele gera um relatório identificando os alunos destaques, alunos que precisam de atenção (regresso) e o panorama geral da turma.
           </p>
         )}
         
         <button onClick={generateReport} disabled={loading} className="mt-4 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Gerar Relatório IA"}
         </button>
      </div>
    </div>
  );
}

export default function EvaluationsView() {
  const [activeTab, setActiveTab] = useState<"tarefas" | "matific" | "paulista" | "media">("tarefas");

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

        {/* Custom Tabs */}
        <div className="max-w-7xl mx-auto mt-6 flex overflow-x-auto gap-2 pb-1 scrollbar-hide">
          <button
            onClick={() => setActiveTab("tarefas")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === "tarefas"
                ? "bg-slate-900 text-white shadow-md"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <ClipboardCheck size={18} />
            Tarefas
          </button>
          <button
            onClick={() => setActiveTab("matific")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === "matific"
                ? "bg-slate-900 text-white shadow-md"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Calculator size={18} />
            Matific
          </button>
          <button
            onClick={() => setActiveTab("paulista")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === "paulista"
                ? "bg-slate-900 text-white shadow-md"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <FileText size={18} />
            Prova Paulista
          </button>
          <button
            onClick={() => setActiveTab("media")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === "media"
                ? "bg-slate-900 text-white shadow-md"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <BarChart size={18} />
            Média & Relatório
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "tarefas" && <div className="h-full w-full p-4"><TaskAnalysis /></div>}
        {activeTab === "matific" && <div className="h-full w-full p-4"><MatificAnalysis /></div>}
        {activeTab === "paulista" && <div className="h-full w-full p-4"><ProvaPaulistaAnalysis /></div>}
        {activeTab === "media" && <div className="h-full w-full p-4 overflow-y-auto"><MediaView /></div>}
      </div>
    </div>
  );
}
