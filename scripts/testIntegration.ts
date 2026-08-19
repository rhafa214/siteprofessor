import fs from 'fs';

function runTests() {
  const windowManager = fs.readFileSync('src/components/layout/WindowManager.tsx', 'utf8');
  const topbar = fs.readFileSync('src/components/layout/Topbar.tsx', 'utf8');
  const academicRegistry = fs.readFileSync('src/views/AcademicRegistryView.tsx', 'utf8');

  // Test B: WindowManager render
  if (!windowManager.includes('const AcademicRegistryView = lazy(')) throw new Error('WindowManager missing lazy import');
  if (!windowManager.includes('win.view === "cadastro-academico" && <AcademicRegistryView />')) throw new Error('WindowManager missing render condition');

  // Test C: Topbar title
  if (!topbar.includes('"cadastro-academico": "Cadastro Acadêmico"')) throw new Error('Topbar missing title');

  // Test D & E: callNumber handling
  if (!academicRegistry.includes('enr.callNumber !== null && enr.callNumber !== undefined ? enr.callNumber.toString().padStart(2, \'0\') : \'—\'')) throw new Error('AcademicRegistryView missing safe callNumber render');
  if (!academicRegistry.includes('if (a.callNumber === null) return 1')) throw new Error('AcademicRegistryView missing safe sorting');

  console.log('All integration tests passed.');
}

runTests();
