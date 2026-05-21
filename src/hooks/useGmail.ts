import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

export function useGmail() {
  const { user, accessToken, logout } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !accessToken) {
      setMessages([]);
      setApiError(null);
      return;
    }

    const fetchMessages = async () => {
      setIsLoading(false);
      setMessages([]);
      return;
    };

    fetchMessages();
  }, [user, accessToken, logout]);

  const getEmailBody = async (messageId: string) => {
    if (!accessToken) return null;
    try {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const data = await res.json();

      let bodyText = "";

      const getBody = (payload: any) => {
        if (!payload) return;
        if (payload.parts) {
          for (const part of payload.parts) {
            if (part.mimeType === "text/html") {
              bodyText = part.body?.data || "";
              return;
            } else if (part.mimeType === "text/plain" && !bodyText) {
              bodyText = part.body?.data || "";
            } else if (part.parts) {
              getBody(part);
            }
          }
        } else if (payload.body?.data) {
          bodyText = payload.body.data;
        }
      };

      getBody(data.payload);

      if (bodyText) {
        // Base64Url decode
        const base64 = bodyText.replace(/-/g, "+").replace(/_/g, "/");
        const decoded = decodeURIComponent(escape(atob(base64)));
        return decoded;
      }
      return data.snippet;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  return { messages, isLoading, apiError, getEmailBody };
}
