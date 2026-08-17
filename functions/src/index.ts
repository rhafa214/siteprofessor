import { onRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import express from "express";
import cors from "cors";
import { createApiRouter } from "../../src/server/api";
import { setServerRuntimeConfig } from "../../src/server/config";

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const AUTHORIZED_FIREBASE_UIDS = defineString("AUTHORIZED_FIREBASE_UIDS");
const ALLOWED_ORIGINS = defineString("ALLOWED_ORIGINS");

setServerRuntimeConfig({
  getGeminiApiKey: () => GEMINI_API_KEY.value(),
  getAuthorizedUids: () => AUTHORIZED_FIREBASE_UIDS.value(),
  getAllowedOrigins: () => ALLOWED_ORIGINS.value(),
});

const app = express();
app.use(express.json({ limit: "50mb" }));

const apiRouter = createApiRouter();

const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    const allowedOriginsRaw = ALLOWED_ORIGINS.value();
    let allowedOrigins: string[] = [];
    if (allowedOriginsRaw) {
      allowedOrigins = allowedOriginsRaw.split(',').map(o => o.trim());
    }
        
    if (!origin || 
        origin.startsWith('http://localhost') || 
        origin.startsWith('https://ais-dev-') || 
        origin.startsWith('https://ais-pre-') || 
        allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.use("/api", apiRouter);

// Catch-all for API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "Endpoint API não encontrado: " + req.originalUrl });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("API Error:", err);
  res.status(500).json({ error: err.message || "Erro interno do servidor" });
});

export const api = onRequest({ region: "us-east1", secrets: [GEMINI_API_KEY] }, app);
