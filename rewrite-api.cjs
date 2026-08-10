const fs = require('fs');

let code = fs.readFileSync('src/server/api.ts', 'utf8');

// 1. Imports
if (!code.includes("import { requireAuth }")) {
  code = code.replace(
    'import { GoogleGenAI, Type } from "@google/genai";',
    'import { GoogleGenAI, Type } from "@google/genai";\nimport { requireAuth } from "./authMiddleware.js";'
  );
}

// 2. Modify router.use("/gemini-proxy", async (req, res) => {
code = code.replace(
  'router.use("/gemini-proxy", async (req, res) => {',
  `router.use("/gemini-proxy", requireAuth, async (req, res) => {
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
      }`
);

// We need to fix the extra try block we injected vs what was already there
code = code.replace(
  `router.use("/gemini-proxy", requireAuth, async (req, res) => {
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
    try {`,
  `router.use("/gemini-proxy", requireAuth, async (req, res) => {
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
      }`
);

// 3. Protect other routes
code = code.replace(
  'router.post("/parse-curriculum", upload.single("file"), async (req, res) => {',
  'router.post("/parse-curriculum", requireAuth, upload.single("file"), async (req, res) => {'
);

code = code.replace(
  'router.post("/parse-addon-curriculum", upload.single("file"), async (req, res) => {',
  'router.post("/parse-addon-curriculum", requireAuth, upload.single("file"), async (req, res) => {'
);

code = code.replace(
  'router.post("/parse-curriculum-text", async (req, res) => {',
  'router.post("/parse-curriculum-text", requireAuth, async (req, res) => {'
);

code = code.replace(
  'router.post("/extract-text", upload.single("file"), async (req, res) => {',
  'router.post("/extract-text", requireAuth, upload.single("file"), async (req, res) => {'
);

code = code.replace(
  'router.post("/generate-eval-report", async (req, res) => {',
  'router.post("/generate-eval-report", requireAuth, async (req, res) => {'
);

code = code.replace(
  'router.post("/generate-lousa", upload.single("file"), async (req, res) => {',
  'router.post("/generate-lousa", requireAuth, upload.single("file"), async (req, res) => {'
);

// 4. Update Client-Error to not be protected but limit payload size
code = code.replace(
  'router.post("/client-error", (req, res) => {',
  `router.post("/client-error", (req, res) => {
    if (req.body && JSON.stringify(req.body).length > 1024 * 500) { // 500KB max for client error
      res.status(413).json({ ok: false, error: "Payload muito grande" });
      return;
    }`
);

fs.writeFileSync('src/server/api.ts', code);
console.log('Rewritten api.ts');
