import { useEffect, useState } from "react";
import { X, Minus } from "lucide-react";
import type { ViewType } from "../../lib/constants";
import { useAppStore } from "../../store/useAppStore";

export default function Topbar({ windowId }: { windowId?: string }) {
  const [time, setTime] = useState(new Date());
  const {
    currentView,
    setCurrentView,
    windows,
    closeWindow,
    minimizeWindow,
    updateWindow,
  } = useAppStore();

  const win = windowId ? windows.find((w) => w.id === windowId) : null;
  const isMaximized = win ? win.isMaximized : false;
  const viewType = win ? win.view : currentView;

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const viewTitles: Record<string, string> = {
    dashboard: "Dashboard",
    diario: "Registro de Aulas",
    grade: "Grade de Horários",
    agenda: "Agenda Estratégica",
    plano: "Plano de Aula",
    "controle-tarefas": "Controle de Tarefas",
    alunos: "Banco de Alunos",
    conhecimento: "Base do Jarvis",
    apostilas: "Minhas Apostilas",
    avaliacoes: "Central de Avaliações",
    "guia-pedagogico": "Guia Pedagógico",
    "lousa-magica": "Lousa Dinâmica (IA)",
    jarvis: "Jarvis AI",
    perfil: "Meu Perfil",
  };

  const handleClose = () => {
    if (win) {
      closeWindow(win.id);
    } else {
      setCurrentView("dashboard");
    }
  };

  const handleMinimize = () => {
    if (win) {
      minimizeWindow(win.id);
    } else {
      setCurrentView("dashboard");
    }
  };

  const handleMaximize = () => {
    if (win) {
      updateWindow(win.id, { isMaximized: !win.isMaximized });
    }
  };

  return (
    <header className="h-10 lg:h-12 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-b border-slate-200/50 dark:border-white/10 px-4 flex items-center justify-between shrink-0 z-10 print:hidden relative cursor-default">
      {/* Window Controls (macOS style) */}
      <div className="flex items-center gap-1.5 lg:gap-2 relative z-10 w-24">
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleClose}
          className="w-3 h-3 lg:w-3.5 lg:h-3.5 rounded-full bg-[#FF5F56] hover:bg-[#FF5F56]/90 border border-black/10 shadow-sm transition-colors flex items-center justify-center group pointer-events-auto"
        >
          <X
            size={8}
            className="opacity-0 group-hover:opacity-100 text-black/50"
            strokeWidth={3}
          />
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleMinimize}
          className="w-3 h-3 lg:w-3.5 lg:h-3.5 rounded-full bg-[#FFBD2E] hover:bg-[#FFBD2E]/90 border border-black/10 shadow-sm transition-colors flex items-center justify-center group pointer-events-auto"
        >
          <Minus
            size={8}
            className="opacity-0 group-hover:opacity-100 text-black/50"
            strokeWidth={3}
          />
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleMaximize}
          className="w-3 h-3 lg:w-3.5 lg:h-3.5 rounded-full bg-[#27C93F] hover:bg-[#27C93F]/90 border border-black/10 shadow-sm transition-colors flex items-center justify-center group pointer-events-auto"
        >
          {/* Expand icon if needed */}
          <div
            className={`w-1.5 h-1.5 border-[1.5px] border-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center`}
          />
        </button>
      </div>

      {/* Window Title (Centered) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <h2 className="text-xs lg:text-sm font-semibold text-slate-700 dark:text-slate-200 tracking-tight">
          {viewTitles[viewType] || "Aplicativo"}
        </h2>
      </div>

      {/* Right side clock */}
      <div className="flex items-center justify-end w-24 relative z-10">
        <div className="text-[10px] lg:text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono">
          {time.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </header>
  );
}
