import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Brain,
  Sparkles,
  Loader2,
  BookOpen,
  GraduationCap,
  PencilRuler,
  Atom,
  Globe,
  Calculator,
} from "lucide-react";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import Dashboard from "./views/Dashboard";
import ClassJournal from "./views/ClassJournal";
import Agenda from "./views/Agenda";
import DriveExplorer from "./views/DriveExplorer";
import LessonPlan from "./views/LessonPlan";
import Tasks from "./views/Tasks";
import KnowledgeBase from "./views/KnowledgeBase";
import TaskAnalysis from "./views/TaskAnalysis";
import MatificAnalysis from "./views/MatificAnalysis";
import StudentsDatabase from "./views/StudentsDatabase";
import BannerAssistant from "./views/BannerAssistant";
import Apostilas from "./views/Apostilas";
import EvaluationsView from "./views/EvaluationsView";
import JarvisBaseView from "./views/JarvisBaseView";
import GuiaPedagogicoView from "./views/GuiaPedagogicoView";
import ProfileView from "./views/ProfileView";
import AddonSidebar from "./views/AddonSidebar";
import type { ViewType } from "./lib/constants";
import { useAuth } from "./contexts/AuthContext";

function App() {
  if (typeof window !== "undefined" && window.location.pathname === "/addon") {
    return <AddonSidebar />;
  }

  const [currentView, setCurrentView] = useState<ViewType>("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, loading, loginWithGoogle } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen w-full bg-slate-50 items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden bg-slate-900">
        {/* Background Image with Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center z-0 opacity-40 mix-blend-luminosity"
          style={{
            backgroundImage:
              'url("https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=2673&auto=format&fit=crop")',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#8257E5]/90 via-[#4f319b]/90 to-[#121214]/95 z-0 backdrop-blur-sm" />

        {/* Floating particles/shapes in background */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none hidden sm:block">
          <motion.div
            animate={{
              y: [-20, 20, -20],
              x: [-10, 10, -10],
              rotate: [0, 45, 0],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[10%] left-[10%] w-64 h-64 border border-white/5 rounded-full"
          />
          <motion.div
            animate={{
              y: [20, -20, 20],
              x: [10, -10, 10],
              rotate: [0, -45, 0],
            }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-[20%] right-[10%] w-96 h-96 border border-white/5 rounded-full"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="bg-white rounded-[24px] sm:rounded-[32px] overflow-hidden flex flex-col lg:flex-row shadow-2xl max-w-5xl w-full mx-auto min-h-[600px] relative z-10 border border-white/20"
        >
          {/* Left Side - Login Form */}
          <div className="w-full lg:w-1/2 p-10 lg:p-16 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-12 h-12 bg-[#8257E5]/10 rounded-xl flex items-center justify-center">
                <Brain className="text-[#8257E5]" size={28} />
              </div>
              <span className="text-xl font-black text-slate-800 tracking-tight">
                EduAssistente
              </span>
            </div>

            <h2 className="text-3xl lg:text-4xl font-black text-slate-800 tracking-tight mb-4">
              Acesse a plataforma
            </h2>
            <p className="text-slate-500 font-medium mb-12 leading-relaxed">
              Faça login com sua conta do Google para começar a gerenciar suas
              turmas e simplificar suas aulas.
            </p>

            <div className="w-full max-w-sm">
              <button
                onClick={async () => {
                  setIsLoggingIn(true);
                  try {
                    await loginWithGoogle();
                  } catch (e) {
                    // error handled in context
                  } finally {
                    setIsLoggingIn(false);
                  }
                }}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-3 bg-[#8257E5] hover:bg-[#6f48c9] text-white py-4 px-6 rounded-xl font-bold transition-all disabled:opacity-70 shadow-lg hover:shadow-xl hover:shadow-[#8257E5]/30 active:scale-[0.98]"
              >
                {isLoggingIn ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <svg
                      className="w-5 h-5 bg-white rounded-full p-[2px]"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Entrar com o Google
                  </>
                )}
              </button>
            </div>

            <p className="mt-12 text-sm font-medium text-slate-500">
              Ambiente de uso exclusivo.{" "}
              <a
                href="#"
                className="text-[#8257E5] hover:text-[#6f48c9] transition-colors border-b border-transparent hover:border-[#8257E5]"
              >
                Precisa de ajuda?
              </a>
            </p>
          </div>

          {/* Right Side - Abstract/Graphic */}
          <div className="w-full lg:w-1/2 bg-[#8257E5] relative overflow-hidden hidden lg:flex flex-col justify-end p-16 text-white min-h-[400px]">
            {/* Background Decorations */}
            <div className="absolute top-[-20%] right-[-10%] w-[80%] h-[80%] rounded-full bg-gradient-to-br from-[#9f75ff] to-[#6f48c9] blur-3xl opacity-50 mix-blend-screen pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-20%] w-[60%] h-[60%] rounded-full bg-[#4f319b] blur-3xl opacity-40 mix-blend-multiply pointer-events-none" />
            <div className="absolute inset-0 bg-[#121214]/5 pointer-events-none backdrop-blur-[100px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-b from-white/20 to-transparent rounded-full blur-2xl pointer-events-none"></div>

            {/* Floating Educational Elements */}
            <motion.div
              animate={{ y: [-15, 15, -15], rotate: [0, 10, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-[15%] right-[20%] text-white/20 pointer-events-none"
            >
              <BookOpen size={72} strokeWidth={1.5} />
            </motion.div>

            <motion.div
              animate={{ y: [15, -15, 15], rotate: [0, -10, 0] }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1,
              }}
              className="absolute top-[35%] left-[20%] text-white/10 pointer-events-none"
            >
              <GraduationCap size={96} strokeWidth={1} />
            </motion.div>

            <motion.div
              animate={{ y: [-10, 20, -10], rotate: [0, -15, 0] }}
              transition={{
                duration: 7,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 2,
              }}
              className="absolute top-[55%] right-[15%] text-white/15 pointer-events-none"
            >
              <Atom size={64} strokeWidth={1.5} />
            </motion.div>

            <motion.div
              animate={{ y: [20, -10, 20], rotate: [0, 5, 0] }}
              transition={{
                duration: 9,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 3,
              }}
              className="absolute top-[20%] left-[45%] text-white/10 pointer-events-none"
            >
              <Globe size={48} strokeWidth={1.5} />
            </motion.div>

            <div className="relative z-10 bg-black/10 backdrop-blur-md p-8 rounded-3xl border border-white/10 shadow-2xl">
              <div className="mb-4 flex gap-2">
                <Sparkles
                  className="text-[#FBBF24]"
                  fill="currentColor"
                  size={28}
                />
              </div>
              <h3 className="text-4xl font-black tracking-tight leading-tight mb-4 text-white">
                O futuro da <br />
                educação com IA.
              </h3>
              <p className="text-white/80 font-medium text-lg max-w-sm leading-relaxed">
                Organize seu fluxo de trabalho, conecte-se com sua agenda e
                utilize o Jarvis para poupar horas de trabalho.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <Sidebar
        currentView={currentView}
        setCurrentView={(v) => {
          setCurrentView(v);
          setIsSidebarOpen(false);
        }}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar 
          currentView={currentView} 
          setIsSidebarOpen={setIsSidebarOpen} 
          setCurrentView={setCurrentView}
        />

        <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10">
          <div className="max-w-7xl mx-auto h-full">
            {currentView === "dashboard" && (
              <Dashboard setCurrentView={setCurrentView} />
            )}
            {currentView === "perfil" && <ProfileView setCurrentView={setCurrentView} />}
            {currentView === "diario" && <ClassJournal />}
            {currentView === "agenda" && <Agenda />}
            {currentView === "arquivos" && <DriveExplorer />}
            {currentView === "plano" && <LessonPlan />}
            {currentView === "tarefas" && <Tasks />}
            {currentView === "avaliacoes" && <EvaluationsView />}
            {currentView === "alunos" && <StudentsDatabase />}
            {currentView === "conhecimento" && <KnowledgeBase />}
            {currentView === "jarvis" && <JarvisBaseView />}
            {currentView === "guia-pedagogico" && <GuiaPedagogicoView />}
            {currentView === "banner" && <BannerAssistant />}
            {currentView === "apostilas" && <Apostilas />}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
