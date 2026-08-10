import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { auth } from "../lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearGoogleSession: (errorMessage?: string) => void;
  accessToken: string | null;
  authError: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  loginWithGoogle: async () => {},
  logout: async () => {},
  clearGoogleSession: () => {},
  accessToken: null,
  authError: null,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Initialize accessToken from sessionStorage (temporarily during session)
  const [accessToken, setAccessTokenState] = useState<string | null>(() => {
    try {
      // Migrate/cleanup legacy local storage
      window.localStorage.removeItem("googleAuthToken");
      return window.sessionStorage.getItem("googleAuthSessionToken") || null;
    } catch {
      return null;
    }
  });

  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
    try {
      if (token) {
        window.sessionStorage.setItem("googleAuthSessionToken", token);
      } else {
        window.sessionStorage.removeItem("googleAuthSessionToken");
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // If user logs out elsewhere or session expires
      if (!currentUser) {
        setUser(null);
        setAccessToken(null);
      } else {
        setUser(currentUser);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setAccessToken]);

  const loginWithGoogle = useCallback(async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    // Requisitar os escopos necessários para Agenda, Drive e Email
    provider.addScope("https://www.googleapis.com/auth/calendar.readonly");
    provider.addScope("https://www.googleapis.com/auth/drive");
    provider.addScope("https://www.googleapis.com/auth/gmail.readonly");
    
    // Forçar a tela de consentimento para garantir que os escopos sejam solicitados
    provider.setCustomParameters({
      prompt: "consent",
    });

    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
      }
      setUser(result.user);
    } catch (error: any) {
      if (error.code !== "auth/popup-closed-by-user" && error.code !== "auth/cancelled-popup-request") {
        console.error("Error logging in with Google:", error);
        setAuthError("Erro na autenticação: " + error.message);
      }
    }
  }, [setAccessToken]);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      setAccessToken(null);
      setUser(null);
    } catch (error: any) {
      console.error("Error logging out:", error);
      setAuthError("Erro ao sair: " + error.message);
    }
  }, [setAccessToken]);

  const clearGoogleSession = useCallback((errorMessage?: string) => {
    setAccessToken(null);
    if (errorMessage) {
      setAuthError(errorMessage);
    }
    logout().catch(console.error);
  }, [setAccessToken, logout]);

  return (
    <AuthContext.Provider
      value={{ user, loading, loginWithGoogle, logout, clearGoogleSession, accessToken, authError }}
    >
      {children}
    </AuthContext.Provider>
  );
}
