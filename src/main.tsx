import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "./contexts/AuthContext";
import { ConfirmProvider } from "./contexts/ConfirmContext";
import { AlertProvider } from "./contexts/AlertContext";
import { PromptProvider } from "./contexts/PromptContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <AlertProvider>
        <PromptProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </PromptProvider>
      </AlertProvider>
    </AuthProvider>
  </StrictMode>,
);
