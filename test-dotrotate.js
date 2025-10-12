import './src/index.js';

const { parse } = golden;

function evalToString(input) {
  const prog = parse(input);
  const result = prog.interp();
  const lastSection = result.sections[result.sections.length - 1];
  return lastSection.toString();
}

console.log('Testing new DotRotate behavior:\n');

console.log('[0, 1, 2, 3] .~ [1]');
console.log('  Expected: each position i picks element at (i+1) % 4');
console.log('  i=0: (0+1)%4=1 → 1');
console.log('  i=1: (1+1)%4=2 → 2');
console.log('  i=2: (2+1)%4=3 → 3');
console.log('  i=3: (3+1)%4=0 → 0');
console.log('  Result:', evalToString('[0, 1, 2, 3] .~ [1]'));

console.log('\n[0, 1, 2, 3] .~ [1, 2]');
console.log('  Expected: positions alternate between +1 and +2 offset');
console.log('  i=0: (0+1)%4=1 → 1');
console.log('  i=1: (1+2)%4=3 → 3');
console.log('  i=2: (2+1)%4=3 → 3');
console.log('  i=3: (3+2)%4=1 → 1');
console.log('  Result:', evalToString('[0, 1, 2, 3] .~ [1, 2]'));

console.log('\n[0, 1, 2, 3] .~ [1, 2, 0]');
console.log('  Expected: offsets cycle through +1, +2, +0');
console.log('  i=0: (0+1)%4=1 → 1');
console.log('  i=1: (1+2)%4=3 → 3');
console.log('  i=2: (2+0)%4=2 → 2');
console.log('  i=3: (3+1)%4=0 → 0');
console.log('  Result:', evalToString('[0, 1, 2, 3] .~ [1, 2, 0]'));

console.log('\n[0, 1, 2, 3] .~ [0]');
console.log('  Expected: no rotation (identity)');
console.log('  Result:', evalToString('[0, 1, 2, 3] .~ [0]'));

console.log('\n[0, 1, 2, 3] .~ [-1]');
console.log('  Expected: each position picks element at (i-1) % 4');
console.log('  i=0: (0-1)%4=3 → 3');
console.log('  i=1: (1-1)%4=0 → 0');
console.log('  i=2: (2-1)%4=1 → 1');
console.log('  i=3: (3-1)%4=2 → 2');
console.log('  Result:', evalToString('[0, 1, 2, 3] .~ [-1]'));
