import { GoogleGenAI } from "@google/genai";

async function run() {
  const ai = new GoogleGenAI({
    apiKey: "dummy",
    httpOptions: {
      baseUrl: "http://localhost:3002/api/gemini-proxy"
    }
  });

  try {
    const text = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: "Hello"
    });
    console.log(text.text);
  } catch (e) {
    console.error("Failed:", e);
  }
}
run();
