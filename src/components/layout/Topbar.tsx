import { useEffect, useState } from 'react';
import { Palmtree, Menu, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import type { ViewType } from '../../lib/constants';
import { DATAS_OFICIAIS } from '../../lib/constants';
import { useAuth } from '../../contexts/AuthContext';

export default function Topbar({ currentView, setIsSidebarOpen }: { currentView: ViewType, setIsSidebarOpen: (b: boolean) => void }) {
  const [time, setTime] = useState(new Date());
  const [recessoInfo, setRecessoInfo] = useState<{ days: number, nome: string } | null>(null);
  const { user, loginWithGoogle, logout } = useAuth();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    
    // Calculate next recesso/férias
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    let upcoming: { days: number, nome: string } | null = null;
    let minDays = Infinity;
    
    for (const item of DATAS_OFICIAIS.recessoDatas) {
      const dataR = new Date(item.data + "T00:00:00");
      const diffR = Math.ceil((dataR.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffR >= 0 && diffR < minDays) {
        minDays = diffR;
        upcoming = { days: diffR, nome: item.nome };
      }
    }
    
    setRecessoInfo(upcoming);
    
    return () => clearInterval(timer);
  }, []);

  const viewTitles: Record<ViewType, string> = {
    dashboard: 'Dashboard',
    diario: 'Diário de Classe',
    agenda: 'Agenda Estratégica',
    arquivos: 'Explorador Drive',
    plano: 'Plano de Aula',
    tarefas: 'Checklist',
    conhecimento: 'Base do Jarvis',
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
        {recessoInfo && (
          <div className="hidden sm:flex bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full border border-emerald-100 items-center gap-2 text-xs font-bold shadow-sm">
            <Palmtree size={14} />
            <span>{recessoInfo.days} dias p/ {recessoInfo.nome}</span>
          </div>
        )}
        
        <div className="hidden lg:block text-lg font-extrabold text-indigo-600 font-mono tracking-tighter w-24 text-right">
          {time.toLocaleTimeString('pt-BR')}
        </div>
        
        <div className="flex items-center border-l border-slate-200 pl-4 lg:pl-6 ml-2 lg:ml-0">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <div className="text-xs font-bold text-slate-700">{user.displayName || 'Professor'}</div>
                <div className="text-[10px] text-slate-500">{user.email}</div>
              </div>
              <button onClick={logout} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" title="Sair">
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <button 
              onClick={loginWithGoogle} 
              className="flex items-center gap-2 text-xs font-bold bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors shadow-sm"
            >
              <LogIn size={16} /> <span className="hidden sm:inline">Entrar com Google</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
