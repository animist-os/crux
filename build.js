// build.js - Bundle Crux into a single distributable file
//
// Emits two artifacts and (when running inside disrupterbox) auto-installs
// the Doh-wrapped variant into the consuming Doh module:
//
//   dist/crux.cjs       - standalone CommonJS bundle for non-Doh consumers
//                         (requires ohm-js via require/globalThis/window).
//
//   dist/crux.doh.js    - Doh-wrapped variant. Same source content, but
//                         (a) ohm is provided as a callback parameter from
//                             the Doh.Module dependency list, and
//                         (b) golden is provided as a callback parameter,
//                             so the standalone `const golden = …` /
//                             `globalThis.golden = golden;` bootstrap lines
//                             from src/index.js are stripped, and
//                         (c) the trailing module.exports / globalThis block
//                             from the CJS bundle is omitted entirely.
//
// When this build runs from a checkout that sits next to disrupterbox's
// modules/golden/ folder, dist/crux.doh.js is also written directly to
// modules/golden/crux.js as a final step. Pass --no-install to skip that
// step (useful for standalone crux development).
//
// Flags:
//   --no-install  do not write modules/golden/crux.js
//   --check       write nothing; exit 1 if dist/ or the installed copy does
//                 not match the current source (timestamps are ignored)
//   --watch       build, then rebuild each time src/ or package.json changes
//
// A build whose output differs from the file on disk only in its timestamp
// leaves that file alone, so a no-op build does not dirty the working tree.
//
// modules/golden/crux.js is therefore a generated artifact - edits made
// directly to it will be overwritten on the next build. See
// docs/crux-rebuild.md in the disrupterbox repo for the full workflow.
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const watchMode = args.includes('--watch');
const skipInstall = args.includes('--no-install');

console.log(checkOnly ? '🔎 Checking Crux bundles against source...\n' : '🔨 Building Crux bundle...\n');

// Read package.json so we can stamp the version into the bundles.
// crux/package.json is the single source of truth for the Crux version;
// bumping it there flows through both dist artifacts and the consumer UI.
const pkgPath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version || '0.0.0';
console.log(`📦 Crux version: ${version}`);

// Read the modular source files
console.log('📝 Reading src/grammar.js...');
const grammarPath = path.join(__dirname, 'src/grammar.js');
let grammarContent = fs.readFileSync(grammarPath, 'utf8');

console.log('📝 Reading src/index.js...');
const indexPath = path.join(__dirname, 'src/index.js');
let indexContent = fs.readFileSync(indexPath, 'utf8');

console.log('📝 Reading src/decompose.js...');
const decomposePath = path.join(__dirname, 'src/decompose.js');
let decomposeContent = fs.readFileSync(decomposePath, 'utf8');

// Remove ES6 imports since we'll use require or global ohm
grammarContent = grammarContent.replace(/^import \* as ohm from ['"]ohm-js['"];?\s*\n/m, '');
grammarContent = grammarContent.replace(/^export \{ g \};?\s*\n?/m, '');
grammarContent = grammarContent.replace(/^export const g = /m, 'const g = ');

indexContent = indexContent.replace(/^import \* as ohm from ['"]ohm-js['"];?\s*\n/m, '');
indexContent = indexContent.replace(/^import \{ g \} from ['"]\.\/grammar\.js['"];?\s*\n/m, '');

decomposeContent = decomposeContent.replace(/^import ['"]\.\/index\.js['"];?\s*\n/m, '');

// Fold view (src/fold): trace and model. Each file runs in its own function
// scope in the bundle, so its top-level names do not meet index.js's. They
// attach their API to golden (crux_trace, crux_fold_model, crux_fold).
// thematic.js is imported by model.js: its scope returns thematicFolds.
console.log('📝 Reading src/fold/{trace,thematic,model}.js...');
const foldContent = ['trace.js', 'thematic.js', 'model.js'].map(file => {
  const body = fs.readFileSync(path.join(__dirname, 'src/fold', file), 'utf8')
    .replace(/^import .*;\s*\n/gm, '')
    .replace(/^export const .*;\s*\n/gm, '')
    .replace(/^export function /gm, 'function ');
  if (file === 'thematic.js') return `// --- src/fold/${file} ---\nconst thematicFolds = (function () {\n${body}\nreturn thematicFolds;\n})();\n`;
  return `// --- src/fold/${file} ---\n(function () {\n${body}\n})();\n`;
}).join('\n');

// For now, just note that ohm-js needs to be available
// In your actual environment, you'll load ohm-js separately or inline it
const generatedAt = new Date().toISOString();

const bundle = `// Crux - Musical Motif DSL
// Bundled Distribution
// Generated: ${generatedAt}
//
// NOTE: This bundle requires ohm-js as a peer dependency

// Load ohm-js (CommonJS)
var ohm = (typeof require !== 'undefined') ? require('ohm-js') : (globalThis.ohm || (typeof window !== 'undefined' && window.ohm));
if (!ohm) {
  throw new Error('ohm-js is required. Install with: npm install ohm-js');
}

// === Grammar ===
${grammarContent}

// === Main Implementation ===
${indexContent}

// === Version (stamped by crux/build.js from crux/package.json) ===
golden.cruxVersion = ${JSON.stringify(version)};
golden.cruxBuiltAt = ${JSON.stringify(generatedAt)};

// === Decomposition Engine ===
${decomposeContent}

// === Fold view ===
${foldContent}

// === Exports ===
if (typeof module !== 'undefined' && module.exports) {
  module.exports = golden;
  module.exports.default = golden;
}
if (typeof globalThis !== 'undefined') globalThis.golden = golden;
if (typeof window !== 'undefined') window.golden = golden;
`;

// Doh-wrapped variant: golden + ohm come from the Doh.Module callback parameters,
// so we strip the standalone golden bootstrap lines from index.js's content.
const indexContentForDoh = indexContent
  .replace(/^const golden = globalThis\.golden \|\| \{\};\s*\n/m, '')
  .replace(/^globalThis\.golden = golden;\s*\n/m, '');

const dohBundle = `// =============================================================================
// AUTO-GENERATED FILE - DO NOT EDIT BY HAND
// -----------------------------------------------------------------------------
// This file is the Doh-wrapped distribution of the Crux DSL. It is produced by
// crux/build.js, which concatenates crux/src/{grammar,index,decompose}.js and
// wraps the result in a Doh.Module callback so that:
//
//   - ohm is injected from the Doh dependency list (no require / globalThis)
//   - golden is the Doh.Module callback parameter (with = {} as the SPR/
//     globals binding), so the standalone golden bootstrap from src/index.js
//     is stripped, and there is no module.exports trailer.
//
// To change anything in this file, edit the corresponding source under
// crux/src/ (or the template in crux/build.js) and re-run \`node build.js\`
// from inside crux/. When run from a disrupterbox checkout, the build copies
// the result back here. See docs/crux-rebuild.md in the disrupterbox repo.
//
// Source:    crux/src/{grammar,index,decompose}.js, crux/src/fold/{trace,thematic,model}.js
// Generated: ${generatedAt}
// =============================================================================
Doh.Module('crux', [
  'ohm',
  //'crux_provenance_index',
], function (ohm, golden = {}) {

// === Grammar ===
${grammarContent}

// === Main Implementation ===
// (golden is provided by the Doh.Module callback parameter above)
${indexContentForDoh}

// === Version (stamped by crux/build.js from crux/package.json) ===
golden.cruxVersion = ${JSON.stringify(version)};
golden.cruxBuiltAt = ${JSON.stringify(generatedAt)};

// === Decomposition Engine ===
${decomposeContent}

// === Fold view ===
${foldContent}

});
`;

// The two timestamp lines change on every build. Compare without them.
const stripStamps = text => text
  .replace(/^\/\/ Generated: .*$/m, '')
  .replace(/^golden\.cruxBuiltAt = .*$/m, '');
const isCurrent = (file, content) =>
  fs.existsSync(file) && stripStamps(fs.readFileSync(file, 'utf8')) === stripStamps(content);

const distDir = path.join(__dirname, 'dist');
const bundlePath = path.join(distDir, 'crux.cjs');
const dohBundlePath = path.join(distDir, 'crux.doh.js');
const goldenTarget = path.resolve(__dirname, '../modules/golden/crux.js');
const install = !skipInstall && fs.existsSync(path.dirname(goldenTarget));

const outputs = [
  [bundlePath, bundle],
  [dohBundlePath, dohBundle],
];
if (install) outputs.push([goldenTarget, dohBundle]);

if (checkOnly) {
  const stale = outputs.filter(([file, content]) => !isCurrent(file, content)).map(([file]) => file);
  if (stale.length) {
    console.error('❌ Stale Crux bundle. These files do not match crux/src:');
    for (const file of stale) console.error(`   ${file}`);
    console.error('\n   Run `node build.js` in crux/ to rebuild.');
    process.exit(1);
  }
  console.log('✅ Bundles match the current source.');
  process.exit(0);
}

fs.mkdirSync(distDir, { recursive: true });
console.log('');
for (const [file, content] of outputs) {
  const sizeKB = (Buffer.byteLength(content) / 1024).toFixed(2);
  if (isCurrent(file, content)) {
    console.log(`   ⏸  unchanged ${file}`);
  } else {
    fs.writeFileSync(file, content);
    console.log(`   ${file === goldenTarget ? '📥 Installed →' : '📄'} ${file} (${sizeKB} KB)`);
  }
}
console.log('\n✅ Build complete.');

// --watch: rebuild in a child process each time the source changes. A child
// process keeps this script a plain top-to-bottom build, and a syntax error
// in a rebuild does not stop the watcher.
if (watchMode) {
  const childArgs = [fileURLToPath(import.meta.url), ...args.filter(a => a !== '--watch')];
  let timer = null;
  let running = false;
  let again = false;
  const rebuild = () => {
    if (running) { again = true; return; }
    running = true;
    console.log(`\n♻️  ${new Date().toLocaleTimeString()} source changed, rebuilding...`);
    const child = spawn(process.execPath, childArgs, { stdio: ['ignore', 'ignore', 'inherit'] });
    child.on('exit', code => {
      running = false;
      console.log(code === 0 ? '   ✅ rebuilt' : `   ❌ build failed (exit ${code})`);
      if (again) { again = false; rebuild(); }
    });
  };
  const onChange = (event, filename) => {
    if (filename && /(^|[\\/])\.|~$/.test(String(filename))) return; // dotfiles, editor backups
    clearTimeout(timer);
    timer = setTimeout(rebuild, 150);
  };
  fs.watch(path.join(__dirname, 'src'), { recursive: true }, onChange);
  fs.watch(pkgPath, onChange);
  console.log('\n👀 Watching crux/src and package.json. Ctrl+C to stop.');
} else {
  console.log(`\n💡 Usage:`);
  console.log(`   const golden = require('./dist/crux.cjs');`);
  console.log(`   // or in Doh: the dist/crux.doh.js bundle is consumed by modules/golden/crux.js\n`);
}
