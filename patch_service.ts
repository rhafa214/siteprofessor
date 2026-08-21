import fs from "fs";
import path from "path";

const targetFile = path.resolve("./src/services/academic/MatificService.ts");
let code = fs.readFileSync(targetFile, "utf8");

// replace generateWeeksFromDates
code = code.replace(
  /async generateWeeksFromDates\([\s\S]*?return weeks;\n  \}/,
  `async generateWeeksFromDates(
    uid: string,
    academicYearId: string,
    termId: string,
    classGroupId: string,
    startDateStr: string,
    endDateStr: string
  ): Promise<CanonicalMatificWeek[]> {
    const batch = writeBatch(db);
    
    let currentStart = new Date(\`\${startDateStr}T12:00:00Z\`);
    const end = new Date(\`\${endDateStr}T12:00:00Z\`);
    
    const weeks: CanonicalMatificWeek[] = [];
    let weekNum = 1;
    
    while (currentStart <= end) {
      let currentEnd = new Date(currentStart);
      const dayOfWeek = currentEnd.getUTCDay();
      const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
      currentEnd.setUTCDate(currentEnd.getUTCDate() + daysUntilFriday);
      
      if (currentEnd > end) {
        currentEnd = new Date(end);
      }
      
      const sDate = currentStart.toISOString().split("T")[0];
      const eDate = currentEnd.toISOString().split("T")[0];
      
      const safeTermId = termId.replace(/[^a-zA-Z0-9]/g, '_');
      const weekId = \`week_\${academicYearId}_\${safeTermId}_\${classGroupId}_\${weekNum}\`;
      
      const w: CanonicalMatificWeek = {
        id: weekId,
        uid,
        academicYearId,
        termId,
        classGroupId,
        weekNumber: weekNum,
        startDate: sDate,
        endDate: eDate,
        targetMinutes: 30,
        countsTowardGoal: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      const ref = doc(db, "users", uid, "matificWeeks", weekId);
      batch.set(ref, w, { merge: true });
      weeks.push(w);
      
      currentStart = new Date(currentEnd);
      currentStart.setUTCDate(currentStart.getUTCDate() + (8 - currentEnd.getUTCDay()));
      weekNum++;
    }
    
    await batch.commit();
    return weeks;
  }`
);

// replace saveWeeklyResults
code = code.replace(
  /async saveWeeklyResults\([\s\S]*?await batch.commit\(\);\n  \}/,
  `async saveWeeklyResults(uid: string, weekId: string, results: CanonicalMatificWeeklyResult[]): Promise<void> {
    const batch = writeBatch(db);
    
    for (const res of results) {
      const resultId = \`result_\${weekId}_\${res.studentId}\`;
      const ref = doc(db, "users", uid, "matificWeeklyResults", resultId);
      
      const dataToSave: any = {
        ...res,
        id: resultId,
        updatedAt: Date.now()
      };
      if (!res.createdAt) {
        dataToSave.createdAt = Date.now();
      }
      
      batch.set(ref, dataToSave, { merge: true });
    }
    
    await batch.commit();
  }`
);

fs.writeFileSync(targetFile, code, "utf8");
console.log("MatificService patched");
