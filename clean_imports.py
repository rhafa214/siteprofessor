import re

with open("src/data/migration/MigrationDryRun.ts", "r") as f:
    content = f.read()

content = content.replace("import { generateDeterministicFingerprint } from './src/data/mappers/legacyMappers';\n", "")
content = content.replace("import { LegacyAcademicSnapshot } from './src/data/migration/LegacyDataCollector';\n", "")
content = content.replace("import { ClassGroup } from './src/domain';\n", "")
content = content.replace("import { ClassAliasDecision } from './src/domain/migration';\n", "")

with open("src/data/migration/MigrationDryRun.ts", "w") as f:
    f.write(content)
