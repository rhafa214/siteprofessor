const fs = require('fs');
let text = fs.readFileSync('src/views/LegacyTaskAnalysisView.tsx', 'utf8');

text = text.replace('const saveData = async (data: ClassData) => {', 'const saveData = async (data: ClassData) => { return; showAlert("Modo legado read-only", "Info", "info"); ');

fs.writeFileSync('src/views/LegacyTaskAnalysisView.tsx', text);
