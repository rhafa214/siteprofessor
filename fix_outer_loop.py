with open("src/data/migration/MigrationDryRun.ts", "r") as f:
    content = f.read()

content = content.replace("      });\n    });", "      });\n    }")

with open("src/data/migration/MigrationDryRun.ts", "w") as f:
    f.write(content)
