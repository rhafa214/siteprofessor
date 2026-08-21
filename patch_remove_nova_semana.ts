import fs from 'fs';

let content = fs.readFileSync('src/views/CanonicalMatificAnalysisView.tsx', 'utf-8');

// 1. Remove state variables
content = content.replace(/  const \[isAddingWeek, setIsAddingWeek\] = useState\(false\);\n/, '');
content = content.replace(/  const \[newWeek, setNewWeek\] = useState\(\{ title: "", date: "" \}\);\n/, '');

// 2. Remove handleAddWeek function
content = content.replace(/  const handleAddWeek = async \(e: React\.FormEvent\) => {[\s\S]*?    } finally {\n      setIsSaving\(false\);\n    }\n  };\n/, '');

// 3. Remove the button
content = content.replace(/            <button onClick=\{\(\) => setIsAddingWeek\(!isAddingWeek\)\} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white border border-blue-700 rounded-xl font-bold text-sm shadow-sm transition-colors hover:bg-blue-700">\n              <Plus size=\{16\} \/> Nova Semana\n            <\/button>\n/, '');

// 4. Remove the form
const formRegex = /          \{isAddingWeek && \([\s\S]*?          \)\}\n/;
content = content.replace(formRegex, '');

fs.writeFileSync('src/views/CanonicalMatificAnalysisView.tsx', content);
