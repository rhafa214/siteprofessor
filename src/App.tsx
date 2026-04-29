import { useState, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import Dashboard from './views/Dashboard';
import ClassJournal from './views/ClassJournal';
import Agenda from './views/Agenda';
import DriveExplorer from './views/DriveExplorer';
import LessonPlan from './views/LessonPlan';
import Tasks from './views/Tasks';
import type { ViewType } from './lib/constants';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
