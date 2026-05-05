import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Brain, Sparkles, Loader2, LogIn } from 'lucide-react';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import Dashboard from './views/Dashboard';
import ClassJournal from './views/ClassJournal';
import Agenda from './views/Agenda';
import DriveExplorer from './views/DriveExplorer';
import LessonPlan from './views/LessonPlan';
import Tasks from './views/Tasks';
import KnowledgeBase from './views/KnowledgeBase';
import type { ViewType } from './lib/constants';
import { useAuth } from './contexts/AuthContext';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
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
      <div className="flex h-screen w-full bg-slate-50 items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 md:p-12 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-100 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          
          <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
            <Brain className="text-indigo-600" size={32} />
          </div>
          
          <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-2">EduAssistente</h1>
          <p className="text-slate-500 font-medium mb-8">Faça login para acessar suas ferramentas, planos de aula e o Jarvis.</p>
          
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
            className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-white p-4 rounded-xl font-bold transition-all disabled:opacity-70"
          >
            {isLoggingIn ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <LogIn size={20} />
                Entrar com Google
              </>
            )}
          </button>
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
        setCurrentView={(v) => { setCurrentView(v); setIsSidebarOpen(false); }} 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
      />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar currentView={currentView} setIsSidebarOpen={setIsSidebarOpen} />
        
        <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10">
          <div className="max-w-7xl mx-auto h-full">
            {currentView === 'dashboard' && <Dashboard />}
            {currentView === 'diario' && <ClassJournal />}
            {currentView === 'agenda' && <Agenda />}
            {currentView === 'arquivos' && <DriveExplorer />}
            {currentView === 'plano' && <LessonPlan />}
            {currentView === 'tarefas' && <Tasks />}
            {currentView === 'conhecimento' && <KnowledgeBase />}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
