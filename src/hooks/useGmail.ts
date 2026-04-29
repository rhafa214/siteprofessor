import { useState, useEffect } from 'react';
import { useGoogleAuth } from '../contexts/GoogleAuthContext';

export function useGmail() {
  const { isConnected, accessToken, logout, setAuthError } = useGoogleAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isConnected || !accessToken) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setIsLoading(true);
      try {
        // Fetch recent messages
        const resList = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&labelIds=INBOX`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (resList.status === 401) {
          logout();
          setAuthError('Sessão expirada. Por favor, conecte novamente.');
          return;
        }

        const dataList = await resList.json();
        
        if (dataList.messages) {
          const detailPromises = dataList.messages.map((m: any) => 
            fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`, {
              headers: { Authorization: `Bearer ${accessToken}` }
            }).then(r => r.json())
          );
          const details = await Promise.all(detailPromises);
          
          const formattedMessages = details.map(d => {
            const subjectHeader = d.payload?.headers?.find((h: any) => h.name === 'Subject');
            const fromHeader = d.payload?.headers?.find((h: any) => h.name === 'From');
            
            let fromName = fromHeader?.value || 'Desconhecido';
            if (fromName.includes('<')) {
              fromName = fromName.split('<')[0].trim();
            }

            return {
              id: d.id,
              snippet: d.snippet,
              subject: subjectHeader?.value || 'Sem assunto',
              from: fromName,
              date: new Date(parseInt(d.internalDate))
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
  }, [isConnected, accessToken, logout, setAuthError]);

  return { messages, isLoading };
}
