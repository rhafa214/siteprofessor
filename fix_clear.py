with open("src/views/MigrationAdmin.tsx", "r") as f:
    content = f.read()

content = content.replace(
"""  const handleClearAlias = async (fingerprint: string) => {
    if (!user) return;
    try {
      await clearClassAlias(user.uid, fingerprint);""",
"""  const handleClearAlias = async (fingerprint: string, source: string) => {
    if (!user) return;
    try {
      const decision: ClassAliasDecision = { 
         fingerprint,
         source,
         canonicalClassGroupId: null,
         status: 'CLEARED',
         createdAt: Date.now(),
         updatedAt: Date.now(),
         migrationReviewVersion: 7
      };
      await saveClassAlias(user.uid, decision);"""
)

with open("src/views/MigrationAdmin.tsx", "w") as f:
    f.write(content)
