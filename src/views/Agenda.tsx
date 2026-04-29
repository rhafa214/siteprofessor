import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, Clock, Link, CheckCircle2, AlertCircle, CalendarCheck, CheckSquare, ListTodo, LogOut } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';

declare const google: any;

export default function Agenda() {
  const [isConnected, setIsConnected] = useLocalStorage('googleCalendarConnected', false);
  const [accessToken, setAccessToken] = useLocalStorage<string | null>('googleAccessToken', null);
  const [tasks] = useLocalStorage<{id: number, text: string, done: boolean}[]>('eduTasksPro', []);
  const [reminders] = useLocalStorage<string[]>('eduReminders', []);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const pendingTasks = tasks.filter(t => !t.done);
  
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '946685977475-3irk02ul9n29jgm1atm7fteebu9dith0.apps.googleusercontent.com';

  const handleConnect = () => {
    if (typeof google === 'undefined') {
      setAuthError('O script do Google ainda não carregou. Tente novamente em alguns segundos ou recarregue a página.');
      return;
    }
    if (!clientId) {
      setAuthError('Variável VITE_GOOGLE_CLIENT_ID não configurada. Crie em console.cloud.google.com e adicione no .env para testar a sincronização real!');
      return;
    }
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        callback: (response: any) => {
          if (response.error !== undefined) {
             setAuthError('Erro na autenticação: ' + response.error);
             return;
          }
          setAccessToken(response.access_token);
          setIsConnected(true);
          setAuthError(null);
        },
      });
      client.requestAccessToken();
    } catch (err: any) {
      setAuthError('Erro inexperado: ' + err.message);
    }
  };

  const fetchEvents = async (token: string) => {
    setIsLoading(true);
    try {
      const start = new Date();
      start.setHours(0,0,0,0);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}&orderBy=startTime&singleEvents=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.status === 401) {
        handleDisconnect();
        setAuthError('Sessão expirada. Por favor, conecte novamente.');
        return;
      }
      
      const data = await res.json();
      if (data.items) {
        setCalendarEvents(data.items);
      }
    } catch (error) {
       console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && accessToken) {
      fetchEvents(accessToken);
    }
  }, [isConnected, accessToken]);

  const handleDisconnect = () => {
    setIsConnected(false);
    setAccessToken(null);
    setCalendarEvents([]);
    setAuthError(null);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col xl:flex-row gap-6 pb-10"
    >
      <div className="xl:w-1/3 flex flex-col gap-6">
        
        {/* Resumo do Dia (Daily Summary) */}
        <div className="bg-indigo-600 text-white p-6 rounded-3xl shadow-md border border-indigo-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-10">
            <CalendarCheck size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">Resumo do Dia</h2>
              <span className="bg-indigo-500/50 px-3 py-1 rounded-full text-xs font-bold border border-indigo-400">
                Hoje
              </span>
            </div>
            
            <p className="text-indigo-100 text-sm mb-6 leading-relaxed">
              {isConnected 
                ? "Você tem 3 aulas programadas e 1 reunião. Seu período de maior foco livre é das 11:00 às 14:00." 
                : "Sincronize sua agenda para receber insights sobre sua rotina diária."}
            </p>

            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-indigo-700/50 p-3 rounded-2xl border border-indigo-500/50">
                <div className="bg-indigo-500 p-2 rounded-xl text-white">
                  <CheckSquare size={18} />
                </div>
                <div>
                  <div className="text-xs text-indigo-200 font-bold uppercase tracking-wider mb-0.5">Tarefas Pendentes</div>
                  <div className="font-medium text-sm leading-tight">
                    {pendingTasks.length > 0 ? `${pendingTasks.length} tarefa(s) na sua checklist.` : "Tudo concluído!"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-indigo-700/50 p-3 rounded-2xl border border-indigo-500/50">
                <div className="bg-indigo-500 p-2 rounded-xl text-white">
                  <ListTodo size={18} />
                </div>
                <div>
                  <div className="text-xs text-indigo-200 font-bold uppercase tracking-wider mb-0.5">Lembretes da EduIA</div>
                  <div className="font-medium text-sm leading-tight">
                    {reminders.length > 0 ? `${reminders.length} lembrete(s) ativo(s).` : "Nenhum lembrete."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hoje / Coisas Importantes */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800">Eventos de Hoje</h2>
          </div>
          
          <div className="space-y-4 flex-1">
            {authError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-sm font-medium">
                {authError}
              </div>
            )}
            {isConnected ? (
              <>
                {isLoading ? (
                  <div className="text-center p-4">Carregando eventos...</div>
                ) : calendarEvents.length > 0 ? (
                  calendarEvents.slice(0, 5).map((ev, i) => {
                    const startInfo = ev.start?.dateTime ? new Date(ev.start.dateTime) : ev.start?.date ? new Date(ev.start.date) : new Date();
                    const endInfo = ev.end?.dateTime ? new Date(ev.end.dateTime) : ev.end?.date ? new Date(ev.end.date) : new Date();
                    const isCurrent = startInfo <= new Date() && endInfo >= new Date();
                    const timeStr = ev.start?.dateTime ? startInfo.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Dia todo';
                    
                    return (
                      <div key={ev.id || i} className={`flex gap-4 p-4 rounded-2xl border transition-all ${isCurrent ? 'border-indigo-200 bg-indigo-50/50 shadow-sm' : 'border-slate-100 bg-slate-50'}`}>
                        <div className={`font-mono font-bold text-sm shrink-0 pt-1 ${isCurrent ? 'text-indigo-700' : 'text-slate-400'}`}>
                          {timeStr}
                        </div>
                        <div>
                          <h4 className={`font-bold text-sm ${isCurrent ? 'text-indigo-900' : 'text-slate-700'}`}>{ev.summary || 'Evento sem título'}</h4>
                          <div className="flex items-center gap-3 mt-1.5 text-xs font-semibold text-slate-500">
                            <span className="flex items-center gap-1"><Clock size={12}/> {ev.start?.dateTime ? Math.round((endInfo.getTime() - startInfo.getTime()) / 60000) + ' min' : '1 dia'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center p-4 text-slate-500">Nenhum evento futuro encontrado nesta semana.</div>
                )}
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <CalendarIcon size={32} className="text-slate-300 mb-3" />
                <span className="text-sm font-bold text-slate-500 mb-1">Agenda Desconectada</span>
                <span className="text-xs text-slate-400 max-w-[200px]">Os eventos do seu dia aparecerão aqui.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="xl:w-2/3 flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
          <h2 className="font-bold text-slate-700 flex items-center gap-2">
            <CalendarIcon size={18} className="text-indigo-500"/> Visão Semanal
          </h2>
          <div className="flex items-center gap-3">
            {isConnected && (
              <button 
                onClick={handleDisconnect}
                className="text-xs font-bold text-slate-500 hover:text-red-500 transition-colors flex items-center gap-1 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm"
              >
                <LogOut size={14} /> Desconectar
              </button>
            )}
            <select className="bg-white border border-slate-200 text-sm font-medium rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 shadow-sm">
              <option>Esta Semana</option>
              <option>Semana Seguinte</option>
              <option>Visão Mensal</option>
            </select>
          </div>
        </div>
        
        <div className="flex-1 bg-slate-50 p-4 relative overflow-hidden">
           {isConnected ? (
             <div className="absolute inset-0 m-4 flex gap-4 overflow-x-auto snap-x scrollbar-thin">
               {/* Simulated Weekly Calendar Grid */}
               {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'].map((day, dIdx) => (
                 <div key={day} className="flex-1 min-w-[200px] bg-white border border-slate-200 rounded-2xl flex flex-col snap-start overflow-hidden">
                   <div className="p-3 border-b border-slate-100 text-center font-bold text-slate-600 shrink-0 bg-slate-50">
                     {day}
                   </div>
                   <div className="flex-1 p-2 space-y-2 overflow-y-auto scrollbar-thin">
                     {dIdx === 1 /* Terça */ && (
                       <>
                         <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl">
                           <div className="text-[10px] font-bold text-indigo-500 mb-1">08:00 - 08:45</div>
                           <div className="text-xs font-bold text-slate-700">Aula 2º B - Matemática</div>
                         </div>
                         <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl relative overflow-hidden">
                           <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-400"></div>
                           <div className="text-[10px] font-bold text-orange-600 mb-1">10:15 - 11:00</div>
                           <div className="text-xs font-bold text-slate-800">Reunião Coordenação</div>
                         </div>
                         <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl mt-4">
                           <div className="text-[10px] font-bold text-emerald-600 mb-1">14:30 - 15:30</div>
                           <div className="text-xs font-bold text-slate-700">Atendimento aos Pais</div>
                         </div>
                       </>
                     )}
                     {dIdx === 3 /* Quinta */ && (
                       <>
                         <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl">
                           <div className="text-[10px] font-bold text-indigo-500 mb-1">09:00 - 10:30</div>
                           <div className="text-xs font-bold text-slate-700">Aula 1º A - Física</div>
                         </div>
                         <div className="bg-slate-100 border border-slate-200 p-3 rounded-xl mt-4 border-dashed">
                           <div className="text-[10px] font-bold text-slate-500 mb-1">13:00 - 14:00</div>
                           <div className="text-xs font-bold text-slate-600 italic flex items-center justify-between">
                             Período Livre
                           </div>
                         </div>
                       </>
                     )}
                   </div>
                 </div>
               ))}
             </div>
           ) : (
             <div className="absolute inset-0 m-4 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center p-8 bg-white/60 backdrop-blur-sm">
                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" alt="Google Calendar" className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">Sincronize sua Rotina</h3>
                <p className="text-slate-500 max-w-md mx-auto mb-8 leading-relaxed font-medium">
                  Integre sua conta do Google para visualizar seu Google Calendar nativamente aqui. Nós organizaremos seu dia e destacaremos o que é mais importante.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={handleConnect}
                    className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    Conectar Google Calendar
                  </button>
                  <button className="bg-white text-slate-700 font-bold py-3 px-8 rounded-xl hover:bg-slate-50 transition-all border border-slate-200 shadow-sm">
                    Saiba mais
                  </button>
                </div>
             </div>
           )}
        </div>
      </div>
    </motion.div>
  );
}

