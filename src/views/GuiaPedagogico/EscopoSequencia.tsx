import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, ChevronRight, X, User } from "lucide-react";
import { dbAulas, Aula } from "../../data/guiaPedagogico";
import { cn } from "../../lib/utils";

export default function EscopoSequencia({ ano }: { ano: number }) {
  const [bimestre, setBimestre] = useState<number>(1);
  const [selectedAula, setSelectedAula] = useState<Aula | null>(null);

  // In this mock, we filter by ano and bimestre and ensure 35 classes are displayed
  const aulas = useMemo(() => {
    const lessons: Aula[] = [];
    for (let i = 1; i <= 35; i++) {
      const found = dbAulas.find(a => a.bimestre === bimestre && a.ano === ano && a.numero === i);
      if (found) {
        lessons.push(found);
      } else {
        lessons.push({
          ano,
          bimestre,
          numero: i,
          conteudo: "Conteúdo a ser definido",
          objetivos: "Objetivos a serem definidos",
          habilidades: "-",
          aprendizagemEssencial: "-"
        });
      }
    }
    return lessons;
  }, [bimestre, ano]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-slate-800">Timeline do {bimestre}º Bimestre</h3>
        <select 
          value={bimestre} 
          onChange={e => setBimestre(Number(e.target.value))}
          className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        >
          <option value={1}>1º Bimestre</option>
          <option value={2}>2º Bimestre</option>
          <option value={3}>3º Bimestre</option>
          <option value={4}>4º Bimestre</option>
        </select>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Timeline */}
        <div className="w-full flex-1 overflow-y-auto pr-2 sm:pr-4 scrollbar-thin transition-all">
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
            {aulas.length === 0 ? (
               <div className="text-center py-12 text-slate-500 relative z-10">
                 Nenhuma aula cadastrada para este bimestre neste protótipo.
               </div>
            ) : (
              aulas.map((aula) => (
                <div key={`${aula.ano}-${aula.bimestre}-${aula.numero}`} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-indigo-600 text-white font-bold shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
                    {aula.numero}
                  </div>
                  
                  <div 
                    onClick={() => setSelectedAula(aula)}
                    className={cn(
                      "w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border cursor-pointer transition-all duration-300 flex flex-col",
                      selectedAula?.numero === aula.numero 
                        ? "bg-indigo-50 border-indigo-500 shadow-md" 
                        : "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{aula.aprendizagemEssencial}</span>
                       <span className="text-xs text-slate-500 shrink-0 ml-2 whitespace-nowrap">Aula {aula.numero}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 mb-2 leading-tight line-clamp-1">
                      {aula.titulo || aula.conteudo}
                    </h4>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3 flex-1">{aula.titulo ? aula.conteudo : aula.objetivos}</p>
                    <div className="flex flex-wrap gap-1 mt-auto">
                      {aula.habilidades.split(',').map(hab => (
                        <span key={hab.trim()} className="text-[10px] font-mono bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                          {hab.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal / Janela Details */}
      <AnimatePresence>
        {selectedAula && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setSelectedAula(null)}
          >
            <motion.div 
              initial={{ y: "100%", opacity: 0, scale: 0.95 }} 
              animate={{ y: 0, opacity: 1, scale: 1 }} 
              exit={{ y: "100%", opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="bg-white border border-slate-200 w-full max-w-2xl rounded-3xl p-6 md:p-8 max-h-[90vh] overflow-y-auto shadow-2xl relative"
            >
              <button 
                onClick={() => setSelectedAula(null)} 
                className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 transition-colors rounded-full text-slate-500"
              >
                <X size={20}/>
              </button>
              
              <div className="flex flex-col mb-6 pt-2">
                <h3 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                    {selectedAula.numero}
                  </div>
                  {selectedAula.titulo ? (
                     <span className="text-slate-900 block">{selectedAula.titulo}</span>
                  ) : (
                     <span>Aula {selectedAula.numero}</span>
                  )}
                </h3>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-slate-500 mb-2 tracking-wide uppercase">Conteúdo</h4>
                  <p className="text-lg font-medium text-slate-800 bg-slate-50 p-5 rounded-2xl border border-slate-200 leading-relaxed shadow-sm">
                    {selectedAula.conteudo}
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-bold text-slate-500 mb-2 tracking-wide uppercase">Objetivos de Aprendizagem</h4>
                  <p className="text-slate-600 leading-relaxed bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm">
                    {selectedAula.objetivos}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Habilidades</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedAula.habilidades.split(',').map(h => (
                          <span key={h.trim()} className="text-xs font-mono bg-indigo-100 text-indigo-800 px-3 py-1.5 rounded-lg border border-indigo-200 shadow-sm">{h.trim()}</span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                    <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Aprendizagem Essencial</h4>
                    <p className="text-sm font-extrabold text-indigo-600">{selectedAula.aprendizagemEssencial}</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200 mt-4">
                  <button className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold transition-all shadow-md active:scale-[0.98]">
                    <CheckCircle2 size={20} className="shrink-0" />
                    <span>Concluir ou Incorporar esta Aula</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
