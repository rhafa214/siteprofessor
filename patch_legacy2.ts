import fs from 'fs';

let content = fs.readFileSync('src/views/LegacyMatificAnalysisView.tsx', 'utf-8');

// Disable Alunos da Turma button
content = content.replace(
  /<button\n\s*onClick=\{\(\) => setStudentMode\(!studentMode\)\}\n\s*className=\{`flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-sm shadow-sm transition-colors`\}\n\s*>/g,
  '<button disabled onClick={() => {}} className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-400 rounded-xl font-bold text-sm shadow-sm cursor-not-allowed" title="Modo de Leitura (Legado)">'
);

fs.writeFileSync('src/views/LegacyMatificAnalysisView.tsx', content);
