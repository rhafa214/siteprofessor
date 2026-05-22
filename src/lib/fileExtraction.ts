import * as mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

// Use CDN for the worker to avoid Vite build/development issues with worker imports
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export const extractTextFromFile = async (file: File): Promise<string> => {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (!extension) throw new Error("Extensão de arquivo não reconhecida.");

  if (["txt", "md", "csv", "json"].includes(extension)) {
    return await file.text();
  } else if (extension === "pdf") {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n\n";
    }
    return fullText;
  } else if (extension === "docx") {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } else {
    throw new Error(
      "Formato de arquivo não suportado. Por favor, envie .txt, .pdf ou .docx.",
    );
  }
};
