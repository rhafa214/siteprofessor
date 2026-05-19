import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Allow iframe embedding for Google Docs add-on
  app.use((req, res, next) => {
    res.removeHeader("X-Frame-Options");
    res.setHeader("Content-Security-Policy", "frame-ancestors *");
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  
  app.post("/api/parse-curriculum", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Nenhum arquivo enviado." });
        return;
      }
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor." });
        return;
      }

      const ano = req.body.ano || "6";
      const bimestre = req.body.bimestre || "1";

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      
      const base64EncodeString = req.file.buffer.toString("base64");
      const mimeType = req.file.mimetype; // usually application/pdf

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64EncodeString,
              },
            },
            {
              text: `Extraia TODAS as aulas descritas no documento de Escopo-Sequência de Matemática. EXTRAIA EXCLUSIVAMENTE AS AULAS DO ${ano}º ANO do ${bimestre}º BIMESTRE. Ignore os outros anos ou bimestres. Mapeie todos os campos da tabela para o array JSON. Garanta que todas as aulas extraídas tenham ano=${ano} e bimestre=${bimestre}.`,
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
             type: Type.ARRAY,
             items: {
               type: Type.OBJECT,
               properties: {
                 ano: { type: Type.INTEGER, description: "O ano escolar (ex: 6, 7, 8, 9)" },
                 bimestre: { type: Type.INTEGER, description: "O bimestre (ex: 1, 2, 3, 4)" },
                 aula: { type: Type.STRING, description: "O número da aula (ex: '1', '2', 'Aula de verificação')" },
                 titulo: { type: Type.STRING, description: "O título ou tema da aula" },
                 conteudo: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de conteúdos abordados" },
                 objetivos: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de objetivos de aprendizagem" },
                 habilidades: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de códigos de habilidades BNCC/Paulista (ex: EF06MA01)" },
                 aprendizagem: { type: Type.STRING, description: "O texto completo da Aprendizagem Essencial esperada" }
               },
               required: ["ano", "bimestre", "aula", "titulo", "conteudo", "objetivos", "habilidades", "aprendizagem"]
             }
          }
        },
      });

      const extractedText = response.text;
      if (!extractedText) {
        res.status(500).json({ error: "A resposta do modelo veio vazia." });
        return;
      }
      
      const jsonData = JSON.parse(extractedText.trim());
      res.json(jsonData);

    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: "Erro ao processar PDF: " + e.message });
    }
  });

  app.post("/api/parse-curriculum-text", async (req, res) => {
    try {
      const { textContext, ano = "6", bimestre = "1" } = req.body;
      if (!textContext) {
        res.status(400).json({ error: "Nenhum texto de contexto enviado." });
        return;
      }
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor." });
        return;
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: {
          parts: [
            { text: textContext },
            {
              text: `Extraia TODAS as aulas descritas nestes documentos de referência. EXTRAIA EXCLUSIVAMENTE AS AULAS DO ${ano}º ANO do ${bimestre}º BIMESTRE. Ignore os outros anos ou bimestres. Mapeie todos os campos da tabela para o array JSON. Garanta que todas as aulas extraídas tenham ano=${ano} e bimestre=${bimestre}.`,
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
             type: Type.ARRAY,
             items: {
               type: Type.OBJECT,
               properties: {
                 ano: { type: Type.INTEGER, description: "O ano escolar (ex: 6, 7, 8, 9)" },
                 bimestre: { type: Type.INTEGER, description: "O bimestre (ex: 1, 2, 3, 4)" },
                 aula: { type: Type.STRING, description: "O número da aula (ex: '1', '2', 'Aula de verificação')" },
                 titulo: { type: Type.STRING, description: "O título ou tema da aula" },
                 conteudo: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de conteúdos abordados" },
                 objetivos: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de objetivos de aprendizagem" },
                 habilidades: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de códigos de habilidades BNCC/Paulista (ex: EF06MA01)" },
                 aprendizagem: { type: Type.STRING, description: "O texto completo da Aprendizagem Essencial esperada" }
               },
               required: ["ano", "bimestre", "aula", "titulo", "conteudo", "objetivos", "habilidades", "aprendizagem"]
             }
          }
        },
      });

      const extractedText = response.text;
      if (!extractedText) {
        res.status(500).json({ error: "A resposta do modelo veio vazia." });
        return;
      }
      
      const jsonData = JSON.parse(extractedText.trim());
      res.json(jsonData);

    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: "Erro ao processar texto: " + e.message });
    }
  });

  app.post("/api/extract-text", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Nenhum arquivo enviado." });
        return;
      }
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor." });
        return;
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      
      const base64EncodeString = req.file.buffer.toString("base64");
      const mimeType = req.file.mimetype;

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64EncodeString,
              },
            },
            {
              text: `Extraia todo o conteúdo de texto, estruturado preferencialmente em Markdown, deste documento. Mantenha títulos, tabelas (escreva em markdown) e listas. Se for uma matriz, escopo, ou guia, não perca nenhuma informação. Sem blá-blá-blá. Apenas extraia a informação.`,
            },
          ],
        },
      });

      const extractedText = response.text;
      if (!extractedText) {
        res.status(500).json({ error: "A resposta do modelo veio vazia." });
        return;
      }
      
      res.json({ text: extractedText });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: "Erro ao processar PDF: " + e.message });
    }
  });

  app.post("/api/generate-eval-report", async (req, res) => {
    try {
      const { turma, tarefas, matific, provaPaulista } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor." });
        return;
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: {
          parts: [
            { text: `Gere um relatório consolidado da turma ${turma} avaliando a evolução/regresso através dos seguintes dados de notas:\n\nTarefas JSON: ${JSON.stringify(tarefas)}\n\nMatific JSON: ${JSON.stringify(matific)}\n\nProva Paulista JSON: ${JSON.stringify(provaPaulista)}` },
            {
              text: `Crie um relatório curto, porém analítico. Divida em Panorama Geral da turma, Alunos em Destaque (mostrando evolução e constância), e Alunos Precisam de Atenção (mostrar regresso ou notas baixas). Formate em HTML com tags <h3>, <p>, <ul>, <li>, <strong> para ser exibido e estilizado facilmente, adicione quebras de linhas se for necessário.`,
            },
          ],
        },
      });

      res.json({ report: response.text });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: "Erro ao processar texto: " + e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    const fs = await import("fs/promises");
    app.use("*", async (req, res, next) => {
      try {
        let html = await fs.readFile(path.join(process.cwd(), "index.html"), "utf-8");
        html = await vite.transformIndexHtml(req.url, html);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
