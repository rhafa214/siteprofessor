import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  BotMessageSquare, 
  Send, 
  School, 
  Laptop,
  CheckCircle2,
  CalendarClock,
  ArrowRight,
  Mail,
  Landmark,
  Sparkles,
  Loader2,
  Brain
} from 'lucide-react';
import { getSmartPhrase, DATAS_OFICIAIS } from '../lib/constants';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { cn } from '../lib/utils';
import NewsCarousel from '../components/dashboard/NewsCarousel';
import { GoogleGenAI } from '@google/genai';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { useGmail } from '../hooks/useGmail';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

let aiClient: GoogleGenAI | null = null;
function getAI() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
    if (key) {
      // @ts-ignore - catch any initialization errors
      try { aiClient = new GoogleGenAI({ apiKey: key }); } catch (e) {}
    }
  }
  return aiClient;
}

export default function Dashboard() {
  const { user, loginWithGoogle } = useAuth();
  const { events: calendarEvents, isLoading: isCalendarLoading, apiError: calendarApiError } = useGoogleCalendar();
  const { messages: emails, isLoading: isEmailsLoading, apiError: emailsApiError } = useGmail();

  const [now, setNow] = useState(new Date());
  const [reminders, setReminders] = useLocalStorage<string[]>('eduReminders', []);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'bot', text: string}[]>([
    { role: 'bot', text: 'Olá, educador! Sou o EduIA, seu assistente inteligente integrado via Gemini. Como posso ajudar com sua rotina, planejamento de aulas ou dicas para a sala de aula hoje?' }
  ]);
  const [efapeDone, setEfapeDone] = useLocalStorage('efapeDone', false);
  const [classLogs] = useLocalStorage<any[]>('classLogs', []);
  const [turmasList] = useLocalStorage<string[]>('classTurmasList', []);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      const fetchSettings = async () => {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid, 'settings', 'dashboard'));
          if (snap.exists()) {
            const data = snap.data();
            if (data.reminders) {
              setReminders(data.reminders);
            }
            if (data.efapeDoneAt) {
              const doneAt = new Date(data.efapeDoneAt);
              const nextWeek = new Date(doneAt);
              nextWeek.setDate(nextWeek.getDate() + 7);
              // reset next week
              if (new Date() >= nextWeek) {
                setEfapeDone(false);
                await setDoc(doc(db, 'users', user.uid, 'settings', 'dashboard'), { efapeDoneAt: null }, { merge: true });
              } else {
                setEfapeDone(true);
              }
            } else {
              setEfapeDone(false);
            }
          } else {
             // save local values if any
             if (reminders.length > 0 || efapeDone) {
               await setDoc(doc(db, 'users', user.uid, 'settings', 'dashboard'), {
                 reminders,
                 efapeDoneAt: efapeDone ? new Date().toISOString() : null
               });
             }
          }
        } catch (e) { console.error('Error fetching dashboard settings', e); }
      };
      // only run once to load initial remote info
      fetchSettings();
    }
  // empty dependency array or just user to load on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const updateFirestoreReminders = (newReminders: string[]) => {
    if (user) {
      setDoc(doc(db, 'users', user.uid, 'settings', 'dashboard'), { reminders: newReminders }, { merge: true }).catch(e => console.error(e));
    }
  };

  const handleEfapeToggle = () => {
    const newState = !efapeDone;
    setEfapeDone(newState);
    if (user) {
      setDoc(doc(db, 'users', user.uid, 'settings', 'dashboard'), {
        efapeDoneAt: newState ? new Date().toISOString() : null
      }, { merge: true }).catch(e => console.error(e));
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isTyping]);

  // Compute events
  const currentEvents = calendarEvents.filter(ev => {
    const s = ev.start?.dateTime ? new Date(ev.start.dateTime) : ev.start?.date ? new Date(ev.start.date) : new Date();
    const e = ev.end?.dateTime ? new Date(ev.end.dateTime) : ev.end?.date ? new Date(ev.end.date) : new Date();
    return now >= s && now <= e;
  });
  const futureEvents = calendarEvents.filter(ev => {
    const s = ev.start?.dateTime ? new Date(ev.start.dateTime) : ev.start?.date ? new Date(ev.start.date) : new Date();
    return s > now;
  });
  
  const currentEvent = currentEvents[0];
  const nextEvent = futureEvents[0];

  // Identificar turma atual
  let currentTurma: string | null = null;
  if (currentEvent && currentEvent.summary) {
    const summaryLower = currentEvent.summary.toLowerCase();
    for (const t of (turmasList || [])) {
      const tShort = t.split('-')[0].trim().toLowerCase();
      const sClean = summaryLower.replace(/[^a-z0-9]/g, '');
      const tClean = tShort.replace(/[^a-z0-9]/g, '');
      
      if ((tClean && sClean.includes(tClean)) || (sClean && tClean.includes(sClean))) {
        currentTurma = t;
        break;
      }
    }
  }

  const logForCurrentTurma = currentTurma ? classLogs?.find(l => l.turma === currentTurma) : null;
  const latestLog = classLogs && classLogs.length > 0 ? classLogs[0] : null;

  // Verificar se a aula está acabando
  let isClassEndingSoon = false;
  if (currentEvent && currentEvent.end?.dateTime) {
    const end = new Date(currentEvent.end.dateTime);
    const diffMins = (end.getTime() - now.getTime()) / (1000 * 60);
    if (diffMins > 0 && diffMins <= 15) {
      isClassEndingSoon = true;
    }
  }

  // Progress calculations
  const start = new Date(now).setHours(7, 0, 0, 0);
  const end = new Date(now).setHours(16, 0, 0, 0);
  let progress = 0;
  if (now.getTime() > start && now.getTime() < end) {
    progress = Math.round(((now.getTime() - start) / (end - start)) * 100);
  } else if (now.getTime() >= end) {
    progress = 100;
  }

  // Prova Paulista Logic
  let nextProva = null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let p of DATAS_OFICIAIS.provas) {
    let dp = new Date(p.data + "T00:00:00");
    if (dp >= today) { nextProva = p; break; }
  }
  const diffP = nextProva ? Math.ceil((new Date(nextProva.data + "T00:00:00").getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : -1;

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isTyping) return;
    
    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setChatInput('');
    setIsTyping(true);

    try {
      // Basic lembrete intercept
      if (userMessage.toLowerCase().includes("lembrar de") || userMessage.toLowerCase().includes("lembre-me de")) {
        const task = userMessage.replace(/lembrar de|lembre-me de/i, "").trim();
        if (task) {
          const nextRems = [...reminders, task];
          setReminders(nextRems);
          updateFirestoreReminders(nextRems);
          setChatMessages(prev => [...prev, { role: 'bot', text: `Prontinho! Anotei "${task}" na sua lista de lembretes.` }]);
          setIsTyping(false);
          return;
        }
      }

      // Format previous messages for context
      const contents = chatMessages.map(msg => ({
        role: msg.role === 'bot' ? 'model' : 'user',
        parts: [{ text: msg.text }]
      }));
      contents.push({ role: 'user', parts: [{ text: userMessage }] });

      const ai = getAI();
      if (!ai) {
        setChatMessages(prev => [...prev, { role: 'bot', text: 'O Gemini API Key não está configurado. Para testar no Vercel/GitHub, configure a variável de ambiente VITE_GEMINI_API_KEY ou GEMINI_API_KEY.' }]);
        setIsTyping(false);
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction: "Você é o EduIA, um assistente especializado e prestativo para professores da rede pública de São Paulo. Ajude com dicas de metodologias ativas, planos de aula, ideias de engajamento e dúvidas gerais de forma clara, amigável e concisa (use no máximo 3 a 4 frases curtas por resposta)."
        }
      });

      const responseText = response.text || "Desculpe, tive um problema ao tentar processar sua mensagem. Pode reformular?";
      setChatMessages(prev => [...prev, { role: 'bot', text: responseText }]);

    } catch (error) {
      console.error(error);
      setChatMessages(prev => [...prev, { role: 'bot', text: 'Oops, houve um erro ao conectar com minha rede neural. Tente novamente em instantes.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const removeReminder = (index: number) => {
    const nextRems = reminders.filter((_, i) => i !== index);
    setReminders(nextRems);
    updateFirestoreReminders(nextRems);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 lg:space-y-8 pb-10"
    >
      {/* Hero Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 lg:pb-8 border-b border-slate-200">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 mb-2">Olá, Professor(a)!</h1>
          <p className="text-indigo-600 font-semibold text-lg">{getSmartPhrase()}</p>
          <p className="text-slate-500 text-sm mt-1">
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          {nextProva && (
            <div className="mt-4 inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-bold border border-blue-100">
              {diffP === 0 ? "🚀 Hoje tem Prova Paulista!" : `🎯 Faltam ${diffP} dias para a próxima ${nextProva.nome}`}
            </div>
          )}
        </div>
        
        <div className="w-full md:w-72 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between text-xs font-bold text-slate-500 uppercase mb-2">
            <span>Jornada (07h-16h)</span>
            <span className="text-indigo-600">{progress}%</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* AI Context Card (Current Class Insight) */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gradient-to-r from-indigo-50 leading-relaxed md:leading-normal to-purple-50 border border-indigo-100 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row items-center gap-4 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Brain size={120} />
        </div>
        <div className="bg-indigo-100 text-indigo-600 w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-indigo-200 relative z-10">
          <BotMessageSquare size={24} />
        </div>
        <div className="relative z-10 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">EduIA Observou</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
          </div>
          <div className="text-slate-700 font-medium text-sm max-w-4xl space-y-2">
            {currentTurma ? (
               logForCurrentTurma ? (
                 <p>Vi que você está no <strong className="text-indigo-700">{currentTurma}</strong> agora. Na última aula com eles (<strong className="text-indigo-700">{logForCurrentTurma.data}</strong>) você registrou: <strong className="text-indigo-700">{logForCurrentTurma.progresso}</strong>. Inicie a partir daí!</p>
               ) : (
                 <p>Vi que você está no <strong className="text-indigo-700">{currentTurma}</strong> agora, porém busquei nas aulas trabalhadas e não encontrei registros no seu <strong className="text-indigo-700">Diário de Classe</strong> para essa turma.</p>
               )
            ) : (
              latestLog ? (
                <p>No momento você não tem uma aula ativa na agenda ou está em seu horário de estudos. Aproveite para planejar seus próximos passos! Posso sugerir atividades ou exercícios com base no seu registro mais recente com o <strong className="text-indigo-700">{latestLog.turma}</strong> sobre <strong className="text-indigo-700">{latestLog.progresso}</strong>.</p>
              ) : (
                <p>No momento você não tem uma aula ativa na agenda ou está em seu horário de estudos. Como ainda não encontrei registros no seu <strong className="text-indigo-700">Diário de Classe</strong>, que tal aproveitar para se organizar, preparar novas aulas ou corrigir avaliações?</p>
              )
            )}
            
            {isClassEndingSoon && (
              <p className="text-orange-700 bg-orange-100 border border-orange-200 px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center">
                ⚠️ A aula logo vai acabar. Não esqueça de fazer a chamada e o registro na Sala do Futuro!
              </p>
            )}
          </div>
        </div>
        <div className="relative z-10 shrink-0 w-full md:w-auto mt-2 md:mt-0">
          <button 
             onClick={() => {
                const prompt = currentTurma && logForCurrentTurma 
                  ? `Gere uma revisão rápida sobre o conteúdo: "${logForCurrentTurma.progresso}" que trabalhei com a turma ${currentTurma} na última aula.`
                  : latestLog 
                    ? `Estou em um momento de estudo/planejamento. Me dê sugestões de atividades, dinâmicas e exercícios baseados no conteúdo "${latestLog.progresso}" que trabalhei recentemente com a turma ${latestLog.turma}.`
                    : "Estou em um momento de estudo/planejamento. Me dê sugestões de como organizar minha semana e preparar minhas próximas aulas de forma criativa.";
                setChatInput(prompt);
                document.getElementById('chat-section')?.scrollIntoView({ behavior: 'smooth' });
             }}
             className="w-full md:w-auto bg-white text-indigo-600 border border-indigo-200 px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-colors shadow-sm whitespace-nowrap flex items-center justify-center gap-2"
          >
            <Sparkles size={14} /> {(currentTurma && logForCurrentTurma) ? 'Sugerir Revisão' : latestLog ? 'Sugerir Atividades' : 'Planejar Aulas'}
          </button>
        </div>
      </motion.div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Google Sync Status */}
        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 lg:p-8 text-white flex flex-col justify-between relative overflow-hidden shadow-lg min-h-[160px]">
          <div className="absolute top-0 right-0 p-6 opacity-20">
            <CalendarClock size={120} />
          </div>
          <div className="relative z-10 flex flex-col h-full justify-center">
            <div className="flex items-center gap-2 text-indigo-100 text-xs font-bold uppercase tracking-wider mb-2">
              <span className={cn("w-2 h-2 rounded-full", user ? "bg-emerald-400 animate-pulse" : "bg-red-400")} />
              {user ? 'Sincronizado' : 'Status Agenda'}
            </div>
            
            {!user ? (
              <>
                <h2 className="text-2xl lg:text-3xl font-bold tracking-tight mb-3">Sincronize sua agenda do Google</h2>
                <div className="flex items-center gap-2 text-indigo-50 font-medium text-sm mb-4">
                  <ArrowRight size={16} /> <span>Integre sua conta para ver suas próximas aulas e eventos.</span>
                </div>
                <button onClick={loginWithGoogle} className="self-start bg-white text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-slate-50 transition-colors">
                  Conectar Agora
                </button>
              </>
            ) : calendarApiError ? (
              <div className="text-red-200 mt-2 font-medium text-sm">
                <p>⚠️ {calendarApiError}</p>
              </div>
            ) : isCalendarLoading ? (
              <div className="text-indigo-100 font-medium flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Carregando seus próximos eventos...
              </div>
            ) : (() => {
              const currentEvents = calendarEvents.filter(ev => {
                const s = ev.start?.dateTime ? new Date(ev.start.dateTime) : ev.start?.date ? new Date(ev.start.date) : new Date();
                const e = ev.end?.dateTime ? new Date(ev.end.dateTime) : ev.end?.date ? new Date(ev.end.date) : new Date();
                return now >= s && now <= e;
              });
              const futureEvents = calendarEvents.filter(ev => {
                const s = ev.start?.dateTime ? new Date(ev.start.dateTime) : ev.start?.date ? new Date(ev.start.date) : new Date();
                return s > now;
              });
              
              const currentEvent = currentEvents[0];
              const nextEvent = futureEvents[0];
              
              if (!currentEvent && !nextEvent) {
                return (
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight mb-3">Agenda Livre!</h2>
                    <p className="text-indigo-100 text-sm">Não há eventos marcados para os próximos dias no momento.</p>
                  </div>
                );
              }

              return (
                <div className="flex flex-col md:flex-row gap-4 w-full">
                  {currentEvent && (
                    <div className="flex-1">
                      <h2 className="text-lg lg:text-xl font-bold tracking-tight mb-2 text-emerald-100">Agora</h2>
                      <div className="bg-white/10 rounded-xl p-4 border border-emerald-400/30 backdrop-blur-md">
                        <h3 className="font-bold text-lg mb-1 truncate">{currentEvent.summary || 'Evento'}</h3>
                        <p className="text-indigo-100 text-sm flex items-center gap-2">
                          <CalendarClock size={14} /> 
                          {currentEvent.end?.dateTime 
                            ? `Até as ${new Date(currentEvent.end.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute:'2-digit' })}` 
                            : 'O dia todo'}
                        </p>
                      </div>
                    </div>
                  )}
                  {nextEvent && (
                    <div className="flex-1">
                      <h2 className="text-lg lg:text-xl font-bold tracking-tight mb-2">A Seguir</h2>
                      <div className="bg-white/10 rounded-xl p-4 border border-white/20 backdrop-blur-md">
                        <h3 className="font-bold text-lg mb-1 truncate">{nextEvent.summary || 'Evento'}</h3>
                        <p className="text-indigo-100 text-sm flex items-center gap-2">
                          <CalendarClock size={14} /> 
                          {nextEvent.start?.dateTime 
                            ? new Date(nextEvent.start.dateTime).toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute:'2-digit' }) 
                            : 'O dia todo'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Prova Paulista Monitor - SHRUNK */}
        <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 flex flex-col justify-center items-center shadow-sm text-center">
          <div className="text-[10px] font-bold text-amber-800/60 uppercase tracking-widest mb-3">Monitor SEDUC</div>
          <div className="flex items-center justify-center gap-4">
            <div className="w-14 h-14 shrink-0 bg-amber-500 text-white rounded-2xl flex items-center justify-center text-xl font-black shadow-md shadow-amber-500/30">
              {diffP > 0 ? diffP : (diffP === 0 ? "🚀" : "--")}
            </div>
            <div className="text-left">
              <h3 className="text-base font-bold text-amber-900 leading-tight">
                {nextProva ? nextProva.nome : 'Sem provas agendadas'}
              </h3>
              <p className="text-amber-700/80 text-xs mt-1 font-medium">
                {nextProva ? `Inicia em ${new Date(nextProva.data + "T00:00:00").toLocaleDateString('pt-BR')}` : 'Calendário livre'}
              </p>
            </div>
          </div>
        </div>

        {/* Emails / Inbox */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col h-auto lg:h-[340px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 text-slate-800">
              <div className="bg-red-100 p-2 rounded-xl text-red-600">
                <Mail size={20} />
              </div>
              <h2 className="font-bold tracking-tight">Caixa de Entrada (Gmail Edu)</h2>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
            {!user ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <Mail size={32} className="text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-500">Conecte sua conta do Google para ler seus e-mails do Gmail Edu diretamente aqui.</p>
                <button onClick={loginWithGoogle} className="mt-3 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50">Conectar Contas</button>
              </div>
            ) : emailsApiError ? (
               <div className="text-center p-4 text-red-600 text-sm font-medium">{'⚠️ ' + emailsApiError}</div>
            ) : isEmailsLoading ? (
               <div className="flex items-center justify-center h-full text-slate-500">
                 <Loader2 size={24} className="animate-spin mb-2" />
               </div>
            ) : emails.length > 0 ? (
              emails.map((msg, i) => (
                <div key={msg.id || i} className={`flex gap-4 p-3 rounded-2xl border transition-colors group cursor-pointer ${i === 0 ? 'bg-red-50/50 border-red-100 hover:bg-red-50' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${i === 0 ? 'bg-red-200 text-red-700' : 'bg-slate-200 text-slate-700'}`}>
                    {msg.from ? msg.from.charAt(0).toUpperCase() : 'M'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className={`font-bold text-sm truncate ${i === 0 ? 'text-slate-800' : 'text-slate-700'}`}>{msg.from}</span>
                      <span className={`text-[10px] font-bold shrink-0 ${i === 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {msg.date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <p className={`text-sm truncate ${i === 0 ? 'font-bold text-slate-700' : 'text-slate-700'}`}>{msg.subject}</p>
                    <p className="text-xs text-slate-500 truncate">{msg.snippet?.replace(/&#39;/g, "'").replace(/&quot;/g, '"') || ''}</p>
                  </div>
                </div>
              ))
            ) : (
               <div className="text-center p-4 text-slate-500 text-sm">Nenhum e-mail recente encontrado. Verifique sua conexão ou se a sua conta tem a permissão de leitura de email ativa.</div>
            )}
          </div>
        </div>

        {/* Sistemas de Apoio */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col h-auto lg:h-[340px]">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
             Sistemas de Apoio
          </div>
          <div className="flex flex-col gap-3 flex-1 justify-center">
            <a href="https://saladofuturo.educacao.sp.gov.br/" target="_blank" rel="noopener noreferrer" 
              className="flex items-center gap-3 p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50 transition-all group text-slate-700 font-bold">
              <School size={20} className="text-slate-400 group-hover:text-indigo-600 transition-colors" /> 
              Sala do Futuro
            </a>
            <a href="https://avaefape.educacao.sp.gov.br/" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50 transition-all group text-slate-700 font-bold">
              <Laptop size={20} className="text-slate-400 group-hover:text-indigo-600 transition-colors" /> 
              AVA EFAPE
            </a>
            <a href="https://app.teachy.com.br/" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-2xl border border-amber-100 bg-amber-50 hover:border-amber-300 hover:bg-amber-100 transition-all group text-amber-900 font-bold">
              <Sparkles size={20} className="text-amber-500 group-hover:text-amber-600 transition-colors" /> 
              Plataforma Teachy (IA)
            </a>
          </div>
        </div>

        {/* News Feed - Categorias */}
        <div className="lg:col-span-3 flex flex-col h-auto lg:h-[400px]">
          <NewsCarousel />
        </div>

        {/* Chat Assistant (EduIA) */}
        <div id="chat-section" className="lg:col-span-3 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
            <BotMessageSquare size={16} className="text-indigo-500" /> Assistente EduIA
          </div>
          
          <div className="flex flex-col md:flex-row gap-6 lg:h-96 h-auto">
            {/* Chat Area */}
            <div className="flex-1 flex flex-col bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden h-96 md:h-full">
              <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                    msg.role === 'bot' 
                      ? "bg-white border border-slate-200 text-slate-700 self-start rounded-tl-sm whitespace-pre-wrap"
                      : "bg-indigo-600 text-white self-end ml-auto rounded-tr-sm whitespace-pre-wrap"
                  )}>
                    {msg.text}
                  </div>
                ))}
                {isTyping && (
                  <div className="bg-white border border-slate-200 text-slate-500 self-start rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-indigo-500" />
                    <span className="text-xs font-medium">Pensando...</span>
                  </div>
                )}
              </div>
              <form onSubmit={handleChat} className="p-3 bg-white border-t border-slate-100 flex gap-2">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isTyping}
                  placeholder="Ex: Como engajar alunos no 2º ano?"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50"
                />
                <button type="submit" disabled={isTyping} className="bg-slate-900 text-white p-2 rounded-xl hover:bg-slate-800 transition-colors shrink-0 disabled:opacity-50">
                  <Send size={18} />
                </button>
              </form>
            </div>
            
            {/* Reminders List */}
            <div className="w-full md:w-1/3 flex flex-col justify-between h-auto md:h-full">
              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-3 border-b border-slate-100 pb-2">Seus Lembretes</h4>
                {reminders.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhum lembrete ativo.</p>
                ) : (
                  <ul className="space-y-2 overflow-y-auto max-h-40 scrollbar-thin pr-2">
                    {reminders.map((rem, i) => (
                      <li key={i} className="flex justify-between items-start gap-2 bg-slate-50 p-2 rounded-lg text-sm text-slate-700 group border border-slate-100">
                        <span className="leading-tight">{rem}</span>
                        <button type="button" onClick={() => removeReminder(i)} className="text-slate-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all shrink-0">
                          <CheckCircle2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              <button 
                type="button"
                onClick={handleEfapeToggle}
                className={cn(
                  "w-full py-2.5 rounded-xl text-sm font-bold border transition-colors mt-4",
                  efapeDone 
                    ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {efapeDone ? "Fiz a EFAPE! ✅" : "Marcar EFAPE como concluída"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
