import React, { useState, useEffect } from "react";
import { X, File, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

interface DriveFilePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (fileId: string, fileName: string, mimeType: string) => void;
  accessToken: string;
}

export default function DriveFilePickerModal({
  isOpen,
  onClose,
  onSelect,
  accessToken,
}: DriveFilePickerModalProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    if (isOpen && accessToken) {
      fetchFiles();
    }
  }, [isOpen, accessToken]);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      // Query for PPT and PPTX and Google Slides
      const q = "trashed=false and (mimeType='application/vnd.ms-powerpoint' or mimeType='application/vnd.openxmlformats-officedocument.presentationml.presentation' or mimeType='application/vnd.google-apps.presentation' or name contains '.ppt' or name contains '.pptx')";
      
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)&orderBy=modifiedTime desc`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const data = await res.json();
      if (data.files) {
        setFiles(data.files);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-xl font-bold text-slate-800">
            Selecionar Apresentação no Drive
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <File size={48} className="opacity-20" />
              <p className="text-sm">Nenhuma apresentação encontrada.</p>
            </div>
          ) : (
            files.map((file) => (
              <div
                key={file.id}
                className="flex justify-between items-center group px-4 py-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors cursor-pointer"
                onClick={() => onSelect(file.id, file.name, file.mimeType)}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                    <File size={20} />
                  </div>
                  <span className="font-medium text-slate-700">
                    {file.name}
                  </span>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 px-4 py-1.5 bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg hover:bg-indigo-200 transition-colors"
                >
                  Selecionar
                </button>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
