import fs from "fs";

let content = fs.readFileSync("src/views/EvaluationsView.tsx", "utf8");

// Add GradePlanConfigView import
content = content.replace(
  'import CalculadoraMediaView from "./CalculadoraMediaView";',
  'import CalculadoraMediaView from "./CalculadoraMediaView";\nimport GradePlanConfigView from "./GradePlanConfigView";'
);

// Add "grade-plan" to the activeTab type
content = content.replace(
  '| "medias"',
  '| "medias"\n    | "grade-plan"'
);

// Add to header title
content = content.replace(
  '{activeTab === "medias" && "Média Bimestral"}',
  '{activeTab === "medias" && "Média Bimestral"}\n                {activeTab === "grade-plan" && "Plano de Avaliação"}'
);

// Add to routing
content = content.replace(
  '{activeTab === "medias" && (',
  '{activeTab === "grade-plan" && (\n            <GradePlanConfigView selectedBimestre={selectedBimestre} />\n          )}\n\n          {activeTab === "medias" && ('
);

// Add the card to the grid. Find the end of the cards and insert it.
const mediasCardRegex = /<motion\.div[\s\S]*?onClick=\{\(\) => setActiveTab\("medias"\)\}[\s\S]*?<\/motion\.div>/;
const match = content.match(mediasCardRegex);
if (match) {
  const cardCode = `
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group flex flex-col items-center justify-center text-center h-48 gap-4"
            onClick={() => setActiveTab("grade-plan")}
          >
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors">
              Plano de Avaliação
            </h3>
          </motion.div>
`;
  content = content.replace(match[0], cardCode + '\n' + match[0]);
}

fs.writeFileSync("src/views/EvaluationsView.tsx", content);
