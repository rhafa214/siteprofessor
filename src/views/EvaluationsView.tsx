import React, { useState } from "react";
import MatificAnalysis from "./MatificAnalysis";
import TaskAnalysis from "./TaskAnalysis";
import ProvaPaulistaAnalysis from "./ProvaPaulistaAnalysis";
import SchoolAssessments from "./SchoolAssessments";
import CalculadoraMediaView from "./CalculadoraMediaView";
import { motion, AnimatePresence } from "motion/react";
import {
  Calculator,
  ClipboardCheck,
  FileText,
  BarChart,
  BrainCircuit,
  Loader2,
  BookOpen,
  Trophy,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useAlert } from "../contexts/AlertContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useLocalStorage } from "../hooks/useLocalStorage";
// import media view if it exists? It doesn't exist, I'll fix this the simple way.

export default function EvaluationsView() {
  const [activeTab, setActiveTab] = useState<
    | "tarefas"
    | "matific"
    | "paulista"
    | "bimestral"
    | "simulado"
    | "participacao"
    | "medias"
    | null
  >(null);

  const getCurrentBimestre = () => {
    const month = new Date().getMonth();
    if (month < 4) return "1º Bimestre";
    if (month < 7) return "2º Bimestre";
    if (month < 9) return "3º Bimestre";
    return "4º Bimestre";
  };

  const [selectedBimestre, setSelectedBimestre] =
    useState(getCurrentBimestre());

  const bimestres = [
    "1º Bimestre",
    "2º Bimestre",
    "3º Bimestre",
    "4º Bimestre",
  ];

  if (activeTab) {
    return (
      <div className="h-full flex flex-col bg-slate-50/50">
        <div className="bg-white border-b border-slate-200 p-4 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab(null)}
              className="p-2 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors"
              title="Voltar para módulos"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-chevron-left"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">
                {activeTab === "tarefas" && "Controle de Tarefas"}
                {activeTab === "matific" && "Matific"}
                {activeTab === "paulista" && "Prova Paulista"}
                {activeTab === "medias" && "Média Bimestral"}
                {activeTab === "bimestral" && "Avaliação Bimestral"}
                {activeTab === "simulado" && "Simulado"}
                {activeTab === "participacao" && "Notas de Participação"}
              </h1>
            </div>
          </div>
          <div className="relative">
            <select
              value={selectedBimestre}
              onChange={(e) => setSelectedBimestre(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-4 pr-10 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {bimestres.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto relative p-4 md:p-6 pb-24 flex flex-col">
          {activeTab === "tarefas" && (
            <TaskAnalysis selectedBimestre={selectedBimestre} />
          )}
          {activeTab === "matific" && (
            <MatificAnalysis selectedBimestre={selectedBimestre} />
          )}
          {activeTab === "paulista" && (
            <ProvaPaulistaAnalysis selectedBimestre={selectedBimestre} />
          )}
          {activeTab === "medias" && (
            <CalculadoraMediaView selectedBimestre={selectedBimestre} />
          )}
          {activeTab === "bimestral" && (
            <SchoolAssessments
              defaultTab="bimestral"
              selectedBimestre={selectedBimestre}
            />
          )}
          {activeTab === "simulado" && (
            <SchoolAssessments
              defaultTab="simulado"
              selectedBimestre={selectedBimestre}
            />
          )}
          {activeTab === "participacao" && (
            <SchoolAssessments
              defaultTab="participacao"
              selectedBimestre={selectedBimestre}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6 z-10 shrink-0">
        <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Central de Avaliações
            </h1>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              Gestão de notas, engajamento e relatórios de alunos
            </p>
          </div>
          <div className="relative">
            <select
              value={selectedBimestre}
              onChange={(e) => setSelectedBimestre(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-4 pr-10 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 hover:bg-slate-100 transition-colors cursor-pointer shadow-sm"
            >
              {bimestres.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
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
            transition={{ delay: 0.08 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group flex flex-col items-center justify-center text-center h-48 gap-4"
            onClick={() => setActiveTab("participacao")}
          >
            <div className="w-16 h-16 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
              <ClipboardCheck size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 leading-tight group-hover:text-pink-600 transition-colors">
              Participação
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
            transition={{ delay: 0.3 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group flex flex-col items-center justify-center text-center h-48 gap-4"
            onClick={() => setActiveTab("medias")}
          >
            <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <Calculator size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 leading-tight group-hover:text-teal-600 transition-colors">
              Média Bimestral
            </h3>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
