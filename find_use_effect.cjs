const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      const code = fs.readFileSync(fullPath, 'utf8');
      const lines = code.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('useEffect(')) {
          // Check for missing dependency array
          let isMissing = false;
          let block = lines.slice(i, i + 30).join('\n');
          if (block.includes('});') && !block.includes('}, [') && !block.includes('}, []')) {
            console.log(`Potential missing dep array in ${fullPath}:${i + 1}`);
          }
        }
      }
    }
  }
}

processDir('./src');
