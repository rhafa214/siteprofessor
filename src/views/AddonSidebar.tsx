import React, { useState } from "react";
import { getCurrentBimestre } from "../lib/constants";
import { dbAulas } from "../data/guiaPedagogico";
import { BookOpen, PlusCircle, CheckCircle2, Search, ChevronLeft } from "lucide-react";

export default function AddonSidebar() {
  const [selectedAno, setSelectedAno] = useState<number | null>(null);
  const [bimestre, setBimestre] = useState<number>(getCurrentBimestre());
  const [searchTerm, setSearchTerm] = useState("");
  const [insertedIds, setInsertedIds] = useState<Set<string>>(new Set());

  // Filter aulas
  const aulas = dbAulas.filter(
    (aula) => {
      if (aula.ano !== selectedAno || aula.bimestre !== bimestre) return false;
      const title = String(aula.titulo || aula.conteudo || "").toLowerCase();
      const obj = String(aula.objetivos || "").toLowerCase();
      const num = String(aula.numero || "").toLowerCase();
      const term = searchTerm.toLowerCase();
      return title.includes(term) || obj.includes(term) || num.includes(term);
    }
  );

  const handleInsert = (aula: any, id: string) => {
    // Construct the text to insert
    const title = aula.titulo || aula.conteudo || "";
    const objetivos = aula.objetivos || "";
    const habilidades = Array.isArray(aula.habilidades) 
      ? aula.habilidades.join(", ") 
      : aula.habilidades || "";

    const textToInsert = `Aula: ${title}\nObjetivos: ${objetivos}\nHabilidades: ${habilidades}\n\n`;

    // Send generic postMessage up to the parent iframe (Apps Script)
    window.parent.postMessage(
      {
        type: "INSERT_TEXT",
        text: textToInsert,
      },
      "*"
    );

    // mark as inserted visually
    setInsertedIds((prev) => new Set(prev).add(id));

    // reset visual after 2 seconds
    setTimeout(() => {
      setInsertedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2000);
  };

  const renderAnos = () => (
    <div className="p-3 grid grid-cols-2 gap-2">
      {[6, 7, 8, 9].map((ano) => (
        <button
          key={ano}
          onClick={() => setSelectedAno(ano)}
          className="bg-white border text-center border-slate-200 rounded-xl p-3 shadow-sm hover:border-[#8257E5] hover:shadow-md transition-all group flex flex-col items-center justify-center gap-1.5"
        >
          <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-[#8257E5] font-bold text-base group-hover:scale-110 transition-transform">
            {ano}º
          </div>
          <span className="font-semibold text-slate-700 text-sm">{ano}º Ano</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="w-full bg-slate-50 text-slate-800 font-sans min-h-screen">
      {/* Header compact - Sticky */}
      <div className="sticky top-0 z-20 bg-white">
        <div className="bg-[#8257E5] text-white p-3 shadow-md">
          <div className="flex items-center gap-2 mb-2">
            {selectedAno ? (
              <button onClick={() => setSelectedAno(null)} className="hover:bg-white/20 p-1 -ml-1 rounded-full text-white transition-colors">
                <ChevronLeft size={16} />
              </button>
            ) : (
              <BookOpen size={16} />
            )}
            <h1 className="font-bold text-base leading-tight tracking-tight">
              {selectedAno ? `${selectedAno}º Ano` : "Escopo EduAssistente"}
            </h1>
          </div>

          {selectedAno && (
            <div className="flex gap-2">
              <div className="flex-1">
                <select
                  value={bimestre}
                  onChange={(e) => setBimestre(Number(e.target.value))}
                  className="w-full bg-white/20 border border-white/30 text-white rounded-lg text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-white/50 [&>option]:text-slate-800"
                >
                  <option value={1}>1º Bim</option>
                  <option value={2}>2º Bim</option>
                  <option value={3}>3º Bim</option>
                  <option value={4}>4º Bim</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        {selectedAno && (
          <div className="px-3 py-2 bg-white border-b border-slate-200 shadow-sm relative z-10">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Buscar aula ou termo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-100 border-none rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#8257E5]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Timeline Content */}
      <div className="p-4 pb-12 relative">
        {!selectedAno ? (
          renderAnos()
        ) : (
          aulas.length === 0 ? (
            <p className="text-center text-slate-500 text-sm mt-4">
              Nenhuma aula encontrada.
            </p>
          ) : (
            <div className="relative border-l-2 border-indigo-100 ml-3 space-y-6">
              {aulas.map((aula, index) => {
                const id = `${aula.ano}-${aula.bimestre}-${aula.numero}-${index}`;
                const isInserted = insertedIds.has(id);
                return (
                  <div
                    key={id}
                    className="relative pl-6"
                  >
                    {/* Timeline Dot */}
                    <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-[#8257E5] z-10" />

                    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-indigo-300 transition-colors group">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                          Aula {aula.numero}
                        </span>
                        <h3 className="font-semibold text-sm text-slate-800 leading-tight">
                          {aula.titulo || aula.conteudo}
                        </h3>
                      </div>

                      <p className="text-xs text-slate-500 line-clamp-3 mb-3">
                        {aula.objetivos || "Sem objetivos cadastrados."}
                      </p>

                      <button
                        onClick={() => handleInsert(aula, id)}
                        className={`w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                          isInserted
                            ? "bg-green-100 text-green-700"
                            : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                        }`}
                      >
                        {isInserted ? (
                          <>
                            <CheckCircle2 size={14} />
                            Inserido!
                          </>
                        ) : (
                          <>
                            <PlusCircle size={14} />
                            Inserir no Doc
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}