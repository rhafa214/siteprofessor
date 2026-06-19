import React, { useState, useEffect } from "react";
import { X, Folder, Star, ChevronRight, Loader2, Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DriveFolder {
  id: string;
  name: string;
  starred?: boolean;
}

interface DriveFolderPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (folderId: string, folderName: string) => void;
  accessToken: string;
}

export default function DriveFolderPickerModal({
  isOpen,
  onClose,
  onSelect,
  accessToken,
}: DriveFolderPickerModalProps) {
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"starred" | "root" | "folder">(
    "starred",
  );
  const [currentFolderNav, setCurrentFolderNav] = useState<
    { id: string; name: string }[]
  >([]);

  useEffect(() => {
    if (isOpen && accessToken) {
      fetchFolders();
    }
  }, [isOpen, accessToken, viewMode, currentFolderNav]);

  const fetchFolders = async () => {
    setIsLoading(true);
    try {
      let q = "";
      if (viewMode === "starred") {
        q =
          "starred=true and mimeType='application/vnd.google-apps.folder' and trashed=false";
      } else if (viewMode === "root") {
        q =
          "'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false";
      } else if (viewMode === "folder" && currentFolderNav.length > 0) {
        const currentFolderId =
          currentFolderNav[currentFolderNav.length - 1].id;
        q = `'${currentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      }

      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,starred)&orderBy=name`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const data = await res.json();
      if (data.files) {
        setFolders(data.files);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFolderClick = (folder: DriveFolder) => {
    setViewMode("folder");
    setCurrentFolderNav([
      ...currentFolderNav,
      { id: folder.id, name: folder.name },
    ]);
  };

  const navigateToNav = (index: number) => {
    if (index === -1) {
      setViewMode("root");
      setCurrentFolderNav([]);
    } else {
      setViewMode("folder");
      setCurrentFolderNav(currentFolderNav.slice(0, index + 1));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col h-[80vh] max-h-[600px]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-xl font-bold text-slate-800">
            Selecionar Pasta no Drive
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sidebar + Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 border-r border-slate-100 bg-slate-50/50 p-4 shrink-0 flex flex-col gap-2">
            <button
              onClick={() => {
                setViewMode("starred");
                setCurrentFolderNav([]);
              }}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${viewMode === "starred" ? "bg-amber-50 text-amber-700" : "text-slate-600 hover:bg-slate-100"}`}
            >
              <Star
                size={18}
                className={
                  viewMode === "starred" ? "fill-amber-400 text-amber-400" : ""
                }
              />
              Favoritas
            </button>
            <button
              onClick={() => {
                setViewMode("root");
                setCurrentFolderNav([]);
              }}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${viewMode === "root" || viewMode === "folder" ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-100"}`}
            >
              <Folder size={18} />
              Meu Drive
            </button>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {/* Breadcrumb nav */}
            {(viewMode === "root" || viewMode === "folder") && (
              <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 bg-white shrink-0 overflow-x-auto whitespace-nowrap">
                <button
                  onClick={() => navigateToNav(-1)}
                  className="text-sm font-medium text-slate-500 hover:text-emerald-600 transition-colors"
                >
                  Meu Drive
                </button>
                {currentFolderNav.map((nav, i) => (
                  <React.Fragment key={nav.id}>
                    <ChevronRight size={14} className="text-slate-300" />
                    <button
                      onClick={() => navigateToNav(i)}
                      className={`text-sm font-medium transition-colors ${i === currentFolderNav.length - 1 ? "text-slate-800" : "text-slate-500 hover:text-emerald-600"}`}
                    >
                      {nav.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}

            {viewMode === "starred" && (
              <div className="px-6 py-3 border-b border-slate-100 bg-white shrink-0">
                <h3 className="text-sm font-medium text-slate-500">
                  Pastas Favoritas
                </h3>
              </div>
            )}

            {/* Folder List */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 relative">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                  <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                </div>
              ) : folders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                  <Folder size={48} className="opacity-20" />
                  <p className="text-sm">Nenhuma pasta encontrada.</p>
                </div>
              ) : (
                folders.map((folder) => (
                  <div
                    key={folder.id}
                    className="flex justify-between items-center group px-4 py-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors cursor-pointer"
                    onClick={() => handleFolderClick(folder)}
                  >
                    <div className="flex items-center gap-3">
                      <Folder size={20} className="text-sky-500" />
                      <span className="font-medium text-slate-700">
                        {folder.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {folder.starred && (
                        <Star
                          size={16}
                          className="fill-amber-400 text-amber-400"
                        />
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(folder.id, folder.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 px-4 py-1.5 bg-emerald-100 text-emerald-700 font-bold text-xs rounded-lg hover:bg-emerald-200 transition-colors"
                      >
                        Selecionar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer with a fallback current folder selection if we are inside a folder */}
            {viewMode === "folder" && currentFolderNav.length > 0 && (
              <div className="border-t border-slate-100 p-4 bg-slate-50 flex items-center justify-between shrink-0">
                <span className="text-sm text-slate-600">
                  Salvar em:{" "}
                  <strong className="text-slate-800">
                    {currentFolderNav[currentFolderNav.length - 1].name}
                  </strong>
                </span>
                <button
                  onClick={() => {
                    const currentFolder =
                      currentFolderNav[currentFolderNav.length - 1];
                    onSelect(currentFolder.id, currentFolder.name);
                  }}
                  className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors text-sm"
                >
                  Selecionar Pasta Atual
                </button>
              </div>
            )}

            {/* Special behavior for root or starred to select the whole space / create new folder */}
            {(viewMode === "root" || viewMode === "starred") && (
              <div className="border-t border-slate-100 p-4 bg-slate-50 flex items-center justify-between shrink-0">
                <span className="text-sm text-slate-500">
                  Selecione uma pasta acima clicando em "Selecionar" ou entre
                  nela.
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
