import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { GoogleAuthProvider } from './contexts/GoogleAuthContext';
import { AuthProvider } from './contexts/AuthContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <GoogleAuthProvider>
        <App />
      </GoogleAuthProvider>
    </AuthProvider>
  </StrictMode>,
);
