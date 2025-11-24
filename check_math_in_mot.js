
import { g } from './src/grammar.js';

function testParse(code) {
    const match = g.match(code);
    if (match.succeeded()) {
        console.log(`✅ Parsed: "${code}"`);
    } else {
        console.log(`❌ Failed: "${code}"`);
    }
}

console.log("--- Testing Math in Mots ---");
testParse("[1 + 2]");
testParse("[1 * 2]");
testParse("[0, 1 + 2, 3]");
console.log("----------------------");

