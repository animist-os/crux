// Experimental functions for Crux


/**
 * Generate a random Crux composition string with musical sense.
 * Uses heuristics to create varied, interesting compositions.
 * @returns {string} A valid Crux expression
 */
golden.generateRandomCruxString = function() {
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Heuristic: Generate a basic mot with 3-8 pips
  function generateBasicMot() {
    const len = rand(3, 8);
    const pips = [];
    for (let i = 0; i < len; i++) {
      const step = rand(-5, 7);

      // Heuristic: ~40% chance of having a timeScale modifier
      if (Math.random() < 0.4) {
        const timeOptions = ['| /2', '| /4', '| 2', '| 3/2'];
        pips.push(`${step} ${choice(timeOptions)}`);
      } else {
        pips.push(`${step}`);
      }
    }
    return `[${pips.join(', ')}]`;
  }

  // Heuristic: Sometimes include nested mots (20% chance per position)
  function generateMotWithNesting() {
    const len = rand(3, 6);
    const pips = [];
    for (let i = 0; i < len; i++) {
      if (Math.random() < 0.2 && i > 0 && i < len - 1) {
        // Generate nested mot with subdivision
        const nestedLen = rand(2, 4);
        const nested = [];
        for (let j = 0; j < nestedLen; j++) {
          nested.push(rand(-3, 5));
        }
        pips.push(`[${nested.join(',')}]/`);
      } else {
        pips.push(rand(-5, 7));
      }
    }
    return `[${pips.join(', ')}]`;
  }

  // Heuristic: Select diverse binary operators for musical variety
  // Never use the same operator twice
  const fanOps = ['*', '^', '->', 'm', 'l', 'j', 'g', 'r'];
  const cogOps = ['.', '.^', '.->', '.m', '.l', '.j', '.g', '.r'];
  const allOps = [...fanOps, ...cogOps];

  // Shuffle and select 1-3 operators
  const shuffled = allOps.sort(() => Math.random() - 0.5);
  const numOps = rand(1, 3);
  const selectedOps = shuffled.slice(0, numOps);

  // Generate RHS mots appropriate for each operator
  function generateRhsForOp(op) {
    // Heuristic: Different operators need different RHS patterns
    switch(op) {
      case '*':
      case '.':
        // Addition: use intervals, sometimes with rests
        const addPips = rand(2, 4);
        const vals = [];
        for (let i = 0; i < addPips; i++) {
          if (Math.random() < 0.15) {
            vals.push('r');
          } else {
            vals.push(rand(-3, 5));
          }
        }
        return `[${vals.join(', ')}]`;

      case '^':
      case '.^':
        // Multiply: use smaller values, sometimes negative for inversion
        return `[${Math.random() < 0.3 ? -1 : rand(2, 3)}]`;

      case '->':
      case '.->':
        // Fill/steps: single value
        return `[${rand(1, 3)}]`;

      case 'm':
      case '.m':
        // Mirror: single pivot value
        return `[${rand(0, 4)}]`;

      case 'l':
      case '.l':
        // Lens: window size
        return `[${Math.random() < 0.5 ? 2 : -2}]`;

      case 'j':
      case '.j':
        // Jam: replacement values or rhythmic patterns
        if (Math.random() < 0.5) {
          return `[${rand(-2, 5)}]`;
        } else {
          return `[| 1, | /2, | /2]`;
        }

      case 'g':
      case '.g':
        // Glass: contrasting pitches
        return `[${rand(0, 2)}, ${rand(3, 7)}]`;

      case 'r':
      case '.r':
        // Reich: phasing intervals
        return `[${rand(1, 3)}, ${rand(4, 6)}]`;

      default:
        return `[${rand(0, 3)}]`;
    }
  }

  // Build the expression
  let expr = Math.random() < 0.3 ? generateMotWithNesting() : generateBasicMot();

  // Apply selected operators with unique RHS for each
  for (const op of selectedOps) {
    expr += ` ${op} ${generateRhsForOp(op)}`;
  }

  // Heuristic: Sometimes add a repeat (40% chance)
  if (Math.random() < 0.4) {
    expr += ` : ${rand(2, 4)}`;
  }

  return expr;
}
