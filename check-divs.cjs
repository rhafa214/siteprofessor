const fs = require('fs');
const code = fs.readFileSync('src/views/AddonSidebar.tsx', 'utf8');
const rootStart = code.indexOf('<div\n      className="bg-slate-50 text-slate-800 font-sans flex flex-col"');
if (rootStart === -1) {
  console.log("Root not found");
  process.exit(1);
}
const toLine386 = code.split('\n').slice(0, 386).join('\n');
const openDivs = (toLine386.match(/<div(\s|>)/g) || []).length;
const closeDivs = (toLine386.match(/<\/div>/g) || []).length;
console.log(`Open divs: ${openDivs}`);
console.log(`Close divs: ${closeDivs}`);
