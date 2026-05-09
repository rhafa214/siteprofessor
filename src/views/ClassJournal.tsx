import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Plus, Trash2, Users, Save, ChevronLeft, CalendarClock, BookOpen, Clock, AlertCircle, MonitorPlay, CheckSquare, Square, NotebookPen } from 'lucide-react';
import { collection, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

interface ClassLog {
  id: number;
  data: string;
  aulaNumero: string;
  turma: string;
  progresso: string;
  aulaTitulo?: string;
  trabalhouSlide?: boolean;
  lembretes?: string;
}

const horariosDeAula = [
  '1ª aula - 07:00 às 07:50',
  '2ª aula - 07:50 às 08:35',
  '3ª aula - 08:55 às 09:40',
  '4ª aula - 09:40 às 10:30',
  '5ª aula - 10:30 às 11:20',
  '6ª aula - 12:20 às 13:10',
  '7ª aula - 13:10 às 14:00'
];

export default function ClassJournal() {
  const { user } = useAuth();
  const [logs, setLogs] = useLocalStorage<ClassLog[]>('classLogs', []);
  const [turmasList, setTurmasList] = useLocalStorage<string[]>('classTurmasList', [
    '6°A - Orientação de estudos',
    '6°B - Matemática',
    '6°C - Matemática',
    '7°C - Matemática',
    '8°A - Matemática',
    '8°C - Matemática'
  ]);
  
  const [selectedTurma, setSelectedTurma] = useState<string | null>(null);
  
  // Form states
  const todayDateStr = new Date().toISOString().split('T')[0];
  const [formDate, setFormDate] = useState(todayDateStr);
  const [formHorarios, setFormHorarios] = useState<string[]>([]);
  const [formAulaTitulo, setFormAulaTitulo] = useState('');
  const [formTrabalhouSlide, setFormTrabalhouSlide] = useState(false);
  const [formResumo, setFormResumo] = useState('');
  const [formLembretes, setFormLembretes] = useState('');
  const [novaTurma, setNovaTurma] = useState('');

  useEffect(() => {
    const navTurma = localStorage.getItem('nav_class_journal_turma');
    if (navTurma && turmasList && turmasList.length > 0) {
      const navClean = navTurma.toLowerCase().replace(/°|º|\s|-|ª/g, '');
      const match = turmasList.find(t => {
        const justGradeAndClass = t.split('-')[0].trim().replace(/°|º|\s|ª/g, '').toLowerCase();
        return navClean.includes(justGradeAndClass);
      });
      if (match) {
        setSelectedTurma(match);
      }
      localStorage.removeItem('nav_class_journal_turma');
    }
  }, [turmasList]);

  useEffect(() => {
    if (user) {
      const fetchLogs = async () => {
        try {
          const snap = await getDocs(collection(db, 'users', user.uid, 'classLogs'));
          const fbLogs: ClassLog[] = [];
          snap.forEach(d => fbLogs.push(d.data() as ClassLog));
          if (fbLogs.length > 0) {
            setLogs(fbLogs);
          } else if (logs.length > 0) {
            logs.forEach(async (log) => {
              try { await setDoc(doc(db, 'users', user.uid, 'classLogs', log.id.toString()), log); } catch(e) {}
            });
          }
        } catch (e) { console.error('Error fetching logs', e); }
      };
      fetchLogs();
    }
  }, [user]);

  const handleDeleteLog = (id: number) => {
    if (confirm('Tem certeza que deseja excluir este registro?')) {
      setLogs(logs.filter(log => log.id !== id));
      if (user) {
        deleteDoc(doc(db, 'users', user.uid, 'classLogs', id.toString())).catch(e => console.error(e));
      }
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTurma || !formResumo.trim() || formHorarios.length === 0) {
      alert("Por favor, preencha o resumo e selecione pelo menos um horário de aula.");
      return;
    }
    
    // Format date string to display
    const dataObj = new Date(formDate + 'T12:00:00');
    
    const newLog: ClassLog = {
      id: Date.now(),
      data: dataObj.toLocaleDateString('pt-BR'),
      aulaNumero: formHorarios.map(h => h.split(' - ')[0]).join(', '),
      turma: selectedTurma,
      aulaTitulo: formAulaTitulo.trim(),
      trabalhouSlide: formTrabalhouSlide,
      progresso: formResumo.trim(),
      lembretes: formLembretes.trim()
    };
    
    setLogs([newLog, ...logs]);
    setFormResumo('');
    setFormAulaTitulo('');
    setFormLembretes('');
    setFormHorarios([]);
    setFormTrabalhouSlide(false);
    if (user) {
      setDoc(doc(db, 'users', user.uid, 'classLogs', newLog.id.toString()), newLog).catch(e => console.error(e));
    }
  };

  const handleAddTurma = (e: React.FormEvent) => {
    e.preventDefault();
    const nova = novaTurma.trim();
    if (!nova) return;
    setTurmasList((current: string[]) => {
      const list = Array.isArray(current) ? current : [];
      if (list.includes(nova)) return list;
      return [...list, nova];
    });
    setNovaTurma('');
  };

  const handleRemoveTurma = (e: React.MouseEvent, t: string) => {
    e.stopPropagation();
    if (confirm(`Tem certeza que deseja excluir a turma "${t}" do registro de aulas?`)) {
      setTurmasList((current: string[]) => {
        const list = Array.isArray(current) ? current : [];
        return list.filter(item => item !== t);
      });
    }
  };

  // 1. Render all classes (like TaskAnalysis)
  if (!selectedTurma) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full flex flex-col gap-6"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Registro de Aulas</h1>
            <p className="text-slate-500 font-medium">Selecione uma turma para registrar as aulas ou ver o histórico.</p>
          </div>
          <form onSubmit={handleAddTurma} className="flex gap-2">
            <input 
              type="text"
              value={novaTurma}
              onChange={(e) => setNovaTurma(e.target.value)}
              placeholder="Ex: 1º Ano A"
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/20"
            />
            <button type="submit" className="bg-[#1a73e8] text-white font-bold px-4 py-2 rounded-xl shadow-md hover:bg-blue-700 text-sm flex items-center gap-1">
              <Plus size={16} /> Nova Turma
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {turmasList.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-dashed border-slate-300">
               <AlertCircle className="w-12 h-12 text-slate-400 mb-4" />
               <h2 className="text-xl font-bold text-slate-800 mb-2">Nenhuma Turma Adicionada</h2>
               <p className="text-slate-500 text-sm">Adicione uma nova turma para começar a registrar suas aulas.</p>
            </div>
          ) : (
            turmasList.map((turma) => {
              const turmaLogs = logs.filter(l => l.turma === turma);
              return (
                <motion.div
                  key={turma}
                  whileHover={{ y: -4 }}
                  onClick={() => setSelectedTurma(turma)}
                  className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm cursor-pointer hover:shadow-md hover:border-[#1a73e8]/40 transition-all group flex flex-col justify-between min-h-[160px] relative"
                >
                  <button 
                    onClick={(e) => handleRemoveTurma(e, turma)}
                    className="absolute top-4 right-4 p-2 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                    title="Excluir Turma"
                  >
                    <Trash2 size={18} />
                  </button>
                  <div>
                    <div className="w-10 h-10 bg-[#e8f0fe] text-[#1a73e8] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Users size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 tracking-tight mb-2 pr-8">{turma}</h3>
                    <div className="flex gap-4 text-xs font-bold text-slate-500">
                      <span className="flex items-center gap-1"><BookOpen size={14} /> {turmaLogs.length} Registros</span>
                      {turmaLogs.length > 0 && <span className="flex items-center gap-1"><Clock size={14} /> Última: {turmaLogs[0].data}</span>}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>
    );
  }

  // 2. Render specifically selected Class
  const currentTurmaLogs = logs.filter(l => l.turma === selectedTurma);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto flex flex-col h-full gap-6 pb-20"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSelectedTurma(null)}
            className="p-2 border border-slate-200 rounded-xl bg-white text-slate-700 hover:bg-slate-50 hover:text-[#1a73e8] transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">{selectedTurma}</h1>
            <p className="text-slate-500 text-sm font-medium">Gerencie suas aulas e o histórico desta turma.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Form Column */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm order-2 lg:order-1">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Plus size={20} className="text-[#1a73e8]" />
            Nova Aula
          </h2>
          
          <form onSubmit={handleSave} className="flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Data da Aula</label>
                <input 
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8] transition-all font-medium text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Horário(s) da Aula</label>
              <div className="grid grid-cols-2 gap-2">
                {horariosDeAula.map(hor => (
                  <button
                    key={hor}
                    type="button"
                    onClick={() => {
                      setFormHorarios(prev => 
                        prev.includes(hor) ? prev.filter(h => h !== hor) : [...prev, hor]
                      )
                    }}
                    className={`flex items-start gap-2 p-3 rounded-xl border text-left transition-all ${
                      formHorarios.includes(hor) 
                        ? 'border-[#1a73e8] bg-[#f8fbff] text-[#1a73e8]' 
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <div className="mt-0.5">
                      {formHorarios.includes(hor) ? <CheckSquare size={16} /> : <Square size={16} />}
                    </div>
                    <span className="text-sm font-semibold">{hor}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <label className="block text-sm font-bold text-slate-700">Trabalhou o slide dessa aula?</label>
                <p className="text-xs text-slate-500 mt-1">Marque se os slides foram apresentados aos alunos.</p>
              </div>
              <button
                type="button"
                onClick={() => setFormTrabalhouSlide(!formTrabalhouSlide)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${formTrabalhouSlide ? 'bg-[#1a73e8]' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${formTrabalhouSlide ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Número e título da aula trabalhada</label>
              <input 
                type="text"
                value={formAulaTitulo}
                onChange={(e) => setFormAulaTitulo(e.target.value)}
                placeholder="Ex: Aula 5 - Equações do 1º Grau"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8] transition-all font-medium text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Resumo da Aula</label>
              <textarea 
                value={formResumo}
                onChange={(e) => setFormResumo(e.target.value)}
                placeholder="Descreva aqui o que foi abordado em sala, progressos, eventos..."
                className="w-full min-h-[120px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/40 focus:border-[#1a73e8] transition-all font-medium resize-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Lembretes para a próxima aula</label>
              <textarea 
                value={formLembretes}
                onChange={(e) => setFormLembretes(e.target.value)}
                placeholder="Ex: Corrigir exercício 3 da página 45..."
                className="w-full min-h-[80px] bg-amber-50/50 border border-amber-200 rounded-xl px-4 py-3 placeholder:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-all font-medium resize-none text-slate-700"
              />
            </div>

            <button type="submit" className="w-full bg-[#1a73e8] text-white rounded-xl px-6 py-4 font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50">
              <Save size={18} /> Salvar
            </button>
          </form>
        </div>

        {/* List Column */}
        <div className="flex flex-col h-[700px] bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden order-1 lg:order-2">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <CalendarClock className="text-[#1a73e8]" />
            <h2 className="text-lg font-bold text-slate-800">Aulas Anteriores</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {currentTurmaLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                <BookOpen size={40} className="mb-4 text-slate-200" />
                <p className="font-medium text-slate-500">Nenhum registro para esta turma.</p>
                <p className="text-sm">Preencha o formulário para registrar a primeira aula.</p>
              </div>
            ) : (
              currentTurmaLogs.map((log) => (
                <div key={log.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative group hover:border-[#1a73e8]/30 transition-all tracking-tight">
                  <button 
                    onClick={() => handleDeleteLog(log.id)}
                    className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                  
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1"><CalendarClock size={14} /> {log.data}</span>
                    <span className="bg-[#e8f0fe] text-[#1a73e8] text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1"><Clock size={14} /> {log.aulaNumero}</span>
                    {log.trabalhouSlide && <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1"><MonitorPlay size={14} /> Slide OK</span>}
                  </div>
                  
                  {log.aulaTitulo && (
                    <div className="mb-3 text-sm font-bold text-slate-700 border-l-2 border-[#1a73e8] pl-3">
                      {log.aulaTitulo}
                    </div>
                  )}

                  <div className="space-y-2 mt-4">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1"><BookOpen size={12} /> Resumo</div>
                      <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">
                        {log.progresso}
                      </p>
                    </div>

                    {log.lembretes && (
                      <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                        <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1 flex items-center gap-1"><NotebookPen size={12} /> Lembrete p/ Próxima Aula</div>
                        <p className="text-amber-800 text-sm whitespace-pre-wrap leading-relaxed font-medium">
                          {log.lembretes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
