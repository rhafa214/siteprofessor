import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen,
  Map,
  GraduationCap,
  PenTool,
  LayoutDashboard,
  ChevronLeft,
} from "lucide-react";
import { cn } from "../lib/utils";
import AprendizagensEssenciais from "./GuiaPedagogico/AprendizagensEssenciais";
import EscopoSequencia from "./GuiaPedagogico/EscopoSequencia";
import MatrizProvaPaulista from "./GuiaPedagogico/MatrizProvaPaulista";
import PlanejamentoInteligente from "./GuiaPedagogico/PlanejamentoInteligente";

type ViewState = "dashboard" | "ano";
type TabState = "ae" | "escopo" | "matriz" | "planejamento";

export default function GuiaPedagogicoView() {
  const [view, setView] = useState<ViewState>("dashboard");
  const [selectedAno, setSelectedAno] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabState>("ae");

  const anos = [6, 7, 8, 9];

  const handleSelectAno = (ano: number) => {
    setSelectedAno(ano);
    setView("ano");
    setActiveTab("ae");
  };

  const handleBack = () => {
    setView("dashboard");
    setSelectedAno(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col relative overflow-hidden">
      <div className="w-full max-w-[1600px] mx-auto flex-1 flex flex-col relative z-10 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 mb-2">
              <Map size={24} />
              <h2 className="text-sm font-bold tracking-widest uppercase">
                {view === "dashboard"
                  ? "EF | Matemática"
                  : `${selectedAno}º Ano - EF | Matemática`}
              </h2>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Currículo Priorizado 2026
            </h1>
            <p className="text-slate-500 mt-2">
              {view === "dashboard"
                ? "Acesse as Aprendizagens Essenciais, Escopo-Sequência e mais."
                : "Organização pedagógica moderna e iterativa."}
            </p>
          </div>
          {view === "ano" && (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            >
              <ChevronLeft size={16} />
              Voltar aos Anos
            </button>
          )}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {view === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6"
            >
              {anos.map((ano) => (
                <div
                  key={ano}
                  onClick={() => handleSelectAno(ano)}
                  className="group relative bg-white border border-slate-200 hover:border-indigo-500 rounded-2xl p-6 cursor-pointer overflow-hidden transition-all duration-300 shadow-sm hover:shadow-lg"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-indigo-600">
                    <GraduationCap size={80} />
                  </div>
                  <h3 className="text-4xl font-extrabold text-slate-900 mb-2">
                    {ano}º Ano
                  </h3>
                  <div className="text-indigo-600 font-medium mb-6">
                    Ensino Fundamental Anos Finais
                  </div>

                  <div className="space-y-3 mb-8">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">
                        Aprendizagens (Bim 1)
                      </span>
                      <span className="font-bold text-slate-700 text-right">
                        ~5 a 10 AEs
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Aulas Estimadas</span>
                      <span className="font-bold text-slate-700">
                        ~35 aulas
                      </span>
                    </div>
                  </div>

                  <button className="w-full py-3 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-xl font-bold transition-colors">
                    Acessar
                  </button>
                </div>
              ))}
            </motion.div>
          )}

          {view === "ano" && selectedAno && (
            <motion.div
              key="ano-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col flex-1"
            >
              {/* Tabs */}
              <div className="flex overflow-x-auto pb-4 gap-2 mb-6 scrollbar-thin">
                <TabButton
                  active={activeTab === "ae"}
                  onClick={() => setActiveTab("ae")}
                  icon={BookOpen}
                  label="AEs do Ano"
                />
                <TabButton
                  active={activeTab === "escopo"}
                  onClick={() => setActiveTab("escopo")}
                  icon={Map}
                  label="Escopo-Sequência"
                />
                <TabButton
                  active={activeTab === "matriz"}
                  onClick={() => setActiveTab("matriz")}
                  icon={LayoutDashboard}
                  label="Matriz Prova Paulista"
                />
                <TabButton
                  active={activeTab === "planejamento"}
                  onClick={() => setActiveTab("planejamento")}
                  icon={PenTool}
                  label="Planejamentos"
                />
              </div>

              {/* Tab Content */}
              <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-0 sm:p-6 shadow-sm relative overflow-hidden">
                {activeTab === "ae" && (
                  <AprendizagensEssenciais ano={selectedAno} />
                )}
                {activeTab === "escopo" && (
                  <EscopoSequencia ano={selectedAno} />
                )}
                {activeTab === "matriz" && (
                  <MatrizProvaPaulista ano={selectedAno} />
                )}
                {activeTab === "planejamento" && (
                  <PlanejamentoInteligente ano={selectedAno} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all",
        active
          ? "bg-indigo-600 text-white shadow-md hover:bg-indigo-700"
          : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50",
      )}
    >
      <Icon size={18} />
      {label}
    </button>
  );
}
