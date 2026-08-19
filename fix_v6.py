with open("scripts/testFreshMatchingV6.ts", "r") as f:
    content = f.read()

content = content.replace("const { preview } = await generateMigrationPreview", "const { preview } = await (async () => await generateMigrationPreview(snapshot, existingMappings, classAliases, runId))()")

with open("scripts/testFreshMatchingV6.ts", "w") as f:
    f.write(content)
