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
// modules/golden/crux.js is therefore a generated artifact - edits made
// directly to it will be overwritten on the next build. See CRUX_UPDATE.md
// in the disrupterbox repo root for the full workflow.
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔨 Building Crux bundle...\n');

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
// the result back here. See CRUX_UPDATE.md in the disrupterbox repo root.
//
// Source:    crux/src/{grammar,index,decompose}.js
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

});
`;

// Write both bundles
const distDir = path.join(__dirname, 'dist');
fs.mkdirSync(distDir, { recursive: true });

const bundlePath = path.join(distDir, 'crux.cjs');
fs.writeFileSync(bundlePath, bundle);

const dohBundlePath = path.join(distDir, 'crux.doh.js');
fs.writeFileSync(dohBundlePath, dohBundle);

const stats = fs.statSync(bundlePath);
const sizeKB = (stats.size / 1024).toFixed(2);

const dohStats = fs.statSync(dohBundlePath);
const dohSizeKB = (dohStats.size / 1024).toFixed(2);

console.log(`\n✅ Bundles created successfully!`);
console.log(`   📄 ${bundlePath} (${sizeKB} KB)`);
console.log(`   📄 ${dohBundlePath} (${dohSizeKB} KB)`);

// Auto-install into golden when running inside disrupterbox.
// Skip with --no-install for standalone crux development.
const skipInstall = process.argv.includes('--no-install');
const goldenTarget = path.resolve(__dirname, '../modules/golden/crux.js');
if (!skipInstall && fs.existsSync(path.dirname(goldenTarget))) {
  fs.writeFileSync(goldenTarget, dohBundle);
  console.log(`   📥 Installed → ${goldenTarget}`);
}

console.log(`\n💡 Usage:`);
console.log(`   const golden = require('./dist/crux.cjs');`);
console.log(`   // or in Doh: the dist/crux.doh.js bundle is consumed by modules/golden/crux.js\n`);
