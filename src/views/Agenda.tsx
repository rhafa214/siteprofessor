import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, Clock, Link, CheckCircle2, AlertCircle, CalendarCheck, CheckSquare, ListTodo, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useGoogleAuth } from '../contexts/GoogleAuthContext';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';

export default function Agenda() {
  const { isConnected, login, logout, authError } = useGoogleAuth();
  const { events: calendarEvents, isLoading } = useGoogleCalendar();
  const [tasks] = useLocalStorage<{id: number, text: string, done: boolean}[]>('eduTasksPro', []);
  const [reminders] = useLocalStorage<string[]>('eduReminders', []);
  const [weekOffset, setWeekOffset] = useState(0);

  const pendingTasks = tasks.filter(t => !t.done);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col gap-6 pb-10"
    >
      {/* Resumo do Dia (Daily Summary) Banner */}
      <div className="bg-indigo-600 text-white p-6 rounded-3xl shadow-md border border-indigo-500 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 shrink-0">
        <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-10 pointer-events-none">
          <CalendarCheck size={160} />
        </div>
        <div className="relative z-10 flex-1 w-full">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-2xl font-bold">Resumo do Dia</h2>
            <span className="bg-indigo-500/50 px-3 py-1 rounded-full text-xs font-bold border border-indigo-400">Hoje</span>
          </div>
          <p className="text-indigo-100 text-sm leading-relaxed max-w-xl">
            {isConnected 
              ? "Você tem 3 aulas programadas e 1 reunião. Seu período de maior foco livre é das 11:00 às 14:00." 
              : "Sincronize sua agenda para receber insights sobre sua rotina diária."}
          </p>
        </div>
        
        <div className="relative z-10 flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="flex items-center gap-3 bg-indigo-700/50 p-3 rounded-2xl border border-indigo-500/50 flex-1 md:w-48">
            <div className="bg-indigo-500 p-2 rounded-xl text-white">
              <CheckSquare size={18} />
            </div>
            <div>
              <div className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider mb-0.5">Pendentes</div>
              <div className="font-bold text-sm leading-tight">
                {pendingTasks.length > 0 ? `${pendingTasks.length} tarefas` : "Tudo pronto!"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-indigo-700/50 p-3 rounded-2xl border border-indigo-500/50 flex-1 md:w-48">
            <div className="bg-indigo-500 p-2 rounded-xl text-white">
              <ListTodo size={18} />
            </div>
            <div>
              <div className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider mb-0.5">EduIA</div>
              <div className="font-bold text-sm leading-tight">
                {reminders.length > 0 ? `${reminders.length} lembretes` : "Nenhum lembrete"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
        <div className="xl:w-1/3 flex flex-col gap-6 h-full">
          {/* Hoje / Coisas Importantes */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex-1 flex flex-col items-stretch overflow-hidden">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h2 className="text-lg font-bold text-slate-800">Eventos de Hoje</h2>
              {isConnected && (
                <button 
                  onClick={logout}
                  className="text-xs font-bold text-slate-500 hover:text-red-500 transition-colors flex items-center gap-1 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm"
                >
                  <LogOut size={14} /> Desconectar
                </button>
              )}
            </div>
            
            <div className="space-y-4 flex-1 overflow-y-auto pr-2 scrollbar-thin">
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
            <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm">
              <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                <ChevronLeft size={18} />
              </button>
              <button onClick={() => setWeekOffset(0)} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 border-x border-slate-200 transition-colors">
                {weekOffset === 0 ? 'Esta Semana' : weekOffset < 0 ? 'Voltar para Hoje' : 'Hoje'}
              </button>
              <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>
            {isConnected && (
              <button 
                onClick={logout}
                className="text-xs font-bold text-slate-500 hover:text-red-500 transition-colors flex items-center gap-1 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm"
              >
                <LogOut size={14} /> Desconectar
              </button>
            )}
          </div>
        </div>
        
        <div className="flex-1 bg-slate-50 p-4 relative overflow-hidden">
           {isConnected ? (
             <div className="absolute inset-0 m-4 flex gap-4 overflow-x-auto snap-x scrollbar-thin">
               {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'].map((day, dIdx) => {
                 // Get day index relative to today (0 = Sun, 1 = Mon)
                 const todayDay = new Date().getDay();
                 const diff = (dIdx + 1) - todayDay + (weekOffset * 7); // 1 is Monday
                 const dayDate = new Date();
                 dayDate.setDate(dayDate.getDate() + diff);
                 dayDate.setHours(0, 0, 0, 0);
                 const nextDayDate = new Date(dayDate);
                 nextDayDate.setDate(nextDayDate.getDate() + 1);

                 const dayEvents = calendarEvents.filter(ev => {
                   const evDate = ev.start?.dateTime ? new Date(ev.start.dateTime) : ev.start?.date ? new Date(ev.start.date) : new Date();
                   return evDate >= dayDate && evDate < nextDayDate;
                 });

                 return (
                 <div key={day} className="flex-1 min-w-[200px] bg-white border border-slate-200 rounded-2xl flex flex-col snap-start overflow-hidden">
                   <div className={`p-3 border-b text-center font-bold shrink-0 ${diff === 0 && weekOffset === 0 ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                     {day} <span className="text-xs font-normal ml-1">({dayDate.getDate()}/{dayDate.getMonth()+1})</span>
                   </div>
                   <div className="flex-1 p-2 space-y-2 overflow-y-auto scrollbar-thin">
                     {dayEvents.length > 0 ? dayEvents.map((ev, i) => {
                       const startInfo = ev.start?.dateTime ? new Date(ev.start.dateTime) : null;
                       const endInfo = ev.end?.dateTime ? new Date(ev.end.dateTime) : null;
                       const timeStr = startInfo ? `${startInfo.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${endInfo ? endInfo.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '?'}` : 'Dia todo';
                       
                       return (
                         <div key={ev.id || i} className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl mb-2">
                           <div className="text-[10px] font-bold text-indigo-500 mb-1">{timeStr}</div>
                           <div className="text-xs font-bold text-slate-700">{ev.summary || 'Evento'}</div>
                         </div>
                       );
                     }) : (
                        <div className="flex h-full items-center justify-center">
                          <p className="text-xs text-slate-400 font-medium italic">Livre</p>
                        </div>
                     )}
                   </div>
                 </div>
               )})}
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
                    onClick={login}
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
      </div>
    </motion.div>
  );
}

