import React, { createContext, useContext, useState, ReactNode } from "react";
import AlertModal from "../components/AlertModal";

interface AlertOptions {
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  buttonText?: string;
}

interface AlertContextType {
  showAlert: (options: AlertOptions | string, title?: string, type?: "info" | "success" | "warning" | "error") => Promise<void>;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<AlertOptions | null>(null);
  const [resolvePromise, setResolvePromise] = useState<() => void>();

  const showAlert = (opts: AlertOptions | string, title?: string, type?: "info" | "success" | "warning" | "error") => {
    let finalOpts: AlertOptions;
    if (typeof opts === "string") {
      finalOpts = { message: opts, title: title || "Aviso", type: type || "info" };
    } else {
      finalOpts = opts;
    }
    setOptions(finalOpts);
    setIsOpen(true);
    return new Promise<void>((resolve) => {
      setResolvePromise(() => resolve);
    });
  };

  const handleClose = () => {
    if (resolvePromise) resolvePromise();
    setIsOpen(false);
    
    // To allow back-to-back alerts, maybe a slight timeout before clearing options 
    // is needed if keeping it in DOM. But simple close is usually fine.
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      {options && (
        <AlertModal
          isOpen={isOpen}
          title={options.title || "Aviso"}
          message={options.message}
          type={options.type || "info"}
          buttonText={options.buttonText || "OK"}
          onClose={handleClose}
        />
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
}
