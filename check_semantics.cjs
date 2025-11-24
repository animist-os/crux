
const golden = require('./dist/crux.cjs');

console.log("--- Testing Semantic Evaluation ---");

const testEval = (code) => {
    try {
        const result = golden.evaluate(code);
        // Stringify can handle circular structures if necessary, but here we expect simple arrays
        console.log(`${code} => ${JSON.stringify(result)}`);
    } catch (e) {
        console.log(`Error evaluating "${code}": ${e.message}`);
    }
}

// Test cases
testEval("2");
testEval("[2]");
console.log("----------------------");

