import './src/index.js';

const { parse } = golden;

const examples = [
  '[0, 1, 2, 3, 4, 5] .~ [0, 1, 2]',
  '[0, 1, 2, 3] .~ [0, 0, 0, -2]',
  '[0, 10, 20, 30, 40] .~ [1, 2, 3, 4, 5]',
  '[[0,1], [2,3], [4,5], [6,7]] .~ [2, 0, 1]',
  '[0, 1, 2] .~ [-1, 0, 1]',
];

examples.forEach(ex => {
  const prog = parse(ex);
  const result = prog.interp();
  const lastSection = result.sections[result.sections.length - 1];
  console.log(`${ex}`);
  console.log(`  → ${lastSection.toString()}`);
  console.log();
});
