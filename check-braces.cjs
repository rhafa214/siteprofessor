const fs = require('fs');
const code = fs.readFileSync('src/views/AddonSidebar.tsx', 'utf8');
const toLine386 = code.split('\n').slice(0, 386).join('\n');
const openBraces = (toLine386.match(/\{/g) || []).length;
const closeBraces = (toLine386.match(/\}/g) || []).length;
console.log(`Open braces: ${openBraces}`);
console.log(`Close braces: ${closeBraces}`);
