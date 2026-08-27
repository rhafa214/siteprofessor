import fs from "fs";

let cv = fs.readFileSync("src/views/CalculadoraMediaView.tsx", "utf8");
cv = cv.replace(
  'import { StudentRepository } from "../repositories/StudentRepository";',
  'import { StudentRepository } from "../data/repositories/StudentRepository";'
);
cv = cv.replace(
  'import { EnrollmentRepository } from "../repositories/EnrollmentRepository";',
  'import { EnrollmentRepository } from "../data/repositories/EnrollmentRepository";'
);
fs.writeFileSync("src/views/CalculadoraMediaView.tsx", cv);
