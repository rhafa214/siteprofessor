const fs = require('fs');
let code = fs.readFileSync('src/views/AddonSidebar.tsx', 'utf8');

const settingsBlock = /<div className="bg-white border text-sm border-slate-200 rounded-xl p-4 shadow-sm">[\s\S]*?<\/div>/m;
const newSettingsBlock = `<div className="bg-white border text-sm border-slate-200 rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-2">
              Configurações
            </h3>
            <p className="text-slate-600 mb-4 text-xs">
              Todas as integrações e configurações de IA são gerenciadas automaticamente pelo servidor de forma segura.
            </p>
          </div>`;

code = code.replace(settingsBlock, newSettingsBlock);

// Also update the alert message
code = code.replace(
  /"O limite do servidor gratuito foi atingido \(Rate exceeded\/Quota\)\. Por favor, vá na aba de ⚙️ Configurações e adicione sua própria Chave de API do Gemini para continuar utilizando sem limites\.",/g,
  '"O limite do servidor foi atingido. Por favor, aguarde alguns instantes e tente novamente.",'
);

fs.writeFileSync('src/views/AddonSidebar.tsx', code);
