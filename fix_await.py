import re

with open("scripts/testFreshMatchingV6.ts", "r") as f:
    content = f.read()
if "async function runTests()" not in content:
    content = "async function runTests() {\n" + content + "\n}\nrunTests();\n"
with open("scripts/testFreshMatchingV6.ts", "w") as f:
    f.write(content)


with open("src/data/migration/MigrationService.ts", "r") as f:
    content = f.read()

content = re.sub(r'const \{ preview, newMappings \} = generateMigrationPreview\(snapshot, existingMappings, classAliases, runId\);', r'const { preview, newMappings } = await generateMigrationPreview(snapshot, existingMappings, classAliases, runId);', content)

with open("src/data/migration/MigrationService.ts", "w") as f:
    f.write(content)

