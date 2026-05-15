import React, { useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  isDestructive = true,
}: ConfirmModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onConfirm, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl ring-1 ring-slate-900/5 relative"
            >
              {/* Header */}
              <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                      isDestructive
                        ? "bg-rose-50 text-rose-500"
                        : "bg-indigo-50 text-indigo-500"
                    }`}
                  >
                    <AlertTriangle size={20} strokeWidth={2.5} />
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg tracking-tight">
                    {title}
                  </h3>
                </div>
                <button
                  onClick={onCancel}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6">
                <p className="text-slate-600 leading-relaxed font-medium">
                  {message}
                </p>
              </div>

              {/* Footer */}
              <div className="px-6 py-5 bg-slate-50 flex flex-col-reverse sm:flex-row justify-end gap-3 rounded-b-3xl border-t border-slate-100">
                <button
                  onClick={onCancel}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 transition-colors focus:ring-4 focus:ring-slate-100 outline-none w-full sm:w-auto"
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors focus:ring-4 outline-none w-full sm:w-auto ${
                    isDestructive
                      ? "bg-rose-500 text-white hover:bg-rose-600 focus:ring-rose-500/20"
                      : "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-600/20"
                  }`}
                >
                  {confirmText}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
