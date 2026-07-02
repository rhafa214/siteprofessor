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

  app.post("/api/client-error", (req, res) => {
    console.error("[Client Error]:", req.body);
    res.json({ ok: true });
  });

  // --- GEMINI API PROXY ---
  app.use("/api/gemini-proxy", async (req, res) => {
    try {
      console.log("[Gemini Proxy] Request URL:", req.url);
      const gApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (!gApiKey) {
        res.status(500).json({ error: "API Key missing server-side" });
        return;
      }

      // targetUrl matches original logic, because req.url excludes the mount path in `app.use('/api/gemini-proxy', ...)`
      // However, if the path contains search query, it's included in req.url
      const targetUrl = `https://generativelanguage.googleapis.com${req.url}`;
      
      const headers: Record<string, string> = {
        "x-goog-api-key": gApiKey,
        "content-type": req.headers["content-type"] || "application/json",
      };

      if (req.headers["x-goog-api-client"]) {
         headers["x-goog-api-client"] = req.headers["x-goog-api-client"] as string;
      }

      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
      };

      if (req.method !== "GET" && req.method !== "HEAD") {
        // Because of express.json, req.body is already an object, reconstruct it to string:
        fetchOptions.body = JSON.stringify(req.body);
      }

      const response = await fetch(targetUrl, fetchOptions);

      console.log("[Gemini Proxy] Response Status:", response.status);
      if (!response.ok) {
        const text = await response.text();
        console.error("[Gemini Proxy] Error Response:", text);
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() !== "content-encoding") {
             res.setHeader(key, value);
          }
        });
        res.status(response.status).send(text);
        return;
      }

      res.status(response.status);

      response.headers.forEach((value, key) => {
        // Skip content-encoding to avoid issues if we modify stream
        if (key.toLowerCase() !== "content-encoding") {
           res.setHeader(key, value);
        }
      });

      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } else {
        res.end();
      }
    } catch (e: any) {
      console.error("Gemini proxy error:", e);
      res.status(500).json({ error: "Proxy server error: " + e.message });
    }
  });

  app.post("/api/parse-curriculum", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Nenhum arquivo enviado." });
        return;
      }
      
      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor. (ou VITE_)" });
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
        model: "gemini-2.0-flash",
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

      let extractedText = response.text;
      if (!extractedText) {
        res.status(500).json({ error: "A resposta do modelo veio vazia." });
        return;
      }
      
      extractedText = extractedText.replace(/^```json\s*/g, "").replace(/^```\s*/g, "").replace(/\s*```$/g, "").trim();
      const jsonData = JSON.parse(extractedText);
      res.json(jsonData);

    } catch (e: any) {
      console.error(e);
      let errorMsg = "Erro ao processar documento: " + e.message;
      if (e.message && String(e.message).includes("429")) {
        errorMsg = "Limite da versão gratuita do modelo atingido (Erro 429). Aguarde alguns instantes e tente novamente.";
      } else if (e.message && (String(e.message).includes("503") || String(e.message).includes("UNAVAILABLE") || String(e.message).includes("high demand"))) {
        errorMsg = "O sistema de IA está com alta demanda no momento (Erro 503). Por favor, aguarde alguns instantes e tente novamente.";
      }
      res.status(500).json({ error: errorMsg });
    }
  });

  app.post("/api/parse-addon-curriculum", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Nenhum arquivo enviado." });
        return;
      }
      
      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor. (ou VITE_)" });
        return;
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      
      const base64EncodeString = req.file.buffer.toString("base64");
      const mimeType = req.file.mimetype;

      const prompt = `Analise o seguinte plano/escopo de aulas (arquivo PDF) e o converta para um JSON. O JSON DEVE SER um array de objetos puros, não use markdown.
Cada objeto representa uma aula com as seguintes chaves (ano, bimestre, numero como integer, os outros como string):
- ano (ex: 6 para 6º ano)
- bimestre (1, 2, 3 ou 4)
- numero (numero da aula)
- titulo (titulo da aula)
- conteudo (descreva em string)
- objetivos (descreva em string)
- habilidades (codigos das habilidades)
- aprendizagemEssencial (texto)

Extraia todas as aulas contidas no documento.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64EncodeString,
              },
            },
            {
              text: prompt,
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
        },
      });

      let extractedText = response.text;
      if (!extractedText) {
        res.status(500).json({ error: "A resposta do modelo veio vazia." });
        return;
      }
      
      extractedText = extractedText.replace(/^```json\s*/g, "").replace(/^```\s*/g, "").replace(/\s*```$/g, "").trim();
      const jsonData = JSON.parse(extractedText);
      res.json(jsonData);

    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: "Erro ao gerar json do PDF: " + e.message });
    }
  });

  app.post("/api/parse-curriculum-text", async (req, res) => {
    try {
      const { textContext, ano = "6", bimestre = "1" } = req.body;
      if (!textContext) {
        res.status(400).json({ error: "Nenhum texto de contexto enviado." });
        return;
      }
      
      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor. (ou VITE_)" });
        return;
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
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
      
      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor. (ou VITE_)" });
        return;
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      
      const base64EncodeString = req.file.buffer.toString("base64");
      const mimeType = req.file.mimetype;

      let response;
      let retries = 3;
      let delay = 2000;
      
      while (retries > 0) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
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
          break; // Success
        } catch (err: any) {
          retries--;
          if (retries === 0 || (!String(err.message).includes("429") && !String(err.message).includes("503") && !String(err.message).includes("UNAVAILABLE"))) {
            throw err;
          }
          console.warn(`Erro na IA. Tentando novamente em ${delay}ms... (Restam ${retries} tentativas)`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        }
      }

      const extractedText = response?.text;
      if (!extractedText) {
        res.status(500).json({ error: "A resposta do modelo veio vazia." });
        return;
      }
      
      res.json({ text: extractedText });
    } catch (e: any) {
      console.error(e);
      let errorMsg = "Erro ao processar documento: " + e.message;
      if (e.message && String(e.message).includes("429")) {
        errorMsg = "Limite da versão gratuita do modelo atingido (Erro 429). Aguarde alguns instantes e tente novamente.";
      } else if (e.message && (String(e.message).includes("503") || String(e.message).includes("UNAVAILABLE") || String(e.message).includes("high demand"))) {
        errorMsg = "O sistema de IA está com alta demanda no momento (Erro 503). Por favor, aguarde alguns instantes e tente novamente.";
      }
      res.status(500).json({ error: errorMsg });
    }
  });

  app.post("/api/generate-eval-report", async (req, res) => {
    try {
      const { turma, tarefas, matific, provaPaulista } = req.body;
      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor. (ou VITE_)" });
        return;
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
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

  app.post("/api/generate-lousa", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Nenhum arquivo enviado." });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor." });
        return;
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      
      const mimeType = req.file.mimetype;
      let textContent = "";
      let hasInlineData = false;
      const originalFileName = req.file.originalname.toLowerCase();

      // For Images and PDFs we use inlineData
      if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
        hasInlineData = true;
      } else {
        // Assume it's a document like PPTX/DOCX and try to extract text
        try {
          const { parseOffice, generate } = await import("officeparser");
          let extension = originalFileName.includes('.') ? originalFileName.split('.').pop() : 'pptx';
          const ast = await parseOffice(req.file.buffer, { fileType: extension as any });
          const genResult = await generate(ast, 'md');
          textContent = genResult.value;
        } catch (e: any) {
          console.error("Failed to parse document text:", e);
          res.status(400).json({ error: "Este formato de arquivo não é suportado diretamente. Formatos recomendados: PDF ou Imagem." });
          return;
        }
      }

      // 1. Analyze slide and generate the board outline and an image prompt
      const analysisPrompt = `Você atua como um professor experiente e especialista em metodologias ativas e design instrucional.
Analise o conteúdo do slide/documento anexo (ou no texto providenciado). Seu objetivo é ajudar a estruturar e planejar uma "Lousa Dinâmica" para esta aula.

Retorne EXATAMENTE UM JSON válido e sem formatação markdown (sem \`\`\`json), contendo as seguintes chaves:
- "markdown": Uma string em Markdown formatado, descrevendo a estrutura visual e os tópicos da lousa. Inclua: Tema Central, Esquema/Problematização de um lado da lousa, e Resolução/Sistematização do outro. Pense como distribuir a informação espacialmente e quais cores de giz/caneta sugerir usar para focar a atenção dos alunos.
- "promptImagem": Um prompt rico, detalhado e em INGLÊS que será usado para gerar um layout de lousa de sala de aula fotorrealista com anotações e desenhos no quadro verde ou branco. Descreva as cores do giz, os fluxogramas simples e a estética que corresponda ao assunto analisado no slide.

Texto extraído do Slide (se houver):
${textContent}
`;

      const parts: any[] = [];
      if (hasInlineData) {
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: req.file.buffer.toString("base64"),
          },
        });
      }
      parts.push({ text: analysisPrompt });

      let extractedText = "";
      let jsonData: any = {};
      
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const analysisResponse = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: {
              parts,
            },
            config: {
              responseMimeType: "application/json",
            },
          });

          extractedText = analysisResponse.text || "";
          if (!extractedText) throw new Error("A resposta do modelo veio vazia na extração.");
          
          extractedText = extractedText.replace(/^```json\s*/g, "").replace(/^```\s*/g, "").replace(/\s*```$/g, "").trim();
          jsonData = JSON.parse(extractedText);
          break; // success
        } catch (err: any) {
          if (err.status === 429 || (err.message && err.message.includes("429"))) {
            if (attempt === maxRetries) throw err;
            console.log(`Rate limit text gen, retrying ${attempt}/${maxRetries} em 3s...`);
            await new Promise(r => setTimeout(r, 3000));
          } else {
            throw err;
          }
        }
      }

      // 2. Output Image Generation disabled due to API rate limits (requested by user to leave for future)
      let imageBase64 = "";

      res.json({ 
        markdown: jsonData.markdown || "Não foi possível gerar a estrutura da lousa.",
        promptImagem: jsonData.promptImagem,
        imageBase64 
      });

    } catch (e: any) {
      console.error(e);
      let errorMessage = "Erro ao processar lousa: " + e.message;
      if (e.message && e.message.includes("429")) {
        errorMessage = "Limite de requisições excedido na API da IA. Por favor, tente novamente em alguns instantes.";
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  // Catch-all for API routes (so they don't fall through to the SPA HTML fallback)
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: "Endpoint API não encontrado: " + req.originalUrl });
  });

  // Global error handler for API routes (catches multer errors, etc.)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api/')) {
      console.error("API Error:", err);
      res.status(500).json({ error: err.message || "Erro interno do servidor" });
    } else {
      next(err);
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

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Express App Error:", err);
    res.status(500).json({ error: "Erro interno do servidor: " + err.message });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
