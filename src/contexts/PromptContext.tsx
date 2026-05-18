import React, { createContext, useContext, useState, ReactNode, useRef, useEffect } from "react";
import { X, Edit2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface PromptOptions {
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
}

interface PromptContextType {
  prompt: (options: PromptOptions | string, defaultValue?: string) => Promise<string | null>;
}

const PromptContext = createContext<PromptContextType | undefined>(undefined);

export function PromptProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<PromptOptions | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [resolvePromise, setResolvePromise] = useState<(value: string | null) => void>();
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const prompt = (opts: PromptOptions | string, defaultValue?: string) => {
    let finalOpts: PromptOptions;
    if (typeof opts === "string") {
      finalOpts = { title: opts, defaultValue };
    } else {
      finalOpts = opts;
    }
    setOptions(finalOpts);
    setInputValue(finalOpts.defaultValue || "");
    setIsOpen(true);
    return new Promise<string | null>((resolve) => {
      setResolvePromise(() => resolve);
    });
  };

  const handleConfirm = () => {
    if (resolvePromise) resolvePromise(inputValue);
    setIsOpen(false);
  };

  const handleCancel = () => {
    if (resolvePromise) resolvePromise(null);
    setIsOpen(false);
  };

  return (
    <PromptContext.Provider value={{ prompt }}>
      {children}
      <AnimatePresence>
        {isOpen && options && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4 sm:p-6"
            onClick={handleCancel}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl ring-1 ring-slate-900/5 relative text-center"
            >
              <div className="absolute right-4 top-4">
                <button
                  onClick={handleCancel}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>

              <div className="px-6 pt-10 pb-6 flex flex-col items-center text-left items-start">
                <h3 className="font-bold text-slate-800 text-xl tracking-tight mb-2 w-full text-center">
                  {options.title}
                </h3>
                {options.message && (
                  <p className="text-slate-600 leading-relaxed font-medium mb-4 text-center w-full text-sm">
                    {options.message}
                  </p>
                )}
                
                <div className="w-full mt-4 flex items-center relative">
                    <Edit2 className="absolute left-3 text-slate-400" size={16} />
                    <input 
                      ref={inputRef}
                      type="text" 
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                          if (e.key === "Enter") handleConfirm();
                          if (e.key === "Escape") handleCancel();
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-[15px] focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-400 font-medium"
                      placeholder={options.placeholder || "Digite aqui..."}
                    />
                </div>
              </div>

              <div className="px-6 py-5 bg-slate-50 flex flex-col-reverse sm:flex-row justify-end gap-3 rounded-b-3xl border-t border-slate-100">
                <button
                  onClick={handleCancel}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 transition-colors focus:ring-4 focus:ring-slate-100 outline-none w-full sm:w-auto"
                >
                  {options.cancelText || "Cancelar"}
                </button>
                <button
                  onClick={handleConfirm}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors focus:ring-4 outline-none w-full sm:w-auto bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-600/20"
                >
                   {options.confirmText || "OK"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PromptContext.Provider>
  );
}

export function usePrompt() {
  const context = useContext(PromptContext);
  if (!context) {
    throw new Error("usePrompt must be used within a PromptProvider");
  }
  return context;
}
