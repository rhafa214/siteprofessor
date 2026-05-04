import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function useGoogleCalendar() {
  const { user, accessToken, logout } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !accessToken) {
      setEvents([]);
      setApiError(null);
      return;
    }

    const fetchEvents = async () => {
      setIsLoading(true);
      setApiError(null);
      try {
        const start = new Date();
        start.setHours(0,0,0,0);
        start.setDate(start.getDate() - 30);
        const end = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days total

        
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}&orderBy=startTime&singleEvents=true`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (res.status === 401) {
          logout();
          console.error('Sessão expirada. Por favor, conecte novamente.');
          return;
        }

        if (res.status === 403) {
          const errData = await res.json().catch(() => null);
          const errMsg = errData?.error?.message || 'Permissão negada ou API não ativada. No momento do login, certifique-se de marcar a caixa de permissão para ler o Google Calendar (Agenda). Se você for o desenvolvedor, ative a Google Calendar API no Google Cloud Console.';
          setApiError(errMsg);
          return;
        }
        
        const data = await res.json();
        if (data.items) {
          setEvents(data.items);
        }
      } catch (error) {
         console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [user, accessToken, logout]);

  return { events, isLoading, apiError };
}
