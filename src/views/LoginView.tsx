import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "motion/react";
import {
  Brain,
  Loader2,
  Lock,
  ChevronUp
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

function useTime() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return time;
}

export default function LoginView() {
  const { loginWithGoogle, authError } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const time = useTime();

  // Detect mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle keypress or click to reveal login on desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.code === "Space" || e.key === "Escape") {
        setShowLogin(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const formatTimeMobile = (date: Date) => {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };
  
  const formatTimeDesktop = (date: Date) => {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // If swiped up significantly
    if (info.offset.y < -50) {
      setShowLogin(true);
    }
  };

  return (
    <div 
      className="flex min-h-[100dvh] w-full items-center justify-center font-sans relative overflow-hidden bg-slate-900 group select-none"
      onClick={() => {
        if (!isMobile) setShowLogin(true);
      }}
    >
      {/* Background Image with animated zoom effect */}
      <motion.div
        className="absolute inset-0 bg-cover bg-center z-0 origin-center"
        initial={{ scale: 1.05 }}
        animate={{ scale: showLogin ? 1.1 : 1.0, filter: showLogin ? "blur(20px) brightness(0.6)" : "blur(0px) brightness(0.9)" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{
          backgroundImage:
            'url("https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=2673&auto=format&fit=crop")',
        }}
      />

      <div className="absolute inset-0 z-10 flex flex-col justify-between py-12 md:py-20 px-6 overflow-hidden">
        
        {/* Clock Section (Top) */}
        {!showLogin && (
          <motion.div 
            className="flex flex-col items-center mt-8 md:mt-0"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <div className="relative flex flex-col items-center">
              <Lock className="text-white/80 w-6 h-6 mb-2" />
              <h1 className="text-[5.5rem] md:text-[7rem] lg:text-[8rem] font-medium text-white tracking-tight drop-shadow-lg leading-none font-sans">
                {isMobile ? formatTimeMobile(time) : formatTimeDesktop(time)}
              </h1>
            </div>
            <p className="text-lg md:text-2xl text-white/90 mt-2 font-medium capitalize drop-shadow-md tracking-wide">
              {formatDate(time)}
            </p>
          </motion.div>
        )}

        {/* Login Container (Center) */}
        <AnimatePresence>
          {showLogin && (
            <motion.div
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center">
                {/* User Avatar Circle */}
                <div className="w-28 h-28 rounded-full bg-white/10 backdrop-blur-3xl border cursor-pointer border-white/20 mb-6 flex items-center justify-center shadow-2xl hover:scale-105 transition-transform overflow-hidden" onClick={async () => {
                  setIsLoggingIn(true);
                  try {
                    await loginWithGoogle();
                  } catch (e) {
                     // error handled in context
                  } finally {
                    setIsLoggingIn(false);
                  }
                }}>
                  <img src="/app-icon.png" alt="EduAssistente Logo" className="w-full h-full object-cover" onError={(e) => {
                    // Fallback to Icon if image is missing
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement?.querySelector('svg')?.classList.remove('hidden');
                  }} />
                  <Brain className="text-white w-12 h-12 hidden" />
                </div>
                
                <h2 className="text-3xl font-bold text-white mb-2 shadow-sm tracking-tight text-center">
                  EduAssistente
                </h2>
                <p className="text-white/70 mb-8 font-medium text-center text-lg">
                  Entrar na conta acadêmica
                </p>

                <div className="w-full">
                  {authError && (
                    <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} className="mb-4 p-3 bg-red-400/20 backdrop-blur-md border border-red-400/50 text-white rounded-xl text-sm font-medium text-center">
                      {authError}
                    </motion.div>
                  )}
                  
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
                    className="w-full flex items-center justify-center gap-3 bg-white/20 hover:bg-white/30 border border-white/30 text-white py-4 px-6 rounded-2xl font-semibold transition-all backdrop-blur-xl hover:shadow-2xl hover:shadow-white/20 active:scale-[0.98]"
                  >
                    {isLoggingIn ? (
                      <Loader2 className="animate-spin text-white" size={20} />
                    ) : (
                      <>
                        <svg className="w-5 h-5 bg-white rounded-full p-[2px]" viewBox="0 0 24 24">
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
                        Tocar para Entrar
                      </>
                    )}
                  </button>

                  <button 
                    onClick={() => setShowLogin(false)}
                    className="w-full mt-6 text-white/60 hover:text-white transition-colors text-sm font-medium tracking-wide flex justify-center"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom instructions when login is NOT shown */}
        <AnimatePresence>
          {!showLogin && (
            <motion.div 
              className="flex flex-col items-center mx-auto mb-4 w-full"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              {isMobile ? (
                <motion.div 
                  className="w-full h-32 absolute bottom-0 left-0 flex flex-col items-center justify-end pb-8 touch-none"
                  drag="y"
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={0.8}
                  onDragEnd={handleDragEnd}
                >
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="mb-2"
                  >
                    <ChevronUp className="text-white/80 w-6 h-6" />
                  </motion.div>
                  <p className="text-white/90 font-medium tracking-wide text-sm select-none">
                    Deslize para cima para abrir
                  </p>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center pb-4">
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="mb-2"
                  >
                    <ChevronUp className="text-white/60 w-6 h-6" />
                  </motion.div>
                  <p className="text-white/80 font-medium tracking-wide text-sm select-none">
                    Pressione qualquer tecla ou clique para desbloquear
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
