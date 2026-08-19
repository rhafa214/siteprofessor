import re

# Fix Sidebar.tsx
with open("src/components/layout/Sidebar.tsx", "r") as f:
    content = f.read()

content = content.replace("import { BookOpen,", "import {")
content = content.replace("import { BookOpen, BookOpen", "import { BookOpen")
content = re.sub(r'import\s*{\s*([^}]+)}\s*from\s*"lucide-react";', r'import { \1, BookOpen } from "lucide-react";', content)
content = content.replace(", BookOpen, BookOpen", ", BookOpen")

with open("src/components/layout/Sidebar.tsx", "w") as f:
    f.write(content)

# Fix MigrationService.ts
with open("src/data/migration/MigrationService.ts", "r") as f:
    content = f.read()

# Replace any multiline or single line without await
content = re.sub(r'const\s*{\s*preview,\s*newMappings\s*}\s*=\s*generateMigrationPreview', r'const { preview, newMappings } = await generateMigrationPreview', content)

with open("src/data/migration/MigrationService.ts", "w") as f:
    f.write(content)

# Fix scripts/testFreshMatchingV6.ts
with open("scripts/testFreshMatchingV6.ts", "r") as f:
    content = f.read()

# Remove the runTests wrapper that broke imports
content = content.replace("async function runTests() {\n", "")
content = content.replace("\n}\nrunTests();\n", "\n")
content = re.sub(r'const\s*{\s*preview\s*}\s*=\s*generateMigrationPreview', r'const { preview } = await generateMigrationPreview', content)

with open("scripts/testFreshMatchingV6.ts", "w") as f:
    f.write(content)

