import React, { Suspense, useState, useEffect } from "react";
import { Rnd } from "react-rnd";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import Topbar from "./Topbar";
import { useAppStore, AppWindow } from "../../store/useAppStore";

// Lazy-loaded views
import { lazy } from "react";

// Hook for media query
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [matches, query]);
  return matches;
}

const Dashboard = lazy(() => import("../../views/Dashboard"));
const ClassJournal = lazy(() => import("../../views/ClassJournal"));
const Agenda = lazy(() => import("../../views/Agenda"));
const LessonPlan = lazy(() => import("../../views/LessonPlan"));
const KnowledgeBase = lazy(() => import("../../views/KnowledgeBase"));
const TaskAnalysis = lazy(() => import("../../views/TaskAnalysis"));
const MatificAnalysis = lazy(() => import("../../views/MatificAnalysis"));
const StudentsDatabase = lazy(() => import("../../views/StudentsDatabase"));
const Apostilas = lazy(() => import("../../views/Apostilas"));
const EvaluationsView = lazy(() => import("../../views/EvaluationsView"));
const JarvisBaseView = lazy(() => import("../../views/JarvisBaseView"));
const GuiaPedagogicoView = lazy(() => import("../../views/GuiaPedagogicoView"));
const ProfileView = lazy(() => import("../../views/ProfileView"));
const ScheduleView = lazy(() => import("../../views/ScheduleView"));
const LousaView = lazy(() => import("../../views/LousaView"));

const LoadingFallback = () => (
  <div className="flex h-full w-full bg-slate-50 items-center justify-center">
    <Loader2 className="animate-spin text-indigo-600" size={32} />
  </div>
);

export function WindowManager() {
  const { windows, updateWindow, focusWindow, isMissionControlActive, toggleMissionControl } = useAppStore();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const openWindows = windows.filter((w) => !w.isMinimized);
  const zIndexOffset = isMissionControlActive ? 100 : 0;

  return (
    <>
      <div 
        className={cn(
          "fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm transition-all duration-500",
          isMissionControlActive ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={toggleMissionControl}
      />

      {windows.map((win) => {
        // Find index for Mission Control grid
        const mcIndex = openWindows.findIndex((w) => w.id === win.id);
        
        // Compute Mission Control Grid using window dimensions
        const winWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
        const winHeight = typeof window !== "undefined" ? window.innerHeight : 800;
        
        let mcCols = Math.ceil(Math.sqrt(openWindows.length));
        if (mcCols === 0) mcCols = 1;
        const mcRows = Math.ceil(openWindows.length / mcCols);
        
        const gap = 32;
        const containerPadding = 80;
        const availableW = winWidth - (containerPadding * 2) - (gap * (mcCols - 1));
        const availableH = winHeight - (containerPadding * 2) - (gap * (mcRows - 1));
        
        const mcW = Math.min(600, availableW / mcCols);
        const mcH = mcW * 0.7; // Golden ratio approx for preview
        
        const r = Math.floor(mcIndex / mcCols);
        const c = mcIndex % mcCols;
        
        const totalGridW = (mcW * mcCols) + (gap * (mcCols - 1));
        const totalGridH = (mcH * mcRows) + (gap * (mcRows - 1));
        
        const startX = (winWidth - totalGridW) / 2;
        const startY = ((winHeight - totalGridH) / 2) - 20;

        const mcX = startX + (c * (mcW + gap));
        const mcY = startY + (r * (mcH + gap));

        const isEffectivelyMaximized = win.isMaximized || isMobile;

        // Controlled dimensions
        const size = isMissionControlActive && mcIndex !== -1
          ? { width: mcW, height: mcH }
          : isEffectivelyMaximized
          ? { width: "100%", height: "100%" }
          : { width: win.width, height: win.height };

        const position = isMissionControlActive && mcIndex !== -1
          ? { x: mcX, y: mcY }
          : isEffectivelyMaximized
          ? { x: 0, y: 0 }
          : { x: win.x, y: win.y };

        const isVisible = !win.isMinimized;

        return (
          <Rnd
            key={win.id}
            size={size}
            position={position}
            onDragStart={() => setDraggingId(win.id)}
            onDragStop={(e, d) => {
              setDraggingId(null);
              if (!isEffectivelyMaximized && !isMissionControlActive) updateWindow(win.id, { x: d.x, y: d.y });
            }}
            onResizeStart={() => setDraggingId(win.id)}
            onResizeStop={(e, direction, ref, delta, pos) => {
              setDraggingId(null);
              if (!isEffectivelyMaximized && !isMissionControlActive) {
                updateWindow(win.id, {
                  width: ref.style.width,
                  height: ref.style.height,
                  ...pos,
                });
              }
            }}
            onMouseDown={() => {
              focusWindow(win.id);
              if (isMissionControlActive) toggleMissionControl();
            }}
            minWidth={320}
            minHeight={300}
            bounds="window"
            dragHandleClassName="window-drag-handle"
            style={{ 
              zIndex: win.zIndex + zIndexOffset,
              opacity: isVisible ? 1 : 0,
              pointerEvents: isVisible ? "auto" : "none",
            }}
            className={cn(
              "flex flex-col bg-white/95 dark:bg-slate-950/95 backdrop-blur-3xl shadow-2xl ring-1 ring-black/10 dark:ring-white/20 overflow-hidden",
              isEffectivelyMaximized ? "!w-full !h-[100dvh] !inset-0 !transform-none rounded-none" : "rounded-[20px]",
              draggingId !== win.id ? "transition-all duration-500 ease-out" : "",
              !isVisible && "scale-[0.8] translate-y-24", // Animation when minimizing
              isMissionControlActive && "cursor-pointer scale-[0.95] hover:scale-100 ring-4 ring-indigo-500/0 hover:ring-indigo-500/50"
            )}
            disableDragging={isEffectivelyMaximized || isMissionControlActive}
            enableResizing={!isEffectivelyMaximized && !isMissionControlActive}
          >
            <div className={cn("flex-none window-drag-handle print:hidden", isMissionControlActive && "pointer-events-none")}>
              <Topbar windowId={win.id} />
            </div>

            <div className={cn("flex-1 overflow-y-auto w-full h-full pb-24 print:overflow-visible print:w-full print:h-auto", isMissionControlActive && "pointer-events-none select-none")}>
              <div className="w-full h-full print:w-full print:h-auto">
                <Suspense fallback={<LoadingFallback />}>
                  {win.view === "perfil" && <ProfileView />}
                  {win.view === "grade" && <ScheduleView />}
                  {win.view === "diario" && <ClassJournal />}
                  {win.view === "agenda" && <Agenda />}
                  {win.view === "plano" && <LessonPlan />}
                  {win.view === "avaliacoes" && <EvaluationsView />}
                  {win.view === "alunos" && <StudentsDatabase />}
                  {win.view === "conhecimento" && <KnowledgeBase />}
                  {win.view === "jarvis" && <JarvisBaseView />}
                  {win.view === "guia-pedagogico" && <GuiaPedagogicoView />}
                  {win.view === "apostilas" && <Apostilas />}
                  {win.view === "lousa-magica" && <LousaView />}
                </Suspense>
              </div>
            </div>
          </Rnd>
        );
      })}
    </>
  );
}
