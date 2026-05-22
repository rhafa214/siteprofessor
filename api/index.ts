import express from "express";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.use(express.json({ limit: "50mb" }));

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
      model: "gemini-1.5-flash",
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
             type: "ARRAY",
             description: "Lista de aulas do bimestre do ano escolhido.",
             items: {
               type: "OBJECT",
               properties: {
                 ano: { type: "INTEGER", description: "O ano escolar (ex: 6, 7, 8, 9)" },
                 bimestre: { type: "INTEGER", description: "O bimestre (ex: 1, 2, 3, 4)" },
                 aula: { type: "STRING", description: "O número da aula (ex: '1', '2', 'Aula de verificação')" },
                 titulo: { type: "STRING", description: "O título ou tema da aula" },
                 conteudo: { type: "ARRAY", items: { type: "STRING" }, description: "Lista de conteúdos abordados" },
                 objetivos: { type: "ARRAY", items: { type: "STRING" }, description: "Lista de objetivos de aprendizagem" },
                 habilidades: { type: "ARRAY", items: { type: "STRING" }, description: "Lista de códigos de habilidades BNCC/Paulista (ex: EF06MA01)" },
                 aprendizagem: { type: "STRING", description: "O texto completo da Aprendizagem Essencial esperada" }
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
      model: "gemini-1.5-flash",
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

app.post("/api/parse-addon-curriculum", upload.single("file"), async (req, res) => {
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

export default app;
