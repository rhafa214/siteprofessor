import { ServerRuntimeConfig } from "./config.js";
import express from "express";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";
import { requireAuth, requireAuthorizedUser } from "./authMiddleware.js";

export function createApiRouter() {
  const router = express.Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit
  
  router.get("/migration/access", requireAuth, requireAuthorizedUser, (req, res) => { res.json({ authorized: true }); });

  router.post("/client-error", (req, res) => {
    if (req.body && JSON.stringify(req.body).length > 1024 * 500) { // 500KB max for client error
      res.status(413).json({ ok: false, error: "Payload muito grande" });
      return;
    }
    console.error("[Client Error]:", req.body);
    res.json({ ok: true });
  });

  // --- GEMINI API PROXY ---
  router.use("/gemini-proxy", requireAuth, requireAuthorizedUser, async (req, res) => {
    try {
      if (!req.url.includes("models/gemini-2.0-flash")) {
        res.status(403).json({ error: "Modelo não autorizado. Apenas gemini-2.0-flash é permitido." });
        return;
      }
      if (req.method !== "POST" && req.method !== "GET") {
        res.status(405).json({ error: "Método não permitido." });
        return;
      }
      if (req.body && JSON.stringify(req.body).length > 25 * 1024 * 1024) { // 25MB max for Gemini proxy
        res.status(413).json({ error: "Payload da requisição excede o limite permitido (25MB)." });
        return;
      }
      console.log("[Gemini Proxy] Request URL:", req.url);
      const gApiKey = ServerRuntimeConfig.getGeminiApiKey();
      if (!gApiKey) {
        res.status(500).json({ error: "API Key missing server-side" });
        return;
      }
      
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
      if (req.method !== "GET") {
        fetchOptions.body = JSON.stringify(req.body);
      }
      const response = await fetch(targetUrl, fetchOptions);
      console.log("[Gemini Proxy] Response Status:", response.status);
      if (!response.ok) {
        const text = await response.text();
        console.error("[Gemini Proxy] Error Response:", text);
        
        // Hide sensitive details from client
        let safeErrorMsg = "Erro ao processar a requisição na IA.";
        if (response.status === 429) safeErrorMsg = "Limite de requisições excedido. Tente novamente mais tarde.";
        if (response.status === 503 || response.status === 500) safeErrorMsg = "Serviço de IA indisponível no momento.";
        
        res.status(response.status).json({ error: safeErrorMsg });
        return;
      }
      res.status(response.status);
      response.headers.forEach((value, key) => {
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

  router.post("/parse-curriculum", requireAuth, requireAuthorizedUser, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Nenhum arquivo enviado." });
        return;
      }
      
      const apiKey = ServerRuntimeConfig.getGeminiApiKey();
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
      const mimeType = req.file.mimetype; 
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

  router.post("/parse-addon-curriculum", requireAuth, requireAuthorizedUser, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Nenhum arquivo enviado." });
        return;
      }
      
      const apiKey = ServerRuntimeConfig.getGeminiApiKey();
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
      const prompt = `Analise o seguinte plano/escopo de aulas (arquivo PDF) e o converta para um JSON. O JSON DEVE SER um array de objetos puros, não use markdown.\nCada objeto representa uma aula com as seguintes chaves (ano, bimestre, numero como integer, os outros como string):\n- ano (ex: 6 para 6º ano)\n- bimestre (1, 2, 3 ou 4)\n- numero (numero da aula)\n- titulo (titulo da aula)\n- conteudo (descreva em string)\n- objetivos (descreva em string)\n- habilidades (codigos das habilidades)\n- aprendizagemEssencial (texto)\nExtraia todas as aulas contidas no documento.`;
      
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

  router.post("/parse-curriculum-text", requireAuth, requireAuthorizedUser, async (req, res) => {
    try {
      const { textContext, ano = "6", bimestre = "1" } = req.body;
      if (!textContext) {
        res.status(400).json({ error: "Nenhum texto de contexto enviado." });
        return;
      }
      
      const apiKey = ServerRuntimeConfig.getGeminiApiKey();
      if (!apiKey) {
        res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor." });
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

  router.post("/extract-text", requireAuth, requireAuthorizedUser, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Nenhum arquivo enviado." });
        return;
      }
      
      const apiKey = ServerRuntimeConfig.getGeminiApiKey();
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

  router.post("/generate-eval-report", requireAuth, requireAuthorizedUser, async (req, res) => {
    try {
      const { turma, tarefas, matific, provaPaulista } = req.body;
      const apiKey = ServerRuntimeConfig.getGeminiApiKey();
      if (!apiKey) {
        res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor." });
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

  router.post("/generate-lousa", requireAuth, requireAuthorizedUser, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Nenhum arquivo enviado." });
        return;
      }
      const apiKey = ServerRuntimeConfig.getGeminiApiKey();
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
      
      if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
        hasInlineData = true;
      } else {
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
      
      const analysisPrompt = `Você atua como um professor experiente e especialista em metodologias ativas e design instrucional.\nAnalise o conteúdo do slide/documento anexo (ou no texto providenciado). Seu objetivo é ajudar a estruturar e planejar uma "Lousa Dinâmica" para esta aula.\nRetorne EXATAMENTE UM JSON válido e sem formatação markdown (sem \`\`\`json), contendo as seguintes chaves:\n- "markdown": Uma string em Markdown formatado, descrevendo a estrutura visual e os tópicos da lousa. Inclua: Tema Central, Esquema/Problematização de um lado da lousa, e Resolução/Sistematização do outro. Pense como distribuir a informação espacialmente e quais cores de giz/caneta sugerir usar para focar a atenção dos alunos.\n- "promptImagem": Um prompt rico, detalhado e em INGLÊS que será usado para gerar um layout de lousa de sala de aula fotorrealista com anotações e desenhos no quadro verde ou branco. Descreva as cores do giz, os fluxogramas simples e a estética que corresponda ao assunto analisado no slide.\n\nTexto extraído do Slide (se houver):\n${textContent}`;
      
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

  return router;
}
