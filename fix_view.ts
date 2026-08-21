import fs from "fs";
import path from "path";

const targetFile = path.resolve("./src/views/CanonicalMatificAnalysisView.tsx");
let code = fs.readFileSync(targetFile, "utf8");

// Fix the first map (Week View) which starts around line 530 and ends at 562
code = code.replace(
  /\{roster\.map\(student => \{\n\s*let plannedWeeks = 0;[\s\S]*?const percent = .*?;\n\n\s*return \(\n\s*<tr key=\{student\.studentId\} className="border-b border-slate-50 hover:bg-slate-50\/50 transition-colors">/,
  `{roster.map(student => {
                        const res = results[student.studentId] || { minutes: null, activitiesCompleted: null };
                        return (
                          <tr key={student.studentId} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">`
);

// Now apply the correct logic to the SECOND roster.map (Bimester View)
// The second map starts with `{roster.map(student => {` and originally calculated expectedMins incorrectly.
// Let's find it.
code = code.replace(
  /\{roster\.map\(student => \{\n\s*let expectedMins = 0;[\s\S]*?return \(\n\s*<tr key=\{student\.studentId\}/,
  `{roster.map(student => {
  let plannedWeeks = 0;
  let launchedWeeks = 0;
  let zeroWeeks = 0;
  let belowTargetWeeks = 0;
  let targetReachedWeeks = 0;
  let totalMinutes = 0;
  let expectedMinutes = 0;
  let totalActivities = 0;

  weeks.forEach(w => {
    if (w.countsTowardGoal) {
      plannedWeeks++;
      
      const sRes = termResults.find(r => r.weekId === w.id && r.studentId === student.studentId);
      if (sRes && sRes.minutes !== null) {
        launchedWeeks++;
        expectedMinutes += w.targetMinutes; // ONLY ADD TO EXPECTED IF LAUNCHED
        totalMinutes += sRes.minutes;
        
        if (sRes.minutes === 0) zeroWeeks++;
        else if (sRes.minutes < w.targetMinutes) belowTargetWeeks++;
        else targetReachedWeeks++;
        
        if (sRes.activitiesCompleted) totalActivities += sRes.activitiesCompleted;
      }
    }
  });

  const missingWeeks = plannedWeeks - launchedWeeks;
  const percent = expectedMinutes > 0 ? Math.round((totalMinutes / expectedMinutes) * 100) : 0;

  return (
    <tr key={student.studentId}`
);

fs.writeFileSync(targetFile, code, "utf8");
console.log("Fixed View");
