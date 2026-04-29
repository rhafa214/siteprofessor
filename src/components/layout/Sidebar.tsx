import { GraduationCap, LayoutDashboard, Book, CalendarDays, FolderTree, PenTool, ListTodo, X } from 'lucide-react';
import type { ViewType } from '../../lib/constants';
import { cn } from '../../lib/utils';
import { useGoogleAuth } from '../../contexts/GoogleAuthContext';

interface SidebarProps {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Sidebar({ currentView, setCurrentView, isOpen, setIsOpen }: SidebarProps) {
  const { isConnected, login, logout } = useGoogleAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Principal' },
    { id: 'diario', label: 'Diário de Classe', icon: Book, group: 'Principal' },
    { id: 'agenda', label: 'Agenda Estratégica', icon: CalendarDays, group: 'Principal' },
    { id: 'arquivos', label: 'Explorador Drive', icon: FolderTree, group: 'Recursos' },
    { id: 'plano', label: 'Plano de Aula', icon: PenTool, group: 'Recursos' },
    { id: 'tarefas', label: 'Checklist', icon: ListTodo, group: 'Recursos' },
  ] as const;

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 h-full w-72 bg-slate-950 text-white flex flex-col py-6 px-4 shrink-0 shadow-2xl transition-transform duration-300 lg:relative lg:translate-x-0 lg:shadow-xl",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <button 
        onClick={() => setIsOpen(false)}
        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white lg:hidden"
      >
        <X size={24} />
      </button>

      <div className="flex items-center gap-3 mb-8 px-2 mt-2 lg:mt-0">
        <div className="bg-indigo-500 p-2 rounded-xl text-white flex items-center justify-center">
          <GraduationCap size={24} />
        </div>
        <div className="text-xl font-extrabold tracking-tight">
          EduPlanner<span className="text-indigo-400">.</span>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-2xl mb-6 overflow-hidden">
        <div className="w-10 h-10 shrink-0">
          <img 
            src="https://ui-avatars.com/api/?name=Professor&background=6366f1&color=fff" 
            alt="Professor" 
            className="w-full h-full rounded-full border-2 border-indigo-500 object-cover"
          />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold truncate">Professor(a)</span>
          <span className="text-xs text-slate-400 truncate">Modo Local</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin">
        {['Principal', 'Recursos'].map((group) => (
          <div key={group} className="mb-4">
            <div className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider mb-2 ml-3">
              {group}
            </div>
            {navItems
              .filter((item) => item.group === group)
              .map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id as ViewType)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all duration-200 text-sm font-medium",
                      isActive 
                        ? "bg-indigo-600 text-white shadow-md" 
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Icon size={18} className={cn(isActive ? "text-white" : "text-slate-400")} />
                    {item.label}
                  </button>
                );
              })}
          </div>
        ))}
      </nav>

      <div className="mt-auto pt-4">
        {isConnected ? (
          <button 
            onClick={logout}
            className="w-full py-3 bg-red-500 text-white font-bold rounded-xl text-sm hover:bg-red-600 transition-colors"
          >
            Desconectar Google
          </button>
        ) : (
          <button 
            onClick={login}
            className="w-full py-3 bg-white text-slate-950 font-bold rounded-xl text-sm hover:bg-slate-100 transition-colors"
          >
            Sincronizar Google
          </button>
        )}
      </div>
    </aside>
  );
}
