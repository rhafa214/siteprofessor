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
  Clock,
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
import { useAppStore } from "../store/useAppStore";

import { getGeminiClient } from "../lib/gemini";

function getAI() {
  return getGeminiClient();
}

interface DashboardProps {
  // Not used anymore as we fetch from store
}

export default function Dashboard(props: DashboardProps) {
  const { setCurrentView } = useAppStore();
  const { user, loginWithGoogle } = useAuth();
  const { curriculum, schoolModel, jarvisDocs, schedule } =
    useJarvisKnowledge();
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
      text:
        new Date().getHours() >= 18 || new Date().getHours() < 6
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lembretesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        lembretesRef.current &&
        !lembretesRef.current.contains(event.target as Node)
      ) {
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
    if (chatMessages.length > 1 && !isTyping) {
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
  }, [chatMessages, currentChatId, setChatHistory, isTyping]);

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

  const updateFirestoreImportantDates = (
    newDates: { id: string; nome: string; data: string; dataFim?: string }[],
  ) => {
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
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 150);
    return () => clearTimeout(timer);
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

  const sortedClassLogs = classLogs
    ? [...classLogs].sort((a, b) => b.id - a.id)
    : [];

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
      const jarvisDocsPrompt =
        jarvisDocs && jarvisDocs.length > 0
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

      const schedPrompt =
        schedule &&
        Object.values(schedule).some((day: any) => day && day.length > 0)
          ? `\n\n[GRADE DE HORÁRIOS - SEU ACESSO É TOTAL E EXCLUSIVO A ISSO]:\nO professor JÁ CADASTROU a sua grade de horários diários com você. Você AGORA TEM ACESSO a ela. NUNCA diga que não tem acesso.\nA grade atual de aulas é:\n` +
            `Segunda-feira: ${schedule[1]?.join(", ") || "Nenhuma"}\n` +
            `Terça-feira: ${schedule[2]?.join(", ") || "Nenhuma"}\n` +
            `Quarta-feira: ${schedule[3]?.join(", ") || "Nenhuma"}\n` +
            `Quinta-feira: ${schedule[4]?.join(", ") || "Nenhuma"}\n` +
            `Sexta-feira: ${schedule[5]?.join(", ") || "Nenhuma"}\n` +
            `Aja como se você naturalmente soubesse dessa grade. Mapeie quais dias o professor dá aula para cada turma baseado nesta lista.`
          : "";

      const responseStream = await ai.models.generateContentStream({
        model: "gemini-2.0-flash",
        contents,
        config: {
          systemInstruction:
            basePrompt +
            impDatesPrompt +
            curPrompt +
            modPrompt +
            jarvisDocsPrompt +
            schedPrompt,
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
                  description:
                    "Adiciona uma data importante ou avaliação no painel (contagem regressiva).",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      nome: {
                        type: Type.STRING,
                        description:
                          "O nome da avaliação ou evento (ex: 'Prova Bimestral 6°A').",
                      },
                      data: {
                        type: Type.STRING,
                        description:
                          "A data da avaliação no formato YYYY-MM-DD.",
                      },
                    },
                    required: ["nome", "data"],
                  },
                },
                {
                  name: "manageMatificWeeks",
                  description:
                    "Adiciona, edita ou exclui semanas ao controle do Matific de uma turma.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      turma: {
                        type: Type.STRING,
                        description: "Nome da turma (Ex: '6°B - Matemática').",
                      },
                      action: {
                        type: Type.STRING,
                        description: "'add', 'edit' ou 'delete'.",
                      },
                      semanas: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description:
                          "Nomes das semanas. Para 'add': novas semanas (ex: ['11 a 15 de maio']). Para 'delete': nome exato ou aproximado das semanas a deletar. Para 'edit': no formato 'antigo|novo' (ex: '11 a 15 de maio|12 a 16 de maio').",
                      },
                    },
                    required: ["turma", "action", "semanas"],
                  },
                },
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
            const args = call.args as {
              turma: string;
              action: string;
              semanas: string[];
            };
            const { turma, action, semanas } = args;

            // Lógica para controle Matific
            let classData = { students: [], weeks: [], minutes: {} };

            const localDataStr = localStorage.getItem(
              `matificAnalysis_${turma}`,
            );
            if (localDataStr) {
              classData = JSON.parse(localDataStr);
            }

            let responseMsg = "";

            if (action === "add") {
              const newWeeks = semanas.map((title, i) => ({
                id: `jarvis-${Date.now()}-${i}`,
                title: title,
                date: new Date().toLocaleDateString("pt-BR"),
              }));
              classData.weeks = [...(classData.weeks || []), ...newWeeks];

              if (classData.students && Array.isArray(classData.students)) {
                classData.students.forEach((s: any) => {
                  if (!classData.minutes) classData.minutes = {};
                  if (!classData.minutes[s.id]) classData.minutes[s.id] = {};
                  newWeeks.forEach((nw) => {
                    classData.minutes[s.id][nw.id] = null;
                  });
                });
              }
              responseMsg = `Pronto! Adicionei a(s) semana(s) solicitada(s) ao controle do Matific da turma ${turma}, como solicitado.`;
            } else if (action === "edit") {
              semanas.forEach((s) => {
                const [oldTitle, newTitle] = s.split("|").map((x) => x?.trim());
                if (oldTitle && newTitle && classData.weeks) {
                  const weekIdx = classData.weeks.findIndex((w: any) =>
                    w.title.toLowerCase().includes(oldTitle.toLowerCase()),
                  );
                  if (weekIdx !== -1) {
                    classData.weeks[weekIdx].title = newTitle;
                  }
                }
              });
              responseMsg = `Entendido! Alerei a(s) semana(s) no controle do Matific da turma ${turma}.`;
            } else if (action === "delete") {
              semanas.forEach((s) => {
                if (classData.weeks) {
                  const weekIdx = classData.weeks.findIndex((w: any) =>
                    w.title.toLowerCase().includes(s.toLowerCase()),
                  );
                  if (weekIdx !== -1) {
                    const weekId = classData.weeks[weekIdx].id;
                    classData.weeks.splice(weekIdx, 1);
                    if (classData.minutes) {
                      Object.keys(classData.minutes).forEach((studentId) => {
                        delete classData.minutes[studentId][weekId];
                      });
                    }
                  }
                }
              });
              responseMsg = `As semanas foram removidas do controle do Matific da turma ${turma}.`;
            }

            localStorage.setItem(
              `matificAnalysis_${turma}`,
              JSON.stringify(classData),
            );

            if (user) {
              getDoc(doc(db, "users", user.uid, "matificAnalysis", turma))
                .then((snap) => {
                  let fbData = snap.exists()
                    ? snap.data()
                    : { students: [], weeks: [], minutes: {} };
                  if (action === "add") {
                    const newWeeks = semanas.map((title, i) => ({
                      id: `jarvis-${Date.now()}-${i}`,
                      title: title,
                      date: new Date().toLocaleDateString("pt-BR"),
                    }));
                    fbData.weeks = [...(fbData.weeks || []), ...newWeeks];
                    if (fbData.students && Array.isArray(fbData.students)) {
                      fbData.students.forEach((s: any) => {
                        if (!fbData.minutes) fbData.minutes = {};
                        if (!fbData.minutes[s.id]) fbData.minutes[s.id] = {};
                        newWeeks.forEach((nw) => {
                          fbData.minutes[s.id][nw.id] = null;
                        });
                      });
                    }
                  } else {
                    // simplified update for edit/delete; just copy from local because they are in sync
                    fbData = classData;
                  }

                  setDoc(
                    doc(db, "users", user.uid, "matificAnalysis", turma),
                    fbData,
                  ).catch(console.error);
                })
                .catch(console.error);
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
    } catch (error: any) {
      console.error(error);
      let errorMsg = error?.message || "Tente novamente em instantes.";
      if (errorMsg.includes("Rate exceeded") || errorMsg.includes("429")) {
        errorMsg = "Uau, limitei! Tivemos muitos acessos seguidos na nossa rede neural. Por favor, aguarde só uns minutinhos e me chame de novo!";
      } else if (errorMsg.includes("API Key missing")) {
        errorMsg = "A Chave da API (Gemini) não está configurada no servidor.";
      }
      
      setChatMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: `Oops, houve um erro ao conectar com minha rede neural. Detalhe: ${errorMsg}`,
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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 lg:pb-8 border-b border-slate-200/60 relative">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-500/5 blur-3xl rounded-full pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-2 bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-800 bg-clip-text text-transparent flex items-center gap-2">
            Olá,{" "}
            <span className="font-medium text-slate-400 text-2xl lg:text-3xl">
              Professor
            </span>{" "}
            {user?.displayName?.split(" ")[0] || "!"}{" "}
            <span className="animate-wave inline-block origin-[70%_70%]">
              👋
            </span>
          </h1>
          <p className="text-indigo-600 font-bold text-lg flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" /> {getSmartPhrase()}
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

        <div className="w-full md:w-72 bg-gradient-to-b from-white to-slate-50/50 p-5 rounded-2xl border border-slate-200/60 shadow-sm relative z-10">
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
            <span className="flex items-center gap-1.5">
              <Clock size={12} /> Jornada Diária
            </span>
            <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              {progress}%
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full transition-all duration-1000 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Google Sync Status */}
        <div className="lg:col-span-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 lg:p-8 text-white flex flex-col relative overflow-hidden shadow-lg min-h-[160px]">
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
                        Nenhum compromisso próximo
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
        <div className="bg-gradient-to-b from-white to-slate-50/30 border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col h-full w-full">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
            <FolderTree size={14} className="text-slate-300" /> Navegação Rápida
          </div>
          <div className="grid grid-cols-2 gap-4 w-full flex-1">
            <a
              href="https://saladofuturo.educacao.sp.gov.br/"
              target="_blank"
              rel="noopener noreferrer"
              title="Sala do Futuro"
              className="group flex flex-col items-center justify-center gap-3 p-4 shrink-0 rounded-2xl border border-slate-200 bg-white hover:border-indigo-400 hover:shadow-lg hover:-translate-y-1 transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100 group-hover:bg-indigo-100 transition-colors">
                <img
                  src="https://saladofuturo.educacao.sp.gov.br/images/logo.png"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.nextElementSibling?.classList.remove(
                      "hidden",
                    );
                  }}
                  alt="Sala do Futuro"
                  className="h-6 w-auto drop-shadow-sm group-hover:scale-110 transition-transform"
                />
                <span className="hidden text-sm font-black tracking-tighter text-indigo-600">
                  SF
                </span>
              </div>
              <span className="font-semibold text-sm text-slate-700 group-hover:text-indigo-700 text-center transition-colors">
                Sala do Futuro
              </span>
            </a>

            <a
              href="https://avaefape.educacao.sp.gov.br/"
              target="_blank"
              rel="noopener noreferrer"
              title="AVA / Leia SP"
              className="group flex flex-col items-center justify-center gap-3 p-4 shrink-0 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-lg hover:-translate-y-1 transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 group-hover:bg-blue-100 transition-colors">
                <span className="font-black text-xs tracking-tighter text-blue-700 group-hover:scale-110 transition-transform">
                  EFAPE
                </span>
              </div>
              <span className="font-semibold text-sm text-slate-700 group-hover:text-blue-700 text-center transition-colors">
                AVA EFAPE
              </span>
            </a>

            <a
              href="https://app.teachy.com.br/"
              target="_blank"
              rel="noopener noreferrer"
              title="Plataforma Teachy"
              className="group flex flex-col items-center justify-center gap-3 p-4 shrink-0 rounded-2xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-lg hover:-translate-y-1 transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100 group-hover:bg-amber-100 transition-colors">
                <span className="font-black text-xl text-amber-500 group-hover:scale-110 transition-transform italic">
                  t
                </span>
              </div>
              <span className="font-semibold text-sm text-slate-700 group-hover:text-amber-700 text-center transition-colors">
                Teachy
              </span>
            </a>

            <a
              href="https://drive.google.com/drive/u/6/folders/1TOmNSpH-rAAR-yBB67QwEPX6isJsXKf1"
              target="_blank"
              rel="noopener noreferrer"
              title="Meu Google Drive"
              className="group flex flex-col items-center justify-center gap-3 p-4 shrink-0 rounded-2xl border border-slate-200 bg-white hover:border-emerald-400 hover:shadow-lg hover:-translate-y-1 transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100 group-hover:bg-emerald-100 transition-colors">
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg"
                  alt="Google Drive"
                  className="w-6 h-6 group-hover:scale-110 transition-transform"
                />
              </div>
              <span className="font-semibold text-sm text-slate-700 group-hover:text-emerald-700 text-center transition-colors">
                Google Drive
              </span>
            </a>
          </div>
        </div>

        {/* News Feed - Categorias */}
        <div className="lg:col-span-3 flex flex-col h-auto lg:h-[400px]">
          <NewsCarousel />
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
      <AnimatePresence>
        {selectedEmail && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
              onClick={() => setSelectedEmail(null)}
            />
            <motion.div
              initial={{ x: "100%", opacity: 0.5 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0.5 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-white shadow-[0_0_40px_-10px_rgba(0,0,0,0.1)] w-full max-w-3xl flex flex-col relative z-10 h-full border-l border-slate-200"
            >
              {/* Header */}
              <div className="flex items-start justify-between p-8 border-b border-slate-100 bg-white shrink-0 relative z-10">
                <div className="pr-10">
                  <h2 className="text-3xl font-extrabold text-slate-900 leading-tight mb-4 font-serif">
                    {selectedEmail.subject}
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg border border-indigo-200 shrink-0">
                      {selectedEmail.from.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 text-base">
                        {selectedEmail.from}
                      </span>
                      <span className="text-xs font-medium text-slate-400">
                        {new Date(selectedEmail.date).toLocaleString("pt-BR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all absolute top-8 right-8"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-8 lg:p-12 bg-white relative">
                {isEmailLoading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-4">
                    <Loader2
                      size={40}
                      className="animate-spin text-indigo-500"
                    />
                    <span className="text-sm font-medium tracking-wide">
                      Carregando mensagem...
                    </span>
                  </div>
                ) : emailContent ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: emailContent }}
                    className="prose prose-slate prose-lg max-w-none break-words
                      prose-a:text-indigo-600 hover:prose-a:text-indigo-800
                      prose-p:leading-relaxed prose-p:text-slate-700
                      prose-headings:font-bold prose-headings:text-slate-900"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                    <Mail size={40} className="opacity-20" />
                    <p className="text-base font-medium">
                      Não foi possível carregar o conteúdo deste e-mail.
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                <span className="text-xs text-slate-400 font-medium">
                  {selectedEmail.snippet?.substring(0, 50)}...
                </span>
                <button
                  onClick={() => {
                    window.open(
                      `https://mail.google.com/mail/u/0/#inbox/${selectedEmail.id}`,
                      "_blank",
                    );
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                >
                  Responder no Gmail <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Floating Reminders Widget */}
      <div
        ref={lembretesRef}
        className="fixed bottom-24 right-6 z-40 flex flex-col items-end print:hidden"
      >
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
                          <span className="leading-snug block text-sm font-medium flex-1">
                            {rem}
                          </span>
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
              <h3 className="text-xl font-bold text-slate-800 text-center mb-2">
                Excluir Lembrete
              </h3>
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
