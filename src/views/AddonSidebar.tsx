import React, { useState, useRef } from "react";
import Papa from "papaparse";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { getCurrentBimestre } from "../lib/constants";
import { dbAulas, dbAEs, Aula } from "../data/guiaPedagogico";
import { bnccHabilidades } from "../data/bnccHabilidades";
import { BookOpen, PlusCircle, CheckCircle2, Search, ChevronLeft, Upload } from "lucide-react";

export default function AddonSidebar() {
  const [selectedAno, setSelectedAno] = useState<number | null>(null);
  const [bimestre, setBimestre] = useState<number>(getCurrentBimestre());
  const [searchTerm, setSearchTerm] = useState("");
  const [insertedIds, setInsertedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"aulas" | "aes">("aulas");
  const [customAulas, setCustomAulas] = useLocalStorage<Aula[]>("customAulasData", []);
  const [isExtractingPDF, setIsExtractingPDF] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.pdf')) {
      setIsExtractingPDF(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/parse-addon-curriculum", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
           const errData = await res.json();
           throw new Error(errData.error || "Erro no upload.");
        }

        const parsed = await res.json();

        if (Array.isArray(parsed) && parsed.length > 0) {
           setCustomAulas(prev => [...prev, ...parsed]);
           alert(`Escopo PDF importado com sucesso! ${parsed.length} aulas extraídas.`);
        } else {
           alert("Nenhuma aula foi extraída do PDF. Escolha um PDF válido de matriz curricular.");
        }
      } catch (err: any) {
        console.error(err);
        const errorMessage = typeof err.message === 'string' ? err.message : JSON.stringify(err);
        if (errorMessage.includes("503") || errorMessage.includes("high demand") || errorMessage.includes("UNAVAILABLE")) {
          alert("A Inteligência Artificial está com alta demanda no momento. Por favor, aguarde alguns instantes e tente novamente.");
        } else {
          alert("Erro no processamento do PDF: " + errorMessage);
        }
      } finally {
        setIsExtractingPDF(false);
      }
    } else if (file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          if (Array.isArray(json)) {
            setCustomAulas(json);
            alert("Escopo importado com sucesso (JSON)!");
          }
        } catch (err) {
          alert("Erro ao ler JSON: verifique o formato do arquivo.");
        }
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsed = results.data.map((row: any) => ({
            ano: Number(row.ano),
            bimestre: Number(row.bimestre),
            numero: Number(row.numero),
            titulo: row.titulo || '',
            conteudo: row.conteudo || '',
            objetivos: row.objetivos || '',
            habilidades: row.habilidades || '',
            aprendizagemEssencial: row.aprendizagemEssencial || ''
          }));
          setCustomAulas(parsed);
          alert("Escopo importado com sucesso (CSV)!");
        },
        error: (error) => {
          alert("Erro ao ler CSV: " + error.message);
        }
      });
    } else {
      alert("Formato não suportado. Use .csv ou .json");
    }
  };

  const formatAulasList = (numbers: number[]) => {
    if (numbers.length === 0) return "";
    let res = [];
    let i = 0;
    while (i < numbers.length) {
      let start = numbers[i];
      let end = start;
      while (i + 1 < numbers.length && numbers[i + 1] === end + 1) {
        end = numbers[i + 1];
        i++;
      }
      if (start === end) res.push(`${start}`);
      else if (end === start + 1) res.push(`${start}, ${end}`);
      else res.push(`${start} a ${end}`);
      i++;
    }
    return res.join(", ");
  };

  const getDetalheAprendizagem = (ano: number, bimestre: number, codigo: string) => {
    if (!codigo || codigo === "-") return codigo;
    const codigos = codigo.split(",").map((c) => c.trim());
    const detalhes = codigos.map((c) => {
      const aeInfo = dbAEs.find((ae) => ae.ano === ano && ae.bimestre === bimestre && ae.id === c);
      return aeInfo ? `${c} - ${aeInfo.titulo}` : c;
    });
    return detalhes.join("\n");
  };

  // Filter aulas
  const constAllAulas = [...dbAulas, ...customAulas];
  const aulas = constAllAulas.filter(
    (aula) => {
      if (aula.ano !== selectedAno || aula.bimestre !== bimestre) return false;
      const title = String(aula.titulo || aula.conteudo || "").toLowerCase();
      const obj = String(aula.objetivos || "").toLowerCase();
      const num = String(aula.numero || "").toLowerCase();
      const term = searchTerm.toLowerCase();
      return title.includes(term) || obj.includes(term) || num.includes(term);
    }
  );

  const aes = dbAEs.filter(
    (ae) => {
      if (ae.ano !== selectedAno || ae.bimestre !== bimestre) return false;
      const title = String(ae.titulo || "").toLowerCase();
      const id = String(ae.id || "").toLowerCase();
      const term = searchTerm.toLowerCase();
      return title.includes(term) || id.includes(term);
    }
  );

  const handleInsert = (aula: any, id: string) => {
    // Construct the text to insert
    const title = aula.titulo || aula.conteudo || "";
    const aprendizagem = getDetalheAprendizagem(aula.ano, aula.bimestre, aula.aprendizagemEssencial || "");
    const habilidades = Array.isArray(aula.habilidades) 
      ? aula.habilidades.join(", ") 
      : aula.habilidades || "";
    const objetivos = aula.objetivos || "";

    let textToInsert = `Aula ${aula.numero}: ${title}\n`;
    if (aprendizagem) textToInsert += `Aprendizagem Essencial: ${aprendizagem}\n`;
    if (habilidades) textToInsert += `Habilidades: ${habilidades}\n`;
    if (objetivos) textToInsert += `Objetivos: ${objetivos}\n`;
    textToInsert += `\n`;

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

  const handleInsertAE = (ae: any, id: string) => {
    let textToInsert = `Aprendizagem Essencial: ${ae.id}\n${ae.titulo}\n`;
    if (ae.habilidadePriorizada) textToInsert += `Habilidade Priorizada: ${ae.habilidadePriorizada}\n`;
    if (ae.habilidadesRelacionadas) textToInsert += `Habilidades Relacionadas: ${ae.habilidadesRelacionadas}\n`;
    textToInsert += `\n`;

    window.parent.postMessage(
      {
        type: "INSERT_TEXT",
        text: textToInsert,
      },
      "*"
    );

    setInsertedIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setInsertedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2000);
  };

  const renderAnos = () => (
    <div className="grid grid-cols-2 gap-3">
      {[6, 7, 8, 9].map((ano) => (
        <button
          key={ano}
          onClick={() => setSelectedAno(ano)}
          className="bg-white border text-center border-slate-200 rounded-xl p-3 shadow-sm hover:border-[#8257E5] hover:shadow-md transition-all group flex flex-col items-center justify-center gap-2"
        >
          <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-[#8257E5] font-bold text-lg group-hover:scale-110 transition-transform">
            {ano}º
          </div>
          <span className="font-semibold text-slate-700 text-sm">{ano}º Ano</span>
        </button>
      ))}
    </div>
  );

  return (
    <div 
      className="bg-slate-50 text-slate-800 font-sans flex flex-col"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}
    >
      {/* Header compact - Sticky */}
      <div className="sticky top-0 z-20 bg-white shadow-sm">
        <div className="bg-[#8257E5] text-white p-3 shadow-md flex justify-between items-center">
          <div className="flex items-center gap-2">
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
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="hover:bg-white/20 p-1.5 rounded-full transition-colors flex items-center justify-center relative"
            title="Importar Meu Escopo (PDF/CSV/JSON)"
            disabled={isExtractingPDF}
          >
            {isExtractingPDF ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <Upload size={16} />
            )}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".csv,.json,.pdf" 
            className="hidden" 
          />
        </div>

        {selectedAno && (
          <div className="bg-[#8257E5] px-3 pb-3">
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

        {/* Search */}
        {selectedAno && (
          <div className="bg-white border-b border-slate-200 shadow-sm relative z-10 flex flex-col">
            <div className="px-3 py-2 border-b border-slate-100">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder={activeTab === "aulas" ? "Buscar aula ou termo..." : "Buscar aprendizagem..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-100 border-none rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#8257E5]"
                />
              </div>
            </div>
            
            <div className="flex w-full">
              <button 
                onClick={() => setActiveTab("aulas")}
                className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
                  activeTab === "aulas" ? "border-[#8257E5] text-[#8257E5]" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                Aulas
              </button>
              <button 
                onClick={() => setActiveTab("aes")}
                className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
                  activeTab === "aes" ? "border-[#8257E5] text-[#8257E5]" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                Aprendizagens (AE)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Timeline Content */}
      <div className="flex-1 p-4 pb-12 relative">
        {!selectedAno ? (
          renderAnos()
        ) : (
          activeTab === "aulas" ? (
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
                    <div key={id} className="relative pl-6">
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

                        <div className="flex flex-col gap-2 mb-3">
                          {aula.aprendizagemEssencial && aula.aprendizagemEssencial !== "-" && (
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Aprendizagem Essencial</span>
                              <p className="text-xs text-slate-600 leading-snug whitespace-pre-wrap">
                                {getDetalheAprendizagem(aula.ano, aula.bimestre, aula.aprendizagemEssencial)}
                              </p>
                            </div>
                          )}

                          {(aula.habilidades && aula.habilidades.length > 0) && (
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Habilidades</span>
                              <div className="text-xs text-slate-600 leading-snug space-y-1">
                                {(Array.isArray(aula.habilidades) ? aula.habilidades : aula.habilidades.split(",")).map(h => {
                                  const code = h.trim();
                                  const desc = bnccHabilidades[code];
                                  return (
                                    <p key={code} className="mb-1">
                                      <span className="font-semibold">({code})</span>{desc ? ` ${desc}` : ""}
                                    </p>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Objetivos</span>
                            <p className="text-xs text-slate-600 leading-snug">
                              {aula.objetivos || "Sem objetivos cadastrados."}
                            </p>
                          </div>
                        </div>

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
          ) : (
            aes.length === 0 ? (
              <p className="text-center text-slate-500 text-sm mt-4">
                Nenhuma aprendizagem essencial encontrada.
              </p>
            ) : (
              <div className="space-y-4">
                {aes.map((ae, index) => {
                  const id = `ae-${ae.ano}-${ae.bimestre}-${ae.id}-${index}`;
                  const isInserted = insertedIds.has(id);
                  const aulasRelacionadas = dbAulas
                    .filter(a => a.ano === ae.ano && a.bimestre === ae.bimestre && a.aprendizagemEssencial.split(',').map(s => s.trim()).includes(ae.id))
                    .map(a => a.numero)
                    .sort((a,b) => a - b);
                  const aulasStr = formatAulasList(aulasRelacionadas);

                  return (
                    <div key={id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-indigo-300 transition-colors group">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] whitespace-nowrap font-bold px-2 py-0.5 rounded-full shrink-0">
                          {ae.id}
                        </span>
                        <div className="flex-1">
                          {aulasStr && (
                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                              {aulasStr.includes("a") || aulasStr.includes(",") ? "Engloba as Aulas " : "Engloba a Aula "}{aulasStr}
                            </div>
                          )}
                          <h3 className="font-semibold text-sm text-slate-800 leading-tight">
                            {ae.titulo}
                          </h3>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 mb-3">
                        {ae.habilidadePriorizada && (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Habilidade Priorizada</span>
                            <div className="text-xs text-slate-600 leading-snug space-y-1">
                              {ae.habilidadePriorizada.split(",").map(h => {
                                const code = h.trim();
                                const desc = bnccHabilidades[code];
                                return (
                                  <p key={code} className="mb-1">
                                    <span className="font-semibold">({code})</span>{desc ? ` ${desc}` : ""}
                                  </p>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {ae.habilidadesRelacionadas && (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Habilidades Relacionadas</span>
                            <div className="text-xs text-slate-600 leading-snug space-y-1">
                              {ae.habilidadesRelacionadas.split(",").map(h => {
                                const code = h.trim();
                                const desc = bnccHabilidades[code];
                                return (
                                  <p key={code} className="mb-1">
                                    <span className="font-semibold">({code})</span>{desc ? ` ${desc}` : ""}
                                  </p>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleInsertAE(ae, id)}
                        className={`w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                          isInserted
                            ? "bg-green-100 text-green-700"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
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
                  );
                })}
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}