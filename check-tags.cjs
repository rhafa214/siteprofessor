const fs = require('fs');
const code = fs.readFileSync('src/views/AddonSidebar.tsx', 'utf8');
const lines = code.split('\n');

let openTags = [];
for (let i = 256; i < lines.length; i++) {
  const line = lines[i];
  // Simple regex to find <Tag and </Tag>
  const opens = [...line.matchAll(/<([a-zA-Z0-9]+)[^>]*?(?<!\/)>/g)];
  const closes = [...line.matchAll(/<\/([a-zA-Z0-9]+)>/g)];
  
  for (const match of opens) {
    if (!line.includes("/>") || match[0].indexOf("/>") === -1) {
      // not self closing
      openTags.push({tag: match[1], line: i+1});
    }
  }
  for (const match of closes) {
    const last = openTags.pop();
    if (last && last.tag !== match[1]) {
      console.log(`Mismatch at line ${i+1}: expected </${last.tag}> but found </${match[1]}>`);
    }
  }
}
