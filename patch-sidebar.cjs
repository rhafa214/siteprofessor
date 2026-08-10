const fs = require('fs');
let code = fs.readFileSync('src/views/AddonSidebar.tsx', 'utf8');

// 1. Remove `userGeminiKey` state
code = code.replace(
  /const \[userGeminiKey, setUserGeminiKey\] = useLocalStorage<string>\([\s\S]*?userGeminiKey",[\s\S]*?"",[\s\S]*?\);/,
  ""
);

// 2. Rewrite handleFileUpload PDF branch
const oldUploadPdfRegex = /if \(file\.name\.endsWith\("\.pdf"\)\) \{[\s\S]*?catch \(e\) \{[\s\S]*?\}\n\s*\}\n\s*\}/m;
// Let's just find the start of the if (file.name.endsWith(".pdf")) branch and replace it.
