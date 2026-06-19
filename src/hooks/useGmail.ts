import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

export function useGmail() {
  const { user, accessToken, clearGoogleSession } = useAuth();
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
      setIsLoading(true);
      setApiError(null);
      try {
        // Fetch recent messages
        const resList = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&labelIds=INBOX`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );

        if (resList.status === 401) {
          clearGoogleSession("Sessão do Google expirada. Por favor, desconecte e faça login novamente para reconectar o Gmail.");
          setApiError(
            "Sessão do Google expirada. Por favor, desconecte e faça login novamente para reconectar o Gmail.",
          );
          return;
        }

        if (resList.status === 403 || resList.status === 429) {
          const errData = await resList.json().catch(() => null);
          let errMsg = errData?.error?.message || "";
          
          if (errMsg.includes("Rate exceeded") || resList.status === 429) {
            errMsg = "O limite de acessos da API do Gmail foi atingido (Muitas requisições num curto período). Aguarde alguns minutos antes de tentar novamente.";
          } else if (!errMsg) {
            errMsg = "Permissão negada ou API não ativada. Ao fazer login, marque a caixa de permissão do Gmail.";
          }
          setApiError(errMsg);
          return;
        }

        const dataList = await resList.json();

        if (dataList.messages) {
          const detailPromises = dataList.messages.map((m: any) =>
            fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              },
            )
              .then((r) => r.json())
              .catch((err) => null), // Catch individual errors to prevent Unhandled Rejection
          );
          const details = await Promise.all(detailPromises);

          const formattedMessages = details
            .filter((d) => d !== null)
            .map((d) => {
            const subjectHeader = d.payload?.headers?.find(
              (h: any) => h.name === "Subject",
            );
            const fromHeader = d.payload?.headers?.find(
              (h: any) => h.name === "From",
            );

            let fromName = fromHeader?.value || "Desconhecido";
            if (fromName.includes("<")) {
              fromName = fromName.split("<")[0].trim();
            }

            return {
              id: d.id,
              snippet: d.snippet,
              subject: subjectHeader?.value || "Sem assunto",
              from: fromName,
              date: new Date(parseInt(d.internalDate)),
            };
          });

          setMessages(formattedMessages);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [user, accessToken, clearGoogleSession]);

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
