import React, { useState } from "react";
import CanonicalTaskAnalysisView from "./CanonicalTaskAnalysisView";
import LegacyTaskAnalysisView from "./LegacyTaskAnalysisView";
import { History } from "lucide-react";

import { getCurrentBimestre } from "../lib/constants";

export default function TaskAnalysis({
  selectedBimestre = `${getCurrentBimestre()}º Bimestre`,
}: {
  selectedBimestre?: string;
}) {
  const [isLegacyMode, setIsLegacyMode] = useState(false);

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setIsLegacyMode(!isLegacyMode)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm border ${
            isLegacyMode 
              ? "bg-indigo-50 text-indigo-700 border-indigo-200" 
              : "bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-slate-200"
          }`}
          title="Alternar entre o novo sistema e o histórico legado"
        >
          <History size={14} />
          {isLegacyMode ? "Voltar ao Task Analysis atual" : "Ver Registros Legados"}
        </button>
      </div>
      
      {isLegacyMode ? (
        <LegacyTaskAnalysisView selectedBimestre={selectedBimestre} />
      ) : (
        <CanonicalTaskAnalysisView selectedBimestre={selectedBimestre} />
      )}
    </div>
  );
}
