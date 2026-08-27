import fs from "fs";

let content = fs.readFileSync("src/views/GradePlanConfigView.tsx", "utf8");

// Force parsing string as integer
content = content.replace(
  'newComps[index].weight = Number(val) || 0;',
  'newComps[index].weight = parseInt(val, 10) || 0;'
);

// Check if there are non-integers in the state (just in case they somehow got there)
content = content.replace(
  'const totalWeight = components.reduce((sum, c) => sum + (c.enabled ? Number(c.weight) : 0), 0);',
  'const totalWeight = components.reduce((sum, c) => sum + (c.enabled ? Math.floor(Number(c.weight)) : 0), 0);'
);

// Ensure the input prevents decimals
content = content.replace(
  'type="number"',
  'type="number"\n                    step="1"'
);

// To ensure UI reflects strictly integer values for isValid
content = content.replace(
  'const isValid = totalWeight === 100 && !hasPending;',
  'const hasDecimals = components.some(c => c.enabled && !Number.isInteger(c.weight));\n  const isValid = totalWeight === 100 && !hasPending && !hasDecimals;'
);


fs.writeFileSync("src/views/GradePlanConfigView.tsx", content);
