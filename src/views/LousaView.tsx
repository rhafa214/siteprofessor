import React, { useState } from "react";
import { Upload, PenTool, Sparkles, Loader2, FileUp, HardDrive } from "lucide-react";
import Markdown from "react-markdown";
import DriveFilePickerModal from "../components/DriveFilePickerModal";
import { useAuth } from "../contexts/AuthContext";

export default function LousaView() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lousaData, setLousaData] = useState<{
    markdown: string;
    imageBase64: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const { accessToken } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleDriveSelect = async (fileId: string, fileName: string, mimeType: string) => {
    setIsDrivePickerOpen(false);
    setIsLoading(true);
    setError(null);
    try {
      let downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      if (mimeType === 'application/vnd.google-apps.presentation') {
        downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
      }
      
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      if (!res.ok) {
        throw new Error('Falha ao baixar o arquivo do Drive: ' + res.statusText);
      }
      
      const blob = await res.blob();
      const filename = mimeType === 'application/vnd.google-apps.presentation' ? `${fileName}.pdf` : fileName;
      const downloadedFile = new File([blob], filename, { type: blob.type });
      
      setFile(downloadedFile);
    } catch (err: any) {
      setError("Erro ao baixar do Drive: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const generateLousa = async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/generate-lousa", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let errMessage = "Erro ao gerar lousa";
        try {
          const textResponse = await res.text();
          try {
            const err = JSON.parse(textResponse);
            errMessage = err.error || errMessage;
          } catch (e) {
            console.error("Non-JSON error response:", textResponse);
            errMessage = `Erro do servidor (${res.status}): A resposta não pôde ser lida (não é JSON).`;
          }
        } catch (e) {
          errMessage = `Erro do servidor (${res.status}).`;
        }
        throw new Error(errMessage);
      }

      const data = await res.json();
      setLousaData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
          <PenTool className="text-indigo-600 dark:text-indigo-400" />
          Lousa Dinâmica (IA)
        </h1>
        <p className="text-slate-600 dark:text-slate-400 max-w-3xl">
          Faça upload de um slide (PPT, PDF ou Imagem) e deixe a IA planejar a estrutura da sua lousa
          e gerar um esboço visual de como ela ficará para seus alunos.
        </p>
      </div>

      {!lousaData ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 max-w-2xl mx-auto shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
             <button
                onClick={() => document.getElementById("file-upload")?.click()}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
             >
                <div className="bg-indigo-100 dark:bg-indigo-900/50 p-3 rounded-full mb-3">
                  <FileUp className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">Upload Local</h3>
                <p className="text-xs text-slate-500 mt-1">PPT, PDF ou Imagens</p>
             </button>

             <button
                onClick={() => {
                  if (accessToken) {
                    setIsDrivePickerOpen(true);
                  } else {
                    setError("Você precisa conectar sua conta do Google para acessar o Drive.");
                  }
                }}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
             >
                <div className="bg-emerald-100 dark:bg-emerald-900/50 p-3 rounded-full mb-3">
                  <HardDrive className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">Google Drive</h3>
                <p className="text-xs text-slate-500 mt-1">Importe suas apresentações</p>
             </button>
          </div>

          <div className="flex flex-col items-center">
            {file && (
              <div className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 mb-4 w-full max-w-sm justify-center">
                <FileUp size={16} />
                {file.name}
              </div>
            )}
            <input
              id="file-upload"
              type="file"
              className="hidden"
              accept=".pdf,.ppt,.pptx,image/*"
              onChange={handleFileChange}
            />
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-xl text-sm font-medium text-center">
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-center">
            <button
              onClick={generateLousa}
              disabled={!file || isLoading}
              className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Carregando arquivo & Gerando Esquema...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  Gerar Lousa Mágica
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto w-full">
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <PenTool className="text-indigo-600" /> Estrutura da Lousa
                </h2>
                <button
                  onClick={() => setLousaData(null)}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Novo Documento
                </button>
              </div>
              
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <Markdown>{lousaData.markdown}</Markdown>
              </div>
            </div>
          </div>
        </div>
      )}

      {accessToken && (
        <DriveFilePickerModal
          isOpen={isDrivePickerOpen}
          onClose={() => setIsDrivePickerOpen(false)}
          accessToken={accessToken}
          onSelect={handleDriveSelect}
        />
      )}
    </div>
  );
}
