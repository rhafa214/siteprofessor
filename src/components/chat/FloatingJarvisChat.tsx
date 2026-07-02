import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BotMessageSquare,
  Send,
  Loader2,
  History,
  MessageSquarePlus,
  Trash2,
  X,
  MessageCircle
} from "lucide-react";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { cn } from "../../lib/utils";
import { GoogleGenAI, Type } from "@google/genai";
import { useAuth } from "../../contexts/AuthContext";
import { getGeminiClient } from "../../lib/gemini";
import { useJarvisKnowledge } from "../../hooks/useJarvisKnowledge";

export default function FloatingJarvisChat() {
  const { user } = useAuth();
  const { curriculum, schoolModel, jarvisDocs } = useJarvisKnowledge();

  const [isOpen, setIsOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeStreamingMessage, setActiveStreamingMessage] = useState<string | null>(null);
  
  const [currentChatId, setCurrentChatId] = useLocalStorage<string>(
    "eduCurrentChatId",
    Date.now().toString(),
  );

  const [chatMessages, setChatMessages] = useLocalStorage<
    { role: "user" | "bot"; text: string }[]
  >("eduChatCurrent", []);

  const [chatHistory, setChatHistory] = useLocalStorage<
    {
      id: string;
      date: string;
      preview: string;
      messages: { role: "user" | "bot"; text: string }[];
    }[]
  >("eduChatHistory", []);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user && chatMessages.length === 0) {
      const currentHour = new Date().getHours();
      const userName = user.displayName?.split(" ")[0] || "educador";
      let greetingDesc = `Olá, ${userName}! Eu sou Jarvis 🤖, seu assistente inteligente. No que posso te ajudar hoje com sua rotina, planos e metodologias?`;

      if (currentHour >= 18 || currentHour < 6) {
        greetingDesc = `Fazendo hora extra, professor ${userName}?! Hora de descansar, hein! Mas já que estamos aqui... No que posso te ajudar com essa rotina maluca?`;
      }

      setChatMessages([
        {
          role: "bot",
          text: greetingDesc,
        },
      ]);
    }
  }, [user, chatMessages.length, setChatMessages]);

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
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      const timer = setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [chatMessages, isTyping, activeStreamingMessage, isOpen]);

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isTyping) return;

    const userMessage = chatInput.trim();
    setChatMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setChatInput("");
    setIsTyping(true);

    try {
      const contents = chatMessages.map((msg) => ({
        role: msg.role === "bot" ? "model" : "user",
        parts: [{ text: msg.text }],
      }));
      contents.push({ role: "user", parts: [{ text: userMessage }] });

      const ai = getGeminiClient();
      if (!ai) {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "bot",
            text: "Erro: Cliente Gemini não configurado.",
          },
        ]);
        setIsTyping(false);
        return;
      }

      const parts = [
        "Você é Jarvis, um assistente educacional simpático e eficiente, estilo Jarvis do Tony Stark, mas focado na pedagogia. Você ajuda professores a criar planos de aula, metodologias ativas e dar ideias criativas para engajamento.",
      ];
      if (schoolModel) {
        parts.push(`Modelo da escola: ${schoolModel}`);
      }
      if (curriculum) {
        parts.push(`Currículo ou detalhes do modelo: ${curriculum}`);
      }
      if (jarvisDocs && jarvisDocs.length > 0) {
        parts.push(
          "Você possui os seguintes documentos de apoio (" +
            jarvisDocs.length +
            " documentos fornecidos pelo usuário) baseados na Base de Conhecimento do usuário:",
        );
        jarvisDocs.forEach((d) => {
          parts.push(`--- INÍCIO DO DOC: ${d.title} ---`);
          parts.push(d.content);
          parts.push(`--- FIM DO DOC: ${d.title} ---`);
        });
      }
      parts.push("Responda sempre em um tom profissional, amigável e focado.");

      const responseStream = await ai.models.generateContentStream({
        model: "gemini-2.0-flash",
        contents,
        config: {
          systemInstruction: { parts: parts.map(p => ({ text: p })) },
        },
      });

      let fullText = "";
      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullText += chunk.text;
          setActiveStreamingMessage(fullText);
        }
      }

      setChatMessages((prev) => [...prev, { role: "bot", text: fullText }]);
      setActiveStreamingMessage(null);
    } catch (err: any) {
      console.error(err);
      let errorMsg = "Ops! Tive um problema ao processar sua resposta. Verifique a chave de API ou tente novamente.";
      const errString = String(err?.message || err) + " " + JSON.stringify(err);
      if (errString.includes("429") || errString.includes("Quota") || errString.includes("RESOURCE_EXHAUSTED")) {
        errorMsg = "Uau, o limite gratuito do servidor foi atingido (Erro 429 / Quota Exceeded). Aguarde um pouquinho ou adicione sua própria Chave API nas configurações.";
      } else if (errString.includes("503") || errString.includes("UNAVAILABLE")) {
        errorMsg = "A IA está com alta demanda no momento (Erro 503). Por favor, tente novamente em alguns instantes.";
      }
      setChatMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: errorMsg,
        },
      ]);
      setActiveStreamingMessage(null);
    } finally {
      setIsTyping(false);
    }
  };

  const handleNewChat = () => {
    setCurrentChatId(Date.now().toString());
    const userName = user?.displayName?.split(" ")[0] || "educador";
    setChatMessages([
      {
        role: "bot",
        text: `Nova conversa iniciada! Olá de novo, ${userName}. Em que posso ajudar agora?`,
      },
    ]);
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChatHistory((prev) => prev.filter((h) => h.id !== id));
    if (currentChatId === id) {
      handleNewChat();
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-40 p-4 rounded-full shadow-2xl transition-transform hover:scale-110",
          "bg-indigo-600 text-white flex items-center justify-center print:hidden",
          isOpen ? "scale-0" : "scale-100"
        )}
      >
        <BotMessageSquare size={28} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[400px] h-[600px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] flex flex-col bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden print:hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-3 text-slate-800">
                <div className="bg-indigo-100 p-2 text-indigo-600 rounded-xl">
                  <BotMessageSquare size={20} />
                </div>
                <div>
                  <h3 className="font-bold tracking-tight leading-tight">Jarvis</h3>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Assistente IA</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                  title="Histórico"
                >
                  <History size={18} />
                </button>
                <button
                  onClick={handleNewChat}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="Nova Conversa"
                >
                  <MessageSquarePlus size={18} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
                  title="Fechar"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden relative flex">
              {/* Main Chat Area */}
              <div className={cn("flex-1 flex flex-col w-full h-full transition-transform", isHistoryOpen ? "translate-x-[-100%]" : "translate-x-0")}>
                <div
                  ref={scrollRef}
                  className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin bg-white"
                >
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                        msg.role === "bot"
                          ? "bg-slate-50 border border-slate-200 text-slate-800 self-start rounded-tl-sm whitespace-pre-wrap"
                          : "bg-indigo-600 shadow-sm text-white self-end ml-auto rounded-tr-sm whitespace-pre-wrap",
                      )}
                    >
                      {msg.text}
                    </div>
                  ))}
                  {isTyping && activeStreamingMessage === null && (
                    <div className="bg-slate-50 border border-slate-200 text-slate-500 self-start rounded-2xl rounded-tl-sm px-4 py-2.5 flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin text-indigo-500" />
                      <span className="text-xs font-medium">Pensando...</span>
                    </div>
                  )}
                  {activeStreamingMessage !== null && (
                    <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-slate-50 border border-slate-200 text-slate-800 self-start rounded-tl-sm whitespace-pre-wrap">
                      {activeStreamingMessage}
                      <span className="ml-1 inline-block w-1.5 h-4 bg-indigo-400 animate-pulse align-middle" />
                    </div>
                  )}
                  <div ref={messagesEndRef} className="h-1" />
                </div>
                
                <form
                  onSubmit={handleChat}
                  className="p-3 bg-white border-t border-slate-100 flex gap-2 items-end shrink-0"
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
                    placeholder="Mensagem para o Jarvis..."
                    rows={1}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50 resize-none min-h-[44px] max-h-[120px]"
                  />
                  <button
                    type="submit"
                    disabled={isTyping}
                    className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-colors shrink-0 disabled:opacity-50 shadow-sm flex items-center justify-center h-[44px] w-[44px]"
                  >
                    <Send size={18} />
                  </button>
                </form>
              </div>

              {/* History View (Slide in from right) */}
              <div className={cn(
                  "absolute inset-0 bg-slate-50 flex flex-col transition-transform duration-300",
                  isHistoryOpen ? "translate-x-0" : "translate-x-full"
                )}>
                <div className="p-4 border-b border-slate-200 bg-white flex items-center gap-2 text-slate-800 font-bold shrink-0">
                  <History size={18} className="text-slate-500" />
                  Histórico
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {chatHistory.length === 0 ? (
                    <div className="text-center text-slate-500 mt-6 text-sm">
                      Nenhum histórico.
                    </div>
                  ) : (
                    chatHistory.map((h) => (
                      <div
                        key={h.id}
                        onClick={() => {
                          setCurrentChatId(h.id);
                          setChatMessages(h.messages);
                          setIsHistoryOpen(false);
                        }}
                        className={cn(
                          "p-3 rounded-xl border text-sm cursor-pointer transition-colors relative group",
                          currentChatId === h.id
                            ? "bg-indigo-50 border-indigo-200"
                            : "bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200",
                        )}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-slate-700 text-xs">
                            {new Date(h.date).toLocaleDateString()}
                          </span>
                          <button
                            onClick={(e) => deleteHistoryItem(h.id, e)}
                            className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-colors opacity-0 md:opacity-100 md:group-hover:opacity-100 md:invisible group-hover:visible"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <p className="text-slate-500 line-clamp-2 leading-snug text-xs">
                          {h.preview}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
