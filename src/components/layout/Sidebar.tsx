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
  User as UserIcon,
} from "lucide-react";
import type { ViewType } from "../../lib/constants";
import { cn } from "../../lib/utils";
import { useAuth } from "../../contexts/AuthContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useAppStore } from "../../store/useAppStore";

export default function Sidebar() {
  const { currentView, setCurrentView, isSidebarOpen, setSidebarOpen } = useAppStore();
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
    { id: "plano", label: "Plano de Aula", icon: PenTool, group: "Recursos" },
    {
      id: "perfil",
      label: "Perfil",
      icon: UserIcon,
      group: "Recursos",
    },
  ] as const;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 h-full w-72 bg-slate-950 text-white flex flex-col py-6 px-4 shrink-0 shadow-2xl transition-transform duration-300 lg:relative lg:translate-x-0 lg:shadow-xl print:hidden",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <button
        onClick={() => setSidebarOpen(false)}
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
                    onClick={() => {
                      setCurrentView(item.id as ViewType);
                      setSidebarOpen(false);
                    }}
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
