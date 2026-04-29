import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

declare const google: any;

interface AuthContextType {
  isConnected: boolean;
  accessToken: string | null;
  login: () => void;
  logout: () => void;
  authError: string | null;
  setAuthError: (error: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useLocalStorage('googleConnected', false);
  const [accessToken, setAccessToken] = useLocalStorage<string | null>('googleToken', null);
  const [authError, setAuthError] = useState<string | null>(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '946685977475-3irk02ul9n29jgm1atm7fteebu9dith0.apps.googleusercontent.com';

  const login = () => {
    if (typeof google === 'undefined') {
      setAuthError('O script do Google ainda não carregou. Tente novamente em alguns segundos.');
      return;
    }
    if (!clientId) {
      setAuthError('Client ID não configurado.');
      return;
    }

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.readonly',
        callback: (response: any) => {
          if (response.error !== undefined) {
             setAuthError('Erro na autenticação: ' + response.error);
             return;
          }
          setAccessToken(response.access_token);
          setIsConnected(true);
          setAuthError(null);
        },
      });
      client.requestAccessToken();
    } catch (err: any) {
      setAuthError('Erro inesperado: ' + err.message);
    }
  };

  const logout = () => {
    setIsConnected(false);
    setAccessToken(null);
    setAuthError(null);
  };

  return (
    <AuthContext.Provider value={{ isConnected, accessToken, login, logout, authError, setAuthError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useGoogleAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
  }
  return context;
}
