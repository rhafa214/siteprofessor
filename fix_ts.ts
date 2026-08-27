import fs from "fs";

// Fix BimestralGradeService
let bg = fs.readFileSync("src/services/academic/BimestralGradeService.ts", "utf8");
bg = bg.replace(/const sheets = await this\.canonicalService\.getSheetsByCategory\(uid, academicYearId, termId, classGroupId, cat\);/g, 
  "const sheet = await this.canonicalService.getSheet(uid, academicYearId, termId, classGroupId, cat);");
bg = bg.replace(/if \(sheets\.length > 0\) \{/g, "if (sheet) {");
bg = bg.replace(/const sheet = sheets\[0\];/g, "");
bg = bg.replace(/enroll\.student\.name/g, "enroll.name");
fs.writeFileSync("src/services/academic/BimestralGradeService.ts", bg);

// Fix CalculadoraMediaView
let cv = fs.readFileSync("src/views/CalculadoraMediaView.tsx", "utf8");
cv = cv.replace(
  'import { AcademicRosterService } from "../services/academic/AcademicRosterService";',
  'import { AcademicRosterService } from "../services/academic/AcademicRosterService";\nimport { StudentRepository } from "../repositories/StudentRepository";\nimport { EnrollmentRepository } from "../repositories/EnrollmentRepository";'
);
cv = cv.replace(
  'new AcademicRosterService(),',
  'new AcademicRosterService(new StudentRepository(), new EnrollmentRepository()),'
);
cv = cv.replace(
  /<BimestralReportView[\s\S]*?\/>/g,
  `<BimestralReportView
          selectedBimestre={selectedBimestre}
          gradesData={{}}
          selectedTurma={selectedTurma}
        />`
);
fs.writeFileSync("src/views/CalculadoraMediaView.tsx", cv);
