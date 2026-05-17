import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BookOpen, Search, Hash, ChevronDown, ChevronUp, UploadCloud, Loader2 } from "lucide-react";
import { curriculumData as defaultCurriculumData, CurriculumItem } from "../data/curriculumData";
import { useAuth } from "../contexts/AuthContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function CurriculumView() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedAulas, setExpandedAulas] = useState<string[]>([]);
  const [selectedAno, setSelectedAno] = useState<number>(6);
  const [selectedBimestre, setSelectedBimestre] = useState<number>(1);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  
  const [storedData, setStoredData] = useState<CurriculumItem[]>(defaultCurriculumData);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        const docRef = doc(db, "users", user.uid, "knowledge", "curriculumJSON");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().data) {
          setStoredData(docSnap.data().data);
        }
      } catch (err) {
        console.error("Error loading curriculum JSON:", err);
      }
    }
    loadData();
  }, [user]);

  const toggleAula = (aulaId: string) => {
    setExpandedAulas((prev) =>
      prev.includes(aulaId) ? prev.filter((id) => id !== aulaId) : [...prev, aulaId]
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setIsUploading(true);
    setUploadStatus("Enviando PDF para o servidor de IA...");
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("ano", selectedAno.toString());
      formData.append("bimestre", selectedBimestre.toString());
      
      const response = await fetch("/api/parse-curriculum", {
        method: "POST",
        body: formData,
      });
      
      const responseText = await response.text();
      
      if (!response.ok) {
          let errorMessage = "Erro na extração.";
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.error || errorMessage;
          } catch(e) {
            errorMessage = responseText.substring(0, 100);
          }
          throw new Error(errorMessage);
      }
      
      setUploadStatus("Salvando aulas analisadas...");
      const parsedData: CurriculumItem[] = JSON.parse(responseText);
      
      if (parsedData && Array.isArray(parsedData) && parsedData.length > 0) {
        // Merge the newly parsed data with existing data, ignoring duplicates
        const newData = [...storedData];
        parsedData.forEach(newItem => {
           const exists = newData.findIndex(d => d.ano === newItem.ano && d.bimestre === newItem.bimestre && d.aula === newItem.aula);
           if (exists >= 0) {
              newData[exists] = newItem;
           } else {
              newData.push(newItem);
           }
        });
        
        await setDoc(doc(db, "users", user.uid, "knowledge", "curriculumJSON"), {
          data: newData
        });
        setStoredData(newData);
      } else {
        throw new Error("A IA não conseguiu extrair nenhuma aula. Formato não reconhecido.");
      }
      
      setUploadStatus("");
    } catch (err: any) {
      console.error(err);
      alert("Erro ao importar: " + err.message);
      setUploadStatus("");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const filteredData = useMemo(() => {
    return storedData.filter((item) => {
      const matchAnoBimestre = item.ano === selectedAno && item.bimestre === selectedBimestre;
      const matchSearch = item.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.habilidades.some((h) => h.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchAnoBimestre && matchSearch;
    });
  }, [selectedAno, selectedBimestre, searchTerm, storedData]);

  return (
    <div className="flex h-full flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-slate-200">
        <div className="px-6 py-6 md:py-8 max-w-6xl mx-auto w-full">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                  <BookOpen size={20} />
                </div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                  Escopo-Sequência
                </h1>
              </div>
              <p className="text-slate-500 font-medium ml-13 flex items-center gap-2">
                Navegue pelas aprendizagens essenciais, conteúdos e habilidades do currículo.
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full md:w-80">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar aula ou habilidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full bg-slate-100/50 border border-slate-200 text-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white transition-all text-sm font-medium"
                />
              </div>
              
              <div className="relative">
                <input 
                  type="file" 
                  accept="application/pdf" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-70"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {uploadStatus || "Processando..."}
                    </>
                  ) : (
                    <>
                      <UploadCloud size={18} />
                      Extrair PDF com IA
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 ml-13">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {[6, 7, 8, 9].map((ano) => (
                <button
                  key={ano}
                  onClick={() => setSelectedAno(ano)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                    selectedAno === ano
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {ano}º Ano
                </button>
              ))}
            </div>
            
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {[1, 2, 3, 4].map((bimestre) => (
                <button
                  key={bimestre}
                  onClick={() => setSelectedBimestre(bimestre)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                    selectedBimestre === bimestre
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {bimestre}º Bimestre
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          {filteredData.map((item, idx) => {
            const uniqueId = `${item.ano}-${item.bimestre}-${item.aula}-${idx}`;
            const isExpanded = expandedAulas.includes(uniqueId);
            return (
              <motion.div
                key={uniqueId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => toggleAula(uniqueId)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Aula</span>
                      <span className="text-xl font-black text-indigo-600 leading-none">{item.aula}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1">
                        {item.titulo}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {item.habilidades.map((hab) => (
                          <span
                            key={hab}
                            className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700"
                          >
                            <Hash size={10} />
                            {hab}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-slate-400 shrink-0 ml-4">
                    {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-100 bg-slate-50/50"
                    >
                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        
                        <div className="space-y-3">
                          <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                            Conteúdo
                          </h4>
                          <ul className="space-y-2">
                            {item.conteudo.map((c, i) => (
                              <li key={i} className="text-sm text-slate-700 leading-relaxed flex items-start gap-2">
                                <span className="text-blue-500 font-bold mt-0.5">•</span>
                                {c}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                            Objetivos de Aprendizagem
                          </h4>
                          <ul className="space-y-2">
                            {item.objetivos.map((o, i) => (
                              <li key={i} className="text-sm text-slate-700 leading-relaxed flex items-start gap-2">
                                <span className="text-emerald-500 font-bold mt-0.5">•</span>
                                {o}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="space-y-3 lg:col-span-1 md:col-span-2">
                          <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                            Aprendizagem Essencial
                          </h4>
                          {item.aprendizagem ? (
                            <div className="bg-white border border-slate-200 p-4 rounded-xl text-sm text-slate-700 shadow-sm leading-relaxed">
                              {item.aprendizagem}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400 italic">Sem aprendizagem essencial listada.</span>
                          )}
                        </div>

                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
          
          {filteredData.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-700 mb-2">Aulas não cadastradas</h3>
              <p className="text-slate-500">
                Os dados para o {selectedAno}º Ano, {selectedBimestre}º Bimestre ainda não estão carregados. Você pode extraí-los clicando no botão "Extrair PDF com IA".
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
