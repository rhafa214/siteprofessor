import express from "express";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.post("/api/parse-curriculum", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor." });
    }

    const { ano = "6", bimestre = "1" } = req.body;
    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
    const base64EncodeString = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64EncodeString } },
          { text: `Extraia TODAS as aulas descritas no documento de Escopo-Sequência de Matemática. EXTRAIA EXCLUSIVAMENTE AS AULAS DO ${ano}º ANO do ${bimestre}º BIMESTRE. Ignore os outros anos ou bimestres. Mapeie todos os campos da tabela para o array JSON. Garanta que todas as aulas extraídas tenham ano=${ano} e bimestre=${bimestre}.` },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          description: "Lista de aulas do bimestre do ano escolhido.",
          items: {
            type: "OBJECT",
            properties: {
              aula: { type: "STRING", description: "O número ou intervalo da aula (ex: Aula 1 a 5)" },
              aprendizagensEssenciais: { type: "STRING", description: "As aprendizagens essenciais ou objetivos" },
              conteudos: { type: "STRING", description: "Os conteúdos, habilidades ou objetos de conhecimento abordados" },
              ano: { type: "STRING" },
              bimestre: { type: "STRING" }
            },
            required: ["aula", "aprendizagensEssenciais", "conteudos", "ano", "bimestre"]
          }
        }
      }
    });

    const parsedData = JSON.parse(response.text || "[]");
    res.json(parsedData);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "Erro ao processar PDF: " + e.message });
  }
});

app.post("/api/extract-text", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor." });
    }

    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
    const base64EncodeString = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64EncodeString } },
          { text: "Extraia todo o conteúdo de texto, estruturado preferencialmente em Markdown, deste documento. Mantenha títulos, tabelas (escreva em markdown) e listas. Se for uma matriz, escopo, ou guia, não perca nenhuma informação. Sem blá-blá-blá. Apenas extraia a informação." },
        ],
      },
    });

    const extractedText = response.text;
    if (!extractedText) {
      return res.status(500).json({ error: "A resposta do modelo veio vazia." });
    }
    
    res.json({ text: extractedText });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "Erro ao processar PDF: " + e.message });
  }
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default app;
