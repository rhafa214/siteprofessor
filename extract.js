import { execSync } from 'child_process';
try {
  const out = execSync('unzip -p test.docx word/document.xml').toString();
  console.log(out.substring(out.indexOf('w:tcW'), out.indexOf('w:tcW') + 500));
} catch (e) {
  console.error(e);
}
