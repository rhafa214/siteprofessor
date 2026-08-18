import re
with open("src/views/MigrationAdmin.tsx", "r") as f:
    content = f.read()

content = content.replace("handleClearAlias(pat.fingerprint)", "handleClearAlias(pat.fingerprint, pat.source)")

with open("src/views/MigrationAdmin.tsx", "w") as f:
    f.write(content)
