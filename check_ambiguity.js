
import { g } from './src/grammar.js';

function testParse(code) {
    const match = g.match(code);
    if (match.succeeded()) {
        console.log(`✅ Parsed: "${code}"`);
    } else {
        console.log(`❌ Failed: "${code}"`);
        // console.log(match.message);
    }
}

console.log("--- Testing Math Ambiguities ---");
testParse("1 + 2");
testParse("[1 + 2]");
testParse("1 * 2");
testParse("[1 * 2]");
testParse("[0, 1 + 2, 5]");
testParse("0, 1 + 2, 5"); // Comma is concatenation in Expr
testParse("0, 1 * 2, 5"); 
console.log("----------------------");

