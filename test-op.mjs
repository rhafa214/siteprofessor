import fs from 'fs';
(async () => {
  const { parseOffice, generate } = await import('officeparser');
  const buffer = fs.readFileSync('package.json');
  try { // using package.json might fail let's see
    const ast = await parseOffice(buffer, { fileType: 'md' }); 
    const result = await generate(ast, 'md');
    console.log(result.value);
  } catch(e) {
    console.error(e);
  }
})();
