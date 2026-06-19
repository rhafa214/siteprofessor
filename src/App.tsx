import { useState, useEffect, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./lib/utils";
import Sidebar from "./components/layout/Sidebar";
import { useAuth } from "./contexts/AuthContext";
import { useAppStore } from "./store/useAppStore";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import LoginView from "./views/LoginView";
import FloatingJarvisChat from "./components/chat/FloatingJarvisChat";
import { WindowManager } from "./components/layout/WindowManager";

// Lazy-loaded views
const Dashboard = lazy(() => import("./views/Dashboard"));
const AddonSidebar = lazy(() => import("./views/AddonSidebar"));
const AddonAvaliacoesSidebar = lazy(() => import("./views/AddonAvaliacoesSidebar"));

const LoadingFallback = () => (
  <div className="flex h-screen w-full bg-slate-50 items-center justify-center">
    <Loader2 className="animate-spin text-indigo-600" size={32} />
  </div>
);

function App() {
  const { currentView, setCurrentView, setSidebarOpen, isSidebarOpen, windows } = useAppStore();
  const { user, loading, accessToken } = useAuth();
  
  const defaultBg = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop";
  const [bgUrl] = useLocalStorage("app_background_url", defaultBg);

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

  const activeWindows = windows.filter(w => !w.isMinimized);
  const hasActiveWindows = activeWindows.length > 0;

  return (
    <ErrorBoundary>
      <div className="relative h-screen w-full flex flex-col font-sans bg-slate-900 overflow-hidden text-slate-800 selection:bg-indigo-100 selection:text-indigo-900">
        {/* Apple Desktop Background */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none transition-opacity duration-1000"
          style={{ 
            backgroundImage: `url("${bgUrl || defaultBg}")`,
            opacity: hasActiveWindows ? 0.4 : 1
          }}
        />

        {/* Dashboard Layer (Always behind) */}
        <div className="absolute inset-0 z-0 overflow-y-auto w-full h-full pb-32">
          <Suspense fallback={<LoadingFallback />}>
            <Dashboard />
          </Suspense>
        </div>

        {/* Windows Manager Layer */}
        <WindowManager />
        
        <Sidebar /> {/* Now styled as a Dock */}
        <FloatingJarvisChat />
      </div>
    </ErrorBoundary>
  );
}

export default App;
