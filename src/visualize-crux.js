/**
 * Integration module for visualizing Crux programs
 *
 * This module provides functions to generate visual representations
 * of Crux programs, showing how notes derive from mots through operators.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load visualization components
import {
  Provenance,
  DependencyGraphVisualizer,
  TimelineVisualizer,
  ProvenanceTreeVisualizer,
  InteractiveVisualizer
} from './visualization.js';

// Make Provenance globally available for Pip class
global.Provenance = Provenance;

/**
 * Extract environment (variable assignments) from a parsed Prog AST
 */
function extractEnvironmentFromProg(prog) {
  const env = new Map();

  if (!prog || !prog.sections) return env;

  // Walk through all sections and statements
  for (const stmts of prog.sections) {
    for (const stmt of stmts) {
      // Check if this is an Assign statement (has name and expr properties)
      if (stmt && stmt.name && stmt.expr) {
        // Store the variable name and its expression AST
        env.set(stmt.name, {
          name: stmt.name,
          expr: stmt.expr,
          dependencies: extractDependencies(stmt.expr)
        });
      }
    }
  }

  return env;
}

/**
 * Extract variable references from an expression AST
 */
function extractDependencies(expr) {
  const deps = new Set();

  if (!expr) return deps;

  // If it's a Ref (variable reference), add it
  if (expr.constructor && expr.constructor.name === 'Ref' && expr.name) {
    deps.add(expr.name);
  }

  // Recursively check binary operators
  if (expr.x) {
    const xDeps = extractDependencies(expr.x);
    xDeps.forEach(d => deps.add(d));
  }
  if (expr.y) {
    const yDeps = extractDependencies(expr.y);
    yDeps.forEach(d => deps.add(d));
  }

  // Check for nested expressions in arrays
  if (expr.values && Array.isArray(expr.values)) {
    for (const v of expr.values) {
      const vDeps = extractDependencies(v);
      vDeps.forEach(d => deps.add(d));
    }
  }

  return deps;
}

/**
 * Generate a complete interactive HTML visualization from a Crux program
 * @param {string} sourceCode - The Crux source code
 * @param {object} golden - The Crux golden object (from import golden from './index.js')
 * @param {string} outputPath - Path to write the HTML file
 * @param {string} title - Title for the visualization
 */
function visualizeCruxProgram(sourceCode, golden, outputPath, title = "Crux Visualization") {
  console.log('Parsing and evaluating Crux program...');

  // Parse the program to get AST
  const prog = golden.parse(sourceCode);

  // Evaluate to get final result
  const result = golden.crux_interp(sourceCode);

  // Extract the final mot from the last section
  const finalMot = result.sections && result.sections.length > 0
    ? result.sections[result.sections.length - 1]
    : result;

  // Extract environment from AST (variable names and their expressions)
  const environment = extractEnvironmentFromProg(prog);

  console.log(`Program evaluated successfully. Final mot has ${finalMot && finalMot.values ? finalMot.values.length : 0} values.`);
  console.log(`Environment has ${environment.size} variables.`);

  // Generate interactive visualization with source code
  const visualizer = new InteractiveVisualizer(environment, finalMot, title, sourceCode);
  const html = visualizer.generateHTML();

  // Write to file
  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`Visualization written to ${outputPath}`);

  return {
    htmlPath: outputPath,
    environment: environment,
    finalMot,
    pipCount: finalMot.values ? finalMot.values.filter(v => v.step !== undefined).length : 0
  };
}

/**
 * Generate just the timeline SVG for a mot
 */
function generateTimelineSVG(mot, title = "Timeline") {
  const visualizer = new TimelineVisualizer(mot, title);
  return visualizer.generateSVG();
}

/**
 * Generate just the dependency graph SVG
 */
function generateDependencyGraphSVG(environment, finalMot) {
  const visualizer = new DependencyGraphVisualizer(environment, finalMot);
  return visualizer.generateSVG();
}

/**
 * Generate provenance tree for a specific pip
 */
function generateProvenanceTreeSVG(pip, index) {
  const visualizer = new ProvenanceTreeVisualizer(pip, index);
  return visualizer.generateSVG();
}

/**
 * Visualize multiple Crux programs side-by-side for comparison
 */
function visualizeComparison(programs, golden, outputPath, title = "Crux Comparison") {
  const results = programs.map((prog, idx) => {
    const parsed = golden.parse(prog.code);
    const result = golden.crux_interp(prog.code);
    const mot = result.sections && result.sections.length > 0
      ? result.sections[result.sections.length - 1]
      : result;
    const env = extractEnvironmentFromProg(parsed);
    return {
      name: prog.name || `Program ${idx + 1}`,
      code: prog.code,
      mot: mot,
      timeline: generateTimelineSVG(mot, prog.name || `Program ${idx + 1}`)
    };
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1800px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    h1 { font-size: 36px; margin-bottom: 10px; }
    .programs {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(600px, 1fr));
      gap: 30px;
      padding: 30px;
    }
    .program {
      background: #f9f9f9;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .program h2 {
      color: #667eea;
      margin-bottom: 15px;
    }
    .program pre {
      background: #2d2d2d;
      color: #f8f8f2;
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
      margin-bottom: 15px;
      font-size: 14px;
    }
    .visualization {
      display: flex;
      justify-content: center;
      overflow-x: auto;
    }
    svg {
      border: 1px solid #eee;
      border-radius: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${title}</h1>
      <p>Comparing ${results.length} Crux programs side-by-side</p>
    </header>
    <div class="programs">
      ${results.map(r => `
        <div class="program">
          <h2>${r.name}</h2>
          <pre>${r.code}</pre>
          <div class="visualization">${r.timeline}</div>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`Comparison visualization written to ${outputPath}`);

  return { htmlPath: outputPath, programCount: results.length };
}

/**
 * Create a development server for live visualization updates
 */
function createVisualizationServer(port = 3000) {
  import('http').then(http => {
    let cachedHTML = '<html><body><h1>Waiting for Crux program...</h1></body></html>';

    const server = http.default.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(cachedHTML);
    });

    server.listen(port, () => {
      console.log(`Visualization server running at http://localhost:${port}/`);
    });

    return {
      server,
      updateVisualization: (html) => {
        cachedHTML = html;
        console.log('Visualization updated');
      }
    };
  });
}

export {
  visualizeCruxProgram,
  generateTimelineSVG,
  generateDependencyGraphSVG,
  generateProvenanceTreeSVG,
  visualizeComparison,
  createVisualizationServer,
  Provenance
};
