const fs = require('fs');
const content = fs.readFileSync('src/views/CanonicalTaskAnalysisView.tsx', 'utf8');

let newContent = content.replace(
  /await taskService\.current\.saveResult\(user\.uid, result\);/g,
  `const validIds = new Set(roster.map(s => s.studentId));\n    await taskService.current.saveResult(user.uid, result, validIds);`
);

newContent = newContent.replace(
  /await taskService\.current\.saveResult\(user\.uid, res\);/g,
  `const validIds = new Set(roster.map(s => s.studentId));\n      await taskService.current.saveResult(user.uid, res, validIds);`
);

fs.writeFileSync('src/views/CanonicalTaskAnalysisView.tsx', newContent);
