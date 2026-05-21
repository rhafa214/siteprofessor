import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

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
      setIsLoading(false);
      setEvents([]);
      return;
    };

    fetchEvents();
  }, [user, accessToken, logout]);

  return { events, isLoading, apiError };
}
