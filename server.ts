import { ServerRuntimeConfig } from "./src/server/config.js";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createApiRouter } from "./src/server/api.js";
import cors from "cors";

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

  // Mount shared API routes
  const apiRouter = createApiRouter();
  
  // CORS rules for API
  const corsOptions = {
    origin: function (origin, callback) {
      const allowedOriginsRaw = ServerRuntimeConfig.getAllowedOrigins();
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
