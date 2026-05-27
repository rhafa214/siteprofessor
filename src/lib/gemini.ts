import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
export function getGeminiClient() {
  if (!aiClient) {
    try {
      // Use proxy on the backend so API keys are not exposed
      aiClient = new GoogleGenAI({ 
        apiKey: "proxy", // dummy key 
        httpOptions: {
          baseUrl: window.location.origin + "/api/gemini-proxy"
        }
      });
    } catch (e) {
      console.error("Error initializing Gemini", e);
    }
  }
  return aiClient;
}
