import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Save, CheckCircle2, Printer, BotMessageSquare, Send, Sparkles, Loader2, ArrowRight, Trash2, Folder, FolderOpen, Book, Plus, FileText, Edit2, Move, MessageSquarePlus, History, X } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { GoogleGenAI } from '@google/genai';
import { getHolidays, DATAS_OFICIAIS } from '../lib/constants';
import { collection, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

let aiClient: GoogleGenAI | null = null;
function getAI() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
    if (key) {
      try { aiClient = new GoogleGenAI({ apiKey: key }); } catch (e) {}
    }
  }
  return aiClient;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
}

interface Plan {
  id: string;
  folder: string;
  title: string;
  content: string;
}

export default function LessonPlan() {
  const { user } = useAuth();
  const [oldContent, setOldContent] = useLocalStorage<string>('eduPlan', '');
  const [plansDict, setPlansDict] = useLocalStorage<Record<string, string>>('eduPlansRecord', {});
  const [appPlans, setAppPlans] = useLocalStorage<Plan[]>('eduPlans_v2', []);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const [turmasList] = useLocalStorage<string[]>('classTurmasList', [
    '6°A - Orientação de estudos',
    '6°B - Matemática',
    '6°C - Matemática',
    '7°C - Matemática',
    '8°A - Matemática',
    '8°C - Matemática'
  ]);
  const [saved, setSaved] = useState(false);
  
  // Modals state
  const [isNewPlanModalOpen, setIsNewPlanModalOpen] = useState(false);
  const [newPlanData, setNewPlanData] = useState({ title: '', folder: 'Geral', newFolder: '' });
  
  const [movingPlanId, setMovingPlanId] = useState<string | null>(null);
  const [movePlanData, setMovePlanData] = useState({ folder: 'Geral', newFolder: '' });

  useEffect(() => {
    if (user) {
      const fetchPlans = async () => {
        try {
          const snap = await getDocs(collection(db, 'users', user.uid, 'plans'));
          const fbPlans: Plan[] = [];
          snap.forEach(d => fbPlans.push(d.data() as Plan));
          if (fbPlans.length > 0) {
            setAppPlans(fbPlans);
            if (!selectedPlanId) setSelectedPlanId(fbPlans[0].id);
          } else if (appPlans.length > 0) {
            // migrate to firestore if firestore is empty but we have local plans
            appPlans.forEach(async (p) => {
              try {
                await setDoc(doc(db, 'users', user.uid, 'plans', p.id), p);
              } catch(e) {}
            });
          }
        } catch (e) {
          console.error('Error fetching plans', e);
        }
      };
      fetchPlans();
    }
  }, [user]);

  useEffect(() => {
    // Migration script
    const hasMigrated = localStorage.getItem('eduPlans_v2_migrated');
    if (!hasMigrated && appPlans.length === 0) {
      const migrated: Plan[] = [];
      if (oldContent) {
        migrated.push({ id: 'legacy-1', folder: 'Geral', title: 'Plano Antigo', content: oldContent });
      }
      Object.entries(plansDict).forEach(([folder, rawContent], i) => {
        const content = typeof rawContent === 'string' ? rawContent : '';
        if (content && content.trim() !== '') {
          migrated.push({ id: `migrated-${i}`, folder, title: `Plano ${folder}`, content });
        }
      });
      if (migrated.length > 0) {
        setAppPlans(migrated);
        setSelectedPlanId(migrated[0].id);
      }
      localStorage.setItem('eduPlans_v2_migrated', 'true');
    } else if (!selectedPlanId && appPlans.length > 0) {
      setSelectedPlanId(appPlans[0].id);
    }
  }, []);

  const folders = Array.from(new Set(['Geral', ...turmasList, ...appPlans.map(p => p.folder)]));
  
  const activePlan = appPlans.find(p => p.id === selectedPlanId);
  const content = activePlan ? activePlan.content : '';

  const setContent = (val: string | ((prev: string) => string)) => {
    if (!activePlan) return;
    setAppPlans(prev => prev.map(p => {
      if (p.id === activePlan.id) {
        const newVal = typeof val === 'function' ? val(p.content) : val;
        return { ...p, content: newVal };
      }
      return p;
    }));
  };

  const updatePlan = async (id: string, updates: Partial<Plan>) => {
    setAppPlans(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...updates } : p);
      if (user) {
        const updated = next.find(p => p.id === id);
        if (updated) {
          setDoc(doc(db, 'users', user.uid, 'plans', id), updated).catch(e => console.error(e));
        }
      }
      return next;
    });
  };

  const deletePlan = async (id: string) => {
    setAppPlans(prev => prev.filter(p => p.id !== id));
    if (selectedPlanId === id) setSelectedPlanId(null);
    if (user) {
      deleteDoc(doc(db, 'users', user.uid, 'plans', id)).catch(e => console.error(e));
    }
  };
  
  const createPlan = async (plan: Plan) => {
    setAppPlans(prev => [...prev, plan]);
    setSelectedPlanId(plan.id);
    if (user) {
      setDoc(doc(db, 'users', user.uid, 'plans', plan.id), plan).catch(e => console.error(e));
    }
  };
  
  // Chat state
  const userName = user?.displayName ? user.displayName.split(' ')[0] : 'Professor(a)';
  
  const [currentLessonChatId, setCurrentLessonChatId] = useLocalStorage<string>('eduLessonPlanCurrentChatId', Date.now().toString());
  const [messages, setMessages] = useLocalStorage<Message[]>('eduLessonPlanChat', [
    {
      id: '1',
      role: 'model',
      content: `Olá, ${userName}! Eu sou Jarvis 🤖, seu sistema integrado de planejamento acadêmico, estilo Indústrias Stark. Estou aqui para otimizar suas metodologias e estruturar o seu **Planejamento Bimestral**. Para iniciarmos os cálculos, me informe:\n\n1. Qual é a sua **disciplina** e **série**?\n2. Qual é a estimativa de **quantas aulas/slides** você precisa trabalhar neste bimestre?\n3. Para precisão dos cálculos e evitar choques com feriados, **em quais dias da semana** você dá aula para essa turma?`
    }
  ]);
  const [chatHistory, setChatHistory] = useLocalStorage<{id: string, date: string, preview: string, messages: Message[]}[]>('eduLessonPlanChatHistory', []);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Auto-save lesson plan chat to history
  useEffect(() => {
    if (messages.length > 1) {
      setChatHistory(prev => {
        const existingIdx = prev.findIndex(p => p.id === currentLessonChatId);
        const newItem = {
          id: currentLessonChatId,
          date: new Date().toISOString(),
          preview: messages.find(m => m.role === 'user')?.content || 'Conversa sem interação',
          messages: messages
        };
        
        if (existingIdx !== -1) {
          const next = [...prev];
          next[existingIdx] = newItem;
          return next;
        } else {
          return [newItem, ...prev].slice(0, 50);
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, currentLessonChatId]);

  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const handleSave = async () => {
    if (user && activePlan) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'plans', activePlan.id), activePlan);
      } catch (e) {
        console.error(e);
      }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClearText = () => {
    if (!activePlan) return;
    if (window.confirm('Tem certeza que deseja apagar todo o texto deste plano? Esta ação não pode ser desfeita.')) {
      setContent('');
      setMessages([{
        id: Date.now().toString(),
        role: 'model',
        content: 'Texto apagado! Vamos começar de novo? \n\nMe diga sua disciplina, quantidade de aulas esperadas e os dias das aulas.'
      }]);
    }
  };

  const handleClear = () => {
    if (!activePlan) return;
    if (window.confirm('Tem certeza que deseja excluir ESTE ARQUIVO inteiro? Esta ação não pode ser desfeita.')) {
      deletePlan(activePlan.id);
      setMessages([{
        id: Date.now().toString(),
        role: 'model',
        content: 'Plano excluído! Vamos começar um novo? \n\nMe diga sua disciplina, quantidade de aulas esperadas e os dias das aulas.'
      }]);
    }
  };

  const appendToEditor = (text: string) => {
    setContent(prev => prev ? prev + '\n\n' + text : text);
  };

  const scrollToBottom = () => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  };

  const handleNewChat = () => {
    setCurrentLessonChatId(Date.now().toString());
    setMessages([{
      id: Date.now().toString(),
      role: 'model',
      content: `Olá, ${userName}! Eu sou Jarvis 🤖, seu sistema integrado de planejamento acadêmico, estilo Indústrias Stark. Estou aqui para otimizar suas metodologias e estruturar o seu **Planejamento Bimestral**. Para iniciarmos os cálculos, me informe:\n\n1. Qual é a sua **disciplina** e **série**?\n2. Qual é a estimativa de **quantas aulas/slides** você precisa trabalhar neste bimestre?\n3. Para precisão dos cálculos e evitar choques com feriados, **em quais dias da semana** você dá aula para essa turma?`
    }]);
  };

  const loadHistoryChat = (id: string) => {
    const historyItem = chatHistory.find(h => h.id === id);
    if (historyItem) {
      setCurrentLessonChatId(id);
      setMessages(historyItem.messages);
      setIsHistoryOpen(false);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputVal.trim() || isTyping) return;
    
    const userMsg = inputVal.trim();
    setInputVal('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMsg }]);
    setIsTyping(true);

    const ai = getAI();
    if (!ai) {
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        content: 'Configure sua chave do Gemini API para continuarmos!' 
      }]);
      setIsTyping(false);
      return;
    }

    try {
      const year = new Date().getFullYear();
      const feriados = getHolidays(year);
      const feriadosList = Object.entries(feriados).map(([k,v]) => `${k}/${year}: ${v}`).join(', ');

      const sysPrompt = `Você é o Jarvis, um sistema integrado avançado (no estilo J.A.R.V.I.S. do Homem de Ferro, educado, focado mas com aquele toque de super inteligência de cientista), especializado no planejamento estratégico de aulas para professores da Secretaria Escolar de São Paulo (SEDUC-SP).
Seu objetivo é guiar o/a professor/a ${user?.displayName?.split(' ')[0] || ''} passo a passo para criar o plano bimestral. Reaja com entusiasmo inteligente.
Leve em consideração a data atual (${new Date().toLocaleDateString()}), os feriados do ano (${feriadosList}), e as datas oficiais da rede.
INFORMAÇÕES OFICIAIS DO CALENDÁRIO 2026:
- Início do ano letivo: 02/02/2026
- Encerramento do 1º semestre: 06/07/2026
- Início do 2º semestre: 24/07/2026
- Término do ano letivo: 18/12/2026

Períodos de férias e recesso:
- Férias docentes: 02 a 16/01 e 07 a 21/07
- Recesso escolar: 17 a 31/01 e 19 a 31/12

Bimestres escolares:
- 1º bimestre: 02/02 a 22/04
- 2º bimestre: 23/04 a 06/07
- 3º bimestre: 24/07 a 02/10
- 4º bimestre: 05/10 a 18/12
Seja propositivo, ajude a dividir os conteúdos considerando essas datas e dias de avaliação. Se o professor der algumas informações vagas, faça perguntas para refinar.
Forneça o resultado formatado em Markdown com tabelas ou cronogramas passo a passo.`;

      // Build chat history for Gemini
      const contents = messages.map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
      
      contents.push({ role: 'user', parts: [{ text: userMsg }]} as any);

      // Using gemini-2.5-flash as default, or whatever you want
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: `System Prompt: ${sysPrompt}\n\nAgora continue a conversa.` }] },
          ...contents
        ]
      });

      const responseText = response.text || "Desculpe, tive um problema em organizar as ideias.";
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: responseText }]);

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: "Desculpe, ocorreu um erro ao se comunicar com a inteligência artificial." }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Simple Markdown renderer just using basic HTML tags for bold/lists since we can't easily import react-markdown if it's not present. We can try to use a basic replacement approach.
  const formatText = (text: string) => {
    // Basic bold and line breaks parsing
    const parts = text.split('\n').map((line, i) => {
      // Bold
      const boldReplaced = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return <p key={i} className="mb-2" dangerouslySetInnerHTML={{ __html: boldReplaced }} />;
    });
    return <>{parts}</>;
  };

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-[1500px] mx-auto min-h-[calc(100vh-80px)] flex flex-col gap-6"
    >
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[250px_400px_1fr] gap-4 min-h-[600px] items-stretch">
        
        {/* File Explorer */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden min-h-0 print:hidden relative">
          <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 shrink-0 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <FolderOpen size={16} /> Explorador
            </span>
            <button
              onClick={() => {
                setNewPlanData({ title: '', folder: 'Geral', newFolder: '' });
                setIsNewPlanModalOpen(true);
              }}
              className="w-7 h-7 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center hover:bg-indigo-200 transition-colors"
              title="Novo Plano"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {folders.map(folder => {
              const folderPlans = appPlans.filter(p => p.folder === folder);
              return (
                <div key={folder} className="space-y-1">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 px-2 py-1">
                    <Folder size={12} /> {folder}
                  </div>
                  {folderPlans.length === 0 ? (
                    <div className="text-xs text-slate-400 px-6 py-1 italic">Vazio</div>
                  ) : (
                    folderPlans.map(plan => (
                      <div 
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`group flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors ${selectedPlanId === plan.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText size={14} className={selectedPlanId === plan.id ? "text-indigo-500" : "text-slate-400"} />
                          <span className="truncate">{plan.title}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const newTitle = window.prompt("Renomear:", plan.title);
                              if (newTitle) updatePlan(plan.id, { title: newTitle });
                            }}
                            className="p-1 hover:bg-indigo-100 rounded text-indigo-600" title="Renomear"
                          ><Edit2 size={12} /></button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setMovePlanData({ folder: plan.folder, newFolder: '' });
                              setMovingPlanId(plan.id);
                            }}
                            className="p-1 hover:bg-amber-100 rounded text-amber-600" title="Mover"
                          ><Move size={12} /></button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm("Excluir plano?")) deletePlan(plan.id);
                            }}
                            className="p-1 hover:bg-rose-100 rounded text-rose-600" title="Excluir"
                          ><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* IA Chat */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden min-h-0 print:hidden relative">
          <div className="bg-indigo-50 border-b border-indigo-100 p-4 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <BotMessageSquare size={20} />
              </div>
              <div>
                <h3 className="font-bold text-indigo-900">Jarvis - IA Central</h3>
                <p className="text-xs text-indigo-600/80 font-medium tracking-wide">Assistente SEDUC-SP</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsHistoryOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 shadow-sm" title="Histórico">
                <History size={14} /> <span className="hidden sm:inline">Histórico</span>
              </button>
              <button onClick={handleNewChat} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-white hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200 shadow-sm" title="Nova Conversa">
                <MessageSquarePlus size={14} /> <span className="hidden sm:inline">Nova Conversa</span>
              </button>
              <button 
                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                className="text-indigo-600 bg-indigo-100/50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-indigo-200 shadow-sm"
              >
                Calendário
              </button>
            </div>
          </div>
          
          {isCalendarOpen && (
            <div className="bg-indigo-50/50 border-b border-indigo-100 p-4 text-xs text-slate-600 overflow-y-auto max-h-48 scrollbar-thin">
              <h4 className="font-bold text-slate-800 mb-2">Calendário Escolar 2026</h4>
              <ul className="space-y-1">
                <li>• <b>Letivos:</b> Mínimo de 200 dias</li>
                <li>• <b>Início/Fim:</b> 02/02 a 18/12</li>
                <li>• <b>1º Bimestre:</b> 02/02 a 22/04</li>
                <li>• <b>2º Bimestre:</b> 23/04 a 06/07</li>
                <li>• <b>3º Bimestre:</b> 24/07 a 02/10</li>
                <li>• <b>4º Bimestre:</b> 05/10 a 18/12</li>
                <li>• <b>Férias Docentes:</b> 02 a 16/01 e 07 a 21/07</li>
                <li>• <b>Recesso Escolar:</b> 17 a 31/01 e 19 a 31/12</li>
              </ul>
            </div>
          )}
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={chatRef}>
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-4 ${
                  m.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-sm' 
                    : 'bg-slate-50 border border-slate-100 text-slate-700 rounded-bl-sm'
                }`}>
                  <div className="text-sm font-medium leading-relaxed">
                    {formatText(m.content)}
                  </div>
                  {m.role === 'model' && m.id !== '1' && (
                    <button 
                      onClick={() => appendToEditor(m.content)}
                      className="mt-3 text-xs bg-white border border-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-indigo-50 font-bold transition-colors shadow-sm"
                    >
                      <ArrowRight size={14} /> Inserir no Plano
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-bl-sm p-4 flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-600 animate-pulse">Planejando...</span>
                </div>
              </div>
            )}
          </div>
          
          <form onSubmit={handleSend} className="p-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
            <div className="flex gap-2 items-end">
              <textarea 
                value={inputVal}
                onChange={e => {
                  setInputVal(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ex: Tenho 15 aulas planejadas de História para o 6º A as terças..." 
                className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm placeholder:text-slate-400 resize-none min-h-[48px] max-h-[120px] scrollbar-thin"
                rows={1}
              />
              <button 
                disabled={isTyping || !inputVal.trim()}
                type="submit" 
                className="bg-indigo-600 text-white w-12 h-12 rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <Send size={20} />
              </button>
            </div>
          </form>
        </div>

        {/* Editor */}
        <div className="flex flex-col bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden print:border-none print:shadow-none min-h-0 relative">
          {!activePlan && (
            <div className="absolute inset-0 z-10 bg-slate-50/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
              <FileText size={48} className="text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-700 mb-2">Nenhum plano selecionado</h3>
              <p className="text-sm text-slate-500 mb-6 max-w-sm">Crie um novo plano ou selecione um existente no explorador ao lado para começar a editar.</p>
              <button 
                onClick={() => {
                  setNewPlanData({ title: '', folder: 'Geral', newFolder: '' });
                  setIsNewPlanModalOpen(true);
                }}
                className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Plus size={18} /> Novo Plano
              </button>
            </div>
          )}
          <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 shrink-0 flex items-center justify-between print:hidden gap-2">
            <span className="text-sm font-bold text-slate-700 truncate">
              {activePlan ? activePlan.title : 'Documento Final'}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button 
                onClick={handleClearText}
                disabled={!activePlan}
                className="flex items-center justify-center bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 w-8 h-8 rounded-lg transition-all shadow-sm disabled:opacity-50"
                title="Limpar Texto"
              >
                <Trash2 size={16} />
              </button>
              
              <button 
                onClick={handlePrint}
                disabled={!activePlan}
                className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-sm disabled:opacity-50"
                title="Imprimir PDF"
              >
                <Printer size={16} />
              </button>
              
              <button 
                onClick={handleSave}
                disabled={!activePlan}
                className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50"
              >
                {saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                {saved ? 'Salvo' : 'Salvar'}
              </button>
            </div>
          </div>
          <textarea 
            value={content}
            disabled={!activePlan}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Seu plano bimestral ficará aqui..." 
            className="flex-1 w-full resize-none p-6 md:p-8 font-medium text-slate-700 text-base leading-relaxed focus:outline-none bg-white placeholder:text-slate-300 print:p-0 scrollbar-thin disabled:bg-slate-50 disabled:text-slate-400"
          ></textarea>
        </div>

      </div>

      {isNewPlanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Novo Plano de Aula</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Título do Plano</label>
                <input 
                  type="text" 
                  value={newPlanData.title}
                  onChange={e => setNewPlanData({...newPlanData, title: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: 1º Bimestre"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Salvar na Pasta</label>
                <select 
                  value={newPlanData.folder}
                  onChange={e => setNewPlanData({...newPlanData, folder: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {folders.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                  <option value="Nova Pasta">-- Criar Nova Pasta --</option>
                </select>
              </div>
              {newPlanData.folder === 'Nova Pasta' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nome da Nova Pasta</label>
                  <input 
                    type="text" 
                    value={newPlanData.newFolder}
                    onChange={e => setNewPlanData({...newPlanData, newFolder: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: 9°A - Ciências"
                  />
                </motion.div>
              )}
            </div>
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsNewPlanModalOpen(false)}
                className="flex-1 bg-slate-100 text-slate-600 px-4 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                disabled={!newPlanData.title.trim() || (newPlanData.folder === 'Nova Pasta' && !newPlanData.newFolder.trim())}
                onClick={() => {
                  const finalFolder = newPlanData.folder === 'Nova Pasta' ? newPlanData.newFolder.trim() : newPlanData.folder;
                  const id = Date.now().toString();
                  createPlan({ id, folder: finalFolder, title: newPlanData.title.trim(), content: '' });
                  setIsNewPlanModalOpen(false);
                }}
                className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-50"
              >
                Criar Plano
              </button>
            </div>
          </div>
        </div>
      )}

      {movingPlanId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Mover Plano</h3>
            <p className="text-sm text-slate-500 mb-4">Selecione para qual pasta deseja mover este plano.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Mover para a Pasta</label>
                <select 
                  value={movePlanData.folder}
                  onChange={e => setMovePlanData({...movePlanData, folder: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {folders.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                  <option value="Nova Pasta">-- Criar Nova Pasta --</option>
                </select>
              </div>
              {movePlanData.folder === 'Nova Pasta' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nome da Nova Pasta</label>
                  <input 
                    type="text" 
                    value={movePlanData.newFolder}
                    onChange={e => setMovePlanData({...movePlanData, newFolder: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: 9°A - Ciências"
                  />
                </motion.div>
              )}
            </div>
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setMovingPlanId(null)}
                className="flex-1 bg-slate-100 text-slate-600 px-4 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                disabled={movePlanData.folder === 'Nova Pasta' && !movePlanData.newFolder.trim()}
                onClick={() => {
                  const finalFolder = movePlanData.folder === 'Nova Pasta' ? movePlanData.newFolder.trim() : movePlanData.folder;
                  updatePlan(movingPlanId, { folder: finalFolder });
                  setMovingPlanId(null);
                }}
                className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-50"
              >
                Mover Plano
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Slide-over */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setIsHistoryOpen(false)} />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full max-w-sm bg-white h-full shadow-2xl relative flex flex-col border-l border-slate-200"
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <History size={18} className="text-indigo-600" /> Histórico de Planejador
              </h3>
              <button onClick={() => setIsHistoryOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatHistory.length === 0 ? (
                <div className="text-center text-slate-400 text-sm mt-10">
                  <MessageSquarePlus size={32} className="mx-auto mb-3 opacity-20" />
                  Nenhuma conversa salva ainda.
                </div>
              ) : (
                chatHistory.map(h => (
                  <button 
                    key={h.id}
                    onClick={() => loadHistoryChat(h.id)}
                    className="w-full text-left p-4 rounded-2xl border border-slate-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group shadow-sm hover:shadow-md"
                  >
                    <div className="text-xs font-bold text-slate-400 mb-1 group-hover:text-indigo-500">
                      {new Date(h.date).toLocaleDateString()} {new Date(h.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-sm text-slate-700 font-medium line-clamp-2 leading-tight">
                      {h.preview}
                    </div>
                    <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                      <BotMessageSquare size={12} /> {h.messages.length} mensagens
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}

    </motion.div>
  );
}
