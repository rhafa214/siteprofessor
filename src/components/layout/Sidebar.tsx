import { useState } from "react";
import {
  GraduationCap,
  LayoutDashboard,
  Book,
  CalendarDays,
  PenTool,
  ClipboardCheck,
  User as UserIcon,
  LogOut,
  Library,
  Map,
  Layers,
} from "lucide-react";
import type { ViewType } from "../../lib/constants";
import { cn } from "../../lib/utils";
import { useAuth } from "../../contexts/AuthContext";
import { useAppStore } from "../../store/useAppStore";

export default function Sidebar() {
  const { currentView, setCurrentView, windows, isMissionControlActive, toggleMissionControl } = useAppStore();
  const { user, loginWithGoogle, logout } = useAuth();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const dockItems = [
    {
      id: "dashboard",
      label: "Início",
      icon: LayoutDashboard,
      color:
        "bg-gradient-to-b from-[#4A90E2] to-[#0052D4] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.2)]",
      iconColor: "text-white drop-shadow-sm",
    },
    {
      id: "diario",
      label: "Aulas",
      icon: Book,
      color:
        "bg-gradient-to-b from-[#F2C94C] to-[#F2994A] shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_2px_4px_rgba(0,0,0,0.2)]",
      iconColor: "text-orange-900 drop-shadow-sm",
    },
    {
      id: "agenda",
      label: "Agenda",
      icon: CalendarDays,
      color:
        "bg-[#FFFFFF] shadow-[inset_0_1px_1px_rgba(255,255,255,1),0_2px_4px_rgba(0,0,0,0.1)] border border-slate-100",
      iconColor: "text-[#FF3B30] drop-shadow-sm",
      topBanner: true,
    },
    {
      id: "avaliacoes",
      label: "Provas",
      icon: ClipboardCheck,
      color:
        "bg-gradient-to-b from-[#F9F9F9] to-[#E6E6E6] shadow-[inset_0_1px_1px_rgba(255,255,255,1),0_2px_4px_rgba(0,0,0,0.1)] border border-slate-200",
      iconColor: "text-[#007AFF] drop-shadow-sm",
      lines: true,
    },
    {
      id: "apostilas",
      label: "Apostilas",
      icon: Library,
      color:
        "bg-gradient-to-b from-[#56CCF2] to-[#2F80ED] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.2)]",
      iconColor: "text-white drop-shadow-sm",
    },
    {
      id: "plano",
      label: "Plano",
      icon: PenTool,
      color:
        "bg-gradient-to-b from-[#FF9A9E] to-[#FECFEF] shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_2px_4px_rgba(0,0,0,0.2)]",
      iconColor: "text-pink-600 drop-shadow-sm",
    },
    {
      id: "guia-pedagogico",
      label: "Currículo",
      icon: Map,
      color:
        "bg-gradient-to-b from-[#34C759] to-[#2E8B57] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.2)]",
      iconColor: "text-white drop-shadow-sm",
    },
    {
      id: "perfil",
      label: "Perfil",
      icon: UserIcon,
      color:
        "bg-gradient-to-b from-[#E0E0E0] to-[#BDBDBD] shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_2px_4px_rgba(0,0,0,0.2)] border border-white/50",
      iconColor: "text-slate-700 drop-shadow-sm",
    },
  ] as const;

  const hasOpenWindows = windows.some((w) => !w.isMinimized);

  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-50 flex justify-center pointer-events-none print:hidden transition-all duration-300 ease-out origin-bottom",
        hasOpenWindows
          ? "bottom-1 scale-[0.70] opacity-85 hover:scale-[0.85] hover:bottom-2 hover:opacity-100"
          : "bottom-4 scale-100 opacity-100",
      )}
    >
      <div className="pointer-events-auto flex items-center gap-2 p-3 rounded-3xl bg-white/30 dark:bg-black/30 backdrop-blur-2xl border border-white/20 shadow-2xl hover:bg-white/40 transition-colors">
        {dockItems.map((item, index) => {
          const Icon = item.icon;
          const isOpen =
            item.id === "dashboard"
              ? false
              : windows.some((w) => w.id === item.id && !w.isMinimized);
          const isActive =
            currentView === item.id ||
            (item.id === "dashboard" &&
              (currentView === "dashboard" ||
                windows.every((w) => w.isMinimized)));
          const isHovered = hoveredId === item.id;

          return (
            <div
              key={item.id}
              className={cn(
                "relative group",
                index >= 4 ? "hidden md:block" : "block",
              )}
            >
              {/* Tooltip */}
              <div
                className={cn(
                  "absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900/90 backdrop-blur-md text-white text-xs font-bold rounded-lg pointer-events-none transition-all duration-200 z-50",
                  isHovered
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-2",
                )}
              >
                {item.label}
              </div>

              <button
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => setCurrentView(item.id as ViewType)}
                className={cn(
                  "relative flex flex-col items-center justify-center transition-all duration-300 origin-bottom overflow-hidden box-border",
                  "w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-[14px] md:rounded-[18px] lg:rounded-[20px] mx-1 shadow-sm",
                  isActive
                    ? "scale-110 shadow-xl"
                    : "hover:scale-125 hover:shadow-lg hover:-translate-y-2",
                  item.color,
                )}
              >
                {/* Apple Calendar like top banner */}
                {(item as any).topBanner && (
                  <div className="absolute top-0 left-0 right-0 h-3 md:h-4 bg-[#FF3B30] flex items-center justify-center shadow-[0_1px_1px_rgba(0,0,0,0.1)]">
                    {/* Tiny text could go here */}
                  </div>
                )}

                {/* Apple Pages/Notes like lines */}
                {(item as any).lines && (
                  <div className="absolute inset-x-2 top-4 bottom-2 flex flex-col gap-[3px] opacity-20 pointer-events-none">
                    <div className="h-px bg-slate-800 w-full" />
                    <div className="h-px bg-slate-800 w-full" />
                    <div className="h-px bg-slate-800 w-3/4" />
                    <div className="h-px bg-slate-800 w-full mt-1" />
                  </div>
                )}

                <Icon
                  size={window.innerWidth >= 1024 ? 28 : 24}
                  className={(item as any).iconColor || "text-white"}
                  style={{ marginTop: (item as any).topBanner ? "6px" : "0" }}
                />
              </button>
              {(isOpen || (item.id === "dashboard" && isActive)) && (
                <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 flex justify-center w-full">
                  <div
                    className={cn(
                      "w-1 h-1 md:w-1.5 md:h-1.5 rounded-full transition-all duration-300 shadow-[0_0_4px_rgba(0,0,0,0.5)]",
                      isActive
                        ? "bg-slate-800 dark:bg-white blur-[0.2px]"
                        : "bg-slate-500/60 dark:bg-white/40",
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}

        <div className="w-px h-10 bg-black/10 dark:bg-white/20 mx-1 md:mx-2 rounded-full" />

        <div className="relative group">
          {/* Tooltip */}
          <div
            className={cn(
              "absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900/90 backdrop-blur-md text-white text-xs font-bold rounded-lg pointer-events-none transition-all duration-200 z-50",
              hoveredId === "mission-control"
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-2",
            )}
          >
            Visão Geral
          </div>
          <button
            onMouseEnter={() => setHoveredId("mission-control")}
            onMouseLeave={() => setHoveredId(null)}
            onClick={toggleMissionControl}
            className={cn(
              "relative flex flex-col items-center justify-center transition-all duration-300 origin-bottom overflow-hidden box-border",
              "w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-[14px] md:rounded-[18px] lg:rounded-[20px] mx-1 shadow-sm border border-white/20",
              isMissionControlActive
                ? "scale-110 shadow-xl bg-indigo-600 outline outline-2 outline-indigo-400 outline-offset-2"
                : "hover:scale-125 hover:shadow-lg hover:-translate-y-2 bg-slate-800/80 dark:bg-white/20",
            )}
          >
            <Layers size={window.innerWidth >= 1024 ? 28 : 24} className={isMissionControlActive ? "text-white" : "text-white dark:text-slate-200"} />
          </button>
          {isMissionControlActive && (
            <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 flex justify-center w-full">
              <div className="w-1 h-1 md:w-1.5 md:h-1.5 bg-white rounded-full transition-all duration-300 shadow-[0_0_4px_rgba(0,0,0,0.5)] blur-[0.2px]" />
            </div>
          )}
        </div>

        <div className="w-px h-10 bg-black/10 dark:bg-white/20 mx-1 md:mx-2 rounded-full" />

        {!user ? (
          <button
            onClick={loginWithGoogle}
            className="flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-2xl mx-1 transition-all duration-300 hover:scale-110 bg-slate-800 text-white shadow-lg"
            title="Entrar"
          >
            <UserIcon size={24} />
          </button>
        ) : (
          <button
            onClick={logout}
            className="flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-2xl mx-1 transition-all duration-300 hover:scale-110 bg-red-500 text-white shadow-lg"
            title="Sair"
          >
            <LogOut size={24} />
          </button>
        )}
      </div>
    </div>
  );
}
