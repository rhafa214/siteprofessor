const fs = require('fs');
const code = fs.readFileSync('src/views/AddonSidebar.tsx', 'utf8');
const toLine386 = code.split('\n').slice(0, 386).join('\n');

let depth = 0;
for (let i = 0; i < toLine386.length; i++) {
  if (toLine386[i] === '{') depth++;
  else if (toLine386[i] === '}') depth--;
}
console.log("Final depth:", depth);

// Let's do a simple stack to find the unmatched one
let stack = [];
const lines = toLine386.split('\n');
for (let lineNum = 0; lineNum < lines.length; lineNum++) {
  const line = lines[lineNum];
  // Ignore comments for simplicity, assume no braces in comments or strings.
  // Actually, we must ignore braces in strings!
  let inString = false;
  let stringChar = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if ((c === '"' || c === "'" || c === "`") && line[i-1] !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = c;
      } else if (c === stringChar) {
        inString = false;
      }
    } else if (!inString) {
      if (c === '{') stack.push({line: lineNum + 1, col: i + 1});
      else if (c === '}') stack.pop();
    }
  }
}
console.log("Unmatched braces:", stack);
