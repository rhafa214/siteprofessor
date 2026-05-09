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
    diario: 'Registro de Aulas',
    agenda: 'Agenda Estratégica',
    arquivos: 'Explorador Drive',
    plano: 'Plano de Aula',
    tarefas: 'Checklist',
    'controle-tarefas': 'Controle de Tarefas',
    alunos: 'Banco de Alunos',
    conhecimento: 'Base do Jarvis',
    banner: 'Assistente Banner',
  };

  return (
    <header className="h-10 lg:h-12 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between shrink-0 z-10 shadow-sm print:hidden">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-1 lg:hidden text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu size={18} />
        </button>
        <h2 className="text-sm font-bold text-slate-800 tracking-tight">
          {(viewTitles[currentView] || '').toUpperCase()}
        </h2>
      </div>
      
      <div className="flex items-center gap-4 lg:gap-6">
        {recessoInfo && (
          <div className="hidden sm:flex bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 items-center gap-1.5 text-[11px] font-bold shadow-sm">
            <Palmtree size={12} />
            <span>{recessoInfo.days} dias p/ {recessoInfo.nome}</span>
          </div>
        )}
        
        <div className="hidden lg:block text-sm font-bold text-indigo-600 font-mono tracking-tighter w-20 text-right">
          {time.toLocaleTimeString('pt-BR')}
        </div>
        
        <div className="flex items-center border-l border-slate-200 pl-4 lg:pl-6 ml-2 lg:ml-0">
          {!user && (
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
