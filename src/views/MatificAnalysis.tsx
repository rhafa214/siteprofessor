import React, { useState } from "react";
import CanonicalMatificAnalysisView from "./CanonicalMatificAnalysisView";
import LegacyMatificAnalysisView from "./LegacyMatificAnalysisView";
import { History, LayoutDashboard } from "lucide-react";

export default function MatificAnalysis({ selectedBimestre }: { selectedBimestre: string }) {
  const [mode, setMode] = useState<"canonical" | "legacy">("canonical");

  return (
    <div className="relative h-full flex flex-col">
      {/* View Switcher inline instead of absolute */}
      <div className="flex justify-end mb-4 shrink-0">
        <div className="inline-flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          <button
            onClick={() => setMode("canonical")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              mode === "canonical"
                ? "bg-blue-50 text-blue-700"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            <LayoutDashboard size={16} />
            Matific Canônico
          </button>
          <button
            onClick={() => setMode("legacy")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              mode === "legacy"
                ? "bg-amber-50 text-amber-700"
                : "text-slate-500 hover:text-amber-700 hover:bg-amber-50/50"
            }`}
          >
            <History size={16} />
            Ver Registros Legados
          </button>
        </div>
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
