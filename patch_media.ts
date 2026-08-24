import fs from "fs";
import path from "path";

const targetFile = path.resolve("./src/views/CanonicalMatificAnalysisView.tsx");
let code = fs.readFileSync(targetFile, "utf8");

code = code.replace(
  /const mediaMinutos = alunosLancados > 0 \? Math\.round\(totalMinutos \/ alunosLancados\) : 0;/,
  'const mediaMinutos = alunosLancados > 0 ? String(Math.round(totalMinutos / alunosLancados)) : "—";'
);

fs.writeFileSync(targetFile, code, "utf8");
console.log("Media fixed");
