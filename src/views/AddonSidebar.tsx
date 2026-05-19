import React, { useState } from "react";
import { getCurrentBimestre } from "../lib/constants";
import { dbAulas } from "../data/guiaPedagogico";
import { motion } from "motion/react";
import { BookOpen, PlusCircle, CheckCircle2, Search } from "lucide-react";

export default function AddonSidebar() {
  const [ano, setAno] = useState<number>(6);
  const [bimestre, setBimestre] = useState<number>(getCurrentBimestre());
  const [searchTerm, setSearchTerm] = useState("");
  const [insertedIds, setInsertedIds] = useState<Set<string>>(new Set());

  // Filter aulas
  const aulas = dbAulas.filter(
    (aula) => {
      if (aula.ano !== ano || aula.bimestre !== bimestre) return false;
      const title = String(aula.titulo || aula.conteudo || "").toLowerCase();
      const obj = String(aula.objetivos || "").toLowerCase();
      const term = searchTerm.toLowerCase();
      return title.includes(term) || obj.includes(term);
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
      "*",
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

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-800 font-sans overflow-hidden">
      {/* Header compact */}
      <div className="bg-[#8257E5] text-white p-4 shadow-md flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={20} />
          <h1 className="font-bold text-lg leading-tight tracking-tight">
            Escopo EduAssistente
          </h1>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="w-full bg-white/20 border border-white/30 text-white rounded-lg text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-white/50 [&>option]:text-slate-800"
            >
              <option value={6}>6º Ano</option>
              <option value={7}>7º Ano</option>
              <option value={8}>8º Ano</option>
              <option value={9}>9º Ano</option>
            </select>
          </div>
          <div className="flex-1">
            <select
              value={bimestre}
              onChange={(e) => setBimestre(Number(e.target.value))}
              className="w-full bg-white/20 border border-white/30 text-white rounded-lg text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-white/50 [&>option]:text-slate-800"
            >
              <option value={1}>1º Bim</option>
              <option value={2}>2º Bim</option>
              <option value={3}>3º Bim</option>
              <option value={4}>4º Bim</option>
            </select>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Buscar aula..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-100 border-none rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8257E5]"
          />
        </div>
      </div>

      {/* Timeline Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {aulas.length === 0 ? (
          <p className="text-center text-slate-500 text-sm mt-8">
            Nenhuma aula encontrada.
          </p>
        ) : (
          <div className="relative border-l-2 border-indigo-100 ml-3 space-y-6">
            {aulas.map((aula, index) => {
              const id = `${aula.ano}-${aula.bimestre}-${aula.numero}-${index}`;
              const isInserted = insertedIds.has(id);
              return (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  key={id}
                  className="relative pl-6"
                >
                  {/* Timeline Dot */}
                  <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-[#8257E5] z-10" />

                  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-indigo-300 transition-colors group">
                    <h3 className="font-semibold text-sm text-slate-800 leading-tight mb-1">
                      {aula.titulo || aula.conteudo || `Aula ${aula.numero}`}
                    </h3>

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
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
