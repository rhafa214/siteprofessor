import fs from 'fs';

let content = fs.readFileSync('src/views/LegacyMatificAnalysisView.tsx', 'utf-8');

const block1 = `                        <button
                          onClick={() => setIsImportModalOpen(true)}
                          className={\`flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-sm shadow-sm transition-colors\`}
                        >
                          <Users size={16} /> Alunos da Turma
                        </button>`;

const block1Replace = `                        <button
                          disabled
                          className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-400 rounded-xl font-bold text-sm shadow-sm cursor-not-allowed"
                          title="Modo de Leitura (Legado)"
                        >
                          <Users size={16} /> Alunos da Turma
                        </button>`;

content = content.replace(block1, block1Replace);

const block2 = `                        {!studentMode && (
                          <button
                            onClick={syncStudentsWithDatabase}
                            disabled={isSyncing}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl font-bold text-sm shadow-sm transition-colors"
                          >
                            {isSyncing ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Users size={16} />
                            )}
                            {isSyncing ? "Sincronizando..." : "Puxar do Banco"}
                          </button>
                        )}`;

const block2Replace = `                        {!studentMode && (
                          <button
                            disabled
                            className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-400 border border-slate-200 rounded-xl font-bold text-sm shadow-sm cursor-not-allowed"
                            title="Modo de Leitura (Legado)"
                          >
                            <Users size={16} /> Puxar do Banco
                          </button>
                        )}`;
                        
content = content.replace(block2, block2Replace);

fs.writeFileSync('src/views/LegacyMatificAnalysisView.tsx', content);
