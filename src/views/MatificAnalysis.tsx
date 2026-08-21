import React, { useState } from "react";
import CanonicalMatificAnalysisView from "./CanonicalMatificAnalysisView";
import LegacyMatificAnalysisView from "./LegacyMatificAnalysisView";
import { History, LayoutDashboard } from "lucide-react";

export default function MatificAnalysis({ selectedBimestre }: { selectedBimestre: string }) {
  const [mode, setMode] = useState<"canonical" | "legacy">("canonical");

  return (
    <div className="relative h-full flex flex-col">
      {/* View Switcher */}
      <div className="absolute top-4 right-4 z-50 flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
        <button
          onClick={() => setMode("canonical")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
            mode === "canonical"
              ? "bg-slate-100 text-slate-800"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          }`}
        >
          <LayoutDashboard size={14} />
          Atual (Canônico)
        </button>
        <button
          onClick={() => setMode("legacy")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
            mode === "legacy"
              ? "bg-amber-100 text-amber-800"
              : "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
          }`}
        >
          <History size={14} />
          Ver Registros Legados
        </button>
      </div>

      <div className="flex-1 h-full">
        {mode === "canonical" ? (
          <CanonicalMatificAnalysisView selectedBimestre={selectedBimestre} />
        ) : (
          <LegacyMatificAnalysisView selectedBimestre={selectedBimestre} />
        )}
      </div>
    </div>
  );
}
