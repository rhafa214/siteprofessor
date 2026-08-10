const fs = require('fs');
const code = fs.readFileSync('src/views/AddonSidebar.tsx', 'utf8');
const toLine386 = code.split('\n').slice(0, 386).join('\n');

let stack = [];
const lines = toLine386.split('\n');
for (let lineNum = 0; lineNum < lines.length; lineNum++) {
  const line = lines[lineNum];
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
      if (c === '(') stack.push({line: lineNum + 1, col: i + 1});
      else if (c === ')') stack.pop();
    }
  }
}
console.log("Unmatched parens:", stack);
