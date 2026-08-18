with open("scripts/testFreshMatchingV7.ts", "r") as f:
    content = f.read()

test_logic = """  // Test the RESULT_SCHEMA_VALIDATED logic directly
  const isSchemaValid = (rec: number, unrec: number, unrecRecs: number) => unrecRecs === 0 && unrec === 0 && rec > 0;
  const testSchema1 = isSchemaValid(0, 288, 0) === false;
  const testSchema2 = isSchemaValid(10, 0, 0) === true;
  
  console.log('Test Schema 1 (recognizedLeaves = 0, unrecognizedLeaves = 288 -> false):', testSchema1 ? 'PASS' : 'FAIL');
  console.log('Test Schema 2 (recognizedLeaves > 0, unrecognizedLeaves = 0 -> true):', testSchema2 ? 'PASS' : 'FAIL');

"""

content = content.replace("  // I) recognizedLeaves = 0 e unrecognizedLeaves > 0 -> false", test_logic + "  // I) recognizedLeaves = 0 e unrecognizedLeaves > 0 -> false")

with open("scripts/testFreshMatchingV7.ts", "w") as f:
    f.write(content)
