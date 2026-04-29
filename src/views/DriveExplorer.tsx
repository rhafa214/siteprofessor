import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Folder, FileText, File, ArrowLeft, Star, Grid as GridIcon, List as ListIcon, Chrome } from 'lucide-react';
import { useGoogleAuth } from '../contexts/GoogleAuthContext';

export default function DriveExplorer() {
  const [activeTab, setActiveTab] = useState<'root' | 'starred'>('root');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const { isConnected, accessToken, login, logout, authError, setAuthError } = useGoogleAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFiles = async (token: string) => {
    setIsLoading(true);
    try {
      const q = activeTab === 'starred' ? 'starred = true and trashed = false' : 'trashed = false and "root" in parents';
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,starred,iconLink)&orderBy=folder,name`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.status === 401) {
        logout();
        setAuthError('Sessão expirada. Por favor, conecte novamente.');
        return;
      }
      
      const data = await res.json();
      if (data.files) {
        setFiles(data.files);
      }
    } catch (error) {
       console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && accessToken) {
      fetchFiles(accessToken);
    }
  }, [isConnected, accessToken, activeTab]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-140px)] gap-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-4">
        <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit">
          <button 
            onClick={() => setActiveTab('root')}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flexitems-center gap-2 ${
              activeTab === 'root' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Folder size={16} className="inline mr-2" /> Meu Drive
          </button>
          <button 
            onClick={() => setActiveTab('starred')}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'starred' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Star size={16} className={activeTab === 'starred' ? "fill-indigo-500 text-indigo-500" : ""} /> Favoritos
          </button>
        </div>
        
        {isConnected ? (
          <button onClick={logout} className="bg-red-50 text-red-600 px-5 py-2.5 rounded-xl text-sm font-bold border border-red-100 hover:bg-red-100 transition-colors shadow-sm self-start sm:self-auto">
            Desconectar
          </button>
        ) : (
          <button onClick={login} className="bg-slate-900 text-white px-5 py-2.5 flex items-center gap-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors shadow-md self-start sm:self-auto">
            Conectar Google Drive
          </button>
        )}
      </div>

      {authError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-sm font-medium">
          {authError}
        </div>
      )}

      <div className="flex-1 bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden relative">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
          <div className="flex items-center text-sm font-bold text-slate-800">
             <span>{activeTab === 'root' ? 'Espaço de Trabalho' : 'Favoritos'}</span>
          </div>
          
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <GridIcon size={18} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <ListIcon size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative">
          {!isConnected ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50">
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                 <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" alt="Google Drive" className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Conecte seu Google Drive</h3>
              <p className="text-slate-500 font-medium max-w-sm">
                 Para testar de verdade, configure o VITE_GOOGLE_CLIENT_ID e faça login para ver seus próprios arquivos!
              </p>
            </div>
          ) : isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-medium">
              Carregando arquivos...
            </div>
          ) : files.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {files.map(f => {
                  const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
                  const isPdf = f.mimeType === 'application/pdf';
                  const isDoc = f.mimeType.includes('document');
                  const isSheet = f.mimeType.includes('spreadsheet');
                  const isSlides = f.mimeType.includes('presentation');
                  return (
                    <div 
                      key={f.id} 
                      className="bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-lg transition-all group rounded-2xl p-6 flex flex-col items-center text-center cursor-pointer relative"
                    >
                      <div className="w-14 h-14 rounded-full bg-slate-50 shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        {isFolder ? <Folder size={28} className="text-blue-500 fill-blue-100" /> :
                         isPdf ? <FileText size={28} className="text-red-500" /> :
                         isDoc ? <File size={28} className="text-sky-600" /> :
                         isSheet ? <File size={28} className="text-emerald-500" /> :
                         isSlides ? <Chrome size={28} className="text-amber-500" /> :
                         <File size={28} className="text-slate-400" />}
                      </div>
                      <span className="text-sm font-medium text-slate-700 line-clamp-2 leading-tight break-all">
                        {f.name}
                      </span>
                      <button className="absolute top-3 right-3 text-slate-200 opacity-0 group-hover:opacity-100 transition-all">
                         <Star size={18} className={f.starred ? "fill-amber-400 text-amber-400 opacity-100" : "hover:text-amber-400"} />
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {files.map(f => {
                  const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
                  const isPdf = f.mimeType === 'application/pdf';
                  const isDoc = f.mimeType.includes('document');
                  const isSheet = f.mimeType.includes('spreadsheet');
                  const isSlides = f.mimeType.includes('presentation');
                  return (
                    <div 
                      key={f.id} 
                      className="bg-white border border-slate-200 hover:border-indigo-400 hover:bg-slate-50 transition-all group rounded-xl p-3 flex items-center gap-4 cursor-pointer relative"
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        {isFolder ? <Folder size={20} className="text-blue-500 fill-blue-100" /> :
                         isPdf ? <FileText size={20} className="text-red-500" /> :
                         isDoc ? <File size={20} className="text-sky-600" /> :
                         isSheet ? <File size={20} className="text-emerald-500" /> :
                         isSlides ? <Chrome size={20} className="text-amber-500" /> :
                         <File size={20} className="text-slate-400" />}
                      </div>
                      <span className="text-sm font-medium text-slate-700 truncate flex-1">
                        {f.name}
                      </span>
                      <button className="text-slate-200 opacity-0 group-hover:opacity-100 transition-all px-2">
                         <Star size={18} className={f.starred ? "fill-amber-400 text-amber-400 opacity-100" : "hover:text-amber-400"} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          ) : (
            <div className="text-center p-8 text-slate-400 font-medium mt-10">
              Nenhum arquivo encontrado nesta pasta.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
