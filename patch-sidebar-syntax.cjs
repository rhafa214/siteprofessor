const fs = require('fs');
let code = fs.readFileSync('src/views/AddonSidebar.tsx', 'utf8');

// fix double div
code = code.replace(/<\/div>\s*<\/div>\s*\) : !selectedAno \? \(/m, "</div>\n        ) : !selectedAno ? (");

fs.writeFileSync('src/views/AddonSidebar.tsx', code);
