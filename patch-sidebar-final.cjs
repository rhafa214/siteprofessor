const fs = require('fs');
let code = fs.readFileSync('src/views/AddonSidebar.tsx', 'utf8');

const regex = /\) : activeTab === "aulas" \? \([\s\S]*?\} finally \{/;

// Wait, the error is TS1381: Unexpected token on line 611: `<PlusCircle size={14} />`
