import React, { useState } from "react";
import LegacyAssessmentView from "./LegacyAssessmentView";
import CanonicalAssessmentView from "./CanonicalAssessmentView";
import { AssessmentCategory } from "../domain/assessment/AssessmentTypes";

export default function SchoolAssessments({
  defaultTab = "bimestral",
  selectedBimestre,
}: {
  defaultTab?: "bimestral" | "simulado" | "participacao";
  selectedBimestre: string;
}) {
  const [useLegacy, setUseLegacy] = useState(false);

  const categoryMap: Record<string, AssessmentCategory> = {
    "bimestral": "BIMESTRAL",
    "simulado": "SIMULADO",
    "participacao": "PARTICIPACAO"
  };

  const category = categoryMap[defaultTab];

  if (useLegacy) {
    return (
      <div className="h-full flex flex-col relative">
        <div className="absolute top-4 left-4 z-50">
          <button
            onClick={() => setUseLegacy(false)}
            className="px-4 py-2 bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-lg hover:bg-indigo-700 transition-colors"
          >
            Voltar ao Modo Atual (Canônico)
          </button>
        </div>
        <div className="absolute top-4 right-4 z-50 pointer-events-none">
          <div className="px-4 py-2 bg-amber-100 text-amber-800 font-bold text-sm rounded-xl shadow-lg border border-amber-200">
            Modo Legado — Somente Leitura
          </div>
        </div>
        {/* Legacy Assessment View */}
        <LegacyAssessmentView defaultTab={defaultTab} selectedBimestre={selectedBimestre} />
      </div>
    );
  }

  return (
    <CanonicalAssessmentView 
      category={category} 
      selectedBimestreLabel={selectedBimestre} 
      onSwitchToLegacy={() => setUseLegacy(true)} 
    />
  );
}
