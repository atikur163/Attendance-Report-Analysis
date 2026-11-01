import { runAllAutomatedTests } from '../src/services/testRunner';

console.log('--- Executing UniAttend Automated Test Suite ---');
const res = runAllAutomatedTests();
console.log(`TOTAL TESTS: ${res.total}`);
console.log(`PASSED: ${res.passed}`);
console.log(`FAILED: ${res.failed}`);

if (res.failed > 0) {
  console.error('\nFAILED TESTS:');
  res.results.filter(r => !r.passed).forEach(f => {
    console.error(`[${f.category}] ${f.name}`);
    console.error(`  Expected: ${f.expected}`);
    console.error(`  Actual:   ${f.actual}`);
  });
  process.exit(1);
} else {
  console.log('\nAll automated tests passed successfully!');
  res.results.forEach(r => {
    console.log(`✓ [${r.category}] ${r.name}`);
  });
  process.exit(0);
}
