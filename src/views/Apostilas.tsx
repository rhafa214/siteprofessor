import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BookMarked,
  Plus,
  Trash2,
  X,
  ExternalLink,
  Library,
  Edit2,
  UploadCloud,
  Link as LinkIcon,
  Loader2,
  Maximize,
} from "lucide-react";
import { db } from "../lib/firebase";
import {
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import PdfViewer, { PdfThumbnail } from "../components/PdfViewer";
import {
  savePdfLocal,
  getPdfLocal,
  deletePdfLocal,
} from "../lib/localPdfStorage";
import { supabase } from "../lib/supabase";

interface Apostila {
  id: string;
  title: string;
  pdfUrl?: string; // The universal URL property
  color: string;
  category?: "apostila" | "documento";
  createdAt: number;
}

const COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-pink-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function ThumbnailRenderer({ url }: { url: string }) {
  const [error, setError] = useState(false);
  const extractDriveId = (link: string | undefined | null) => {
    if (!link) return null;
    const matchD = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (matchD) return matchD[1];
    const matchId = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchId) return matchId[1];
    return null;
  };
  const driveId = extractDriveId(url);

  if (!url) return null;

  if (driveId && !error) {
    return (
      <img
        src={`https://drive.google.com/thumbnail?id=${driveId}&sz=w600`}
        alt=""
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none bg-white z-0"
        onError={() => setError(true)}
      />
    );
  }
  
  if (driveId) {
    return (
        <div className="absolute inset-0 w-full h-full bg-[#f8f9fa] flex items-center justify-center opacity-80">
            <BookMarked size={48} className="text-slate-300" />
        </div>
    );
  }

  if (url.startsWith("local:")) {
    // Cannot easily preview IndexedDB Blob in thumbnail without async fetch, so show placeholder
    return (
        <div className="absolute inset-0 w-full h-full bg-[#f8f9fa] flex items-center justify-center opacity-80">
            <BookMarked size={48} className="text-slate-400" />
        </div>
    );
  }

  return <PdfThumbnail url={url} />;
}

export default function Apostilas() {
  const { user } = useAuth();
  const [apostilas, setApostilas] = useState<Apostila[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newCategory, setNewCategory] = useState<"apostila" | "documento">("apostila");
  const [activeTab, setActiveTab] = useState<"apostila" | "documento">("apostila");
  const [itemToDelete, setItemToDelete] = useState<Apostila | null>(null);

  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedApostila, setSelectedApostila] = useState<Apostila | null>(
    null,
  );
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [localPdfBlob, setLocalPdfBlob] = useState<Blob | null>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, "users", user.uid, "apostilas"),
      (snap) => {
        const data: Apostila[] = [];
        snap.forEach((d) => {
          const item = d.data();
          let pdfUrl = item.pdfUrl;
          if (!pdfUrl) {
            if (item.driveLink) pdfUrl = item.driveLink;
            else if (item.storageUrl) pdfUrl = item.storageUrl;
          }
          data.push({ ...item, id: d.id, pdfUrl } as Apostila);
        });
        data.sort((a, b) => b.createdAt - a.createdAt);
        setApostilas(data);
      },
      (error) => {
        console.error("Firestore error in apostilas listener:", error);
      },
    );
    return () => unsub();
  }, [user]);

  const extractDriveId = (link: string | undefined | null) => {
    if (!link) return null;
    const matchD = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (matchD) return matchD[1];
    const matchId = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchId) return matchId[1];
    return null;
  };

  const openAddForm = () => {
    setEditingId(null);
    setNewTitle("");
    setNewUrl("");
    setSelectedFile(null);
    setSelectedColor(COLORS[0]);
    setIsFormOpen(true);
    setNewCategory(activeTab);
  };

  const openEditForm = (e: React.MouseEvent, apo: Apostila) => {
    e.stopPropagation();
    setEditingId(apo.id);
    setNewTitle(apo.title);
    setNewUrl(apo.pdfUrl || "");
    setSelectedFile(null);
    setSelectedColor(apo.color || COLORS[0]);
    setIsFormOpen(true);
    setNewCategory(apo.category || "apostila");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle.trim()) return;
    if (!selectedFile && !newUrl.trim()) {
      alert("Por favor, adicione um link ou selecione um arquivo.");
      return;
    }

    try {
      setIsUploading(true);

      let finalPdfUrl: string | undefined = newUrl.trim() || undefined;
      const docId = editingId || Math.random().toString(36).substring(7);
      
      // If a file is selected, use local IndexedDB instead of Supabase
      if (selectedFile) {
        await savePdfLocal(docId, selectedFile);
        finalPdfUrl = "local:" + docId;
      }

      if (editingId) {
        const dataToUpdate: any = {
          title: newTitle.trim(),
          color: selectedColor,
          category: newCategory,
        };
        if (finalPdfUrl) dataToUpdate.pdfUrl = finalPdfUrl;

        await updateDoc(
          doc(db, "users", user.uid, "apostilas", editingId),
          dataToUpdate,
        );
      } else {
        const dataToAdd: any = {
          title: newTitle.trim(),
          color: selectedColor,
          category: newCategory,
          createdAt: Date.now(),
        };
        if (finalPdfUrl) dataToAdd.pdfUrl = finalPdfUrl;

        await setDoc(doc(db, "users", user.uid, "apostilas", docId), dataToAdd);
      }
      setIsFormOpen(false);
      setNewTitle("");
      setNewUrl("");
      setSelectedFile(null);
      setEditingId(null);
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao salvar apostila: ${e.message || "Erro desconhecido"}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (e: React.MouseEvent, apo: Apostila) => {
    e.stopPropagation();
    setItemToDelete(apo);
  };

  const confirmDelete = async () => {
    if (!user || !itemToDelete) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "apostilas", itemToDelete.id));
      if (itemToDelete.pdfUrl && itemToDelete.pdfUrl.startsWith("local:")) {
        await deletePdfLocal(itemToDelete.id);
      }
      if (selectedApostila?.id === itemToDelete.id) setSelectedApostila(null);
    } catch (e) {
      console.error(e);
      alert("Erro ao remover o arquivo.");
    } finally {
      setItemToDelete(null);
    }
  };

  const handleSelectApostila = async (apo: Apostila) => {
    setSelectedApostila(apo);
    if (apo.pdfUrl && apo.pdfUrl.startsWith("local:")) {
      const blob = await getPdfLocal(apo.id);
      setLocalPdfBlob(blob || null);
    } else {
      setLocalPdfBlob(null);
    }
  };

  const filteredApostilas = apostilas.filter(
    (a) => (a.category || "apostila") === activeTab
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-140px)] gap-6"
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 justify-center rounded-2xl flex items-center">
            <Library size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">
              Estante de Arquivos
            </h1>
            <p className="text-slate-500 font-medium">
              Suas apostilas e documentos importantes sempre à mão.
            </p>
          </div>
        </div>
        <button
          onClick={openAddForm}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus size={18} /> Adicionar
        </button>
      </div>

      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("apostila")}
          className={`pb-3 font-bold px-2 border-b-2 transition-colors ${activeTab === "apostila" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          Apostilas
        </button>
        <button
          onClick={() => setActiveTab("documento")}
          className={`pb-3 font-bold px-2 border-b-2 transition-colors ${activeTab === "documento" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          Documentos Importantes
        </button>
      </div>

      <div className="flex-1 bg-slate-100/50 rounded-3xl p-6 border border-slate-200 overflow-y-auto">
        {filteredApostilas.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
            <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-4">
              <BookMarked size={40} className="text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 mb-2">
              Sua estante está vazia
            </h3>
            <p className="text-slate-500 max-w-sm">
              Adicione o link ou envie o arquivo para visualizá-lo aqui rapidamente.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {filteredApostilas.map((apo) => (
              <motion.div
                layoutId={`apo-${apo.id}`}
                key={apo.id}
                onClick={() => handleSelectApostila(apo)}
                className="group relative cursor-pointer flex flex-col"
              >
                {/* Book Spine / Cover */}
                <div
                  className={`${apo.color} rounded-r-2xl rounded-l-md shadow-md aspect-[3/4] relative overflow-hidden flex items-center justify-center p-4 border border-black/10 group-hover:-translate-y-2 group-hover:shadow-xl transition-all duration-300`}
                >
                  {/* Decorative book binding line */}
                  <div className="absolute left-3 top-0 bottom-0 w-px bg-white/20 z-10 pointer-events-none"></div>
                  <div className="absolute left-6 top-0 bottom-0 w-px bg-black/10 z-10 pointer-events-none"></div>

                  <ThumbnailRenderer url={apo.pdfUrl} />

                  <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-10"></div>
                  <h3 className="text-white font-bold text-sm text-center drop-shadow-md z-20 break-words line-clamp-3 max-w-full px-2 pb-3 absolute bottom-0 w-full pointer-events-none">
                    {apo.title}
                  </h3>

                  <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all z-20">
                    <button
                      onClick={(e) => openEditForm(e, apo)}
                      className="p-2 bg-black/40 hover:bg-blue-500 text-white rounded-full outline-none backdrop-blur-sm"
                      title="Editar"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, apo)}
                      className="p-2 bg-black/40 hover:bg-red-500 text-white rounded-full outline-none backdrop-blur-sm"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Shelf shadow underneath */}
                <div className="h-3 bg-black/10 mx-2 rounded-full blur-sm mt-1"></div>
                {/* Format indicator */}
                <div className="text-center mt-2 opacity-60 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-center gap-1">
                  {apo.pdfUrl && apo.pdfUrl.includes("supabase") ? (
                    <>
                      <UploadCloud size={12} /> Nuvem
                    </>
                  ) : extractDriveId(apo.pdfUrl) ? (
                    <>
                      <LinkIcon size={12} /> Drive
                    </>
                  ) : (
                    <>
                      <BookMarked size={12} /> PDF
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isFormOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isUploading) {
                setIsFormOpen(false);
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => !isUploading && setIsFormOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <BookMarked className="text-indigo-500" />{" "}
                {editingId ? "Editar Arquivo" : "Novo Arquivo"}
              </h2>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Categoria
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as "apostila" | "documento")}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="apostila">Apostila</option>
                    <option value="documento">Documento Importante</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Título do Arquivo
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-400"
                    placeholder="Ex: Caderno do Aluno - 1º Bimestre"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Enviar PDF (Nuvem)
                  </label>
                  <label
                    className={`w-full flex items-center justify-center gap-2 border-2 border-dashed ${selectedFile ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100"} rounded-xl px-4 py-4 cursor-pointer transition-all`}
                  >
                    <UploadCloud
                      size={20}
                      className={
                        selectedFile ? "text-indigo-500" : "text-slate-400"
                      }
                    />
                    <span
                      className={`text-sm font-medium ${selectedFile ? "text-indigo-700 font-bold" : "text-slate-500"}`}
                    >
                      {selectedFile
                        ? selectedFile.name
                        : "Selecionar arquivo .pdf"}
                    </span>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) =>
                        e.target.files && setSelectedFile(e.target.files[0])
                      }
                      className="hidden"
                    />
                  </label>
                  {selectedFile && (
                    <p className="text-xs text-indigo-600 mt-2">
                      Este PDF será enviado para a nuvem e poderá ser acessado
                      de qualquer dispositivo!
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-2 font-medium">
                    Ou conecte um link abaixo:
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Link da Apostila (Opcional)
                  </label>
                  <input
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-400"
                    placeholder="Cole o link do PDF ou do Google Drive..."
                    disabled={!!selectedFile}
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Links do Google Drive não suportam exibição em Modo Kindle
                    por restrições do Google.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Cor da Capa
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedColor(c)}
                        className={`w-8 h-8 rounded-full ${c} ${selectedColor === c ? "ring-4 ring-offset-2 ring-indigo-500 scale-110" : "hover:scale-110"} transition-all`}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isUploading || (!selectedFile && !newUrl.trim())}
                  className="w-full mt-2 relative flex items-center justify-center gap-2 overflow-hidden bg-indigo-600 text-white rounded-xl py-3.5 font-bold hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {isUploading && (
                      <Loader2 size={18} className="animate-spin" />
                    )}
                    {editingId
                      ? isUploading
                        ? "Atualizando..."
                        : "Atualizar Arquivo"
                      : isUploading
                        ? "Salvando..."
                        : "Salvar Arquivo"}
                  </span>
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {selectedApostila && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-0 sm:p-4 sm:py-8 bg-black/80 backdrop-blur-2xl transition-all duration-300 ${isFullscreen ? "p-0 sm:p-0 sm:py-0" : ""}`}
          >
            <motion.div
              layoutId={`apo-${selectedApostila.id}`}
              className={`bg-[#1e1e1e] flex flex-col w-full h-full min-h-0 ${isFullscreen ? "max-w-none rounded-none" : "max-w-7xl rounded-none sm:rounded-2xl border border-white/5"} shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden relative transition-all duration-300`}
            >
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.2 }}
                className="flex flex-col w-full h-full min-h-0"
              >
                <div
                  className={`p-3 px-5 flex items-center justify-between shrink-0 bg-[#252525] ${isFullscreen ? "absolute top-0 left-0 right-0 z-[60] bg-black/80 backdrop-blur-md opacity-0 hover:opacity-100 transition-opacity border-b border-white/10" : "border-b border-white/5 z-10"}`}
                >
                  <h2 className="text-sm font-semibold text-white/90 truncate max-w-[50%] flex gap-2 items-center">
                    <BookMarked size={16} className="text-white/50" /> {selectedApostila.title}
                  </h2>
                  <div className="flex items-center gap-2">
                    <a
                      href={selectedApostila.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 bg-black/20 hover:bg-black/40 text-white rounded-xl transition-all flex items-center gap-1 text-sm font-medium backdrop-blur-sm"
                    >
                      <ExternalLink size={16} />{" "}
                      <span className="hidden sm:inline">Abrir externamente</span>
                    </a>
                    <button
                      onClick={() => {
                        if (!isFullscreen) {
                          document.documentElement
                            .requestFullscreen()
                            .catch(console.error);
                          setIsFullscreen(true);
                        } else {
                          if (document.fullscreenElement) {
                            document.exitFullscreen().catch(console.error);
                          }
                          setIsFullscreen(false);
                        }
                      }}
                      className="p-2 bg-black/20 hover:bg-black/40 text-white rounded-xl transition-all hidden sm:flex items-center gap-1 backdrop-blur-sm"
                      title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
                    >
                      <Maximize size={16} />{" "}
                      <span className="hidden sm:inline">
                        {isFullscreen ? "Minimizar" : "Tela Cheia"}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedApostila(null);
                        setIsFullscreen(false);
                        if (document.fullscreenElement) {
                          document.exitFullscreen().catch(console.error);
                        }
                      }}
                      className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-all ml-1 backdrop-blur-sm"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 w-full relative bg-[#1e1e1e]">
                  <PdfViewer
                    url={selectedApostila.pdfUrl}
                    fileData={localPdfBlob}
                  />
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {itemToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setItemToDelete(null);
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <Trash2 className="text-red-600" size={24} />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Excluir arquivo?</h2>
                <p className="text-slate-600">
                  Tem certeza que deseja remover <strong>{itemToDelete.title}</strong>? Essa ação não poderá ser desfeita.
                </p>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setItemToDelete(null)}
                    className="px-4 py-2 font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="px-4 py-2 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
