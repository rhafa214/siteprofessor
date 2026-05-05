import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Save, CheckCircle2, Printer, BotMessageSquare, Send, Sparkles, Loader2, ArrowRight, Trash2, Folder, FolderOpen, Book, Plus, FileText, Edit2, Move, MessageSquarePlus, History, X, CalendarDays, ListTodo } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { GoogleGenAI } from '@google/genai';
import { getHolidays, DATAS_OFICIAIS } from '../lib/constants';
import { collection, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

import { useJarvisKnowledge } from '../hooks/useJarvisKnowledge';

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
  const { curriculum, schoolModel } = useJarvisKnowledge();
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
  const [activeTab, setActiveTab] = useState<'chat' | 'files'>('chat');

  const handleBimestralClick = () => {
    setInputVal("Preciso de um planejamento BIMESTRAL detalhado. Calcule todas as aulas que teremos no bimestre selecionado, a quantidade de aulas previstas, quantas realmente darão para realizar (considerando feriados e o calendário estadual), a quantidade de slides/materiais necessários e sugira possíveis avaliações e instrumentos avaliativos. Por favor, me faça as perguntas necessárias para começarmos, como: bimestre, ano/série, quantidade de aulas semanais.");
  };

  const handleQuinzenalClick = () => {
    setInputVal("Preciso de um planejamento QUINZENAL detalhado para minhas aulas. Baseado na matriz curricular e no modelo estruturado, descreva aula a aula para as próximas duas semanas. Por favor, me faça as perguntas necessárias para começarmos, como: tema/habilidade foco destas semanas, ano/série, etc.");
  };

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

${curriculum ? `[MATRIZ CURRICULAR (ESTADO)]: \n${curriculum}\nUtilize essa matriz como guia fundamental dos conteúdos, habilidades e objetivos.` : ''}
${schoolModel ? `[MODELO DE PLANO DA ESCOLA]: \n${schoolModel}\nUtilize este modelo de plano de aula sempre que criar o seu planejamento estruturado.` : ''}

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
      className="max-w-[1500px] mx-auto min-h-[calc(100vh-80px)] flex flex-col gap-6 p-4 lg:p-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-800 flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
              <Book size={24} />
            </div>
            Estúdio de Planejamento
          </h1>
          <p className="text-slate-500 font-medium ml-14">Crie, organize e estruture seus planos de aula com suporte do Jarvis.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 print:hidden">
        <button 
          onClick={handleBimestralClick}
          className="flex flex-col items-start p-6 bg-white border border-indigo-100 rounded-3xl shadow-sm hover:shadow-md hover:border-indigo-300 transition-all text-left relative overflow-hidden group cursor-pointer"
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-50/80 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl mb-4 relative z-10">
            <CalendarDays size={24} />
          </div>
          <h3 className="text-lg font-black text-slate-800 mb-2 relative z-10 tracking-tight">Gerar Planejamento Bimestral</h3>
          <p className="text-sm text-slate-500 font-medium relative z-10">Levanta todas as aulas previstas, o que dará pra realizar e introduz possíveis avaliações baseadas na matriz.</p>
        </button>

        <button 
          onClick={handleQuinzenalClick}
          className="flex flex-col items-start p-6 bg-white border border-emerald-100 rounded-3xl shadow-sm hover:shadow-md hover:border-emerald-300 transition-all text-left relative overflow-hidden group cursor-pointer"
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-50/80 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl mb-4 relative z-10">
            <ListTodo size={24} />
          </div>
          <h3 className="text-lg font-black text-slate-800 mb-2 relative z-10 tracking-tight">Gerar Plano Quinzenal</h3>
          <p className="text-sm text-slate-500 font-medium relative z-10">Estrutura atividades, metodologias passo a passo considerando o modelo da sua escola.</p>
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 min-h-[700px] items-stretch pb-12">
        
        {/* Left Panel: Tabs (Chat / Documentos) */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden h-[850px] print:hidden relative">
          
          {/* Tabs Header */}
          <div className="bg-slate-50/80 border-b border-slate-200 p-3 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'chat' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                <BotMessageSquare size={16} /> Jarvis
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'files' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                <FolderOpen size={16} /> Planos
              </button>
            </div>

            {/* Contextual actions based on active tab */}
            {activeTab === 'chat' ? (
              <div className="flex items-center gap-1">
                <button onClick={() => setIsHistoryOpen(true)} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Histórico">
                  <History size={16} />
                </button>
                <button onClick={handleNewChat} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Nova Conversa">
                  <MessageSquarePlus size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setNewPlanData({ title: '', folder: 'Geral', newFolder: '' });
                  setIsNewPlanModalOpen(true);
                }}
                className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 p-2 rounded-xl transition-all flex items-center gap-1"
                title="Novo Documento"
              >
                <Plus size={16} /> <span className="text-xs tracking-tight font-bold pr-1">Novo</span>
              </button>
            )}
          </div>

          {activeTab === 'chat' && (
            <div className="flex bg-gradient-to-r from-indigo-50/50 to-blue-50/50 border-b border-indigo-50 p-3 shrink-0 items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/20">
                  <Sparkles size={14} />
                </div>
                <div>
                  <h3 className="font-bold text-indigo-950 text-sm leading-none">Copiloto IA</h3>
                  <p className="text-[10px] text-indigo-600/80 font-bold uppercase mt-1">Conectado</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                className="text-indigo-600 hover:bg-indigo-100/50 border border-transparent hover:border-indigo-200 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
              >
                Datas Especiais
              </button>
             </div>
          )}

          {activeTab === 'chat' && isCalendarOpen && (
            <div className="bg-slate-50 border-b border-slate-100 p-4 text-xs text-slate-700 overflow-y-auto max-h-48 scrollbar-thin shadow-inner shrink-0">
              <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2"><CalendarDays size={14} className="text-indigo-500"/> Calendário 2026</h4>
              <ul className="space-y-1.5 ml-1">
                <li><span className="text-indigo-500 font-bold mr-1">•</span> <b>Início/Fim:</b> 02/02 a 18/12</li>
                <li><span className="text-indigo-500 font-bold mr-1">•</span> <b>1º Bim:</b> 02/02 a 22/04</li>
                <li><span className="text-indigo-500 font-bold mr-1">•</span> <b>2º Bim:</b> 23/04 a 06/07</li>
                <li><span className="text-indigo-500 font-bold mr-1">•</span> <b>3º Bim:</b> 24/07 a 02/10</li>
                <li><span className="text-indigo-500 font-bold mr-1">•</span> <b>4º Bim:</b> 05/10 a 18/12</li>
                <li><span className="text-indigo-500 font-bold mr-1">•</span> <b>Férias:</b> Janeiro e Julho</li>
              </ul>
            </div>
          )}

          {activeTab === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white scrollbar-thin" ref={chatRef}>
                {messages.map(m => (
                  <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] rounded-2xl p-3 shadow-sm ${
                      m.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-sm' 
                        : 'bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-sm'
                    }`}>
                      <div className="text-[13px] font-medium leading-relaxed">
                        {formatText(m.content)}
                      </div>
                      {m.role === 'model' && m.id !== '1' && (
                        <button 
                          onClick={() => appendToEditor(m.content)}
                          className="mt-3 text-[11px] bg-white border border-slate-200 text-indigo-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-indigo-50 hover:border-indigo-200 font-bold transition-all shadow-sm"
                        >
                          <ArrowRight size={12} /> Inserir no Plano Ativo
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm p-3 flex items-center gap-2 shadow-sm">
                      <Loader2 size={14} className="animate-spin text-indigo-600" />
                      <span className="text-xs font-bold text-indigo-600 animate-pulse">Pensando...</span>
                    </div>
                  </div>
                )}
              </div>
              
              <form onSubmit={handleSend} className="p-3 border-t border-slate-100 shrink-0 bg-white">
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
                    placeholder="Como o Jarvis pode ajudar?" 
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[42px] max-h-[120px] scrollbar-thin resize-none"
                    rows={1}
                  />
                  <button 
                    disabled={isTyping || !inputVal.trim()}
                    type="submit" 
                    className="bg-indigo-600 text-white w-[42px] h-[42px] rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:shadow-none shrink-0"
                  >
                    <Send size={16} className={inputVal.trim() ? "translate-x-0.5 -translate-y-0.5" : ""} />
                  </button>
                </div>
              </form>
            </>
          )}

          {activeTab === 'files' && (
            <div className="flex-1 overflow-y-auto p-3 scrollbar-thin bg-slate-50/50">
              <div className="space-y-4">
              {folders.map(folder => {
                const folderPlans = appPlans.filter(p => p.folder === folder);
                if (folderPlans.length === 0) return null;
                
                return (
                  <div key={folder} className="bg-white border border-slate-100 rounded-2xl p-3 flex flex-col shadow-sm">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2 ml-1">
                      <Folder size={12} className="text-slate-300" /> {folder}
                    </div>
                    <div className="space-y-1.5">
                      {folderPlans.map(plan => (
                        <div 
                          key={plan.id}
                          onClick={() => setSelectedPlanId(plan.id)}
                          className={`group flex items-center justify-between p-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all border ${selectedPlanId === plan.id ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-200'}`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileText size={14} className={selectedPlanId === plan.id ? "text-indigo-500" : "text-slate-400"} />
                            <span className="truncate text-[13px]">{plan.title}</span>
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                const newTitle = window.prompt("Renomear:", plan.title);
                                if (newTitle) updatePlan(plan.id, { title: newTitle });
                              }}
                              className="p-1.5 hover:bg-white rounded-lg text-indigo-600" title="Renomear"
                            ><Edit2 size={12} /></button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setMovePlanData({ folder: plan.folder, newFolder: '' });
                                setMovingPlanId(plan.id);
                              }}
                              className="p-1.5 hover:bg-white rounded-lg text-amber-600" title="Mover"
                            ><Move size={12} /></button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm("Excluir plano?")) deletePlan(plan.id);
                              }}
                              className="p-1.5 hover:bg-white rounded-lg text-rose-600" title="Excluir"
                            ><Trash2 size={12} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              </div>
              {folders.length === 0 || appPlans.length === 0 ? (
                 <div className="text-center p-8 text-slate-400 text-sm font-medium italic">Nenhum documento salvo ainda.</div>
              ) : null}
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="flex flex-col bg-slate-100/80 rounded-3xl shadow-inner overflow-hidden print:bg-white print:shadow-none min-h-0 relative border border-slate-200">
          {!activePlan && (
            <div className="absolute inset-0 z-10 bg-slate-50/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl shadow-slate-200/50 mb-6">
                <FileText size={40} className="text-indigo-300" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">Câmera de Documentos Vazia</h3>
              <p className="text-sm text-slate-500 mb-8 max-w-sm font-medium">Selecione um plano no explorador à esquerda ou inicie um novo projeto para começar a escrever.</p>
              <button 
                onClick={() => {
                  setNewPlanData({ title: '', folder: 'Geral', newFolder: '' });
                  setIsNewPlanModalOpen(true);
                }}
                className="bg-indigo-600 text-white px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 hover:-translate-y-0.5"
              >
                <Plus size={18} /> Criar Novo Plano
              </button>
            </div>
          )}
          
          <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-5 py-3.5 shrink-0 flex flex-wrap items-center justify-between print:hidden gap-4 z-20">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{activePlan?.folder || 'Pasta'}</span>
              <span className="text-base font-black text-slate-800 truncate">
                {activePlan ? activePlan.title : 'Sem título'}
              </span>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <button 
                onClick={handleClearText}
                disabled={!activePlan}
                className="bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                title="Limpar Documento"
              >
                <Trash2 size={14} /> <span className="hidden xl:inline">Limpar</span>
              </button>
              
              <button 
                onClick={handlePrint}
                disabled={!activePlan}
                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                title="Imprimir / Gerar PDF"
              >
                <Printer size={14} /> <span className="hidden xl:inline">Imprimir</span>
              </button>
              
              <div className="w-px h-6 bg-slate-200 mx-1"></div>
              
              <button 
                onClick={handleSave}
                disabled={!activePlan}
                className={`text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50 ${saved ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'}`}
              >
                {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
                {saved ? 'Salvo no Drive' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center pb-24 scrollbar-thin">
            <textarea 
              value={content}
              disabled={!activePlan}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Digite seu planejamento ou peça para o Jarvis inserir o conteúdo gerado..." 
              className="w-full max-w-[850px] min-h-[850px] bg-white shadow-xl shadow-slate-200/50 border border-slate-200 rounded-2xl p-8 lg:p-12 font-medium text-slate-700 text-[15px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-300 print:shadow-none print:border-none print:p-0 resize-none"
            />
          </div>
        </div>

      </div>

      {isNewPlanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center top-0 left-0">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsNewPlanModalOpen(false)}></div>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative z-10 m-4">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
              <FileText size={24} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-6 tracking-tight">Criar Novo Plano</h3>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Título do Documento</label>
                <input 
                  type="text" 
                  value={newPlanData.title}
                  onChange={e => setNewPlanData({...newPlanData, title: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-inner"
                  placeholder="Ex: 1º Bimestre - Matemática 6ºA"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Organizar na Pasta</label>
                <select 
                  value={newPlanData.folder}
                  onChange={e => setNewPlanData({...newPlanData, folder: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-inner appearance-none cursor-pointer"
                >
                  {folders.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                  <option value="Nova Pasta">✨ Criar Nova Pasta...</option>
                </select>
              </div>
              {newPlanData.folder === 'Nova Pasta' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <label className="block text-sm font-bold text-slate-700 mb-2 mt-2">Nome da Nova Pasta</label>
                  <input 
                    type="text" 
                    value={newPlanData.newFolder}
                    onChange={e => setNewPlanData({...newPlanData, newFolder: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-inner"
                    placeholder="Ex: 9°A - Ciências"
                  />
                </motion.div>
              )}
            </div>
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsNewPlanModalOpen(false)}
                className="flex-1 bg-white border border-slate-200 text-slate-600 px-4 py-3.5 rounded-2xl font-bold hover:bg-slate-50 transition-colors"
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
                className="flex-1 bg-indigo-600 text-white px-4 py-3.5 rounded-2xl font-bold hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-50"
              >
                Criar Documento
              </button>
            </div>
          </div>
        </div>
      )}

      {movingPlanId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center top-0 left-0">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMovingPlanId(null)}></div>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative z-10 m-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
              <Move size={24} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">Mover Plano</h3>
            <p className="text-sm font-medium text-slate-500 mb-6">Selecione o novo destino para o documento.</p>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Mover para a Pasta</label>
                <select 
                  value={movePlanData.folder}
                  onChange={e => setMovePlanData({...movePlanData, folder: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all shadow-inner appearance-none cursor-pointer"
                >
                  {folders.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                  <option value="Nova Pasta">✨ Criar Nova Pasta...</option>
                </select>
              </div>
              {movePlanData.folder === 'Nova Pasta' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <label className="block text-sm font-bold text-slate-700 mb-2 mt-2">Nome da Nova Pasta</label>
                  <input 
                    type="text" 
                    value={movePlanData.newFolder}
                    onChange={e => setMovePlanData({...movePlanData, newFolder: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all shadow-inner"
                    placeholder="Ex: 9°A - Ciências"
                  />
                </motion.div>
              )}
            </div>
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setMovingPlanId(null)}
                className="flex-1 bg-white border border-slate-200 text-slate-600 px-4 py-3.5 rounded-2xl font-bold hover:bg-slate-50 transition-colors"
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
                className="flex-1 bg-amber-500 text-white px-4 py-3.5 rounded-2xl font-bold hover:bg-amber-600 transition-colors shadow-md disabled:opacity-50"
              >
                Confirmar
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
            className="w-full max-w-sm bg-slate-50 h-full shadow-2xl relative flex flex-col border-l border-slate-200"
          >
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-white shadow-sm z-10">
              <h3 className="font-black text-slate-800 flex items-center gap-2 text-lg tracking-tight">
                <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg"><History size={16} /></div> 
                Histórico do Copiloto
              </h3>
              <button onClick={() => setIsHistoryOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatHistory.length === 0 ? (
                <div className="text-center text-slate-400 text-sm mt-10">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <MessageSquarePlus size={24} className="text-slate-300" />
                  </div>
                  <p className="font-medium">Nenhuma conversa salva ainda.</p>
                </div>
              ) : (
                chatHistory.map(h => (
                  <button 
                    key={h.id}
                    onClick={() => loadHistoryChat(h.id)}
                    className="w-full text-left p-4 rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group shadow-sm hover:shadow-md"
                  >
                    <div className="text-[11px] font-bold tracking-wider text-slate-400 mb-2 uppercase group-hover:text-indigo-500 transition-colors">
                      {new Date(h.date).toLocaleDateString()} • {new Date(h.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-sm text-slate-700 font-medium line-clamp-2 leading-relaxed">
                      "{h.preview}"
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1.5 bg-slate-100 text-slate-500 px-2 py-1 rounded-lg text-xs font-bold group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                      <BotMessageSquare size={12} /> {h.messages.length} mensagen{h.messages.length === 1 ? '' : 's'}
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
