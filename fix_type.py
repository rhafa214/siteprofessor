with open("src/data/migration/MigrationDryRun.ts", "r") as f:
    content = f.read()

import re
content = re.sub(r"mapping\.canonicalClassGroupId", r"(mapping as any).canonicalClassGroupId", content)
content = re.sub(r"mapping\.legacyClassGroupSlug", r"(mapping as any).legacyClassGroupSlug", content)

with open("src/data/migration/MigrationDryRun.ts", "w") as f:
    f.write(content)
