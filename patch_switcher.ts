import fs from 'fs';

let content = fs.readFileSync('src/views/MatificAnalysis.tsx', 'utf-8');

const oldSwitcher = `      {/* View Switcher */}
      <div className="absolute top-4 right-4 z-50 flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
        <button
          onClick={() => setMode("canonical")}
          className={\`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors \${
            mode === "canonical"
              ? "bg-slate-100 text-slate-800"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          }\`}
        >
          <LayoutDashboard size={14} />
          Atual (Canônico)
        </button>
        <button
          onClick={() => setMode("legacy")}
          className={\`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors \${
            mode === "legacy"
              ? "bg-amber-100 text-amber-800"
              : "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
          }\`}
        >
          <History size={14} />
          Ver Registros Legados
        </button>
      </div>`;

const newSwitcher = `      {/* View Switcher inline instead of absolute */}
      <div className="flex justify-end mb-4 shrink-0">
        <div className="inline-flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          <button
            onClick={() => setMode("canonical")}
            className={\`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors \${
              mode === "canonical"
                ? "bg-blue-50 text-blue-700"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }\`}
          >
            <LayoutDashboard size={16} />
            Matific Canônico
          </button>
          <button
            onClick={() => setMode("legacy")}
            className={\`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors \${
              mode === "legacy"
                ? "bg-amber-50 text-amber-700"
                : "text-slate-500 hover:text-amber-700 hover:bg-amber-50/50"
            }\`}
          >
            <History size={16} />
            Ver Registros Legados
          </button>
        </div>
      </div>`;

content = content.replace(oldSwitcher, newSwitcher);
fs.writeFileSync('src/views/MatificAnalysis.tsx', content);
