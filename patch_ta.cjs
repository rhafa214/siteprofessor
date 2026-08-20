const fs = require('fs');
let text = fs.readFileSync('src/views/TaskAnalysis.tsx', 'utf8');

text = text.replace(
  /\{isLegacyMode \? "Sair do Histórico Legado" : "Registro Legado"\}/,
  '{isLegacyMode ? "Voltar ao Task Analysis atual" : "Ver Registros Legados"}'
);

fs.writeFileSync('src/views/TaskAnalysis.tsx', text);
