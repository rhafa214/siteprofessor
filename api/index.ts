import express from "express";
import { createApiRouter } from "../src/server/api.js";
import cors from "cors";

const app = express();

app.use(express.json({ limit: "50mb" }));

// Mount shared API routes
// The Vercel function maps `/api/*` to `api/index.ts`.
// Because we are using express and the router is mounted on `/`,
// when Vercel runs it, the URL might already be stripped or not.
// Usually Vercel passes the full path e.g., `/api/extract-text`.
// So we should mount it at `/api`.
const apiRouter = createApiRouter();
    
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOriginsRaw = process.env.ALLOWED_ORIGINS || process.env.VITE_ALLOWED_ORIGINS;
    let allowedOrigins = [];
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
app.use('/api', cors(corsOptions));
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

export const config = {
  api: {
    bodyParser: false,
  },
};

export default app;
