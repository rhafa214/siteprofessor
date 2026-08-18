import re

with open("src/data/migration/MigrationDryRun.ts", "r") as f:
    content = f.read()

# 1. processSourceForStudents to async
content = content.replace(
    "const processSourceForStudents = (sourceName: string, dataMap: Record<string, unknown>) => {",
    "const processSourceForStudents = async (sourceName: string, dataMap: Record<string, unknown>) => {"
)

# 2. await processSourceForStudents
content = content.replace(
    "processSourceForStudents('taskAnalysis', snapshot.firestoreData.taskAnalysis || {});",
    "await processSourceForStudents('taskAnalysis', snapshot.firestoreData.taskAnalysis || {});"
)
content = content.replace(
    "processSourceForStudents('matificAnalysis', snapshot.firestoreData.matificAnalysis || {});",
    "await processSourceForStudents('matificAnalysis', snapshot.firestoreData.matificAnalysis || {});"
)
content = content.replace(
    "processSourceForStudents('pp_', snapshot.firestoreData.pp_ || {});",
    "await processSourceForStudents('pp_', snapshot.firestoreData.pp_ || {});"
)

# 3. Object.entries(dataMap).forEach => for of
# Need to be careful here
pattern_outer_loop = r"Object\.entries\(dataMap\)\.forEach\(\(\[legacyClassId, data\]\) => \{"
replacement_outer_loop = r"for (const [legacyClassId, data] of Object.entries(dataMap)) {"
content = re.sub(pattern_outer_loop, replacement_outer_loop, content)

# Since we replaced `.forEach(() => {` with `for() {`, we need to find where it ends and remove the `});`
# The end of the outer loop is just before `if (sourceName === 'matificAnalysis') {`
pattern_end_outer = r"      \}\);\n    \}\);\n\n    if \(sourceName === 'matificAnalysis'\)"
replacement_end_outer = r"      });\n    }\n\n    if (sourceName === 'matificAnalysis')"
content = re.sub(pattern_end_outer, replacement_end_outer, content)

# 4. await generateDeterministicFingerprint
content = content.replace(
    "const fingerprint = generateDeterministicFingerprint(legacyClassId);",
    "const fingerprint = await generateDeterministicFingerprint(legacyClassId);"
)

# 5. Fix type comparisons
# src/data/migration/MigrationDryRun.ts(219,53): error TS2367: This comparison appears to be unintentional because the types 'string' and 'Promise<string>' have no overlap.
# src/data/migration/MigrationDryRun.ts(221,21): error TS2322: Type 'Promise<string>' is not assignable to type 'string'.
# Let's inspect these lines

with open("src/data/migration/MigrationDryRun.ts", "w") as f:
    f.write(content)
