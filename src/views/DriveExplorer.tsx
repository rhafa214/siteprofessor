import { useState } from 'react';
import { motion } from 'motion/react';
import { Folder, FileText, File, ArrowLeft, Star, UploadCloud, ChevronRight } from 'lucide-react';

export default function DriveExplorer() {
  const [activeTab, setActiveTab] = useState<'root' | 'starred'>('root');
  
  // Mock data to replace actual Google Drive request temporarily
  const mockFiles = [
    { id: '1', name: 'Planejamentos 2026', type: 'folder' },
    { id: '2', name: 'Avaliações Bimestrais', type: 'folder' },
    { id: '3', name: 'Relatórios de Alunos', type: 'folder' },
    { id: '4', name: 'Plano Ensino Médio.pdf', type: 'pdf' },
    { id: '5', name: 'Reunião de Pais.docx', type: 'doc' },
    { id: '6', name: 'Planilha de Notas.xlsx', type: 'sheet' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-140px)] gap-6"
    >
      <div className="flex items-center justify-between shrink-0">
        <div className="flex bg-slate-200/50 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('root')}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'root' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Meu Drive
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
        
        <button className="bg-slate-900 text-white px-5 py-2.5 flex items-center gap-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors shadow-md">
          <UploadCloud size={18} /> Upload de Arquivo
        </button>
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden">
        {/* Breadcrumbs / Nav */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <button className="text-slate-400 hover:text-indigo-600 transition-colors hidden p-1">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center text-sm font-bold text-slate-800">
             <span>{activeTab === 'root' ? 'Meu Drive' : 'Favoritos'}</span>
          </div>
        </div>

        {/* Grid/List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {mockFiles.map(f => (
              <div 
                key={f.id} 
                className="bg-slate-50 border border-slate-100 hover:border-indigo-300 hover:shadow-md transition-all group rounded-2xl p-6 flex flex-col items-center text-center cursor-pointer relative"
              >
                <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {f.type === 'folder' && <Folder size={28} className="text-blue-500 fill-blue-100" />}
                  {f.type === 'pdf' && <FileText size={28} className="text-red-500" />}
                  {f.type === 'doc' && <File size={28} className="text-sky-600" />}
                  {f.type === 'sheet' && <File size={28} className="text-emerald-500" />}
                </div>
                <span className="text-sm font-medium text-slate-700 line-clamp-2 leading-tight">
                  {f.name}
                </span>
                
                <button className="absolute top-3 right-3 text-slate-300 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-all">
                   <Star size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
