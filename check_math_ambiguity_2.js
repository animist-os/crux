
import { g } from './src/grammar.js';

function testParse(code) {
    const match = g.match(code);
    if (match.succeeded()) {
        console.log(`✅ Parsed: "${code}"`);
    } else {
        console.log(`❌ Failed: "${code}"`);
    }
}

console.log("--- Testing Ambiguity with Math ---");
// User concern: [[0], [[1] + [2]], [5]]
// Crux does not have "+" for Mots.
testParse("[[1] + [2]]"); // Should fail if + only works on numbers in StepValue
testParse("[1 + [2]]"); // Should fail
testParse("[[1] + 2]"); // Should fail
console.log("----------------------");

