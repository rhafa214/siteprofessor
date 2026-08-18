with open("src/data/migration/ClassAliasService.ts", "r") as f:
    content = f.read()

content = content.replace(
    "`users/${uid}/migrationReviewDecisions/classAliases`",
    "`users/${uid}/migrationReviewDecisions/classAliases/decisions`"
)

with open("src/data/migration/ClassAliasService.ts", "w") as f:
    f.write(content)
