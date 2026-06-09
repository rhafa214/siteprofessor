import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

export function useGoogleCalendar() {
  const { user, accessToken, clearGoogleSession } = useAuth();
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
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - 30);
        const end = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days total

        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}&orderBy=startTime&singleEvents=true`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );

        if (res.status === 401) {
          clearGoogleSession("Sessão do Google expirada. Por favor, conecte novamente.");
          setApiError(
            "Sessão do Google expirada. Por favor, conecte novamente.",
          );
          return;
        }

        if (res.status === 403 || res.status === 429) {
          const errData = await res.json().catch(() => null);
          let errMsg = errData?.error?.message || "";
          
          if (errMsg.includes("Rate exceeded") || res.status === 429) {
            errMsg = "O limite de acessos da API do Google Calendar foi atingido por excesso de consultas no momento. Aguarde alguns minutos e tente novamente.";
          } else if (!errMsg) {
             errMsg = "Permissão negada ou API não ativada. No momento do login, certifique-se de marcar a caixa de permissão para ler o Google Calendar (Agenda). Se você for o desenvolvedor, ative a Google Calendar API no Google Cloud Console.";
          }
          
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
  }, [user, accessToken, clearGoogleSession]);

  return { events, isLoading, apiError };
}
