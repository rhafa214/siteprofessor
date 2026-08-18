with open("src/data/migration/MigrationDryRun.ts", "r") as f:
    content = f.read()

content = content.replace("import('../../src/domain/migration')", "import('../../domain/migration')")

with open("src/data/migration/MigrationDryRun.ts", "w") as f:
    f.write(content)
