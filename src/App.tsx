import { useState, useEffect, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import { useAuth } from "./contexts/AuthContext";
import { useAppStore } from "./store/useAppStore";
import { ErrorBoundary } from "./components/ErrorBoundary";
import LoginView from "./views/LoginView";
import FloatingJarvisChat from "./components/chat/FloatingJarvisChat";

// Lazy-loaded views
const Dashboard = lazy(() => import("./views/Dashboard"));
const ClassJournal = lazy(() => import("./views/ClassJournal"));
const Agenda = lazy(() => import("./views/Agenda"));
const LessonPlan = lazy(() => import("./views/LessonPlan"));
const KnowledgeBase = lazy(() => import("./views/KnowledgeBase"));
const TaskAnalysis = lazy(() => import("./views/TaskAnalysis"));
const MatificAnalysis = lazy(() => import("./views/MatificAnalysis"));
const StudentsDatabase = lazy(() => import("./views/StudentsDatabase"));
const Apostilas = lazy(() => import("./views/Apostilas"));
const EvaluationsView = lazy(() => import("./views/EvaluationsView"));
const JarvisBaseView = lazy(() => import("./views/JarvisBaseView"));
const GuiaPedagogicoView = lazy(() => import("./views/GuiaPedagogicoView"));
const ProfileView = lazy(() => import("./views/ProfileView"));
const AddonSidebar = lazy(() => import("./views/AddonSidebar"));
const AddonAvaliacoesSidebar = lazy(() => import("./views/AddonAvaliacoesSidebar"));
const ScheduleView = lazy(() => import("./views/ScheduleView"));
const LousaView = lazy(() => import("./views/LousaView"));

const LoadingFallback = () => (
  <div className="flex h-screen w-full bg-slate-50 items-center justify-center">
    <Loader2 className="animate-spin text-indigo-600" size={32} />
  </div>
);

function App() {
  const { currentView, setSidebarOpen, isSidebarOpen } = useAppStore();
  const { user, loading, accessToken } = useAuth();

  // Redirect to addon if parameter is present
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("mode=addon") && window.location.pathname !== "/addon") {
       window.location.href = "/addon" + window.location.search;
    }
  }, []);

  if (typeof window !== "undefined" && window.location.pathname === "/addon") {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <AddonSidebar />
        </Suspense>
      </ErrorBoundary>
    );
  }
  if (typeof window !== "undefined" && window.location.pathname === "/addon-avaliacoes") {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <AddonAvaliacoesSidebar />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (loading) {
    return <LoadingFallback />;
  }

  if (!user || !accessToken) {
    return <LoginView />;
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen w-full flex-col font-sans bg-slate-50 overflow-hidden lg:flex-row print:flex-col print:h-auto print:overflow-visible text-slate-800 selection:bg-indigo-100 selection:text-indigo-900">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden print:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <Sidebar />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible print:h-auto print:block">
          <div className="print:hidden">
              <Topbar />
          </div>

          <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10 print:overflow-visible print:p-0 print:m-0">
            <div className="max-w-7xl mx-auto h-full print:max-w-none print:w-full print:h-auto">
              <Suspense fallback={<LoadingFallback />}>
                {currentView === "dashboard" && <Dashboard />}
                {currentView === "perfil" && <ProfileView />}
                {currentView === "grade" && <ScheduleView />}
                {currentView === "diario" && <ClassJournal />}
                {currentView === "agenda" && <Agenda />}
                {currentView === "plano" && <LessonPlan />}
                {currentView === "avaliacoes" && <EvaluationsView />}
                {currentView === "alunos" && <StudentsDatabase />}
                {currentView === "conhecimento" && <KnowledgeBase />}
                {currentView === "jarvis" && <JarvisBaseView />}
                {currentView === "guia-pedagogico" && <GuiaPedagogicoView />}
                {currentView === "apostilas" && <Apostilas />}
                {currentView === "lousa-magica" && <LousaView />}
              </Suspense>
            </div>
          </div>
        </main>
        
        <FloatingJarvisChat />
      </div>
    </ErrorBoundary>
  );
}

export default App;
