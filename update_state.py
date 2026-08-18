import re
with open("src/views/MigrationAdmin.tsx", "r") as f:
    content = f.read()

state_vars = """
  const [sanitizedReport, setSanitizedReport] = useState<any>(null);
  const [reviewPatterns, setReviewPatterns] = useState<any[]>([]);
  const [canonicalGroups, setCanonicalGroups] = useState<any[]>([]);
"""
content = re.sub(r"const \[sanitizedReport, setSanitizedReport\] = useState<any>\(null\);", state_vars, content)

with open("src/views/MigrationAdmin.tsx", "w") as f:
    f.write(content)
