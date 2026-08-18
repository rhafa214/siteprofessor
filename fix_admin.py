with open("src/views/MigrationAdmin.tsx", "r") as f:
    content = f.read()

content = content.replace("handleConfirmAlias = async (fingerprint: string, legacyReference: string, source: string, canonicalClassGroupId: string) => {", "handleConfirmAlias = async (fingerprint: string, source: string, canonicalClassGroupId: string) => {")
content = content.replace("         legacyReference,\n", "")
content = content.replace("handleConfirmAlias(pat.fingerprint, pat.legacyReference, pat.source, val);", "handleConfirmAlias(pat.fingerprint, pat.source, val);")

with open("src/views/MigrationAdmin.tsx", "w") as f:
    f.write(content)
