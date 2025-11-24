
import { g } from './src/grammar.js';
import { evaluate } from './src/index.js'; 

console.log("--- Testing Semantic Evaluation ---");

const testEval = (code) => {
    try {
        const result = evaluate(code);
        console.log(`${code} => ${JSON.stringify(result)}`);
    } catch (e) {
        console.log(`Error evaluating ${code}: ${e.message}`);
    }
}

// We expect these to fail semantics right now because we haven't implemented PriExpr_pipAsMot yet
testEval("2");
console.log("----------------------");
