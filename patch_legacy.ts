import fs from 'fs';

let content = fs.readFileSync('src/views/LegacyMatificAnalysisView.tsx', 'utf-8');

// Disable Nova Semana button
content = content.replace(
  /<button\n\s*onClick=\{\(\) => setIsAddingWeek\(!isAddingWeek\)\}\n\s*className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white border border-blue-700 rounded-xl font-bold text-sm shadow-sm transition-colors hover:bg-blue-700"\n\s*>/g,
  '<button disabled onClick={() => {}} className="flex items-center gap-2 px-4 py-2 bg-blue-600/50 text-white/80 border border-blue-700/50 rounded-xl font-bold text-sm shadow-sm cursor-not-allowed" title="Modo de Leitura (Legado)">'
);

// Disable Alunos da Turma button
content = content.replace(
  /<button\n\s*onClick=\{\(\) => setStudentMode\(!studentMode\)\}\n\s*className=\{`flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-sm shadow-sm transition-colors`\}\n\s*>/g,
  '<button disabled onClick={() => {}} className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-400 rounded-xl font-bold text-sm shadow-sm cursor-not-allowed" title="Modo de Leitura (Legado)">'
);

// Disable Puxar do Banco button
content = content.replace(
  /<button\n\s*onClick=\{syncStudentsWithDatabase\}\n\s*disabled=\{isSyncing\}\n\s*className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-sm shadow-sm transition-colors hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"\n\s*>/g,
  '<button disabled className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-400 border border-slate-200 rounded-xl font-bold text-sm shadow-sm cursor-not-allowed" title="Modo de Leitura (Legado)">'
);

fs.writeFileSync('src/views/LegacyMatificAnalysisView.tsx', content);
