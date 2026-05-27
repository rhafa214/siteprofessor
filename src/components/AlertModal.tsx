import React, { useEffect } from "react";
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  onClose: () => void;
  buttonText?: string;
}

export default function AlertModal({
  isOpen,
  title,
  message,
  type = "info",
  onClose,
  buttonText = "OK",
}: AlertModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const Icon = () => {
    switch (type) {
      case "success":
        return <CheckCircle size={28} strokeWidth={2.5} />;
      case "error":
        return <AlertCircle size={28} strokeWidth={2.5} />;
      case "warning":
        return <AlertTriangle size={28} strokeWidth={2.5} />;
      default:
        return <Info size={28} strokeWidth={2.5} />;
    }
  };

  const iconStyle = () => {
    switch (type) {
      case "success":
        return "bg-emerald-50 text-emerald-500 shadow-emerald-100";
      case "error":
        return "bg-rose-50 text-rose-500 shadow-rose-100";
      case "warning":
        return "bg-amber-50 text-amber-500 shadow-amber-100";
      default:
        return "bg-blue-50 text-blue-500 shadow-blue-100";
    }
  };

  const buttonStyle = () => {
    switch (type) {
      case "success":
        return "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500/20";
      case "error":
        return "bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500/20";
      case "warning":
        return "bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500/20";
      default:
        return "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500/20";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6"
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
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>

              <div className="px-6 pt-10 pb-8 flex flex-col items-center">
                <div
                  className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-5 shadow-lg ${iconStyle()}`}
                >
                  <Icon />
                </div>
                <h3 className="font-bold text-slate-800 text-xl tracking-tight mb-2">
                  {title}
                </h3>
                <p className="text-slate-600 leading-relaxed font-medium">
                  {message}
                </p>
              </div>

              <div className="px-6 py-5 bg-slate-50 flex flex-col justify-end gap-3 rounded-b-3xl border-t border-slate-100">
                <button
                  onClick={onClose}
                  className={`px-6 py-3.5 rounded-xl text-[15px] font-bold shadow-sm transition-colors focus:ring-4 outline-none w-full ${buttonStyle()}`}
                >
                  {buttonText}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
