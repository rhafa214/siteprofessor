with open("scripts/testFreshMatchingV6.ts", "r") as f:
    content = f.read()

# Make it a module by adding export {} at the top, which allows top-level await in tsconfig with target esnext or similar, 
# but if tsconfig is commonjs, it won't work.
# Best is to wrap the execution part.
# The file has imports, then variable declarations, then the call.

lines = content.split('\n')
import_lines = [l for l in lines if l.startswith('import')]
other_lines = [l for l in lines if not l.startswith('import')]

new_content = "\n".join(import_lines) + "\n\nasync function main() {\n" + "\n".join(other_lines).replace("const { preview } = await (async () => await generateMigrationPreview(snapshot, existingMappings, classAliases, runId))()", "const { preview } = await generateMigrationPreview(snapshot, new Map(), [], 'test');") + "\n}\nmain().catch(console.error);\n"

with open("scripts/testFreshMatchingV6.ts", "w") as f:
    f.write(new_content)
