import React, { useState, useEffect } from "react";
import {
  BookMarked,
  Search,
  ChevronLeft,
  Loader2,
  FileText,
} from "lucide-react";
import { db } from "../lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import PdfViewer from "../components/PdfViewer";
import { getPdfLocal } from "../lib/localPdfStorage";

interface Apostila {
  id: string;
  title: string;
  pdfUrl?: string;
  color: string;
  category?: "apostila" | "documento";
  bimester?: string;
}

export default function AddonAvaliacoesSidebar() {
  const { user } = useAuth();
  const [apostilas, setApostilas] = useState<Apostila[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedApostila, setSelectedApostila] = useState<Apostila | null>(
    null,
  );
  const [localPdfBlob, setLocalPdfBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
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
        setApostilas(data);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore error:", error);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user]);

  const handleSelectApostila = async (apo: Apostila) => {
    setSelectedApostila(apo);
    if (apo.pdfUrl && apo.pdfUrl.startsWith("local:")) {
      const blob = await getPdfLocal(apo.id);
      setLocalPdfBlob(blob || null);
    } else {
      setLocalPdfBlob(null);
    }
  };

  const filtered = apostilas.filter(
    (a) =>
      (a.category === "apostila" || !a.category) &&
      a.title.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div
      className="bg-slate-50 text-slate-800 font-sans flex flex-col"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      <div className="sticky top-0 z-20 bg-white shadow-sm shrink-0">
        <div className="bg-indigo-600 text-white p-3 shadow-md flex items-center gap-2">
          {selectedApostila ? (
            <button
              onClick={() => setSelectedApostila(null)}
              className="hover:bg-white/20 p-1 -ml-1 rounded-full text-white transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
          ) : (
            <FileText size={16} />
          )}
          <h1 className="font-bold text-base leading-tight tracking-tight flex-1 truncate">
            {selectedApostila
              ? selectedApostila.title
              : "Montador de Avaliações"}
          </h1>
        </div>

        {!selectedApostila && (
          <div className="bg-white border-b border-slate-200 shadow-sm relative z-10 flex flex-col">
            <div className="px-3 py-2 border-b border-slate-100">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Buscar apostila..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-100 border-none rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            </div>
            <div className="px-3 py-2 text-xs text-slate-500 bg-slate-50 border-b border-slate-100">
              Selecione uma apostila para extrair questões para sua avaliação.
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto relative bg-slate-50 flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : selectedApostila ? (
          <div className="flex-1 w-full bg-[#1e1e1e]">
            <PdfViewer url={selectedApostila.pdfUrl} fileData={localPdfBlob} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-slate-500 relative z-10 bg-white m-4 rounded-xl shadow-sm border border-slate-100">
            <BookMarked size={32} className="mx-auto mb-3 text-slate-300" />
            Nenhuma apostila encontrada. Adicione as apostilas na plataforma
            principal (Estante de Arquivos).
          </div>
        ) : (
          <div className="p-3 grid grid-cols-2 gap-3 relative z-10">
            {filtered.map((apo) => (
              <button
                key={apo.id}
                onClick={() => handleSelectApostila(apo)}
                className={`flex flex-col items-center justify-center text-center p-3 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-400 hover:shadow-md transition-all ${apo.color || "bg-indigo-500"} bg-opacity-10 bg-white`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm mb-2 ${apo.color || "bg-indigo-500"}`}
                >
                  <BookMarked size={18} />
                </div>
                <span className="text-xs font-semibold text-slate-700 line-clamp-2">
                  {apo.title}
                </span>
                {apo.bimester && (
                  <span className="text-[10px] text-slate-500 mt-1">
                    {apo.bimester}º Bimestre
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
