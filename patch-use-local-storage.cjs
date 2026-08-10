const fs = require('fs');
let code = fs.readFileSync('src/hooks/useLocalStorage.ts', 'utf8');

code = code.replace(/\/\/ Do not sync googleAuthToken from Firestore because it's a short-lived token\n\s*if \(key === "googleAuthToken"\) return;\n/g, '');
code = code.replace(/if \(key === "googleAuthToken"\) return;\n/g, '');

fs.writeFileSync('src/hooks/useLocalStorage.ts', code);
