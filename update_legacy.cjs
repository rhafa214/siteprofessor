const fs = require('fs');
const content = fs.readFileSync('src/views/LegacyTaskAnalysisView.tsx', 'utf8');

// Disable saveData
let newContent = content.replace(
  /const saveData = async \(data: ClassData\) => \{([\s\S]*?)try \{([\s\S]*?)await setDoc\(([\s\S]*?)localStorage\.setItem\(([\s\S]*?)\} catch \(err: any\) \{/g,
  `const saveData = async (data: ClassData) => {
    showAlert("O modo legado é somente leitura. Edições foram desabilitadas.", "Registro Legado", "info");
    return;
    try {
      await setDoc(
        $3
      localStorage.setItem(
        $4
} catch (err: any) {`
);

// We should just manually replace the saveData function content.
