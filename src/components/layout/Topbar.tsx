import { useEffect, useState } from 'react';
import { Palmtree, Menu } from 'lucide-react';
import type { ViewType } from '../../lib/constants';
import { DATAS_OFICIAIS } from '../../lib/constants';

export default function Topbar({ currentView, setIsSidebarOpen }: { currentView: ViewType, setIsSidebarOpen: (b: boolean) => void }) {
  const [time, setTime] = useState(new Date());
  const [recessoDays, setRecessoDays] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    
    // Calculate recesso
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dataR = new Date(DATAS_OFICIAIS.recesso + "T00:00:00");
    const diffR = Math.ceil((dataR.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    setRecessoDays(diffR > 0 ? diffR : 0);
    
    return () => clearInterval(timer);
  }, []);

  const viewTitles: Record<ViewType, string> = {
    dashboard: 'Dashboard',
    diario: 'Diário de Classe',
    agenda: 'Agenda Estratégica',
    arquivos: 'Explorador Drive',
    plano: 'Plano de Aula',
    tarefas: 'Checklist',
  };

  return (
    <header className="h-16 lg:h-20 bg-white border-b border-slate-200 px-4 lg:px-10 flex items-center justify-between shrink-0 z-10 shadow-sm">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 lg:hidden text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <Menu size={24} />
        </button>
        <h2 className="text-lg font-bold text-slate-800 tracking-tight">
          {viewTitles[currentView].toUpperCase()}
        </h2>
      </div>
      
      <div className="flex items-center gap-4 lg:gap-6">
        <div className="hidden sm:flex bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full border border-emerald-100 items-center gap-2 text-xs font-bold shadow-sm">
          <Palmtree size={14} />
          <span>{recessoDays} dias p/ recesso</span>
        </div>
        
        <div className="text-lg lg:text-xl font-extrabold text-indigo-600 font-mono tracking-tighter w-24 text-right">
          {time.toLocaleTimeString('pt-BR')}
        </div>
      </div>
    </header>
  );
}
