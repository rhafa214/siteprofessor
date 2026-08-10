const fs = require('fs');
let code = fs.readFileSync('src/views/AddonSidebar.tsx', 'utf8');

// 1. Remove `userGeminiKey` state
code = code.replace(
  /const \[userGeminiKey, setUserGeminiKey\] = useLocalStorage<string>\([\s\S]*?userGeminiKey",[\s\S]*?"",[\s\S]*?\);/,
  ""
);

// 2. Add authenticatedFetch import
if (!code.includes('import { authenticatedFetch }')) {
  code = code.replace(
    'import { useLocalStorage } from "../hooks/useLocalStorage";',
    'import { useLocalStorage } from "../hooks/useLocalStorage";\nimport { authenticatedFetch } from "../lib/apiClient";'
  );
}

// 3. Rewrite handleFileUpload PDF branch
const oldPdfBranch = /const \{ GoogleGenAI \} = await import\("@google\/genai"\);[\s\S]*?const parsed = JSON\.parse\(rawText\);/m;
const newPdfBranch = `const formData = new FormData();
        formData.append("file", file);

        const res = await authenticatedFetch("/api/parse-addon-curriculum", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          let errMsg = "Falha ao processar o PDF.";
          try {
            const errData = await res.json();
            errMsg = errData.error || errMsg;
          } catch (e) {}
          throw new Error(errMsg);
        }

        const parsed = await res.json();`;

code = code.replace(oldPdfBranch, newPdfBranch);

fs.writeFileSync('src/views/AddonSidebar.tsx', code);
