const fs = require('fs');
let text = fs.readFileSync('src/views/LegacyTaskAnalysisView.tsx', 'utf8');

if (!text.includes('Registro legado — somente leitura')) {
  text = text.replace(
    /<h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">/,
    `<h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded">Registro legado — somente leitura</span>`
  );
}
fs.writeFileSync('src/views/LegacyTaskAnalysisView.tsx', text);
