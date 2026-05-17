import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Database, FileText, UploadCloud, Loader2, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
  uploadedAt: number;
}

export default function JarvisBaseView() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [expandedDocs, setExpandedDocs] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        const docRef = doc(db, "users", user.uid, "knowledge", "jarvisBase");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().docs) {
          setDocs(docSnap.data().docs);
        }
      } catch (err) {
        console.error("Error loading knowledge base:", err);
      }
    }
    loadData();
  }, [user]);

  const saveDocs = async (newDocs: KnowledgeDoc[]) => {
    if (!user) return;
    try {
      await setDoc(doc(db, "users", user.uid, "knowledge", "jarvisBase"), {
        docs: newDocs
      });
      setDocs(newDocs);
    } catch (err) {
      console.error("Error saving knowledge base:", err);
      alert("Erro ao salvar documento.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !user) return;
    
    setIsUploading(true);
    let successfullyUploaded: KnowledgeDoc[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadStatus(`Extraindo dados com IA... (${i + 1}/${files.length})`);
      
      try {
        const formData = new FormData();
        formData.append("file", file);
        
        const response = await fetch("/api/extract-text", {
          method: "POST",
          body: formData,
        });
        
        const responseText = await response.text();
        
        if (!response.ok) {
          let errorMessage = "Erro na resposta do servidor.";
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.error || errorMessage;
          } catch(e) {
            errorMessage = responseText.substring(0, 100);
          }
          throw new Error(errorMessage);
        }
        
        const parsedData = JSON.parse(responseText);
        
        if (parsedData.text) {
          const newDoc: KnowledgeDoc = {
            id: Date.now().toString() + "-" + i,
            title: file.name,
            content: parsedData.text,
            uploadedAt: Date.now()
          };
          successfullyUploaded.push(newDoc);
        } else {
          console.error(`A IA não conseguiu extrair informações do documento ${file.name}.`);
        }
      } catch (err: any) {
        console.error(`Erro ao importar ${file.name}:`, err);
        alert(`Erro ao importar ${file.name}: ${err.message}`);
      }
    }
    
    if (successfullyUploaded.length > 0) {
      setUploadStatus("Salvando documentos...");
      const newDocs = [...successfullyUploaded, ...docs];
      await saveDocs(newDocs);
    }
    
    setUploadStatus("");
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Tem certeza que deseja remover este documento da base?")) return;
    const newDocs = docs.filter(d => d.id !== id);
    await saveDocs(newDocs);
  };

  const toggleDoc = (id: string) => {
    setExpandedDocs((prev) =>
      prev.includes(id) ? prev.filter((dId) => dId !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex h-full flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-slate-200">
        <div className="px-6 py-6 md:py-8 max-w-6xl mx-auto w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-2">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
                  <Database size={20} />
                </div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                  Base de Conhecimento (Jarvis)
                </h1>
              </div>
              <p className="text-slate-500 font-medium ml-13 flex items-center gap-2">
                Faça o upload de currículos, provas, guias e planejamentos. O Jarvis usará todos esses documentos como base ao planejar suas aulas.
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full md:w-80">
              <div className="relative">
                <input 
                  type="file" 
                  multiple
                  accept="application/pdf,image/*,.docx" 
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
                      Adicionar Documento
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          {docs.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <Database className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-700 mb-2">Nenhum documento na base</h3>
              <p className="text-slate-500">
                Adicione arquivos como "Matriz da Prova Paulista", "Aprendizagens Essenciais" e outros materiais de apoio para que o Jarvis entenda o seu currículo.
              </p>
            </div>
          )}

          {docs.map((docItem) => {
            const isExpanded = expandedDocs.includes(docItem.id);
            return (
              <motion.div
                key={docItem.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <div
                  onClick={() => toggleDoc(docItem.id)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1">
                        {docItem.title}
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">
                        Adicionado em {new Date(docItem.uploadedAt).toLocaleDateString()} às {new Date(docItem.uploadedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <button 
                      onClick={(e) => handleDelete(docItem.id, e)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir documento"
                    >
                      <Trash2 size={18} />
                    </button>
                    <div className="text-slate-400">
                      {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-100 bg-slate-50/50"
                    >
                      <div className="p-6">
                        <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed bg-white border border-slate-200 p-4 rounded-xl shadow-sm overflow-auto max-h-[500px]">
                          {docItem.content}
                        </pre>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
