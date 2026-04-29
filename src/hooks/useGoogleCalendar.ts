import { useState, useEffect } from 'react';
import { useGoogleAuth } from '../contexts/GoogleAuthContext';

export function useGoogleCalendar() {
  const { isConnected, accessToken, logout, setAuthError } = useGoogleAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isConnected || !accessToken) {
      setEvents([]);
      return;
    }

    const fetchEvents = async () => {
      setIsLoading(true);
      try {
        const start = new Date();
        start.setHours(0,0,0,0);
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
        
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}&orderBy=startTime&singleEvents=true`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (res.status === 401) {
          logout();
          setAuthError('Sessão expirada. Por favor, conecte novamente.');
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
  }, [isConnected, accessToken, logout, setAuthError]);

  return { events, isLoading };
}
