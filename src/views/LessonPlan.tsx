import React, { useState, useRef, useEffect } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "motion/react";
import {
  Save,
  CheckCircle2,
  Printer,
  BotMessageSquare,
  Send,
  Sparkles,
  Loader2,
  ArrowRight,
  Trash2,
  Folder,
  FolderOpen,
  Book,
  Plus,
  FileText,
  Edit2,
  Move,
  MessageSquarePlus,
  History,
  X,
  CalendarDays,
  ListTodo,
  Bot,
  Calendar
} from "lucide-react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { GoogleGenAI } from "@google/genai";
import { getHolidays, DATAS_OFICIAIS } from "../lib/constants";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useConfirm } from "../contexts/ConfirmContext";

import { useJarvisKnowledge } from "../hooks/useJarvisKnowledge";

let aiClient: GoogleGenAI | null = null;
function getAI() {
  if (!aiClient) {
    const key =
      process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
    if (key) {
      try {
        aiClient = new GoogleGenAI({ apiKey: key });
      } catch (e) {}
    }
  }
  return aiClient;
}

interface Message {
  id: string;
  role: "user" | "model";
  content: string;
  isError?: boolean;
}

interface Plan {
  id: string;
  folder: string;
  title: string;
  content: string;
}

import { curriculumData } from "../data/curriculumData";

export default function LessonPlan() {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const { curriculum, schoolModel, jarvisDocs } = useJarvisKnowledge();
  const [oldContent, setOldContent] = useLocalStorage<string>("eduPlan", "");
  const [plansDict, setPlansDict] = useLocalStorage<Record<string, string>>(
    "eduPlansRecord",
    {},
  );
  const [appPlans, setAppPlans] = useLocalStorage<Plan[]>("eduPlans_v2", []);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const [turmasList] = useLocalStorage<string[]>("classTurmasList", [
    "6°A - Orientação de estudos",
    "6°B - Matemática",
    "6°C - Matemática",
    "7°C - Matemática",
    "8°A - Matemática",
    "8°C - Matemática",
  ]);
  const [saved, setSaved] = useState(false);

  // Modals state
  const [isNewPlanModalOpen, setIsNewPlanModalOpen] = useState(false);
  const [newPlanData, setNewPlanData] = useState({
    title: "",
    folder: "Geral",
    newFolder: "",
  });

  const [movingPlanId, setMovingPlanId] = useState<string | null>(null);
  const [movePlanData, setMovePlanData] = useState({
    folder: "Geral",
    newFolder: "",
  });

  const [isSemanalClassesModalOpen, setIsSemanalClassesModalOpen] = useState(false);
  const [selectedSemanalClasses, setSelectedSemanalClasses] = useState<string[]>([]);

  const [isBimestralModalOpen, setIsBimestralModalOpen] = useState(false);
  const [selectedBimestralAno, setSelectedBimestralAno] = useState<string>("6");
  const [selectedBimestralBimestre, setSelectedBimestralBimestre] = useState<string>("1");

  useEffect(() => {
    if (user) {
      const fetchPlans = async () => {
        try {
          const snap = await getDocs(
            collection(db, "users", user.uid, "plans"),
          );
          const fbPlans: Plan[] = [];
          snap.forEach((d) => fbPlans.push(d.data() as Plan));
          if (fbPlans.length > 0) {
            setAppPlans(fbPlans);
            if (!selectedPlanId) setSelectedPlanId(fbPlans[0].id);
          } else if (appPlans.length > 0) {
            // migrate to firestore if firestore is empty but we have local plans
            appPlans.forEach(async (p) => {
              try {
                await setDoc(doc(db, "users", user.uid, "plans", p.id), p);
              } catch (e) {}
            });
          }
        } catch (e) {
          console.error("Error fetching plans", e);
        }
      };
      fetchPlans();
    }
  }, [user]);

  useEffect(() => {
    // Migration script
    const hasMigrated = localStorage.getItem("eduPlans_v2_migrated");
    if (!hasMigrated && appPlans.length === 0) {
      const migrated: Plan[] = [];
      if (oldContent) {
        migrated.push({
          id: "legacy-1",
          folder: "Geral",
          title: "Plano Antigo",
          content: oldContent,
        });
      }
      Object.entries(plansDict).forEach(([folder, rawContent], i) => {
        const content = typeof rawContent === "string" ? rawContent : "";
        if (content && content.trim() !== "") {
          migrated.push({
            id: `migrated-${i}`,
            folder,
            title: `Plano ${folder}`,
            content,
          });
        }
      });
      if (migrated.length > 0) {
        setAppPlans(migrated);
        setSelectedPlanId(migrated[0].id);
      }
      localStorage.setItem("eduPlans_v2_migrated", "true");
    } else if (!selectedPlanId && appPlans.length > 0) {
      setSelectedPlanId(appPlans[0].id);
    }
  }, []);

  const folders = Array.from(
    new Set(["Geral", ...turmasList, ...appPlans.map((p) => p.folder)]),
  );

  const activePlan = appPlans.find((p) => p.id === selectedPlanId);
  const content = activePlan ? activePlan.content : "";

  const setContent = (val: string | ((prev: string) => string)) => {
    if (!activePlan) return;
    setAppPlans((prev) =>
      prev.map((p) => {
        if (p.id === activePlan.id) {
          const newVal = typeof val === "function" ? val(p.content) : val;
          return { ...p, content: newVal };
        }
        return p;
      }),
    );
  };

  const updatePlan = async (id: string, updates: Partial<Plan>) => {
    setAppPlans((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...updates } : p));
      if (user) {
        const updated = next.find((p) => p.id === id);
        if (updated) {
          setDoc(doc(db, "users", user.uid, "plans", id), updated).catch((e) =>
            console.error(e),
          );
        }
      }
      return next;
    });
  };

  const deletePlan = async (id: string) => {
    setAppPlans((prev) => prev.filter((p) => p.id !== id));
    if (selectedPlanId === id) setSelectedPlanId(null);
    if (user) {
      deleteDoc(doc(db, "users", user.uid, "plans", id)).catch((e) =>
        console.error(e),
      );
    }
  };

  const createPlan = async (plan: Plan) => {
    setAppPlans((prev) => [...prev, plan]);
    setSelectedPlanId(plan.id);
    if (user) {
      setDoc(doc(db, "users", user.uid, "plans", plan.id), plan).catch((e) =>
        console.error(e),
      );
    }
  };

  // Chat state
  const userName = user?.displayName
    ? user.displayName.split(" ")[0]
    : "Professor(a)";

  const [currentLessonChatId, setCurrentLessonChatId] = useLocalStorage<string>(
    "eduLessonPlanCurrentChatId",
    Date.now().toString(),
  );
  const [messages, setMessages] = useLocalStorage<Message[]>(
    "eduLessonPlanChat",
    [],
  );
  const [chatHistory, setChatHistory] = useState<
    { id: string; date: string; preview: string; messages: Message[] }[]
  >([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState<"dashboard" | "chat" | "editor">(
    "dashboard",
  );

  useEffect(() => {
    if (user) {
      const fetchHistory = async () => {
        try {
          const snap = await getDocs(
            collection(db, "users", user.uid, "chatHistory"),
          );
          const fbHistory: {
            id: string;
            date: string;
            preview: string;
            messages: Message[];
          }[] = [];
          snap.forEach((d) => fbHistory.push(d.data() as any));
          if (fbHistory.length > 0) {
            const sorted = fbHistory.sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
            );
            setChatHistory(sorted);

            if (messages.length <= 1) {
              setCurrentLessonChatId(sorted[0].id);
              setMessages(sorted[0].messages);
            }
          }
        } catch (e) {
          console.error("Error fetching chat history", e);
        }
      };
      fetchHistory();
    }
  }, [user]);

  const handleSemanalClick = () => {
    setViewMode("chat");
    setIsSemanalClassesModalOpen(false);
    handleNewChat();
    
    // We use a timeout to avoid react state batching overriding the messages immediately
    setTimeout(() => {
      handleSend(undefined, `Quero um planejamento SEMANAL para as seguintes turmas: ${selectedSemanalClasses.join(", ")}. Por favor, me pergunte qual(is) aula(s) eu vou trabalhar (por exemplo: "aula 1 do segundo bimestre", "aulas 2 e 3", etc.). Quando eu responder com as aulas, você DEVE procurar OBRIGATORIAMENTE no seu material base (escopo/sequência/matriz curricular) e me mostrar as Habilidades, Aprendizagens Essenciais, Objetivos e os Conteúdos exatos da aula antes de seguirmos para o plano.`);
    }, 100);
  };

  const handleBimestralClick = () => {
    setIsBimestralModalOpen(true);
  };

  const handleBimestralSubmit = () => {
    setViewMode("chat");
    setIsBimestralModalOpen(false);
    handleNewChat();
    
    // We use a timeout to avoid react state batching overriding the messages immediately
    setTimeout(() => {
      handleSend(undefined, `Preciso de um GUIA DE APRENDIZAGEM / PLANEJAMENTO BIMESTRAL EXTREMAMENTE DETALHADO referente ao **${selectedBimestralAno}º Ano**, **${selectedBimestralBimestre}º Bimestre**.

Use como estrutura e agrupamento as informações abaixo (baseadas no formato P.E.I. E.E. Prof.ª Maria Elisa de Oliveira):

**1. Cabeçalho:**
- Componente Curricular: Matemática
- Ano/Turma: ${selectedBimestralAno}º Ano
- Bimestre: ${selectedBimestralBimestre}º

**2. Aulas previstas:**
Calcule e informe a quantidade total de aulas previstas para o bimestre (ex: 35 aulas ou o que for previsto no calendário normal). 

**3. Tabela Principal (Coração do Guia):**
Divida rigorosamente as aulas do bimestre em **blocos de aulas** baseados nas matrizes/escopo-sequência fornecidas. Não invente conteúdos, extraia-os exclusivamente do JSON/Matriz Curricular do ${selectedBimestralAno}º Ano, ${selectedBimestralBimestre}º Bimestre. 
Para cada bloco construa as colunas:
- **Aula & Conteúdos (O que vou aprender?)**: Exemplo: "Aula 1 a 5: AE1 - [Descrição da Aprendizagem Essencial/Conteúdo]"
- **Objetivos de Aprendizagem (O que devo saber?)**: Exemplo: "Identificar... Compor ou decompor..." Detalhe com base nas Habilidades.

Faça isso percorrendo TODAS as aulas (ex: Aula 1 a 5, Aula 6 a 10... até as últimas aulas designadas para Revisão).

**4. Critérios de Avaliação (Como serei avaliado?):**
Obrigatório incluir os exatos critérios e pesos abaixo:
- Matific: 10%
- Tarefas de Casa/SP: 10%
- Prova Paulista: 30%
- Prova Escrita (Bimestral): 30%
- Participação e Atividades em Aula: 20%

**5. Referências e fontes (Material Digital, etc):**
Inclua os links do Material Digital, Tarefas (CMSP/Matific), Livro impresso e canais Youtube.

Traga a resposta inteiramente formatada em Markdown, usando tabelas se possível ou blocos destrinchados que sigam o cabeçalho, a organização por blocos de aula e as demais sessões.`);
    }, 100);
  };

  const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "chatHistory", id));
      setChatHistory((prev) => prev.filter((h) => h.id !== id));
      if (currentLessonChatId === id) {
        handleNewChat();
      }
    } catch (err) {
      console.error("Failed to delete chat", err);
    }
  };

  // Auto-save lesson plan chat to history
  useEffect(() => {
    if (messages.length > 1) {
      setChatHistory((prev) => {
        const existingIdx = prev.findIndex((p) => p.id === currentLessonChatId);
        const newItem = {
          id: currentLessonChatId,
          date: new Date().toISOString(),
          preview:
            messages.find((m) => m.role === "user")?.content ||
            "Conversa sem interação",
          messages: messages,
        };

        if (user) {
          setDoc(
            doc(db, "users", user.uid, "chatHistory", currentLessonChatId),
            newItem,
          ).catch((e) => console.error(e));
        }

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
  }, [messages, currentLessonChatId, user]);

  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSave = async () => {
    if (user && activePlan) {
      try {
        await setDoc(
          doc(db, "users", user.uid, "plans", activePlan.id),
          activePlan,
        );
      } catch (e) {
        console.error(e);
      }
    }
    setSaved(true);
    setCurrentLessonChatId(Date.now().toString());
    setMessages([]);
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClearText = async () => {
    if (!activePlan) return;
    if (
      await confirm({
        title: "Apagar Texto",
        message: "Tem certeza que deseja apagar todo o texto deste plano? Esta ação não pode ser desfeita.",
        isDestructive: true,
      })
    ) {
      setContent("");
      setMessages([]);
    }
  };

  const handleClear = async () => {
    if (!activePlan) return;
    if (
      await confirm({
        title: "Excluir Arquivo",
        message: "Tem certeza que deseja excluir ESTE ARQUIVO inteiro? Esta ação não pode ser desfeita.",
        isDestructive: true,
      })
    ) {
      deletePlan(activePlan.id);
      setMessages([]);
    }
  };

  const appendToEditor = (text: string) => {
    setContent((prev) => (prev ? prev + "\n\n" + text : text));
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      if (chatRef.current) {
        chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }, 150);
  };

  const handleNewChat = () => {
    setCurrentLessonChatId(Date.now().toString());
    setMessages([]);
  };

  const loadHistoryChat = (id: string) => {
    const historyItem = chatHistory.find((h) => h.id === id);
    if (historyItem) {
      setCurrentLessonChatId(id);
      setMessages(historyItem.messages);
      setIsHistoryOpen(false);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, viewMode]);

  const handleSend = async (e?: React.FormEvent, overrideMessage?: string) => {
    if (e) e.preventDefault();
    const messageToSend = overrideMessage || inputVal;
    if (!messageToSend.trim() || isTyping) return;

    const userMsg = messageToSend.trim();
    if (!overrideMessage) setInputVal("");
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", content: userMsg },
    ]);
    setIsTyping(true);

    const ai = getAI();
    if (!ai) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "model",
          content: "Configure sua chave do Gemini API para continuarmos!",
        },
      ]);
      setIsTyping(false);
      return;
    }

    try {
      const year = new Date().getFullYear();
      const feriados = getHolidays(year);
      const feriadosList = Object.entries(feriados)
        .map(([k, v]) => `${k}/${year}: ${v}`)
        .join(", ");

      const sysPrompt = `Você é o Jarvis, um sistema integrado avançado (no estilo J.A.R.V.I.S. do Homem de Ferro, educado, focado mas com aquele toque de super inteligência de cientista), especializado no planejamento estratégico de aulas para professores da Secretaria Escolar de São Paulo (SEDUC-SP).
Seu objetivo é guiar o/a professor/a ${user?.displayName?.split(" ")[0] || ""} passo a passo para criar o plano bimestral ou planos de aula individuais. Reaja com entusiasmo inteligente.
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

${curriculum ? `[MATRIZ/ESCOPO CURRICULAR DO USUÁRIO]: \n\`\`\`\n${curriculum}\n\`\`\`\nCRÍTICO: Utilize essas informações curriculares do usuário como guia dos conteúdos. Se houver informações equivalentes nos [DOCUMENTOS BASE DA IA (BASE DO JARVIS)] (ex: a matriz bimestral estiver no Jarvis), dê **PRIORIDADE MÁXIMA E ABSOLUTA** aos documentos do Jarvis.` : `[ESCOPO-SEQUÊNCIA OFICIAL (FALLBACK)]: \n\`\`\`json\n${JSON.stringify(curriculumData)}\n\`\`\`\nCRÍTICO: Se houver documentos na [BASE DO JARVIS] que cubram as aulas/conteúdos requisitados, **IGNORE ESSA BASE FALLBACK** e use os DO JARVIS. Use esta base de fallback APENAS se nenhum documento no Jarvis tratar sobre os conteúdos pedidos.`}
${jarvisDocs && jarvisDocs.length > 0 ? `\n[DOCUMENTOS BASE DA IA (BASE DO JARVIS)]: \nVocê tem acesso aos arquivos da base de conhecimento da escola e do professor listados abaixo.\nCRÍTICO E OBRIGATÓRIO: Quando o usuário pedir um planejamento (ex: "Sexto ano, 2º bimestre"), sua PRIMEIRA tarefa mental é ler os títulos e conteúdos destes arquivos, localizar o documento e as partes EXATAS correspondentes à solicitação do usuário, e usar PRIMORDIALMENTE essa informação como base para seu plano de aula. Ignore os demais documentos que não correspondem à turma e bimestre solicitados. Atue com precisão máxima!\nLista de documentos base:\n${jarvisDocs.map(d => `\n========== INÍCIO DO DOC: [${d.title}] ==========\n${d.content}\n========== FIM DO DOC: [${d.title}] ==========\n`).join("\n")}` : ""}
${schoolModel ? `[MODELO DE PLANO DA ESCOLA]: \n${schoolModel}\nCRÍTICO: Este é o modelo exato exigido pela escola! Ao escrever o documento final de planejamento de aula para o usuário, você DEVE, OBRIGATORIAMENTE, replicar os tópicos, a estrutura e cada um dos campos presentes neste formato, preenchendo-os por completo de forma rica e detalhada com os dados da matriz. O professor tem que estar pronto para apenas copiar a sua saída e entregar à coordenação.` : ""}

Seja propositivo, ajude a dividir os conteúdos considerando essas datas e dias de avaliação. Quando for gerar o plano de aula real a pedido do usuário (seja bimestral, quinzenal ou aula a aula), respeite os modelos anexos integralmente!
Forneça o resultado formatado de forma limpa em Markdown.`;

      // Build chat history for Gemini
      const contents = messages
        .filter((m) => !m.isError)
        .map((m) => ({
          role: m.role === "model" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

      contents.push({ role: "user", parts: [{ text: userMsg }] } as any);

      let response;
      let lastError;
      const MAX_RETRIES = 3;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `System Prompt: ${sysPrompt}\n\nAgora continue a conversa.`,
                  },
                ],
              },
              ...contents,
            ],
          });
          break; // success
        } catch (error: any) {
          lastError = error;

          if (error?.status === 400 || error?.message?.includes("400")) {
            break; // don't retry bad requests
          }

          console.warn(
            `Tentativa ${attempt + 1} falhou. Tentando novamente...`,
            error,
          );
          if (attempt < MAX_RETRIES - 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, Math.pow(2, attempt) * 1000),
            );
          }
        }
      }

      if (!response) {
        throw lastError || new Error("Falha após várias tentativas");
      }

      const responseText =
        response.text || "Desculpe, tive um problema em organizar as ideias.";
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "model", content: responseText },
      ]);
    } catch (err) {
      console.error("Erro na comunicação com a IA:", err);
      // Removemos a última mensagem do usuário para que ele possa enviar novamente facilmente, ou mantemos?
      // É melhor manter e mostrar a mensagem de erro. Filtramos o isError na próxima tentativa.
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "model",
          content:
            "Desculpe, os servidores da inteligência artificial parecem estar indisponíveis ou sobrecarregados no momento. Por favor, aguarde alguns segundos e tente enviar sua mensagem novamente.",
          isError: true,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // Markdown renderer is now handled by react-markdown directly in the component.

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`w-full mx-auto flex flex-col ${viewMode === "chat" ? "h-[calc(100vh-40px)] lg:h-[calc(100vh-48px)]" : "max-w-[1800px] gap-4 lg:gap-6 p-4 lg:p-6 min-h-[calc(100vh-40px)] lg:min-h-[calc(100vh-48px)]"}`}
    >
      <div
        className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden ${viewMode === "chat" ? "px-2 lg:px-4 pt-2 lg:pt-3 shrink-0" : ""}`}
      >
        <div>
          <h1
            className={`${viewMode === "chat" ? "text-xl lg:text-2xl gap-2.5" : "text-2xl lg:text-3xl gap-3"} font-black tracking-tight text-slate-800 flex items-center`}
          >
            <div
              className={`${viewMode === "chat" ? "p-2 rounded-lg" : "p-2.5 rounded-xl"} bg-indigo-100 text-indigo-600`}
            >
              <Book size={viewMode === "chat" ? 20 : 24} />
            </div>
            Estúdio de Planejamento
          </h1>
          {viewMode !== "chat" && (
            <p className="text-slate-500 font-medium ml-14 mt-1">
              Crie, organize e estruture seus planos de aula com suporte do
              Jarvis.
            </p>
          )}
        </div>

        {viewMode !== "dashboard" && (
          <button
            onClick={() => setViewMode("dashboard")}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold transition-colors"
          >
            Voltar ao Painel
          </button>
        )}
        {viewMode === "editor" && (
          <button
            onClick={() => setViewMode("chat")}
            className="flex items-center gap-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-4 py-2.5 rounded-xl font-bold transition-colors"
          >
            <Sparkles size={18} />
            Voltar ao Chat
          </button>
        )}
        {viewMode === "chat" && (
          <button
            onClick={() => setViewMode("editor")}
            className="flex items-center gap-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-4 py-2.5 rounded-xl font-bold transition-colors"
          >
            <FolderOpen size={18} />
            Editor de Planos
          </button>
        )}
      </div>

      {viewMode === "dashboard" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4 animate-in fade-in slide-in-from-bottom-4 print:hidden">
          <button
            onClick={handleBimestralClick}
            className="flex flex-col items-start p-8 bg-white border border-indigo-100 rounded-3xl shadow-sm hover:shadow-md hover:border-indigo-300 transition-all text-left relative overflow-hidden group cursor-pointer"
          >
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-50/80 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
            <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl mb-6 relative z-10 flex items-center justify-center shadow-inner">
              <CalendarDays size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-3 relative z-10 tracking-tight">
              Gerar Planejamento Bimestral
            </h3>
            <p className="text-sm text-slate-500 font-medium relative z-10 leading-relaxed">
              Levanta todas as aulas previstas, o que dará pra realizar e
              introduz possíveis avaliações baseadas na matriz.
            </p>
          </button>

          <button
            onClick={() => {
              setSelectedSemanalClasses([]);
              setIsSemanalClassesModalOpen(true);
            }}
            className="flex flex-col items-start p-8 bg-white border border-emerald-100 rounded-3xl shadow-sm hover:shadow-md hover:border-emerald-300 transition-all text-left relative overflow-hidden group cursor-pointer"
          >
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-50/80 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl mb-6 relative z-10 flex items-center justify-center shadow-inner">
              <ListTodo size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-3 relative z-10 tracking-tight">
              Gerar Plano Semanal
            </h3>
            <p className="text-sm text-slate-500 font-medium relative z-10 leading-relaxed">
              Escolha suas turmas e estruture as aulas semanais extraindo habilidades e objetivos diretamente do escopo sequência.
            </p>
          </button>

          <button
            onClick={() => {
              setViewMode("editor");
            }}
            className="flex flex-col items-start p-8 bg-white border border-rose-100 rounded-3xl shadow-sm hover:shadow-md hover:border-rose-300 transition-all text-left relative overflow-hidden group cursor-pointer"
          >
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-rose-50/80 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl mb-6 relative z-10 flex items-center justify-center shadow-inner">
              <FolderOpen size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-3 relative z-10 tracking-tight">
              Acessar Planos Salvos
            </h3>
            <p className="text-sm text-slate-500 font-medium relative z-10 leading-relaxed">
              Visualize, edite, imprima ou exporte os planos anteriores, e
              organize suas pastas.
            </p>
          </button>
        </div>
      )}

      <div
        className={
          viewMode === "chat"
            ? "flex-1 flex flex-col bg-slate-50 border border-slate-200 rounded-3xl shadow-sm overflow-hidden min-h-[70vh] animate-in fade-in slide-in-from-bottom-4 relative w-full print:hidden"
            : "hidden"
        }
      >
        {/* Chat Header */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 p-3 shrink-0 flex items-center justify-between z-10 w-full absolute top-0 left-0 right-0">
          <div className="flex items-center gap-3 ml-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/20">
              <Sparkles size={14} />
            </div>
            <div className="mr-4">
              <h3 className="font-bold text-indigo-950 text-sm leading-none">
                Copiloto IA
              </h3>
              <p className="text-[10px] text-indigo-600/80 font-bold uppercase mt-1">
                Conectado
              </p>
            </div>

            <div className="hidden sm:flex items-center gap-2 border-l border-slate-200 pl-4 ml-2">
              <span className="text-xs font-bold text-slate-500">Destino:</span>
              <select
                value={selectedPlanId || ""}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 max-w-[200px] truncate"
              >
                <option value="" disabled>
                  Selecionar plano...
                </option>
                {appPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              {!selectedPlanId && (
                <button
                  onClick={() => {
                    setNewPlanData({
                      title: "",
                      folder: "Geral",
                      newFolder: "",
                    });
                    setIsNewPlanModalOpen(true);
                  }}
                  className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg text-xs font-bold transition-colors"
                >
                  + Novo
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
              className="text-indigo-600 hover:bg-indigo-100/50 border border-transparent hover:border-indigo-200 px-3 py-2 rounded-xl text-xs font-bold transition-all"
            >
              Datas Especiais
            </button>
            <div className="w-px h-5 bg-slate-200 mx-1"></div>
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
              title="Histórico"
            >
              <History size={18} />
            </button>
            <button
              onClick={handleNewChat}
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
              title="Nova Conversa"
            >
              <MessageSquarePlus size={18} />
            </button>
          </div>
        </div>
        {isCalendarOpen && (
          <div className="bg-slate-50 border-b border-slate-100 p-4 text-xs text-slate-700 overflow-y-auto max-h-48 scrollbar-thin shadow-inner shrink-0">
            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
              <CalendarDays size={14} className="text-indigo-500" /> Calendário
              2026
            </h4>
            <ul className="space-y-1.5 ml-1">
              <li>
                <span className="text-indigo-500 font-bold mr-1">•</span>{" "}
                <b>Início/Fim:</b> 02/02 a 18/12
              </li>
              <li>
                <span className="text-indigo-500 font-bold mr-1">•</span>{" "}
                <b>1º Bim:</b> 02/02 a 22/04
              </li>
              <li>
                <span className="text-indigo-500 font-bold mr-1">•</span>{" "}
                <b>2º Bim:</b> 23/04 a 06/07
              </li>
              <li>
                <span className="text-indigo-500 font-bold mr-1">•</span>{" "}
                <b>3º Bim:</b> 24/07 a 02/10
              </li>
              <li>
                <span className="text-indigo-500 font-bold mr-1">•</span>{" "}
                <b>4º Bim:</b> 05/10 a 18/12
              </li>
              <li>
                <span className="text-indigo-500 font-bold mr-1">•</span>{" "}
                <b>Férias:</b> Janeiro e Julho
              </li>
            </ul>
          </div>
        )}

        <>
          <div
            className="flex-1 overflow-y-auto px-4 pt-20 pb-8 bg-slate-50 scrollbar-thin"
            ref={chatRef}
          >
            <div className="max-w-[1000px] mx-auto w-full flex flex-col space-y-6 pb-32">
              {messages.length === 0 && !isTyping && (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
                  <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                    <Bot size={40} className="text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-700 mb-2">
                    Olá, eu sou o Jarvis
                  </h3>
                  <p className="text-slate-500 max-w-md mx-auto">
                    Estou aqui para ajudar você no planejamento acadêmico. Me
                    diga qual é a sua disciplina, quantidade de aulas e os dias
                    que você dá aula para começarmos.
                  </p>
                </div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 md:gap-4 w-full ${m.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`w-8 h-8 md:w-10 md:h-10 shrink-0 rounded-full flex items-center justify-center ${
                      m.role === "user"
                        ? "bg-indigo-600 text-white"
                        : m.isError
                          ? "bg-red-100 text-red-600 border border-red-200"
                          : "bg-emerald-100 text-emerald-600 border border-emerald-200"
                    }`}
                  >
                    {m.role === "user" ? (
                      <div className="font-bold text-sm">P</div>
                    ) : m.isError ? (
                      <X size={20} />
                    ) : (
                      <Bot size={20} />
                    )}
                  </div>

                  <div
                    className={`flex flex-col max-w-[85%] md:max-w-[80%] ${m.role === "user" ? "items-end" : "items-start"}`}
                  >
                    {m.content && (
                      <div
                        className={`p-3 md:p-4 rounded-2xl ${
                          m.role === "user"
                            ? "bg-indigo-600 text-white rounded-tr-sm"
                            : m.isError
                              ? "bg-red-50 border border-red-200 shadow-sm text-red-700 rounded-tl-sm"
                              : "bg-white border border-slate-200 shadow-sm text-slate-700 rounded-tl-sm"
                        }`}
                      >
                        {m.role === "model" ? (
                          <div className="markdown-body prose prose-sm md:prose-base prose-slate max-w-none">
                            <Markdown remarkPlugins={[remarkGfm]}>
                              {m.content}
                            </Markdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap leading-relaxed max-w-full text-sm md:text-base">
                            {m.content}
                          </p>
                        )}
                      </div>
                    )}
                    {m.role === "model" && !m.isError && m.id !== "1" && (
                      <button
                        onClick={() => appendToEditor(m.content)}
                        className="mt-2 text-[12px] bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-indigo-50 hover:text-indigo-600 transition-all font-medium"
                      >
                        <ArrowRight size={14} /> Inserir no Plano Ativo
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-3 md:gap-4 w-full">
                  <div className="w-8 h-8 md:w-10 md:h-10 shrink-0 rounded-full flex items-center justify-center bg-emerald-100 text-emerald-600 border border-emerald-200">
                    <Bot size={20} />
                  </div>
                  <div className="bg-white border border-slate-200 shadow-sm px-5 py-4 rounded-2xl rounded-tl-sm flex items-center gap-2 text-slate-500">
                    <Loader2
                      size={16}
                      className="animate-spin text-emerald-500"
                    />
                    <span className="text-sm font-medium animate-pulse">
                      Pensando...
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="bg-white border-t border-slate-200 p-3 md:p-4 shrink-0 z-10 w-full relative">
            <div className="max-w-5xl mx-auto">
              <form
                onSubmit={handleSend}
                className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all shadow-sm"
              >
                <textarea
                  value={inputVal}
                  onChange={(e) => {
                    setInputVal(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height =
                      Math.min(e.target.scrollHeight, 128) + "px";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                      e.currentTarget.style.height = "auto";
                    }
                  }}
                  placeholder="Pergunte ao Jarvis..."
                  className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-40 min-h-[72px] py-3 text-[15px] md:text-base scrollbar-thin overflow-y-auto px-4 focus:outline-none placeholder:text-slate-400"
                  rows={3}
                />
                <button
                  disabled={isTyping || !inputVal.trim()}
                  type="submit"
                  className="p-2.5 md:p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shrink-0 shadow-sm self-end"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>
        </>
      </div>

      {viewMode === "editor" && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 min-h-0 items-stretch pb-6 animate-in fade-in slide-in-from-bottom-4">
          {/* Left panel: Files */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden h-full print:hidden relative">
            <div className="bg-slate-50/80 border-b border-slate-200 p-3 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2 px-3 py-1.5 text-slate-700 font-bold">
                <FolderOpen size={16} className="text-indigo-600" />
                <span className="text-sm">Planos Salvos</span>
              </div>
              <button
                onClick={() => {
                  setNewPlanData({ title: "", folder: "Geral", newFolder: "" });
                  setIsNewPlanModalOpen(true);
                }}
                className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 p-2 rounded-xl transition-all flex items-center gap-1"
                title="Novo Documento"
              >
                <Plus size={16} />{" "}
                <span className="text-xs tracking-tight font-bold pr-1">
                  Novo
                </span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 scrollbar-thin bg-slate-50/50">
              <div className="space-y-4">
                {folders.map((folder) => {
                  const folderPlans = appPlans.filter(
                    (p) => p.folder === folder,
                  );
                  if (folderPlans.length === 0) return null;

                  return (
                    <div
                      key={folder}
                      className="bg-white border border-slate-100 rounded-2xl p-3 flex flex-col shadow-sm"
                    >
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2 ml-1">
                        <Folder size={12} className="text-slate-300" /> {folder}
                      </div>
                      <div className="space-y-1.5">
                        {folderPlans.map((plan) => (
                          <div
                            key={plan.id}
                            onClick={() => setSelectedPlanId(plan.id)}
                            className={`group flex items-center justify-between p-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all border ${selectedPlanId === plan.id ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm" : "bg-transparent border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-200"}`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <FileText
                                size={14}
                                className={
                                  selectedPlanId === plan.id
                                    ? "text-indigo-500"
                                    : "text-slate-400"
                                }
                              />
                              <span className="truncate text-[13px]">
                                {plan.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newTitle = window.prompt(
                                    "Renomear:",
                                    plan.title,
                                  );
                                  if (newTitle)
                                    updatePlan(plan.id, { title: newTitle });
                                }}
                                className="p-1.5 hover:bg-white rounded-lg text-indigo-600"
                                title="Renomear"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMovePlanData({
                                    folder: plan.folder,
                                    newFolder: "",
                                  });
                                  setMovingPlanId(plan.id);
                                }}
                                className="p-1.5 hover:bg-white rounded-lg text-amber-600"
                                title="Mover"
                              >
                                <Move size={12} />
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (await confirm({ title: "Excluir Plano", message: "Excluir plano?", isDestructive: true }))
                                    deletePlan(plan.id);
                                }}
                                className="p-1.5 hover:bg-white rounded-lg text-rose-600"
                                title="Excluir"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {folders.length === 0 || appPlans.length === 0 ? (
                <div className="text-center p-8 text-slate-400 text-sm font-medium italic">
                  Nenhum documento salvo ainda.
                </div>
              ) : null}
            </div>
          </div>

          {/* Editor */}
          <div className="flex flex-col bg-slate-100/80 rounded-3xl shadow-inner overflow-hidden print:bg-white print:shadow-none min-h-0 relative border border-slate-200">
            {!activePlan && (
              <div className="absolute inset-0 z-10 bg-slate-50/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl shadow-slate-200/50 mb-6">
                  <FileText size={40} className="text-indigo-300" />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">
                  Câmera de Documentos Vazia
                </h3>
                <p className="text-sm text-slate-500 mb-8 max-w-sm font-medium">
                  Selecione um plano no explorador à esquerda ou inicie um novo
                  projeto para começar a escrever.
                </p>
                <button
                  onClick={() => {
                    setNewPlanData({
                      title: "",
                      folder: "Geral",
                      newFolder: "",
                    });
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
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  {activePlan?.folder || "Pasta"}
                </span>
                <span className="text-base font-black text-slate-800 truncate">
                  {activePlan ? activePlan.title : "Sem título"}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleClearText}
                  disabled={!activePlan}
                  className="bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                  title="Limpar Documento"
                >
                  <Trash2 size={14} />{" "}
                  <span className="hidden xl:inline">Limpar</span>
                </button>

                <button
                  onClick={handlePrint}
                  disabled={!activePlan}
                  className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                  title="Imprimir / Gerar PDF"
                >
                  <Printer size={14} />{" "}
                  <span className="hidden xl:inline">Imprimir</span>
                </button>

                <div className="w-px h-6 bg-slate-200 mx-1"></div>

                <button
                  onClick={handleSave}
                  disabled={!activePlan}
                  className={`text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50 ${saved ? "bg-emerald-500 shadow-emerald-500/20" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20"}`}
                >
                  {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
                  {saved ? "Salvo no Drive" : "Salvar Alterações"}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center pb-24 scrollbar-thin">
              <textarea
                value={content}
                disabled={!activePlan}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Digite seu planejamento ou peça para o Jarvis inserir o conteúdo gerado..."
                className="w-full max-w-[1000px] min-h-full h-full bg-white shadow-xl shadow-slate-200/50 border border-slate-200 rounded-2xl p-8 lg:p-12 font-medium text-slate-700 text-[15px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-300 print:shadow-none print:border-none print:p-0 resize-none"
              />
            </div>
          </div>
        </div>
      )}

      {isNewPlanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center top-0 left-0">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsNewPlanModalOpen(false)}
          ></div>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative z-10 m-4">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
              <FileText size={24} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-6 tracking-tight">
              Criar Novo Plano
            </h3>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Título do Documento
                </label>
                <input
                  type="text"
                  value={newPlanData.title}
                  onChange={(e) =>
                    setNewPlanData({ ...newPlanData, title: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-inner"
                  placeholder="Ex: 1º Bimestre - Matemática 6ºA"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Organizar na Pasta
                </label>
                <select
                  value={newPlanData.folder}
                  onChange={(e) =>
                    setNewPlanData({ ...newPlanData, folder: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-inner appearance-none cursor-pointer"
                >
                  {folders.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                  <option value="Nova Pasta">✨ Criar Nova Pasta...</option>
                </select>
              </div>
              {newPlanData.folder === "Nova Pasta" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                >
                  <label className="block text-sm font-bold text-slate-700 mb-2 mt-2">
                    Nome da Nova Pasta
                  </label>
                  <input
                    type="text"
                    value={newPlanData.newFolder}
                    onChange={(e) =>
                      setNewPlanData({
                        ...newPlanData,
                        newFolder: e.target.value,
                      })
                    }
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
                disabled={
                  !newPlanData.title.trim() ||
                  (newPlanData.folder === "Nova Pasta" &&
                    !newPlanData.newFolder.trim())
                }
                onClick={() => {
                  const finalFolder =
                    newPlanData.folder === "Nova Pasta"
                      ? newPlanData.newFolder.trim()
                      : newPlanData.folder;
                  const id = Date.now().toString();
                  createPlan({
                    id,
                    folder: finalFolder,
                    title: newPlanData.title.trim(),
                    content: "",
                  });
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

      {isBimestralModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center top-0 left-0">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsBimestralModalOpen(false)}
          ></div>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative z-10 m-4 flex flex-col max-h-[90vh]">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shrink-0">
              <Calendar size={24} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">
              Plano Bimestral
            </h3>
            <p className="text-sm font-medium text-slate-500 mb-6 shrink-0">
              Selecione o ano escolar e o bimestre para o plano.
            </p>
            
            <div className="space-y-4 mb-6 flex-1">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  Ano Escolar
                </label>
                <select 
                  value={selectedBimestralAno}
                  onChange={(e) => setSelectedBimestralAno(e.target.value)}
                  className="w-full bg-slate-100 border-none px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
                >
                  <option value="6">6º Ano</option>
                  <option value="7">7º Ano</option>
                  <option value="8">8º Ano</option>
                  <option value="9">9º Ano</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  Bimestre
                </label>
                <select 
                  value={selectedBimestralBimestre}
                  onChange={(e) => setSelectedBimestralBimestre(e.target.value)}
                  className="w-full bg-slate-100 border-none px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
                >
                  <option value="1">1º Bimestre</option>
                  <option value="2">2º Bimestre</option>
                  <option value="3">3º Bimestre</option>
                  <option value="4">4º Bimestre</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 shrink-0">
              <button
                onClick={() => setIsBimestralModalOpen(false)}
                className="flex-1 bg-white border border-slate-200 text-slate-600 px-4 py-3.5 rounded-2xl font-bold hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleBimestralSubmit}
                className="flex-1 bg-blue-600 text-white px-4 py-3.5 rounded-2xl font-bold hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50"
              >
                Gerar Plano
              </button>
            </div>
          </div>
        </div>
      )}

      {isSemanalClassesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center top-0 left-0">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsSemanalClassesModalOpen(false)}
          ></div>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative z-10 m-4 flex flex-col max-h-[90vh]">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 shrink-0">
              <ListTodo size={24} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">
              Plano Semanal
            </h3>
            <p className="text-sm font-medium text-slate-500 mb-6 shrink-0">
              Selecione as turmas para as quais você deseja planejar a semana.
            </p>
            
            <div className="space-y-3 overflow-y-auto pr-2 mb-6 scrollbar-thin flex-1">
              {turmasList.length === 0 ? (
                <p className="text-sm text-slate-500 italic">Nenhuma turma cadastrada no diário.</p>
              ) : (
                turmasList.map((turma) => (
                  <label key={turma} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 cursor-pointer transition-colors group">
                    <div className="relative flex items-center justify-center">
                      <input 
                        type="checkbox" 
                        className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded-md checked:bg-emerald-500 checked:border-emerald-500 transition-colors"
                        checked={selectedSemanalClasses.includes(turma)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSemanalClasses((prev) => [...prev, turma]);
                          } else {
                            setSelectedSemanalClasses((prev) => prev.filter(t => t !== turma));
                          }
                        }}
                      />
                      <CheckCircle2 size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 placeholder-events-none transition-opacity" />
                    </div>
                    <span className="font-bold text-slate-700 group-hover:text-emerald-800 transition-colors">{turma}</span>
                  </label>
                ))
              )}
            </div>

            <div className="flex gap-3 shrink-0">
              <button
                onClick={() => setIsSemanalClassesModalOpen(false)}
                className="flex-1 bg-white border border-slate-200 text-slate-600 px-4 py-3.5 rounded-2xl font-bold hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={selectedSemanalClasses.length === 0}
                onClick={handleSemanalClick}
                className="flex-1 bg-emerald-500 text-white px-4 py-3.5 rounded-2xl font-bold hover:bg-emerald-600 transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Bot size={18} /> Iniciar com Jarvis
              </button>
            </div>
          </div>
        </div>
      )}

      {movingPlanId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center top-0 left-0">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setMovingPlanId(null)}
          ></div>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative z-10 m-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
              <Move size={24} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">
              Mover Plano
            </h3>
            <p className="text-sm font-medium text-slate-500 mb-6">
              Selecione o novo destino para o documento.
            </p>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Mover para a Pasta
                </label>
                <select
                  value={movePlanData.folder}
                  onChange={(e) =>
                    setMovePlanData({ ...movePlanData, folder: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all shadow-inner appearance-none cursor-pointer"
                >
                  {folders.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                  <option value="Nova Pasta">✨ Criar Nova Pasta...</option>
                </select>
              </div>
              {movePlanData.folder === "Nova Pasta" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                >
                  <label className="block text-sm font-bold text-slate-700 mb-2 mt-2">
                    Nome da Nova Pasta
                  </label>
                  <input
                    type="text"
                    value={movePlanData.newFolder}
                    onChange={(e) =>
                      setMovePlanData({
                        ...movePlanData,
                        newFolder: e.target.value,
                      })
                    }
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
                disabled={
                  movePlanData.folder === "Nova Pasta" &&
                  !movePlanData.newFolder.trim()
                }
                onClick={() => {
                  const finalFolder =
                    movePlanData.folder === "Nova Pasta"
                      ? movePlanData.newFolder.trim()
                      : movePlanData.folder;
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
          <div
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
            onClick={() => setIsHistoryOpen(false)}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-full max-w-sm bg-slate-50 h-full shadow-2xl relative flex flex-col border-l border-slate-200"
          >
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-white shadow-sm z-10">
              <h3 className="font-black text-slate-800 flex items-center gap-2 text-lg tracking-tight">
                <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                  <History size={16} />
                </div>
                Histórico do Copiloto
              </h3>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
              >
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
                chatHistory.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => loadHistoryChat(h.id)}
                    className="w-full text-left p-4 rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group shadow-sm hover:shadow-md relative"
                  >
                    <button
                      onClick={(e) => handleDeleteChat(h.id, e)}
                      className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="text-[11px] font-bold tracking-wider text-slate-400 mb-2 uppercase group-hover:text-indigo-500 transition-colors pr-6">
                      {new Date(h.date).toLocaleDateString()} •{" "}
                      {new Date(h.date).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div className="text-sm text-slate-700 font-medium line-clamp-2 leading-relaxed">
                      "{h.preview}"
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1.5 bg-slate-100 text-slate-500 px-2 py-1 rounded-lg text-xs font-bold group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                      <BotMessageSquare size={12} /> {h.messages.length}{" "}
                      mensagen{h.messages.length === 1 ? "" : "s"}
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
