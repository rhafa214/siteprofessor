import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  Brain,
  MessageSquarePlus,
  History,
  X,
  BookOpen,
  BellRing,
  Trash2,
  FolderTree,
} from "lucide-react";
import { getSmartPhrase, DATAS_OFICIAIS } from "../lib/constants";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { cn } from "../lib/utils";
import NewsCarousel from "../components/dashboard/NewsCarousel";
import { GoogleGenAI, Type } from "@google/genai";
import { useGoogleCalendar } from "../hooks/useGoogleCalendar";
import { useGmail } from "../hooks/useGmail";
import { useAuth } from "../contexts/AuthContext";
import { useJarvisKnowledge } from "../hooks/useJarvisKnowledge";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

let aiClient: GoogleGenAI | null = null;
function getAI() {
  if (!aiClient) {
    const key =
      process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
    if (key) {
      // @ts-ignore - catch any initialization errors
      try {
        aiClient = new GoogleGenAI({ apiKey: key });
      } catch (e) {}
    }
  }
  return aiClient;
}

interface DashboardProps {
  setCurrentView?: (view: any) => void;
}

export default function Dashboard({ setCurrentView }: DashboardProps) {
  const { user, loginWithGoogle } = useAuth();
  const { curriculum, schoolModel, jarvisDocs, schedule } = useJarvisKnowledge();
  const {
    events: calendarEvents,
    isLoading: isCalendarLoading,
    apiError: calendarApiError,
  } = useGoogleCalendar();
  const {
    messages: emails,
    isLoading: isEmailsLoading,
    apiError: emailsApiError,
    getEmailBody,
  } = useGmail();

  const [now, setNow] = useState(new Date());
  const [reminders, setReminders] = useLocalStorage<string[]>(
    "eduReminders",
    [],
  );
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isLembretesOpen, setIsLembretesOpen] = useState(false);
  const [reminderToDelete, setReminderToDelete] = useState<number | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [emailContent, setEmailContent] = useState<string | null>(null);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [activeStreamingMessage, setActiveStreamingMessage] = useState<
    string | null
  >(null);
  const [currentChatId, setCurrentChatId] = useLocalStorage<string>(
    "eduCurrentChatId",
    Date.now().toString(),
  );
  const [chatMessages, setChatMessages] = useLocalStorage<
    { role: "user" | "bot"; text: string }[]
  >("eduChatCurrent", [
    {
      role: "bot",
      text: new Date().getHours() >= 18 || new Date().getHours() < 6 
        ? `Fazendo hora extra, professor?! Hora de descansar, hein! Mas já que estamos aqui... Eu sou Jarvis 🤖, seu assistente. No que posso te ajudar com sua rotina maluca hoje?`
        : `Olá! Eu sou Jarvis 🤖, seu sistema integrado estilo Indústrias Stark, processando no Gemini. No que posso te ajudar hoje com sua rotina, planos e metodologias?`,
    },
  ]);
  const [chatHistory, setChatHistory] = useLocalStorage<
    {
      id: string;
      date: string;
      preview: string;
      messages: { role: "user" | "bot"; text: string }[];
    }[]
  >("eduChatHistory", []);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [efapeDone, setEfapeDone] = useLocalStorage("efapeDone", false);
  const [classLogs] = useLocalStorage<any[]>("classLogs", []);
  const [turmasList] = useLocalStorage<string[]>("classTurmasList", [
    "6°A - Orientação de estudos",
    "6°B - Matemática",
    "6°C - Matemática",
    "7°C - Matemática",
    "8°A - Matemática",
    "Itinerário 1° e 2°",
  ]);
  const [importantDates, setImportantDates] = useState<
    { id: string; nome: string; data: string; dataFim?: string }[]
  >([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lembretesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (lembretesRef.current && !lembretesRef.current.contains(event.target as Node)) {
        setIsLembretesOpen(false);
      }
    }
    if (isLembretesOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isLembretesOpen]);

  useEffect(() => {
    if (user && chatMessages.length === 1 && chatMessages[0].role === "bot") {
      const currentHour = new Date().getHours();
      const userName = user.displayName?.split(" ")[0] || "educador";
      let greetingDesc = `Olá, ${userName}! Eu sou Jarvis 🤖, seu sistema integrado estilo Indústrias Stark, processando no Gemini. No que posso te ajudar hoje com sua rotina, planos e metodologias?`;
      
      if (currentHour >= 18 || currentHour < 6) {
        greetingDesc = `Fazendo hora extra, professor ${userName}?! Hora de descansar, hein! Mas já que estamos aqui... Eu sou Jarvis 🤖. No que posso te ajudar com essa rotina maluca?`;
      }
      
      setChatMessages([
        {
          role: "bot",
          text: greetingDesc,
        },
      ]);
    }
  }, [user]);

  // Auto-save current chat to history
  useEffect(() => {
    if (chatMessages.length > 1) {
      setChatHistory((prev) => {
        const existingIdx = prev.findIndex((p) => p.id === currentChatId);
        const newItem = {
          id: currentChatId,
          date: new Date().toISOString(),
          preview:
            chatMessages.find((m) => m.role === "user")?.text ||
            "Conversa sem interação",
          messages: chatMessages,
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
  }, [chatMessages, currentChatId]);

  useEffect(() => {
    if (user) {
      const fetchSettings = async () => {
        try {
          const snap = await getDoc(
            doc(db, "users", user.uid, "settings", "dashboard"),
          );
          if (snap.exists()) {
            const data = snap.data();
            if (data.reminders) {
              setReminders(data.reminders);
            }
            if (data.importantDates) {
              setImportantDates(data.importantDates);
            }
            if (data.efapeDoneAt) {
              const doneAt = new Date(data.efapeDoneAt);
              const nextWeek = new Date(doneAt);
              nextWeek.setDate(nextWeek.getDate() + 7);
              // reset next week
              if (new Date() >= nextWeek) {
                setEfapeDone(false);
                await setDoc(
                  doc(db, "users", user.uid, "settings", "dashboard"),
                  { efapeDoneAt: null },
                  { merge: true },
                );
              } else {
                setEfapeDone(true);
              }
            } else {
              setEfapeDone(false);
            }
          } else {
            // save local values if any
            if (reminders.length > 0 || efapeDone) {
              await setDoc(
                doc(db, "users", user.uid, "settings", "dashboard"),
                {
                  reminders,
                  efapeDoneAt: efapeDone ? new Date().toISOString() : null,
                },
              );
            }
          }
        } catch (e) {
          console.error("Error fetching dashboard settings", e);
        }
      };
      // only run once to load initial remote info
      fetchSettings();
    }
    // empty dependency array or just user to load on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const updateFirestoreReminders = (newReminders: string[]) => {
    if (user) {
      setDoc(
        doc(db, "users", user.uid, "settings", "dashboard"),
        { reminders: newReminders },
        { merge: true },
      ).catch((e) => console.error(e));
    }
  };

  const updateFirestoreImportantDates = (newDates: { id: string; nome: string; data: string; dataFim?: string }[]) => {
    if (user) {
      setDoc(
        doc(db, "users", user.uid, "settings", "dashboard"),
        { importantDates: newDates },
        { merge: true },
      ).catch((e) => console.error(e));
    }
  };

  const handleEfapeToggle = () => {
    const newState = !efapeDone;
    setEfapeDone(newState);
    if (user) {
      setDoc(
        doc(db, "users", user.uid, "settings", "dashboard"),
        {
          efapeDoneAt: newState ? new Date().toISOString() : null,
        },
        { merge: true },
      ).catch((e) => console.error(e));
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
  }, [chatMessages, isTyping, activeStreamingMessage]);

  // Compute events
  const currentEvents = calendarEvents.filter((ev) => {
    const s = ev.start?.dateTime
      ? new Date(ev.start.dateTime)
      : ev.start?.date
        ? new Date(ev.start.date)
        : new Date();
    const e = ev.end?.dateTime
      ? new Date(ev.end.dateTime)
      : ev.end?.date
        ? new Date(ev.end.date)
        : new Date();
    return now >= s && now <= e;
  });
  const futureEvents = calendarEvents.filter((ev) => {
    const s = ev.start?.dateTime
      ? new Date(ev.start.dateTime)
      : ev.start?.date
        ? new Date(ev.start.date)
        : new Date();
    return s > now;
  });

  const currentEvent = currentEvents[0];
  const nextEvent = futureEvents[0];

  // Identificar turma atual
  let currentTurma: string | null = null;
  if (currentEvent && currentEvent.summary) {
    const summaryLower = currentEvent.summary.toLowerCase();
    for (const t of turmasList || []) {
      const tShort = t.split("-")[0].trim().toLowerCase();
      const sClean = summaryLower.replace(/[^a-z0-9]/g, "");
      const tClean = tShort.replace(/[^a-z0-9]/g, "");

      if (
        (tClean && sClean.includes(tClean)) ||
        (sClean && tClean.includes(sClean))
      ) {
        currentTurma = t;
        break;
      }
    }
  }

  const sortedClassLogs = classLogs ? [...classLogs].sort((a, b) => b.id - a.id) : [];

  const logForCurrentTurma = currentTurma
    ? sortedClassLogs.find((l) => l.turma === currentTurma)
    : null;
  const latestLog = sortedClassLogs.length > 0 ? sortedClassLogs[0] : null;

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

  // Merge official dates with custom dates
  const allProvasAndDates =
    importantDates && importantDates.length > 0 ? [...importantDates] : [];

  // Sort them by date to find the *next* one (or current one)
  allProvasAndDates.sort(
    (a, b) =>
      new Date(a.data + "T00:00:00").getTime() -
      new Date(b.data + "T00:00:00").getTime(),
  );

  let isHappeningNow = false;
  for (let p of allProvasAndDates) {
    let dp = new Date(p.data + "T00:00:00");
    let dpFim = (p as any).dataFim
      ? new Date((p as any).dataFim + "T00:00:00")
      : dp;

    // If we are before the end date, this is our target
    if (dpFim >= today) {
      nextProva = p;
      if (today >= dp && today <= dpFim) {
        isHappeningNow = true;
      }
      break;
    }
  }

  let diffP = -1;
  if (nextProva) {
    let dp = new Date(nextProva.data + "T00:00:00");
    diffP = Math.ceil((dp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffP < 0) diffP = 0; // It's currently happening
  }

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isTyping) return;

    const userMessage = chatInput.trim();
    setChatMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setChatInput("");
    setIsTyping(true);

    try {
      // Basic lembrete intercept
      if (
        userMessage.toLowerCase().includes("lembrar de") ||
        userMessage.toLowerCase().includes("lembre-me de")
      ) {
        const task = userMessage.replace(/lembrar de|lembre-me de/i, "").trim();
        if (task) {
          const nextRems = [...reminders, task];
          setReminders(nextRems);
          updateFirestoreReminders(nextRems);
          setChatMessages((prev) => [
            ...prev,
            {
              role: "bot",
              text: `Prontinho! Anotei "${task}" na sua lista de lembretes.`,
            },
          ]);
          setIsTyping(false);
          return;
        }
      }

      // Format previous messages for context
      const contents = chatMessages.map((msg) => ({
        role: msg.role === "bot" ? "model" : "user",
        parts: [{ text: msg.text }],
      }));
      contents.push({ role: "user", parts: [{ text: userMessage }] });

      const ai = getAI();
      if (!ai) {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "bot",
            text: "O Gemini API Key não está configurado. Para testar no Vercel/GitHub, configure a variável de ambiente VITE_GEMINI_API_KEY ou GEMINI_API_KEY.",
          },
        ]);
        setIsTyping(false);
        return;
      }

      const basePrompt = `Você é o Jarvis, um assistente especializado e prestativo estilo J.A.R.V.I.S. (do Homem de Ferro, muito inteligente, proativo, educado, focando na área da educação). 
Ajude o/a professor/a ${user?.displayName?.split(" ")[0] || ""} com dicas de metodologias ativas, planos de aula, ideias de engajamento e dúvidas gerais de forma clara, amigável e concisa (use no máximo 3 a 4 frases curtas por resposta). Dirija-se a ele/ela pelo nome.

Se o usuário pedir para ser lembrado de algo, DEVE SEMPRE usar a função \`addReminder\`.
Se o usuário pedir para adicionar, editar ou excluir semanas ao controle do Matific, DEVE SEMPRE usar a função \`manageMatificWeeks\`. Para novas semanas o nome da semana deve vir com o período de dias, por exemplo '11 a 15 de maio', usando seu conhecimento de calendário. Tente identificar a turma mais próxima na lista. Turmas cadastradas: ${JSON.stringify(turmasList)}.

Para sua referência, as datas do calendário escolar de 2026 são:
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
- 4º bimestre: 05/10 a 18/12`;

      const curPrompt = curriculum
        ? `\n\n[MATRIZ CURRICULAR (ESTADO)]: \n${curriculum}\nUtilize essa matriz quando for planejar algo específico do currículo.`
        : "";
      const modPrompt = schoolModel
        ? `\n\n[MODELO DE PLANO DA ESCOLA]: \n${schoolModel}\nUtilize este modelo de plano de aula sempre que criar planejamentos estruturados.`
        : "";
      const jarvisDocsPrompt = jarvisDocs && jarvisDocs.length > 0
        ? `\n\n[DOCUMENTOS BASE DA IA (BASE DO JARVIS)]: \nVocê tem acesso aos arquivos da base de conhecimento do professor listados abaixo. Se o usuário fizer qualquer tipo de pergunta técnica ou pedir um material focado em um currículo, sua PRIMEIRA tarefa é consultar estes documentos listados aqui abaixo, encontrando o exato contexto para responder.\n\nLista de documentos base:\n${jarvisDocs.map((d: any) => `\n========== INÍCIO DO DOC: [${d.title}] ==========\n${d.content}\n========== FIM DO DOC: [${d.title}] ==========\n`).join("\n")}` 
        : "";
      const impDatesPrompt =
        importantDates && importantDates.length > 0
          ? `\n\n[DATAS IMPORTANTES (Professor/a)]:\nEstas são anotações de datas cruciais do professor (que atualizam sua contagem regressiva):\n` +
            importantDates
              .map(
                (d) =>
                  `- ${d.nome}: ${d.data}` +
                  ((d as any).dataFim ? ` até ${(d as any).dataFim}` : ""),
              )
              .join("\n")
          : "";

      const schedPrompt = schedule && Object.values(schedule).some((day: any) => day && day.length > 0)
        ? `\n\n[GRADE DE HORÁRIOS - SEU ACESSO É TOTAL E EXCLUSIVO A ISSO]:\nO professor JÁ CADASTROU a sua grade de horários diários com você. Você AGORA TEM ACESSO a ela. NUNCA diga que não tem acesso.\nA grade atual de aulas é:\n` +
          `Segunda-feira: ${schedule[1]?.join(", ") || "Nenhuma"}\n` +
          `Terça-feira: ${schedule[2]?.join(", ") || "Nenhuma"}\n` +
          `Quarta-feira: ${schedule[3]?.join(", ") || "Nenhuma"}\n` +
          `Quinta-feira: ${schedule[4]?.join(", ") || "Nenhuma"}\n` +
          `Sexta-feira: ${schedule[5]?.join(", ") || "Nenhuma"}\n` +
          `Aja como se você naturalmente soubesse dessa grade. Mapeie quais dias o professor dá aula para cada turma baseado nesta lista.`
        : "";

      const responseStream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction:
            basePrompt + impDatesPrompt + curPrompt + modPrompt + jarvisDocsPrompt + schedPrompt,
          tools: [
            {
              functionDeclarations: [
                {
                  name: "addReminder",
                  description:
                    "Adiciona um novo lembrete ou tarefa para o usuário. Use quando o usuário pedir para lembrá-lo de algo.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      task: {
                        type: Type.STRING,
                        description:
                          "A descrição do lembrete a ser salvo. Seja conciso e direto.",
                      },
                    },
                    required: ["task"],
                  },
                },
                {
                  name: "addEvaluation",
                  description: "Adiciona uma data importante ou avaliação no painel (contagem regressiva).",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      nome: {
                        type: Type.STRING,
                        description: "O nome da avaliação ou evento (ex: 'Prova Bimestral 6°A')."
                      },
                      data: {
                        type: Type.STRING,
                        description: "A data da avaliação no formato YYYY-MM-DD."
                      }
                    },
                    required: ["nome", "data"]
                  }
                },
                {
                  name: "manageMatificWeeks",
                  description: "Adiciona, edita ou exclui semanas ao controle do Matific de uma turma.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      turma: {
                        type: Type.STRING,
                        description: "Nome da turma (Ex: '6°B - Matemática')."
                      },
                      action: {
                        type: Type.STRING,
                        description: "'add', 'edit' ou 'delete'."
                      },
                      semanas: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "Nomes das semanas. Para 'add': novas semanas (ex: ['11 a 15 de maio']). Para 'delete': nome exato ou aproximado das semanas a deletar. Para 'edit': no formato 'antigo|novo' (ex: '11 a 15 de maio|12 a 16 de maio')."
                      }
                    },
                    required: ["turma", "action", "semanas"],
                  }
                }
              ],
            },
          ],
        },
      });

      let fullResponse = "";
      setActiveStreamingMessage("");
      let functionCalled = false;

      for await (const chunk of responseStream) {
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          const call = chunk.functionCalls[0];
          if (call.name === "addReminder") {
            const args = call.args as { task: string };
            const nextRems = [...reminders, args.task];
            setReminders(nextRems);
            updateFirestoreReminders(nextRems);

            setChatMessages((prev) => [
              ...prev,
              {
                role: "bot",
                text: `Entendido. Adicionado o lembrete: "${args.task}" à sua agenda pessoal, senhor.`,
              },
            ]);
            functionCalled = true;
            break;
          } else if (call.name === "addEvaluation") {
            const args = call.args as { nome: string; data: string };
            const newDateEntry = {
              id: Date.now().toString(),
              nome: args.nome,
              data: args.data,
            };
            const nextDates = [...importantDates, newDateEntry];
            setImportantDates(nextDates);
            updateFirestoreImportantDates(nextDates);

            setChatMessages((prev) => [
              ...prev,
              {
                role: "bot",
                text: `Adicionado: "${args.nome}" para a data ${args.data}. A contagem regressiva no painel já está atualizada, senhor.`,
              },
            ]);
            functionCalled = true;
            break;
          } else if (call.name === "manageMatificWeeks") {
            const args = call.args as { turma: string, action: string, semanas: string[] };
            const { turma, action, semanas } = args;
            
            // Lógica para controle Matific
            let classData = { students: [], weeks: [], minutes: {} };
            
            const localDataStr = localStorage.getItem(`matificAnalysis_${turma}`);
            if (localDataStr) {
               classData = JSON.parse(localDataStr);
            }

            let responseMsg = "";

            if (action === "add") {
              const newWeeks = semanas.map((title, i) => ({
                id: `jarvis-${Date.now()}-${i}`,
                title: title,
                date: new Date().toLocaleDateString('pt-BR')
              }));
              classData.weeks = [...(classData.weeks || []), ...newWeeks];

              if(classData.students && Array.isArray(classData.students)) {
                 classData.students.forEach((s: any) => {
                    if(!classData.minutes) classData.minutes = {};
                    if(!classData.minutes[s.id]) classData.minutes[s.id] = {};
                    newWeeks.forEach(nw => {
                       classData.minutes[s.id][nw.id] = null;
                    });
                 });
              }
              responseMsg = `Pronto! Adicionei a(s) semana(s) solicitada(s) ao controle do Matific da turma ${turma}, como solicitado.`;
            } else if (action === "edit") {
              semanas.forEach(s => {
                const [oldTitle, newTitle] = s.split("|").map(x => x?.trim());
                if(oldTitle && newTitle && classData.weeks) {
                  const weekIdx = classData.weeks.findIndex((w: any) => w.title.toLowerCase().includes(oldTitle.toLowerCase()));
                  if (weekIdx !== -1) {
                    classData.weeks[weekIdx].title = newTitle;
                  }
                }
              });
              responseMsg = `Entendido! Alerei a(s) semana(s) no controle do Matific da turma ${turma}.`;
            } else if (action === "delete") {
              semanas.forEach(s => {
                if(classData.weeks) {
                  const weekIdx = classData.weeks.findIndex((w: any) => w.title.toLowerCase().includes(s.toLowerCase()));
                  if (weekIdx !== -1) {
                    const weekId = classData.weeks[weekIdx].id;
                    classData.weeks.splice(weekIdx, 1);
                    if (classData.minutes) {
                      Object.keys(classData.minutes).forEach(studentId => {
                        delete classData.minutes[studentId][weekId];
                      });
                    }
                  }
                }
              });
              responseMsg = `As semanas foram removidas do controle do Matific da turma ${turma}.`;
            }

            localStorage.setItem(`matificAnalysis_${turma}`, JSON.stringify(classData));

            if (user) {
               getDoc(doc(db, "users", user.uid, "matificAnalysis", turma)).then(snap => {
                  let fbData = snap.exists() ? snap.data() : { students: [], weeks: [], minutes: {} };
                  if (action === "add") {
                    const newWeeks = semanas.map((title, i) => ({
                      id: `jarvis-${Date.now()}-${i}`,
                      title: title,
                      date: new Date().toLocaleDateString('pt-BR')
                    }));
                    fbData.weeks = [...(fbData.weeks || []), ...newWeeks];
                    if(fbData.students && Array.isArray(fbData.students)) {
                       fbData.students.forEach((s: any) => {
                          if(!fbData.minutes) fbData.minutes = {};
                          if(!fbData.minutes[s.id]) fbData.minutes[s.id] = {};
                          newWeeks.forEach(nw => {
                             fbData.minutes[s.id][nw.id] = null;
                          });
                       });
                    }
                  } else {
                     // simplified update for edit/delete; just copy from local because they are in sync
                     fbData = classData;
                  }
                  
                  setDoc(doc(db, "users", user.uid, "matificAnalysis", turma), fbData).catch(console.error);
               }).catch(console.error);
            }

            setChatMessages((prev) => [
              ...prev,
              {
                role: "bot",
                text: responseMsg,
              },
            ]);
            functionCalled = true;
            break;
          }
        }
        if (chunk.text) {
          fullResponse += chunk.text;
          setActiveStreamingMessage(fullResponse);
        }
      }

      setActiveStreamingMessage(null);
      if (!functionCalled) {
        const responseText =
          fullResponse ||
          "Desculpe, tive um problema ao tentar processar sua mensagem. Pode reformular?";
        setChatMessages((prev) => [
          ...prev,
          { role: "bot", text: responseText },
        ]);
      }
    } catch (error) {
      console.error(error);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: "Oops, houve um erro ao conectar com minha rede neural. Tente novamente em instantes.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const removeReminder = (index: number) => {
    const nextRems = reminders.filter((_, i) => i !== index);
    setReminders(nextRems);
    updateFirestoreReminders(nextRems);
  };

  const handleNewChat = () => {
    setCurrentChatId(Date.now().toString());
    setChatMessages([
      {
        role: "bot",
        text: `Olá, ${user?.displayName?.split(" ")[0] || "educador"}! Eu sou Jarvis 🤖, processando no Gemini. No que posso te ajudar hoje com sua rotina, planos e metodologias?`,
      },
    ]);
  };

  const loadHistoryChat = (id: string) => {
    const historyItem = chatHistory.find((h) => h.id === id);
    if (historyItem) {
      setCurrentChatId(id);
      setChatMessages(historyItem.messages);
      setIsHistoryOpen(false);
    }
  };

  const handleOpenEmail = async (email: any) => {
    setSelectedEmail(email);
    setEmailContent(null);
    setIsEmailLoading(true);
    const content = await getEmailBody(email.id);
    setEmailContent(content);
    setIsEmailLoading(false);
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
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 mb-2">
            Olá, Professor {user?.displayName?.split(" ")[0] || ""}!
          </h1>
          <p className="text-indigo-600 font-semibold text-lg">
            {getSmartPhrase()}
          </p>
          <p className="text-slate-500 text-sm mt-1">
            {now.toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          {nextProva && (
            <div className="mt-4 inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-bold border border-blue-100">
              {isHappeningNow
                ? `🚀 Está acontecendo: ${nextProva.nome}!`
                : `🎯 Faltam ${diffP} dias para: ${nextProva.nome}`}
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
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
              Jarvis Observou
            </span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
          </div>
          <div className="text-slate-700 font-medium text-sm max-w-4xl space-y-2">
            {currentTurma ? (
              logForCurrentTurma ? (
                <div className="flex flex-col gap-1.5">
                  <p>
                    Professor, de acordo com o meu banco de dados sua próxima aula será no{" "}
                    <strong className="text-indigo-700">{currentTurma}</strong>.
                  </p>
                  <p className="text-slate-600 bg-white/50 p-3 rounded-xl border border-indigo-100/50">
                    Na última aula (<strong className="text-slate-800">{logForCurrentTurma.data}</strong>) vocês trabalharam:{" "}
                    <span className="italic text-slate-800">"{logForCurrentTurma.progresso}"</span>
                  </p>
                  {logForCurrentTurma.lembretes && (
                    <p className="text-amber-700 font-semibold bg-amber-50 px-3 py-2 rounded-lg mt-1 w-fit border border-amber-200">
                      📝 Lembrete da época: {logForCurrentTurma.lembretes}
                    </p>
                  )}
                  <button onClick={() => setCurrentView?.("diario")} className="text-indigo-600 hover:text-indigo-800 mt-1 uppercase text-[10px] font-bold tracking-wider hover:underline text-left w-fit transition-colors">
                    Ir para o Registro de Aulas &rarr;
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <p>
                    Vi que você está no{" "}
                    <strong className="text-indigo-700">{currentTurma}</strong>{" "}
                    agora, porém busquei nas aulas trabalhadas e não encontrei
                    registros no seu{" "}
                    <strong className="text-indigo-700">Registro de Aulas</strong>{" "}
                    para essa turma.
                  </p>
                  <button onClick={() => setCurrentView?.("diario")} className="text-indigo-600 hover:text-indigo-800 uppercase text-[10px] font-bold tracking-wider hover:underline text-left w-fit transition-colors">
                    Registrar uma Aula Agora &rarr;
                  </button>
                </div>
              )
            ) : latestLog ? (
              <p>
                No momento você não tem uma aula ativa na agenda ou está em seu
                horário de estudos. Aproveite para planejar seus próximos
                passos! Posso sugerir atividades ou exercícios com base no seu
                registro mais recente com o{" "}
                <strong className="text-indigo-700">{latestLog.turma}</strong>{" "}
                sobre{" "}
                <strong className="text-indigo-700">
                  {latestLog.progresso}
                </strong>
                .
              </p>
            ) : (
              <p>
                No momento você não tem uma aula ativa na agenda ou está em seu
                horário de estudos. Como ainda não encontrei registros no seu{" "}
                <strong className="text-indigo-700">Registro de Aulas</strong>,
                que tal aproveitar para se organizar, preparar novas aulas ou
                corrigir avaliações?
              </p>
            )}

            {isClassEndingSoon && (
              <p className="text-orange-700 bg-orange-100 border border-orange-200 px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center">
                ⚠️ A aula logo vai acabar. Não esqueça de fazer a chamada e o
                registro na Sala do Futuro!
              </p>
            )}
          </div>
        </div>
        <div className="relative z-10 shrink-0 w-full md:w-auto mt-2 md:mt-0">
          <button
            onClick={() => {
              const prompt =
                currentTurma && logForCurrentTurma
                  ? `Gere uma revisão rápida sobre o conteúdo: "${logForCurrentTurma.progresso}" que trabalhei com a turma ${currentTurma} na última aula.`
                  : latestLog
                    ? `Estou em um momento de estudo/planejamento. Me dê sugestões de atividades, dinâmicas e exercícios baseados no conteúdo "${latestLog.progresso}" que trabalhei recentemente com a turma ${latestLog.turma}.`
                    : "Estou em um momento de estudo/planejamento. Me dê sugestões de como organizar minha semana e preparar minhas próximas aulas de forma criativa.";
              setChatInput(prompt);
              document
                .getElementById("chat-section")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
            className="w-full md:w-auto bg-white text-indigo-600 border border-indigo-200 px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-colors shadow-sm whitespace-nowrap flex items-center justify-center gap-2"
          >
            <Sparkles size={14} />{" "}
            {currentTurma && logForCurrentTurma
              ? "Sugerir Revisão"
              : latestLog
                ? "Sugerir Atividades"
                : "Planejar Aulas"}
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
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  user ? "bg-emerald-400 animate-pulse" : "bg-red-400",
                )}
              />
              {user ? "Sincronizado" : "Status Agenda"}
            </div>

            {!user ? (
              <>
                <h2 className="text-2xl lg:text-3xl font-bold tracking-tight mb-3">
                  Sincronize sua agenda do Google
                </h2>
                <div className="flex items-center gap-2 text-indigo-50 font-medium text-sm mb-4">
                  <ArrowRight size={16} />{" "}
                  <span>
                    Integre sua conta para ver suas próximas aulas e eventos.
                  </span>
                </div>
                <button
                  onClick={loginWithGoogle}
                  className="self-start bg-white text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-slate-50 transition-colors"
                >
                  Conectar Agora
                </button>
              </>
            ) : calendarApiError ? (
              <div className="text-red-200 mt-2 font-medium text-sm">
                <p>⚠️ {calendarApiError}</p>
              </div>
            ) : isCalendarLoading ? (
              <div className="text-indigo-100 font-medium flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Carregando seus
                próximos eventos...
              </div>
            ) : (
              (() => {
                const currentEvents = calendarEvents.filter((ev) => {
                  const s = ev.start?.dateTime
                    ? new Date(ev.start.dateTime)
                    : ev.start?.date
                      ? new Date(ev.start.date)
                      : new Date();
                  const e = ev.end?.dateTime
                    ? new Date(ev.end.dateTime)
                    : ev.end?.date
                      ? new Date(ev.end.date)
                      : new Date();
                  return now >= s && now <= e;
                });
                const futureEvents = calendarEvents.filter((ev) => {
                  const s = ev.start?.dateTime
                    ? new Date(ev.start.dateTime)
                    : ev.start?.date
                      ? new Date(ev.start.date)
                      : new Date();
                  return s > now;
                });

                const currentEvent = currentEvents[0];
                const nextEvent = futureEvents[0];

                if (!currentEvent && !nextEvent) {
                  return (
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight mb-3">
                        Agenda Livre!
                      </h2>
                      <p className="text-indigo-100 text-sm">
                        Não há eventos marcados para os próximos dias no
                        momento.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="flex flex-col md:flex-row gap-4 w-full">
                    {currentEvent && (
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-2">
                          <h2 className="text-lg lg:text-xl font-bold tracking-tight text-emerald-100">
                            Agora
                          </h2>
                          {setCurrentView && (
                            <button
                              onClick={() => {
                                localStorage.setItem(
                                  "nav_class_journal_turma",
                                  currentEvent.summary || "",
                                );
                                setCurrentView("diario");
                              }}
                              className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                            >
                              <BookOpen size={14} /> Registrar Aula
                            </button>
                          )}
                        </div>
                        <div className="bg-white/10 rounded-xl p-4 border border-emerald-400/30 backdrop-blur-md">
                          <h3 className="font-bold text-lg mb-1 truncate">
                            {currentEvent.summary || "Evento"}
                          </h3>
                          <p className="text-indigo-100 text-sm flex items-center gap-2">
                            <CalendarClock size={14} />
                            {currentEvent.end?.dateTime
                              ? `Até as ${new Date(currentEvent.end.dateTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                              : "O dia todo"}
                          </p>
                        </div>
                      </div>
                    )}
                    {nextEvent && (
                      <div className="flex-1">
                        <h2 className="text-lg lg:text-xl font-bold tracking-tight mb-2">
                          A Seguir
                        </h2>
                        <div className="bg-white/10 rounded-xl p-4 border border-white/20 backdrop-blur-md">
                          <h3 className="font-bold text-lg mb-1 truncate">
                            {nextEvent.summary || "Evento"}
                          </h3>
                          <p className="text-indigo-100 text-sm flex items-center gap-2">
                            <CalendarClock size={14} />
                            {nextEvent.start?.dateTime
                              ? new Date(
                                  nextEvent.start.dateTime,
                                ).toLocaleString("pt-BR", {
                                  weekday: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "O dia todo"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        </div>

        {/* Prova Paulista Monitor - SHRUNK */}
        <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 flex flex-col justify-center items-center shadow-sm text-center">
          <div className="text-[10px] font-bold text-amber-800/60 uppercase tracking-widest mb-3">
            Monitor de Eventos
          </div>
          <div className="flex items-center justify-center gap-4">
            <div className="w-14 h-14 shrink-0 bg-amber-500 text-white rounded-2xl flex items-center justify-center text-xl font-black shadow-md shadow-amber-500/30">
              {isHappeningNow ? "🚀" : diffP >= 0 ? diffP : "--"}
            </div>
            <div className="text-left">
              <h3 className="text-base font-bold text-amber-900 leading-tight">
                {nextProva ? nextProva.nome : "Sem eventos"}
              </h3>
              <p className="text-amber-700/80 text-xs mt-1 font-medium">
                {nextProva
                  ? isHappeningNow
                    ? (nextProva as any).dataFim
                      ? `Até ${new Date((nextProva as any).dataFim + "T00:00:00").toLocaleDateString("pt-BR")}`
                      : `Acontecendo hoje!`
                    : `Inicia em ${new Date(nextProva.data + "T00:00:00").toLocaleDateString("pt-BR")}`
                  : "Calendário livre"}
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
              <h2 className="font-bold tracking-tight">
                Caixa de Entrada (Gmail Edu)
              </h2>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
            {!user ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <Mail size={32} className="text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-500">
                  Conecte sua conta do Google para ler seus e-mails do Gmail Edu
                  diretamente aqui.
                </p>
                <button
                  onClick={loginWithGoogle}
                  className="mt-3 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50"
                >
                  Conectar Contas
                </button>
              </div>
            ) : emailsApiError ? (
              <div className="text-center p-4 text-red-600 text-sm font-medium">
                {"⚠️ " + emailsApiError}
              </div>
            ) : isEmailsLoading ? (
              <div className="flex items-center justify-center h-full text-slate-500">
                <Loader2 size={24} className="animate-spin mb-2" />
              </div>
            ) : emails.length > 0 ? (
              emails.map((msg, i) => (
                <div
                  key={msg.id || i}
                  onClick={() => handleOpenEmail(msg)}
                  className={`flex gap-4 p-3 rounded-2xl border transition-colors group cursor-pointer ${i === 0 ? "bg-red-50/50 border-red-100 hover:bg-red-50" : "bg-white border-slate-100 hover:bg-slate-50"}`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${i === 0 ? "bg-red-200 text-red-700" : "bg-slate-200 text-slate-700"}`}
                  >
                    {msg.from ? msg.from.charAt(0).toUpperCase() : "M"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span
                        className={`font-bold text-sm truncate ${i === 0 ? "text-slate-800" : "text-slate-700"}`}
                      >
                        {msg.from}
                      </span>
                      <span
                        className={`text-[10px] font-bold shrink-0 ${i === 0 ? "text-red-600" : "text-slate-400"}`}
                      >
                        {msg.date.toLocaleDateString("pt-BR", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                    <p
                      className={`text-sm truncate ${i === 0 ? "font-bold text-slate-700" : "text-slate-700"}`}
                    >
                      {msg.subject}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {msg.snippet
                        ?.replace(/&#39;/g, "'")
                        .replace(/&quot;/g, '"') || ""}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center p-4 text-slate-500 text-sm">
                Nenhum e-mail recente encontrado. Verifique sua conexão ou se a
                sua conta tem a permissão de leitura de email ativa.
              </div>
            )}
          </div>
        </div>

        {/* Sistemas de Apoio */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col h-auto lg:h-[340px]">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
            Sistemas de Apoio
          </div>
          <div className="grid grid-cols-2 gap-3 flex-1">
            <a
              href="https://saladofuturo.educacao.sp.gov.br/"
              target="_blank"
              rel="noopener noreferrer"
              title="Sala do Futuro"
              className="flex items-center justify-center p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50 transition-all group aspect-[2/1]"
            >
              <img src="/sala-do-futuro.png" alt="Sala do Futuro" className="max-h-12 w-auto object-contain filter grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
            </a>
            <a
              href="https://avaefape.educacao.sp.gov.br/"
              target="_blank"
              rel="noopener noreferrer"
              title="AVA / Leia SP"
              className="flex items-center justify-center p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50 transition-all group aspect-[2/1]"
            >
              <img src="/leia-sp.png" alt="Leia SP" className="max-h-12 w-auto object-contain filter grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
            </a>
            <a
              href="https://cmspweb.ip.tv/"
              target="_blank"
              rel="noopener noreferrer"
              title="Tarefas SP / CMSP"
              className="flex items-center justify-center p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50 transition-all group aspect-[2/1]"
            >
              <img src="/tarefas-sp.png" alt="Tarefas SP" className="max-h-12 w-auto object-contain filter grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
            </a>
            <a
              href="https://drive.google.com/drive/u/6/folders/1TOmNSpH-rAAR-yBB67QwEPX6isJsXKf1"
              target="_blank"
              rel="noopener noreferrer"
              title="Meu Google Drive"
              className="flex items-center justify-center p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50 transition-all group aspect-[2/1]"
            >
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" 
                alt="Google Drive" 
                className="max-h-12 w-auto object-contain filter grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all" 
              />
            </a>
          </div>
        </div>

        {/* News Feed - Categorias */}
        <div className="lg:col-span-3 flex flex-col h-auto lg:h-[400px]">
          <NewsCarousel />
        </div>

        {/* Chat Assistant (Jarvis) */}
        <div
          id="chat-section"
          className="lg:col-span-3 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col relative"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <BotMessageSquare size={16} className="text-indigo-500" /> Jarvis
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsHistoryOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <History size={14} />
                <span className="hidden sm:inline">Histórico</span>
              </button>
              <button
                onClick={handleNewChat}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
              >
                <MessageSquarePlus size={14} />
                <span className="hidden sm:inline">Nova Conversa</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:h-[450px] h-auto">
            {/* Chat Area */}
            <div className="flex-1 flex flex-col bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden h-96 md:h-full">
              <div
                ref={scrollRef}
                className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin"
              >
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                      msg.role === "bot"
                        ? "bg-white border border-slate-200 text-slate-700 self-start rounded-tl-sm whitespace-pre-wrap"
                        : "bg-indigo-600 text-white self-end ml-auto rounded-tr-sm whitespace-pre-wrap",
                    )}
                  >
                    {msg.text}
                  </div>
                ))}
                {isTyping && activeStreamingMessage === null && (
                  <div className="bg-white border border-slate-200 text-slate-500 self-start rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <Loader2
                      size={16}
                      className="animate-spin text-indigo-500"
                    />
                    <span className="text-xs font-medium">Pensando...</span>
                  </div>
                )}
                {activeStreamingMessage !== null && (
                  <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm bg-white border border-slate-200 text-slate-700 self-start rounded-tl-sm whitespace-pre-wrap">
                    {activeStreamingMessage}
                    <span className="ml-1 inline-block w-1.5 h-4 bg-indigo-400 animate-pulse align-middle" />
                  </div>
                )}
              </div>
              <form
                onSubmit={handleChat}
                className="p-3 bg-white border-t border-slate-100 flex gap-2 items-end"
              >
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleChat(e);
                    }
                  }}
                  disabled={isTyping}
                  placeholder="Ex: Como engajar alunos no 2º ano?"
                  rows={2}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50 resize-none min-h-[44px]"
                />
                <button
                  type="submit"
                  disabled={isTyping}
                  className="bg-slate-900 text-white p-3 rounded-xl hover:bg-slate-800 transition-colors shrink-0 disabled:opacity-50 h-[44px] flex items-center justify-center"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>

            <div className="flex justify-start">
              <button
                type="button"
                onClick={handleEfapeToggle}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-sm font-bold border transition-colors",
                  efapeDone
                    ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                {efapeDone ? "Fiz a EFAPE! ✅" : "Marcar EFAPE como concluída"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* History Slide-over */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
            onClick={() => setIsHistoryOpen(false)}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-full max-w-sm bg-white h-full shadow-2xl relative flex flex-col border-l border-slate-200"
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <History size={18} className="text-indigo-600" /> Histórico de
                Conversas
              </h3>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatHistory.length === 0 ? (
                <div className="text-center text-slate-400 text-sm mt-10">
                  <MessageSquarePlus
                    size={32}
                    className="mx-auto mb-3 opacity-20"
                  />
                  Nenhuma conversa salva ainda.
                </div>
              ) : (
                chatHistory.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => loadHistoryChat(h.id)}
                    className="w-full text-left p-4 rounded-2xl border border-slate-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group shadow-sm hover:shadow-md"
                  >
                    <div className="text-xs font-bold text-slate-400 mb-1 group-hover:text-indigo-500">
                      {new Date(h.date).toLocaleDateString()}{" "}
                      {new Date(h.date).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div className="text-sm text-slate-700 font-medium line-clamp-2 leading-tight">
                      {h.preview}
                    </div>
                    <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                      <BotMessageSquare size={12} /> {h.messages.length}{" "}
                      mensagens
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Email Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSelectedEmail(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col relative overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-slate-100 bg-slate-50 shrink-0">
              <div className="pr-10">
                <h2 className="text-xl font-bold text-slate-800 leading-tight mb-2">
                  {selectedEmail.subject}
                </h2>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-700">
                      {selectedEmail.from}
                    </span>
                  </div>
                  <span>
                    {new Date(selectedEmail.date).toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmail(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors absolute top-6 right-6"
              >
                <X size={24} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-white min-h-[300px] relative">
              {isEmailLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3">
                  <Loader2 size={32} className="animate-spin text-indigo-500" />
                  <span className="text-sm font-medium">
                    Carregando conteúdo do e-mail...
                  </span>
                </div>
              ) : emailContent ? (
                <div
                  dangerouslySetInnerHTML={{ __html: emailContent }}
                  className="prose prose-slate max-w-none text-sm break-words"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                  <Mail size={32} className="opacity-20" />
                  <p className="text-sm">
                    Não foi possível carregar o conteúdo deste e-mail.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
              <button
                onClick={() => {
                  window.open(
                    `https://mail.google.com/mail/u/0/#inbox/${selectedEmail.id}`,
                    "_blank",
                  );
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 font-bold text-sm rounded-xl transition-colors"
              >
                <ArrowRight size={16} /> Abrir no Gmail
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Floating Reminders Widget */}
      <div ref={lembretesRef} className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
        <AnimatePresence>
          {isLembretesOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="bg-white border text-left border-slate-200 shadow-xl rounded-2xl w-80 mb-4 overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-slate-100 bg-amber-50 relative flex items-center gap-2">
                <BellRing size={18} className="text-amber-500" />
                <h4 className="font-bold text-slate-800">Seus Lembretes</h4>
                <button
                  onClick={() => setIsLembretesOpen(false)}
                  className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-4 max-h-[300px] overflow-y-auto scrollbar-thin bg-slate-50">
                {reminders.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    Nenhum lembrete ativo no momento.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {reminders.map((rem, i) => (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        key={i}
                        className="bg-amber-100 p-3 rounded-xl text-slate-800 shadow-sm border border-amber-200"
                      >
                        <div className="flex justify-between items-start gap-2">
                           <span className="leading-snug block text-sm font-medium flex-1">{rem}</span>
                           <div className="flex gap-1 shrink-0">
                               <button
                                 type="button"
                                 onClick={() => removeReminder(i)}
                                 className="text-amber-600 hover:text-emerald-600 hover:bg-white rounded-full p-1.5 transition-all"
                                 title="Marcar como concluído"
                               >
                                 <CheckCircle2 size={16} />
                               </button>
                               <button
                                 type="button"
                                 onClick={() => {
                                   setReminderToDelete(i);
                                   setIsDeleteModalOpen(true);
                                 }}
                                 className="text-amber-600 hover:text-red-600 hover:bg-white rounded-full p-1.5 transition-all"
                                 title="Apagar lembrete"
                               >
                                 <Trash2 size={16} />
                               </button>
                           </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsLembretesOpen(!isLembretesOpen)}
          className="bg-amber-400 hover:bg-amber-500 text-amber-950 p-4 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center justify-center relative"
        >
          <BellRing size={24} />
          {reminders.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm border-2 border-white">
              {reminders.length}
            </span>
          )}
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && reminderToDelete !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setReminderToDelete(null);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl p-6 shadow-2xl relative w-full max-w-sm border border-slate-200 z-10"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4 mx-auto">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 text-center mb-2">Excluir Lembrete</h3>
              <p className="text-slate-500 text-center text-sm mb-6">
                Tem certeza que deseja excluir este lembrete permanentemente?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setReminderToDelete(null);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeReminder(reminderToDelete);
                    setIsDeleteModalOpen(false);
                    setReminderToDelete(null);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
