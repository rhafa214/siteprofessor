import { GoogleGenAI } from "@google/genai";
import { authenticatedFetch } from "./apiClient";

let aiClient: GoogleGenAI | null = null;

// Remova chaves antigas expostas
try {
  window.localStorage.removeItem("userGeminiKey");
} catch (e) {
  // Ignora
}

export function getGeminiClient() {
  try {
    if (!aiClient) {
      // Use proxy on the backend so API keys are not exposed
      aiClient = new GoogleGenAI({
        apiKey: "proxy", // dummy key
        fetch: authenticatedFetch,
        httpOptions: {
          baseUrl: window.location.origin + "/api/gemini-proxy",
        }
      } as any);
    }
  } catch (e) {
    console.error("Error initializing Gemini client", e);
  }
  
  return aiClient!;
}
