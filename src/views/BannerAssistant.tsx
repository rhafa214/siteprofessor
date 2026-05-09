import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Paperclip, Loader2, X, BrainCircuit, FileText, Plus, MessageSquare, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getGeminiClient } from '../lib/gemini';
import Markdown from 'react-markdown';
import JSZip from 'jszip';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  files?: File[];
}

interface ChatSession {
  id: string;
  title: string;
  messages: Omit<Message, 'files'>[];
  updatedAt: number;
}

export default function BannerAssistant() {
  const [sessions, setSessions] = useLocalStorage<ChatSession[]>('banner_sessions', []);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const initialMessage: Message = {
    id: 'welcome',
    role: 'model',
    content: 'Olá! Sou o **Assistente Banner**, seu parceiro para planejamento de aulas. Você pode enviar slides (imagens ou PDFs) aqui e eu vou analisá-los, resumi-los e sugerir atividades engajadoras que você pode aplicar em sala de aula. Como posso ajudar hoje?'
  };

  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (currentSessionId) {
      const session = sessions.find(s => s.id === currentSessionId);
      if (session) {
        setMessages(session.messages);
      }
    } else {
      setMessages([initialMessage]);
    }
  }, [currentSessionId]);

  const saveSession = (newMessages: Message[]) => {
    const sessionIdToSave = currentSessionId || Date.now().toString();
    if (!currentSessionId) {
      setCurrentSessionId(sessionIdToSave);
    }
    
    // Create title from first user message
    const userMessages = newMessages.filter(m => m.role === 'user');
    const title = userMessages.length > 0 
      ? userMessages[0].content.slice(0, 30) + (userMessages[0].content.length > 30 ? '...' : '') 
      : 'Nova Conversa';

    const cleanMessages = newMessages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content
    }));

    setSessions(prev => {
      const existingIdx = prev.findIndex(s => s.id === sessionIdToSave);
      const newSession = {
        id: sessionIdToSave,
        title,
        messages: cleanMessages,
        updatedAt: Date.now()
      };
      
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = newSession;
        return updated.sort((a, b) => b.updatedAt - a.updatedAt);
      }
      return [newSession, ...prev].sort((a, b) => b.updatedAt - a.updatedAt);
    });
  };

  const createNewChat = () => {
    setCurrentSessionId(null);
    setMessages([initialMessage]);
    setInput('');
    setSelectedFiles([]);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      createNewChat();
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        let result = reader.result as string;
        // remove data:image/png;base64,
        const base64Str = result.split(',')[1];
        resolve(base64Str);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const extractTextFromPptx = async (file: File): Promise<string> => {
    try {
      const zip = new JSZip();
      const content = await zip.loadAsync(file);
      let text = '';
      
      const slideFiles = Object.keys(content.files).filter(name => 
        name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
      );

      // Extract slide numbers to sort properly (e.g. slide10 before slide2 if string sorted)
      slideFiles.sort((a, b) => {
         const numA = parseInt(a.replace(/\D/g, '') || '0');
         const numB = parseInt(b.replace(/\D/g, '') || '0');
         return numA - numB;
      });

      for (let i = 0; i < slideFiles.length; i++) {
         const xmlContent = await content.files[slideFiles[i]].async('text');
         // Extract text inside <a:t>...</a:t> tags
         const matches = xmlContent.match(/<a:t.*?>(.*?)<\/a:t>/g);
         if (matches) {
            const slideText = matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
            if (slideText.trim()) text += `\\n\\n--- Slide ${i + 1} ---\\n${slideText}`;
         }
      }
      return text || 'Nenhum texto encontrado no arquivo.';
    } catch (err) {
      console.error('Erro ao processar PPTX:', err);
      return 'Erro ao ler o conteúdo deste arquivo PPTX.';
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && selectedFiles.length === 0) || isLoading) return;

    const userMsgId = Date.now().toString();
    const newUserMsg: Message = {
      id: userMsgId,
      role: 'user',
      content: input,
      files: selectedFiles.length > 0 ? [...selectedFiles] : undefined
    };

    const updatedMessages1 = [...messages, newUserMsg];
    setMessages(updatedMessages1);
    saveSession(updatedMessages1);
    
    const currentMsgStr = input;
    const currentFiles = [...selectedFiles];
    
    setInput('');
    setSelectedFiles([]);
    setIsLoading(true);

    try {
      const parts: any[] = [];
      if (currentMsgStr.trim()) {
        parts.push({ text: currentMsgStr });
      }

      for (let file of currentFiles) {
        if (file.name.toLowerCase().endsWith('.pptx')) {
          const text = await extractTextFromPptx(file);
          parts.push({ text: `[Conteúdo extraído do PPTX: ${file.name}]\n${text}` });
        } else if (file.name.toLowerCase().endsWith('.ppt')) {
          parts.push({ text: `[Aviso: O arquivo ${file.name} está no formato antigo (.ppt), que não é suportado para leitura automática. Se possível, salve como .pptx ou envie um PDF.]` });
        } else {
          const base64Data = await fileToBase64(file);
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType: file.type
            }
          });
        }
      }

      if (parts.length === 0) {
        parts.push({ text: "Analise o arquivo anexado."}); // Fallback if user just sends file
      }

      const client = getGeminiClient();
      
      const contents = [
        ...messages.filter(m => m.id !== 'welcome').map(m => ({
          role: m.role,
          parts: [{ text: m.content }] // simple history tracking without files for now
        })),
        {
          role: 'user',
          parts: parts
        }
      ];

      const model = 'gemini-2.5-flash';
      // System instructions can't easily be appended if using simple contents array in some setups,
      // but we can prepend to the whole array or pass system param if available.
      // Let's just use regular contents array and prepend a system instruction as user/model if we want, or just rely on prompt.
      // It's a plane-jane prompt so it'll work.

      const response = await client.models.generateContent({
        model: model,
        contents: contents as any,
        systemInstruction: "Você é o Assistente Banner, um parceiro de planejamento de aulas para professores (inspirado em Bruce Banner, inteligente e analítico). Quando o professor enviar um slide de aula ou imagem, resuma os principais pontos, e dê no mínimo 3 sugestões criativas de atividades ou dinâmicas que podem ser aplicadas em sala de aula usando esse conteúdo. Seja didático, claro e prático."
      });

      const text = response.text || 'Não consegui gerar uma resposta.';
      
      const finalMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: text
      };
      const updatedMessages2 = [...updatedMessages1, finalMsg];
      setMessages(updatedMessages2);
      saveSession(updatedMessages2);

    } catch (error) {
      console.error("Erro no chat:", error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem ou analisar o arquivo. Tente novamente.'
      };
      const updatedMessages3 = [...updatedMessages1, errorMsg];
      setMessages(updatedMessages3);
      saveSession(updatedMessages3);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...files]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-slate-50 relative overflow-hidden rounded-2xl shadow-sm border border-slate-200">
      
      {/* Sidebar Histórico */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex shrink-0">
        <div className="p-4 border-b border-slate-200">
          <button 
            onClick={createNewChat}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-xl transition-colors text-sm font-medium shadow-sm"
          >
            <Plus size={18} />
            Novo Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2 mt-2">Histórico</div>
          {sessions.map(session => (
            <div 
              key={session.id}
              onClick={() => setCurrentSessionId(session.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors text-sm flex items-center justify-between group cursor-pointer ${
                currentSessionId === session.id 
                ? 'bg-indigo-50 text-indigo-700' 
                : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <MessageSquare size={16} className="shrink-0 opacity-70" />
                <span className="truncate">{session.title}</span>
              </div>
              <button 
                onClick={(e) => deleteSession(e, session.id)}
                className={`p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-white transition-opacity ${currentSessionId === session.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="px-3 text-slate-400 text-sm text-center mt-4">Nenhum chat salvo.</div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={createNewChat}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg mr-2"
            >
              <Plus size={20} />
            </button>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
              <div className="bg-emerald-100 p-1.5 md:p-2 rounded-xl text-emerald-600 hidden md:block">
                <Bot size={20} />
              </div>
              Assistente Banner
            </h1>
          </div>
          <div className="hidden md:block">
             <p className="text-slate-500 text-sm font-medium">Analise slides, resuma conteúdos e planeje suas aulas.</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          <div className="max-w-5xl mx-auto space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 md:gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 md:w-10 md:h-10 shrink-0 rounded-full flex items-center justify-center ${
                  message.role === 'user' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-emerald-100 text-emerald-600 border border-emerald-200'
                }`}>
                  {message.role === 'user' ? <div className="font-bold text-sm">P</div> : <Bot size={20} />}
                </div>

                <div className={`flex flex-col max-w-[85%] md:max-w-[75%] ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {message.files && message.files.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2 justify-end">
                      {message.files.map((file, i) => (
                        <div key={i} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm text-xs text-slate-600">
                          <FileText size={14} className="text-indigo-500" />
                          <span className="truncate max-w-[120px]">{file.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {message.content && (
                    <div className={`p-3 md:p-4 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                        : 'bg-white border border-slate-200 shadow-sm text-slate-700 rounded-tl-sm'
                    }`}>
                      {message.role === 'model' ? (
                        <div className="markdown-body prose prose-sm md:prose-base prose-slate max-w-none">
                          <Markdown>{message.content}</Markdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed max-w-full text-sm md:text-base">{message.content}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-4">
                <div className="w-8 h-8 md:w-10 md:h-10 shrink-0 rounded-full flex items-center justify-center bg-emerald-100 text-emerald-600 border border-emerald-200">
                  <Bot size={20} />
                </div>
                <div className="bg-white border border-slate-200 shadow-sm px-5 py-4 rounded-2xl rounded-tl-sm flex items-center gap-2 text-slate-500">
                  <Loader2 size={16} className="animate-spin text-emerald-500" />
                  <span className="text-sm font-medium animate-pulse">Analisando e gerando sugestões...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="bg-white border-t border-slate-200 p-3 md:p-4 shrink-0">
          <div className="max-w-5xl mx-auto">
            <AnimatePresence>
              {selectedFiles.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: 10, height: 0 }}
                  className="flex flex-wrap gap-2 mb-3"
                >
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100 text-sm">
                      <FileText size={14} />
                      <span className="max-w-[150px] truncate">{file.name}</span>
                      <button 
                        onClick={() => removeFile(index)} 
                        className="ml-1 p-0.5 hover:bg-indigo-200 rounded-md transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all shadow-sm">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 md:p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors shrink-0"
                title="Anexar Slide (PDF, PPTX ou Imagem)"
              >
                <Paperclip size={20} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                multiple 
                accept="image/*,application/pdf,.ppt,.pptx"
                onChange={handleFileChange}
              />
              
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Envie um slide ou escreva o assunto da aula..."
                className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-3 text-sm md:text-base scrollbar-thin overflow-y-auto"
                rows={input.split('\n').length > 1 ? Math.min(input.split('\n').length, 5) : 1}
              />

              <button 
                onClick={handleSend}
                disabled={(!input.trim() && selectedFiles.length === 0) || isLoading}
                className="p-2.5 md:p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shrink-0 shadow-sm self-end"
              >
                <Send size={18} />
              </button>
            </div>
            <div className="text-center mt-2 hidden md:block">
               <span className="text-[10px] md:text-xs text-slate-400 font-medium">O Assistente Banner pode analisar imagens, PDFs e apresentações PPTX para criar planejamentos de aula incríveis.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

