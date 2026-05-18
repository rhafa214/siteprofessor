import { useState } from "react";
import {
  GraduationCap,
  LayoutDashboard,
  Book,
  BookOpen,
  CalendarDays,
  FolderTree,
  PenTool,
  ListTodo,
  X,
  Database,
  ClipboardCheck,
  Users,
  ChevronDown,
  ChevronUp,
  LogOut,
  Bot,
  Library,
  Gamepad2,
  Moon,
  Sun,
  Map,
} from "lucide-react";
import type { ViewType } from "../../lib/constants";
import { cn } from "../../lib/utils";
import { useAuth } from "../../contexts/AuthContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";

interface SidebarProps {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Sidebar({
  currentView,
  setCurrentView,
  isOpen,
  setIsOpen,
}: SidebarProps) {
  const { user, loginWithGoogle, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useLocalStorage("darkMode", false);

  if (typeof document !== "undefined") {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      group: "Principal",
    },
    {
      id: "diario",
      label: "Registro de Aulas",
      icon: Book,
      group: "Principal",
    },
    {
      id: "agenda",
      label: "Agenda Estratégica",
      icon: CalendarDays,
      group: "Principal",
    },
    {
      id: "avaliacoes",
      label: "Avaliações",
      icon: ClipboardCheck,
      group: "Principal",
    },
    { id: "banner", label: "Assistente Banner", icon: Bot, group: "Principal" },
    {
      id: "apostilas",
      label: "Minhas Apostilas",
      icon: Library,
      group: "Recursos",
    },
    {
      id: "guia-pedagogico",
      label: "Currículo Priorizado 2026",
      icon: Map,
      group: "Recursos",
    },
    {
      id: "arquivos",
      label: "Explorador Drive",
      icon: FolderTree,
      group: "Recursos",
    },
    { id: "plano", label: "Plano de Aula", icon: PenTool, group: "Recursos" },
    { id: "tarefas", label: "Checklist", icon: ListTodo, group: "Recursos" },
    { id: "alunos", label: "Banco de Alunos", icon: Users, group: "Recursos" },
    {
      id: "jarvis",
      label: "Documentos Jarvis",
      icon: Database,
      group: "Recursos",
    },
    {
      id: "conhecimento",
      label: "Treinamento & Datas",
      icon: BookOpen,
      group: "Recursos",
    },
  ] as const;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 h-full w-72 bg-slate-950 text-white flex flex-col py-6 px-4 shrink-0 shadow-2xl transition-transform duration-300 lg:relative lg:translate-x-0 lg:shadow-xl",
        isOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <button
        onClick={() => setIsOpen(false)}
        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white lg:hidden"
      >
        <X size={24} />
      </button>

      <div className="flex items-center justify-between mb-8 px-2 mt-2 lg:mt-0">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500 p-2 rounded-xl text-white flex items-center justify-center">
            <GraduationCap size={24} />
          </div>
          <div className="text-xl font-extrabold tracking-tight">
            EduPlanner<span className="text-indigo-400">.</span>
          </div>
        </div>
        
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Alternar tema escuro"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <div className="relative mb-6">
        <button
          onClick={() => (user ? setIsProfileOpen(!isProfileOpen) : null)}
          className={cn(
            "w-full flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-2xl transition-colors text-left",
            user ? "hover:bg-white/10 cursor-pointer" : "cursor-default",
          )}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 shrink-0">
              <img
                src={
                  user?.photoURL ||
                  "https://ui-avatars.com/api/?name=Professor&background=6366f1&color=fff"
                }
                alt="Professor"
                className="w-full h-full rounded-full border-2 border-indigo-500 object-cover keep-colors"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold truncate">
                {user
                  ? `Professor ${user.displayName?.split(" ")[0] || ""}`
                  : "Visitante"}
              </span>
            </div>
          </div>
          {user && (
            <div className="text-slate-400 shrink-0">
              {isProfileOpen ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
            </div>
          )}
        </button>

        {isProfileOpen && user && (
          <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50 p-2">
            <div className="px-3 py-2 text-xs font-medium text-slate-400 border-b border-slate-800/50 mb-1 truncate">
              {user.email}
            </div>
            <button
              onClick={() => {
                logout();
                setIsProfileOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors"
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin">
        {["Principal", "Recursos"].map((group) => (
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
                        : "text-slate-400 hover:text-white hover:bg-white/5",
                    )}
                  >
                    <Icon
                      size={18}
                      className={cn(isActive ? "text-white" : "text-slate-400")}
                    />
                    {item.label}
                  </button>
                );
              })}
          </div>
        ))}
      </nav>

      <div className="mt-auto pt-4">
        {!user && (
          <button
            onClick={loginWithGoogle}
            className="w-full py-3 bg-white text-slate-950 font-bold rounded-xl text-sm hover:bg-slate-100 transition-colors"
          >
            Fazer Login com Google
          </button>
        )}
      </div>
    </aside>
  );
}
