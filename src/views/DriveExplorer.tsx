import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Folder,
  FileText,
  File,
  ArrowLeft,
  Star,
  Grid as GridIcon,
  List as ListIcon,
  Chrome,
  LogIn,
  LogOut,
  X,
  ExternalLink,
  ChevronRight,
  Maximize2
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function DriveExplorer() {
  const [activeTab, setActiveTab] = useState<"root" | "starred">("root");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([
    { id: "root", name: "Meu Drive" },
  ]);
  const currentFolder = folderPath[folderPath.length - 1];

  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);
  const [selectedFileTitle, setSelectedFileTitle] = useState<string>("");

  const {
    user,
    accessToken,
    loginWithGoogle,
    logout,
    authError: globalAuthError,
  } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchFiles = async (token: string, folderId: string, isStarred: boolean) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const q = isStarred
        ? "starred = true and trashed = false"
        : `'${folderId}' in parents and trashed = false`;
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,starred,iconLink,webViewLink)&orderBy=folder,name`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.status === 401) {
        logout();
        setApiError("Sessão do Google expirada. Por favor, conecte novamente.");
        return;
      }

      if (res.status === 403) {
        let errMsg =
          "Permissão negada ou API não ativada. Ao fazer login, marque a caixa de permissão do Google Drive.";
        try {
          const errData = await res.json();
          if (errData?.error?.message) errMsg = errData.error.message;
        } catch (e) {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      if (data.files) {
        setFiles(data.files);
      }
    } catch (error: any) {
      console.error(error);
      setApiError(error.message || "Erro ao carregar arquivos");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && accessToken) {
      fetchFiles(accessToken, currentFolder.id, activeTab === "starred");
    } else {
      setApiError(null);
    }
  }, [user, accessToken, activeTab, currentFolder.id]);

  const handleFolderClick = (f: any) => {
    if (activeTab === "starred") {
      setActiveTab("root");
      setFolderPath([{ id: "root", name: "Meu Drive" }, { id: f.id, name: f.name }]);
    } else {
      setFolderPath((prev) => [...prev, { id: f.id, name: f.name }]);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    setFolderPath((prev) => prev.slice(0, index + 1));
  };

  const handleNavigateUp = () => {
    if (folderPath.length > 1) {
      setFolderPath((prev) => prev.slice(0, prev.length - 1));
    }
  };

  const openFileViewer = (f: any) => {
    setSelectedFileTitle(f.name);
    // Para edição/visualização direta
    if (f.mimeType.includes("document") || f.mimeType.includes("spreadsheet") || f.mimeType.includes("presentation")) {
       setSelectedFileUrl(`https://docs.google.com/document/d/${f.id}/edit?usp=drivesdk&rm=minimal`);
    } else {
       setSelectedFileUrl(`https://drive.google.com/file/d/${f.id}/preview`);
    }
  };

  const displayError = globalAuthError || apiError;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-140px)] gap-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-4">
        <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("root")}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === "root"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Folder size={16} className="inline mr-2" /> Meu Drive
          </button>
          <button
            onClick={() => setActiveTab("starred")}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === "starred"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Star
              size={16}
              className={
                activeTab === "starred" ? "fill-indigo-500 text-indigo-500" : ""
              }
            />{" "}
            Favoritos
          </button>
        </div>

        {accessToken ? (
          <button
            onClick={logout}
            className="bg-red-50 text-red-600 px-5 py-2.5 rounded-xl text-sm font-bold border border-red-100 hover:bg-red-100 transition-colors shadow-sm self-start sm:self-auto flex items-center gap-2"
          >
            <LogOut size={16} /> Desconectar
          </button>
        ) : (
          <button
            onClick={loginWithGoogle}
            className="bg-slate-900 text-white px-5 py-2.5 flex items-center gap-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors shadow-md self-start sm:self-auto"
          >
            <LogIn size={18} /> Conectar Google Drive
          </button>
        )}
      </div>

      {displayError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-sm font-medium">
          {displayError}
        </div>
      )}

      <div className="flex-1 bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden relative">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center text-sm font-bold text-slate-800 flex-wrap">
            {activeTab === "starred" ? (
              <span className="flex items-center gap-2 px-2 py-1 bg-amber-50 text-amber-700 rounded-lg">
                <Star size={18} className="fill-amber-400 text-amber-400" /> Favoritos
              </span>
            ) : (
              <div className="flex items-center flex-wrap gap-1">
                {folderPath.length > 1 && (
                  <button 
                    onClick={handleNavigateUp}
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors mr-1"
                    title="Voltar um nível"
                  >
                    <ArrowLeft size={16} />
                  </button>
                )}
                {folderPath.map((folder, index) => (
                  <div key={folder.id} className="flex items-center">
                    <button
                      onClick={() => handleBreadcrumbClick(index)}
                      className={`hover:text-indigo-600 transition-colors ${
                        index === folderPath.length - 1 ? "text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md" : "text-slate-600"
                      }`}
                    >
                      {folder.name}
                    </button>
                    {index < folderPath.length - 1 && (
                      <ChevronRight size={16} className="text-slate-300 mx-1" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
            >
              <GridIcon size={18} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
            >
              <ListIcon size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative">
          {!accessToken ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50">
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg"
                  alt="Google Drive"
                  className="w-10 h-10"
                />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                Conecte sua conta
              </h3>
              <p className="text-slate-500 font-medium max-w-sm">
                Faça login com o Google para visualizar e editar seus arquivos!
              </p>
            </div>
          ) : isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : files.length > 0 ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {files.map((f) => {
                  const isFolder =
                    f.mimeType === "application/vnd.google-apps.folder";
                  const isPdf = f.mimeType === "application/pdf";
                  const isDoc = f.mimeType.includes("document");
                  const isSheet = f.mimeType.includes("spreadsheet");
                  const isSlides = f.mimeType.includes("presentation");
                  return (
                    <div
                      key={f.id}
                      onClick={() => isFolder ? handleFolderClick(f) : openFileViewer(f)}
                      className="bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-lg transition-all group rounded-2xl p-6 flex flex-col items-center text-center cursor-pointer relative"
                    >
                      <div className="w-14 h-14 rounded-full bg-slate-50 shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        {isFolder ? (
                          <Folder
                            size={28}
                            className="text-blue-500 fill-blue-100"
                          />
                        ) : isPdf ? (
                          <FileText size={28} className="text-red-500" />
                        ) : isDoc ? (
                          <File size={28} className="text-sky-600" />
                        ) : isSheet ? (
                          <File size={28} className="text-emerald-500" />
                        ) : isSlides ? (
                          <Chrome size={28} className="text-amber-500" />
                        ) : (
                          <File size={28} className="text-slate-400" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-slate-700 line-clamp-2 leading-tight break-all">
                        {f.name}
                      </span>
                      <button className="absolute top-3 right-3 text-slate-200 opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
                        <Star
                          size={18}
                          className={
                            f.starred
                              ? "fill-amber-400 text-amber-400 opacity-100"
                              : "text-amber-400/50"
                          }
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {files.map((f) => {
                  const isFolder =
                    f.mimeType === "application/vnd.google-apps.folder";
                  const isPdf = f.mimeType === "application/pdf";
                  const isDoc = f.mimeType.includes("document");
                  const isSheet = f.mimeType.includes("spreadsheet");
                  const isSlides = f.mimeType.includes("presentation");
                  return (
                    <div
                      key={f.id}
                      onClick={() => isFolder ? handleFolderClick(f) : openFileViewer(f)}
                      className="bg-white border border-slate-200 hover:border-indigo-400 hover:bg-slate-50 transition-all group rounded-xl p-3 flex items-center gap-4 cursor-pointer relative"
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        {isFolder ? (
                          <Folder
                            size={20}
                            className="text-blue-500 fill-blue-100"
                          />
                        ) : isPdf ? (
                          <FileText size={20} className="text-red-500" />
                        ) : isDoc ? (
                          <File size={20} className="text-sky-600" />
                        ) : isSheet ? (
                          <File size={20} className="text-emerald-500" />
                        ) : isSlides ? (
                          <Chrome size={20} className="text-amber-500" />
                        ) : (
                          <File size={20} className="text-slate-400" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-slate-700 truncate flex-1">
                        {f.name}
                      </span>
                      <button className="text-slate-200 opacity-0 group-hover:opacity-100 transition-all px-2 pointer-events-none">
                        <Star
                          size={18}
                          className={
                            f.starred
                              ? "fill-amber-400 text-amber-400 opacity-100"
                              : "text-amber-400/50"
                          }
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-center flex flex-col items-center justify-center h-full p-8 text-slate-500 mt-10">
              <Folder size={48} className="text-slate-200 mb-4" />
              <p className="font-medium text-lg">Nenhum arquivo encontrado</p>
              <p className="text-sm text-slate-400">Esta pasta está vazia.</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedFileUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-8"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl md:rounded-3xl shadow-2xl w-full h-full max-h-[95vh] flex flex-col overflow-hidden"
            >
              <div className="h-14 sm:h-16 px-4 shrink-0 bg-slate-50/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3 pr-4 truncate">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                    <FileText size={16} />
                  </div>
                  <h3 className="font-bold text-slate-800 truncate text-sm sm:text-base">
                    {selectedFileTitle}
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                   <button
                    onClick={() => window.open(selectedFileUrl, '_blank')}
                    className="p-2 sm:px-4 sm:py-2 text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <ExternalLink size={16} /> <span className="hidden sm:inline">Abrir em Nova Guia</span>
                  </button>
                  <button
                    onClick={() => setSelectedFileUrl(null)}
                    className="w-10 h-10 rounded-xl bg-slate-200/50 hover:bg-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-800 transition-colors ml-1"
                    title="Fechar (Esc)"
                  >
                    <X size={20} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 w-full bg-slate-100/50 relative">
                {/* Loader showing while iframe loads */}
                <div className="absolute inset-0 flex items-center justify-center -z-10">
                   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
                <iframe
                  src={selectedFileUrl}
                  className="w-full h-full border-0 absolute inset-0 z-10"
                  title={selectedFileTitle}
                  allow="fullscreen; clipboard-read; clipboard-write; display-capture"
                  referrerPolicy="no-referrer"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
