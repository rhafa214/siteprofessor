import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
export function getGeminiClient() {
  if (!aiClient) {
    const key =
      process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
    if (key) {
      try {
        aiClient = new GoogleGenAI({ apiKey: key });
      } catch (e) {
        console.error("Error initializing Gemini", e);
      }
    }
  }
  return aiClient;
}
