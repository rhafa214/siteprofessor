with open("src/views/MigrationAdmin.tsx", "r") as f:
    content = f.read()

import re

# Add state variables
state_vars = """
  const [reviewPatterns, setReviewPatterns] = useState<any[]>([]);
  const [canonicalGroups, setCanonicalGroups] = useState<any[]>([]);

"""
content = re.sub(r"const \[sanitizedReport\, setSanitizedReport\] = useState<any \| null>\(null\);", r"const [sanitizedReport, setSanitizedReport] = useState<any | null>(null);\n" + state_vars, content)

# Add handleLoadReview
handle_load = """
  const handleLoadReview = async () => {
    setStatus('Carregando dados para revisão de turmas...');
    try {
      const { createLegacySnapshot } = await import('../data/migration/LegacyDataCollector');
      const { extractClassReviewPatterns, getProposedClassGroups } = await import('../data/migration/MigrationDryRun');
      const { loadPreparedMappings } = await import('../data/migration/MigrationMappingService');
      const { loadClassAliases } = await import('../data/migration/ClassAliasService');
      
      const snapshot = await createLegacySnapshot(user.uid);
      const existingMappings = await loadPreparedMappings(user.uid);
      const aliases = await loadClassAliases(user.uid);
      
      const groups = getProposedClassGroups(existingMappings);
      const patterns = await extractClassReviewPatterns(snapshot, groups, aliases);
      
      setCanonicalGroups(groups);
      setClassAliases(aliases);
      setReviewPatterns(patterns);
      
      setStatus('Revisão carregada com sucesso.');
    } catch (e: any) {
      console.error(e);
      setStatus(`Erro: ${e.message}`);
    }
  };
"""
content = re.sub(r"const handleRun = async \(\) => \{", handle_load + "\n  const handleRun = async () => {", content)

# Replace the buttons block
buttons_replacement = """
      <div className="mb-6 space-x-4">
        <button 
          onClick={handleLoadReview}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-6 rounded shadow"
        >
          Carregar Revisão de Turmas
        </button>
        <button 
          onClick={handleRun}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded shadow"
        >
          Executar Dry-Run V7
        </button>
      </div>
"""
content = re.sub(r'<div className="mb-6">\s*<button\s*onClick=\{handleRun\}.*?</button>\s*</div>', buttons_replacement, content, flags=re.DOTALL)

# Replace the conditional render of the UI
# from {report?.preview?._unresolvedClassPatterns?.length > 0 && (
# to {reviewPatterns.length > 0 && (
content = content.replace("report?.preview?._unresolvedClassPatterns?.length > 0", "reviewPatterns.length > 0")
content = content.replace("report.preview._unresolvedClassPatterns.map", "reviewPatterns.map")
content = content.replace("report.preview._canonicalClassGroups.map", "canonicalGroups.map")

with open("src/views/MigrationAdmin.tsx", "w") as f:
    f.write(content)
