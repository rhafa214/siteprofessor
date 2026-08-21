import fs from "fs";
import path from "path";

const targetFile = path.resolve("./src/views/CanonicalMatificAnalysisView.tsx");
let code = fs.readFileSync(targetFile, "utf8");

// Re-apply AcademicTermService import correctly
if (!code.includes("AcademicTermService")) {
  code = code.replace(
    /import \{ MatificService.*?\n/,
    `$&import { AcademicTermService } from "../services/academic/AcademicTermService";\n`
  );
}

if (!code.includes("termService = useRef")) {
  code = code.replace(
    /const matificService = useRef\(new MatificService\(\)\);/,
    `const matificService = useRef(new MatificService());\n  const termService = useRef(new AcademicTermService());`
  );
}

// Full replace of the table mapping logic that got mangled in the first patch attempt
code = code.replace(
  /\{roster\.map\(student => \{[\s\S]*?return \(\n\s*<tr key=\{student\.studentId\}/,
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

// We need to fix the TS errors about `res` missing in the WEEK view, because my previous patch replaced the map but forgot to declare `res` in the context of the week view table.
// Let's find the week view map.
// The map looks like this: {roster.map(student => { ... const res = results[student.studentId] || { minutes: null, activitiesCompleted: null };
// Ah, the first patch attempt for the table row calculation replaced `roster.map` which exists TWICE in the file! Once for the week view, once for the bimester view.
// I need to read the whole file to fix it properly.
