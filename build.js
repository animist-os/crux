// build.js - Bundle Crux into a single distributable file
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔨 Building Crux bundle...\n');

// Read the current monolithic index.js which already has everything
console.log('📝 Reading src/index.js...');
const indexPath = path.join(__dirname, 'src/index.js');
let indexContent = fs.readFileSync(indexPath, 'utf8');

// Remove ES6 import since we'll use require or global ohm
indexContent = indexContent.replace(/^import \* as ohm from ['"]ohm-js['"];?\s*\n/m, '');

// For now, just note that ohm-js needs to be available
// In your actual environment, you'll load ohm-js separately or inline it
const bundle = `// Crux - Musical Motif DSL
// Bundled Distribution
// Generated: ${new Date().toISOString()}
//
// NOTE: This bundle requires ohm-js as a peer dependency

// Load ohm-js (CommonJS)
var ohm = (typeof require !== 'undefined') ? require('ohm-js') : (globalThis.ohm || (typeof window !== 'undefined' && window.ohm));
if (!ohm) {
  throw new Error('ohm-js is required. Install with: npm install ohm-js');
}

${indexContent}

// === Exports ===
if (typeof module !== 'undefined' && module.exports) {
  module.exports = golden;
  module.exports.default = golden;
}
if (typeof globalThis !== 'undefined') globalThis.golden = golden;
if (typeof window !== 'undefined') window.golden = golden;
`;

// Write the bundle
const distDir = path.join(__dirname, 'dist');
fs.mkdirSync(distDir, { recursive: true });

const bundlePath = path.join(distDir, 'crux.cjs');
fs.writeFileSync(bundlePath, bundle);

const stats = fs.statSync(bundlePath);
const sizeKB = (stats.size / 1024).toFixed(2);

console.log(`\n✅ Bundle created successfully!`);
console.log(`   📄 ${bundlePath}`);
console.log(`   📦 Size: ${sizeKB} KB`);
console.log(`\n💡 Usage:`);
console.log(`   const golden = require('./dist/crux.cjs');`);
console.log(`   // or in your environment: load crux.cjs after ohm-js\n`);
