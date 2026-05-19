import React, { useState } from "react";
import { Settings2, Download, RefreshCcw, Calendar, BookOpen } from "lucide-react";
import { cn } from "../../lib/utils";
import { getCurrentBimestre } from "../../lib/constants";

export default function PlanejamentoInteligente({ ano }: { ano: number }) {
  const [aulasSemanais, setAulasSemanais] = useState(5);
  const [gerando, setGerando] = useState(false);

  const handleGerar = () => {
    setGerando(true);
    setTimeout(() => {
      setGerando(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-4 bg-indigo-50 text-indigo-600 rounded-full mb-4">
          <Settings2 size={32} />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-slate-800">Planejamento Automático</h2>
        <p className="text-slate-500">
          Reorganize o Escopo-Sequência baseado na sua carga horária real, feriados e ritmo da turma.
        </p>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-8 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-3">
              Aulas semanais de Matemática
            </label>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setAulasSemanais(Math.max(1, aulasSemanais - 1))}
                className="w-12 h-12 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                -
              </button>
              <span className="text-2xl font-bold w-12 text-center text-slate-800">{aulasSemanais}</span>
              <button 
                onClick={() => setAulasSemanais(aulasSemanais + 1)}
                className="w-12 h-12 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-3">
              Período do Planejamento
            </label>
            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors">
              <option>{getCurrentBimestre()}º Bimestre Completo</option>
              <option>Mês Atual</option>
              <option>Próximos 15 dias</option>
            </select>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-100">
           <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-4 rounded-2xl mb-6">
              <div className="flex items-center gap-3 text-emerald-700">
                <BookOpen size={20} />
                <span className="font-semibold text-sm">O sistema vai redistribuir ~35 aulas em ~7 semanas.</span>
              </div>
           </div>

           <div className="flex flex-col sm:flex-row gap-4">
             <button 
               onClick={handleGerar}
               disabled={gerando}
               className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98]"
             >
               <RefreshCcw size={20} className={cn(gerando && "animate-spin")} />
               {gerando ? "Processando e Alinhando AEs..." : "Gerar Cronograma Flexível"}
             </button>
             <button className="sm:w-auto px-8 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-sm">
               <Download size={20} />
               Exportar PDF
             </button>
           </div>
        </div>
      </div>
    </div>
  );
}
