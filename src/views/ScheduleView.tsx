import React, { useState, useEffect } from "react";
import { Table, Calendar, Save, Loader2, Sparkles, Plus, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAlert } from "../contexts/AlertContext";
import { useGoogleCalendar } from "../hooks/useGoogleCalendar";

type Schedule = Record<number, string[]>;

const DAYS = [
  { index: 1, name: "Segunda-feira" },
  { index: 2, name: "Terça-feira" },
  { index: 3, name: "Quarta-feira" },
  { index: 4, name: "Quinta-feira" },
  { index: 5, name: "Sexta-feira" },
];

export default function ScheduleView() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { events, isLoading: isLoadingCalendar } = useGoogleCalendar();
  
  const [schedule, setSchedule] = useState<Schedule>({ 1: [], 2: [], 3: [], 4: [], 5: [] });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);

  // New states for the add modal
  const [modalTurmaValue, setModalTurmaValue] = useState("");
  const [modalAulasCount, setModalAulasCount] = useState(1);
  const [modalStartTime, setModalStartTime] = useState("");
  const [modalEndTime, setModalEndTime] = useState("");

  const handleOpenAddModal = (dayIndex: number) => {
    setActiveDayIndex(dayIndex);
    setModalTurmaValue("");
    setModalAulasCount(1);
    setModalStartTime("");
    setModalEndTime("");
  };

  const handleConfirmAddModal = () => {
    if (!modalTurmaValue.trim() || activeDayIndex === null) {
      setActiveDayIndex(null);
      return;
    }

    let finalStr = `${modalAulasCount} ${modalAulasCount > 1 ? "Aulas" : "Aula"} - ${modalTurmaValue.trim()}`;
    if (modalStartTime) {
      finalStr += ` (${modalStartTime}${modalEndTime ? ` às ${modalEndTime}` : ""})`;
    }

    const current = schedule[activeDayIndex] || [];
    setSchedule(prev => ({
      ...prev,
      [activeDayIndex]: [...current, finalStr]
    }));
    setActiveDayIndex(null);
  };

  useEffect(() => {
    async function loadSchedule() {
      if (!user) return;
      try {
        const docSnap = await getDoc(doc(db, "users", user.uid, "knowledge", "schedule"));
        if (docSnap.exists() && docSnap.data()?.schedule) {
          setSchedule(docSnap.data().schedule);
        }
      } catch (err) {
        console.error("Error loading schedule:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSchedule();
  }, [user]);

  const saveSchedule = async (newSchedule: Schedule) => {
    if (!user) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid, "knowledge", "schedule"), { schedule: newSchedule });
      setSchedule(newSchedule);
      showAlert("Grade de horários salva com sucesso!", "Sucesso", "success");
    } catch (err) {
      console.error(err);
      showAlert("Erro ao salvar grade de horários.", "Erro", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTurma = (dayIndex: number) => {
    if (!newTurmaValue.trim()) {
      setActiveDayIndex(null);
      return;
    }
    const current = schedule[dayIndex] || [];
    setSchedule(prev => ({
      ...prev,
      [dayIndex]: [...current, newTurmaValue.trim()]
    }));
    setNewTurmaValue("");
    setActiveDayIndex(null);
  };

  const handleRemoveTurma = (dayIndex: number, turmaIndex: number) => {
    setSchedule(prev => ({
      ...prev,
      [dayIndex]: (prev[dayIndex] || []).filter((_, idx) => idx !== turmaIndex)
    }));
  };

  const importFromCalendar = () => {
    if (!events || events.length === 0) {
      showAlert("Nenhum evento encontrado no calendário para importar.", "Aviso", "warning");
      return;
    }

    const newSchedule: Schedule = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    
    events.forEach((ev) => {
      if (ev.start?.dateTime || ev.start?.date) {
        const dateStr = ev.start.dateTime || ev.start.date;
        const date = new Date(dateStr);
        const dayIndex = date.getDay(); // 0(Sun) - 6(Sat)
        
        if (dayIndex >= 1 && dayIndex <= 5) {
          const title = ev.summary || "Aula";
          
          let numAulas = 1;
          let startTimeStr = "";
          let endTimeStr = "";

          if (ev.start?.dateTime && ev.end?.dateTime) {
            const startD = new Date(ev.start.dateTime);
            const endD = new Date(ev.end.dateTime);
            const diffMinutes = Math.round((endD.getTime() - startD.getTime()) / 60000);
            if (diffMinutes > 75) {
              numAulas = 2;
            }
            // format times for visual feedback
            startTimeStr = startD.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            endTimeStr = endD.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          }
          
          let finalStr = `${numAulas} ${numAulas > 1 ? "Aulas" : "Aula"} - ${title}`;
          if (startTimeStr) {
            finalStr += ` (${startTimeStr}${endTimeStr ? ` às ${endTimeStr}` : ""})`;
          }

          if (!newSchedule[dayIndex].includes(finalStr)) {
            newSchedule[dayIndex].push(finalStr);
          }
        }
      }
    });

    setSchedule(newSchedule);
    showAlert("Turmas importadas do calendário! Não esqueça de revisar e salvar.", "Sucesso", "success");
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 space-y-6">
      <div className="bg-white border text-center border-slate-200 rounded-[24px] p-6 lg:p-10 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="relative z-10 flex-1 text-left">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-indigo-500/10 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-indigo-100">
               <Table size={24} />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight">Grade de Horários</h1>
              <p className="text-slate-500 font-medium mt-1 text-sm lg:text-base">
                Cadastre ou importe as turmas em que você dá aula a cada dia da semana para o Jarvis lembrar.
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 shrink-0 flex flex-col sm:flex-row gap-3">
          <button
             onClick={importFromCalendar}
             disabled={isLoadingCalendar}
             className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm disabled:opacity-50"
          >
             {isLoadingCalendar ? <Loader2 size={18} className="animate-spin" /> : <Calendar size={18} />}
             Importar do Calendário
          </button>

          <button
             onClick={() => saveSchedule(schedule)}
             disabled={isSaving}
             className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Salvar Grade
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 h-full">
        {DAYS.map((day) => (
          <div key={day.index} className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
               <h3 className="font-bold text-slate-700 text-center">{day.name}</h3>
            </div>
            
            <div className="p-4 flex-1 flex flex-col gap-3 min-h-[300px] overflow-y-auto">
               {(schedule[day.index] || []).map((turma, idx) => (
                  <div key={idx} className="bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-xl px-3 py-2 flex items-center justify-between group shadow-sm">
                     <span className="font-medium text-sm pr-2 shrink">{turma}</span>
                     <button
                        onClick={() => handleRemoveTurma(day.index, idx)}
                        className="text-indigo-400 hover:text-red-500 opacity-50 group-hover:opacity-100 transition-opacity shrink-0"
                     >
                       <X size={16} />
                     </button>
                  </div>
               ))}

               <button
                 onClick={() => handleOpenAddModal(day.index)}
                 className="mt-2 w-full py-2 flex items-center justify-center gap-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-colors border border-dashed border-slate-200 hover:border-indigo-200"
               >
                 <Plus size={16} />
                 <span className="text-sm font-medium">Adicionar Aula</span>
               </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {activeDayIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl max-w-sm w-full border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">
                Adicionar {DAYS.find(d => d.index === activeDayIndex)?.name}
              </h3>
              <button 
                onClick={() => setActiveDayIndex(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 pt-1">
                  Turma
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Ex: 7º Ano A - Matemática"
                  value={modalTurmaValue}
                  onChange={(e) => setModalTurmaValue(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 pt-1">
                  Quantidade de Aulas
                </label>
                <div className="flex bg-slate-50 rounded-xl p-1 border border-slate-200">
                  <button
                    onClick={() => setModalAulasCount(1)}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${modalAulasCount === 1 ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}
                  >
                    1 Aula (50m)
                  </button>
                  <button
                    onClick={() => setModalAulasCount(2)}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${modalAulasCount === 2 ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}
                  >
                    2 Aulas (1h40m)
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 pt-1">
                    Horário Início
                  </label>
                  <input
                    type="time"
                    value={modalStartTime}
                    onChange={(e) => setModalStartTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 pt-1">
                    Horário Fim <span className="font-normal text-slate-400">(Opcional)</span>
                  </label>
                  <input
                    type="time"
                    value={modalEndTime}
                    onChange={(e) => setModalEndTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleConfirmAddModal}
                  disabled={!modalTurmaValue.trim()}
                  className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-md shadow-indigo-600/20 hover:bg-indigo-700 hover:shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:shadow-none"
                >
                  Adicionar à Grade
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
