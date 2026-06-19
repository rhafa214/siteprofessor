import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
export function getGeminiClient() {
  try {
    const userKeyRaw = window.localStorage.getItem("userGeminiKey");
    let userKey = "";
    if (userKeyRaw) {
      try {
        userKey = JSON.parse(userKeyRaw);
      } catch {
        userKey = userKeyRaw;
      }
    }

    if (userKey && userKey.trim().length > 10) {
      return new GoogleGenAI({ apiKey: userKey.trim() });
    }

    if (!aiClient) {
      // Use proxy on the backend so API keys are not exposed
      aiClient = new GoogleGenAI({ 
        apiKey: "proxy", // dummy key 
        httpOptions: {
          baseUrl: window.location.origin + "/api/gemini-proxy"
        }
      });
    }
  } catch (e) {
    console.error("Error initializing Gemini", e);
  }
  return aiClient!;
}
