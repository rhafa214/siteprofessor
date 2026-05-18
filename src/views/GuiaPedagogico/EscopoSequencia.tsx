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
        <div className={cn("flex-1 overflow-y-auto pr-4 scrollbar-thin transition-all", selectedAula ? "lg:w-1/2" : "w-full")}>
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
                        : "bg-white border-slate-200 hover:border-indigo-300"
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

        {/* Side Panel for Detail */}
        <AnimatePresence>
          {selectedAula && (
            <motion.div
              initial={{ opacity: 0, x: 50, width: 0 }}
              animate={{ opacity: 1, x: 0, width: "50%" }}
              exit={{ opacity: 0, x: 50, width: 0 }}
              className="hidden lg:block border-l border-slate-200 pl-6 ml-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800">
                  <span className="text-indigo-600 mr-2 text-lg">Aula {selectedAula.numero}</span>
                  {selectedAula.titulo && <span className="text-slate-900 block mt-1">{selectedAula.titulo}</span>}
                </h3>
                <button onClick={() => setSelectedAula(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-slate-500 mb-2">Conteúdo</h4>
                  <p className="text-lg font-bold text-slate-800 bg-white border border-slate-200 shadow-sm p-4 rounded-xl">{selectedAula.conteudo}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-semibold text-slate-500 mb-2">Objetivos de Aprendizagem</h4>
                  <p className="text-slate-600 leading-relaxed bg-white border border-slate-200 shadow-sm p-4 rounded-xl">{selectedAula.objetivos}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-xl">
                    <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Habilidades</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedAula.habilidades.split(',').map(h => (
                         <span key={h.trim()} className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md">{h.trim()}</span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 shadow-sm p-4 rounded-xl">
                    <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Aprendizagem Essencial</h4>
                    <p className="text-sm font-bold text-indigo-600">{selectedAula.aprendizagemEssencial}</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200">
                  <button className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl font-bold transition-all shadow-md active:scale-[0.98]">
                    <CheckCircle2 size={20} />
                    Marcar Aula como Concluída
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Modal Fallback */}
      <AnimatePresence>
        {selectedAula && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm lg:hidden flex items-end sm:items-center justify-center p-4"
            onClick={() => setSelectedAula(null)}
          >
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              onClick={e => e.stopPropagation()}
              className="bg-white border border-slate-200 w-full rounded-2xl p-6 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-bold text-slate-800">
                  <span className="text-indigo-600 mr-2 text-lg">Aula {selectedAula.numero}</span>
                  {selectedAula.titulo && <span className="text-slate-900 block mt-1">{selectedAula.titulo}</span>}
                </h3>
                <button onClick={() => setSelectedAula(null)} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={20}/></button>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-slate-500 mb-2">Conteúdo</h4>
                  <p className="text-lg font-bold text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-200">{selectedAula.conteudo}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-500 mb-2">Objetivos de Aprendizagem</h4>
                  <p className="text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">{selectedAula.objetivos}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Habilidades</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedAula.habilidades.split(',').map(h => (
                        <span key={h.trim()} className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md border border-indigo-100">{h.trim()}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Aprendizagem Essencial</h4>
                  <p className="text-sm font-bold text-indigo-600">{selectedAula.aprendizagemEssencial}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
