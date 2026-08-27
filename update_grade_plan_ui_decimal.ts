import fs from "fs";

let content = fs.readFileSync("src/views/GradePlanConfigView.tsx", "utf8");

// Remove parseInt
content = content.replace(
  'newComps[index].weight = parseInt(val, 10) || 0;',
  'newComps[index].weight = Number(val);'
);

// Fix totalWeight
content = content.replace(
  'const totalWeight = components.reduce((sum, c) => sum + (c.enabled ? Math.floor(Number(c.weight)) : 0), 0);',
  'const totalWeight = components.reduce((sum, c) => sum + (c.enabled ? Number(c.weight) : 0), 0);'
);

// Define hasInvalidWeights
content = content.replace(
  'const hasDecimals = components.some(c => c.enabled && !Number.isInteger(c.weight));\n  const isValid = totalWeight === 100 && !hasPending && !hasDecimals;',
  'const hasInvalidWeights = components.some(c => c.enabled && (!Number.isFinite(c.weight) || !Number.isInteger(c.weight) || c.weight < 0 || c.weight > 100));\n  const isValid = totalWeight === 100 && !hasPending && !hasInvalidWeights;'
);

// Disable DRAFT save if invalid
content = content.replace(
  'const handleSave = async (activate: boolean) => {\n    if (activate && !isValid) {',
  'const handleSave = async (activate: boolean) => {\n    if (hasInvalidWeights) {\n      showAlert("Use apenas percentuais inteiros entre 0 e 100.", "error");\n      return;\n    }\n    if (activate && !isValid) {'
);

// Disable DRAFT button
content = content.replace(
  'disabled={saving}\n            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"',
  'disabled={saving || hasInvalidWeights}\n            className={`px-4 py-2 font-bold rounded-xl transition-colors ${hasInvalidWeights ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"}`}'
);


// Show UI validation message
content = content.replace(
  'TOTAL: {totalWeight}%\n          </div>\n        </div>',
  'TOTAL: {totalWeight}%\n          </div>\n        </div>\n        {hasInvalidWeights && (\n          <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-xl font-bold flex items-center gap-2">\n            <AlertCircle size={18} /> Use apenas percentuais inteiros entre 0 e 100.\n          </div>\n        )}'
);

fs.writeFileSync("src/views/GradePlanConfigView.tsx", content);
