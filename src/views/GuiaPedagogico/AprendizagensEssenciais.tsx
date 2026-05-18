import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, ChevronDown, ChevronUp, CheckCircle2, Bookmark, BookmarkCheck } from "lucide-react";
import { dbAEs, AprendizagemEssencial } from "../../data/guiaPedagogico";
import { cn } from "../../lib/utils";

export default function AprendizagensEssenciais({ ano }: { ano: number }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [bimestre, setBimestre] = useState<number | "all">(1);
  const [expandedAE, setExpandedAE] = useState<string | null>(null);

  const aes = useMemo(() => {
    return dbAEs.filter(ae => {
      const matchAno = ae.ano === ano;
      const matchBimestre = bimestre === "all" || ae.bimestre === bimestre;
      const matchSearch = ae.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          ae.id.toLowerCase().includes(searchTerm.toLowerCase());
      return matchAno && matchBimestre && matchSearch;
    });
  }, [ano, bimestre, searchTerm]);

  return (
    <div className="flex flex-col h-full">
      {/* Top filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            placeholder="Buscar por AE, habilidade ou texto..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </div>
        <select 
          value={bimestre} 
          onChange={e => setBimestre(e.target.value === "all" ? "all" : Number(e.target.value))}
          className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
        >
          <option value="all">Todos os Bimestres</option>
          <option value={1}>1º Bimestre</option>
          <option value={2}>2º Bimestre</option>
          <option value={3}>3º Bimestre</option>
          <option value={4}>4º Bimestre</option>
        </select>
      </div>

      {/* AE List */}
      <div className="space-y-4 overflow-y-auto pr-2 scrollbar-thin">
        {aes.length === 0 ? (
           <div className="text-center py-12 text-slate-500">
             Nenhuma Aprendizagem Essencial encontrada para os filtros aplicados.<br/>
             (O simulador contém apenas alguns exemplos do 1º Bimestre).
           </div>
        ) : (
          aes.map(ae => (
            <AECard 
              key={ae.id} 
              ae={ae} 
              isExpanded={expandedAE === ae.id}
              onToggle={() => setExpandedAE(expandedAE === ae.id ? null : ae.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function AECard({ ae, isExpanded, onToggle }: { ae: AprendizagemEssencial, isExpanded: boolean, onToggle: () => void }) {
  const [favorite, setFavorite] = useState(false);

  return (
    <div className="bg-white border border-slate-200 shadow-sm hover:shadow-md rounded-2xl overflow-hidden transition-all duration-300">
      <div 
        onClick={onToggle}
        className="p-5 flex items-start gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
      >
        <div className="flex-shrink-0 bg-indigo-50 text-indigo-600 font-bold px-3 py-1.5 rounded-lg text-sm border border-indigo-100">
          {ae.id}
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-slate-800 mb-2 leading-relaxed">
            {ae.titulo}
          </h3>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200">
              Habilidade Priorizada: <strong className="text-slate-800">{ae.habilidadePriorizada}</strong>
            </span>
            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200">
              {ae.bimestre}º Bimestre
            </span>
          </div>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); setFavorite(!favorite); }} 
          className="text-slate-400 hover:text-indigo-600 p-1 transition-colors"
        >
          {favorite ? <BookmarkCheck size={20} className="text-indigo-600" /> : <Bookmark size={20} />}
        </button>
        <div className="text-slate-400 self-center">
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-200 bg-slate-50/50"
          >
            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
              <div className="space-y-4">
                <div>
                  <h4 className="text-slate-500 font-bold mb-1 uppercase text-xs tracking-widest">Conteúdos Relacionados</h4>
                  <p className="text-slate-700">{ae.conteudosRelacionados}</p>
                </div>
                <div>
                  <h4 className="text-slate-500 font-bold mb-1 uppercase text-xs tracking-widest">Conhecimentos Prévios</h4>
                  <p className="text-slate-700">{ae.conhecimentosPrevios}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="text-slate-500 font-bold mb-1 uppercase text-xs tracking-widest">Habilidades Relacionadas</h4>
                  <p className="text-slate-700">{ae.habilidadesRelacionadas}</p>
                </div>
                <div>
                  <h4 className="text-indigo-600 font-bold mb-1 uppercase text-xs tracking-widest">Descritores de Avaliações</h4>
                  <p className="text-indigo-700 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50 leading-relaxed font-medium">
                    {ae.descritores}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
