import express from "express";
import { createServer } from "http";

const app = express();
app.use(express.json());

app.post("/api/gemini-proxy/*", async (req, res) => {
  const geminiUrl = "https://generativelanguage.googleapis.com" + req.url.replace('/api/gemini-proxy', '');
  console.log("Proxying to:", geminiUrl);
  
  res.json({ message: "Works!" });
});

app.listen(3002, () => console.log("Test server running on 3002"));
