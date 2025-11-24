/**
 * Crux Integration for Strudel
 * 
 * This file provides a bridge between Crux and Strudel, allowing you to use
 * Crux syntax within Strudel's live coding environment.
 * 
 * Usage in Strudel:
 * ```javascript
 * register({
 *   crux: (cruxCode, options = {}) => {
 *     // Load Crux if not already loaded
 *     if (typeof golden === 'undefined') {
 *       // Try to load from CDN or local path
 *       throw new Error('Crux library not loaded. Please load crux.cjs before this script.');
 *     }
 *     
 *     // Parse and evaluate Crux code
 *     const result = golden.crux_interp(cruxCode);
 *     
 *     // Convert to Strudel pattern
 *     return cruxToStrudel(result, options);
 *   }
 * });
 * 
 * // Then use it:
 * crux("[0 -> [4]]").s("piano")
 * ```
 */

// Load Crux library
// Try ES module import (works in Node.js)
// In browser, crux.cjs sets globalThis.golden and window.golden
import "./dist/crux.cjs";

/**
 * Quantizes a (possibly fractional) step value to the nearest semitone.
 * Ties (x.5) round down to maintain predictable behavior.
 * @param {number} step
 * @returns {number}
 */
function quantizeStep(step) {
  if (!Number.isFinite(step)) {
    return step;
  }
  const down = Math.floor(step);
  const up = Math.ceil(step);
  const distDown = Math.abs(step - down);
  const distUp = Math.abs(up - step);
  if (distDown <= distUp) {
    return down;
  }
  return up;
}

/**
 * Converts a Crux result (Mot) to Strudel mini notation
 * @param {Object} cruxResult - Result from golden.crux_interp()
 * @param {Object} options - Conversion options
 * @param {number} options.rootNote - MIDI note number for step 0 (default: 60 = C4)
 * @param {string} options.outputFormat - 'midi' or 'note' (default: 'midi')
 * @param {number} options.octave - Starting octave for note names (default: 4)
 * @returns {string|Array} Strudel pattern as string or array
 */
function cruxToStrudel(cruxResult, options = {}) {
  const {
    rootNote = 60,      // C4 = MIDI 60
    outputFormat = 'midi',
    octave = 4
  } = options;
  
  // Handle multiple sections - take the first section by default
  const sections = cruxResult.sections || [];
  if (sections.length === 0) {
    return '';
  }
  
  // For now, use the first section. Could extend to handle multiple sections
  const mot = sections[0];
  if (!mot || !mot.values || mot.values.length === 0) {
    return '';
  }
  
  // Convert each pip to Strudel notation
  const patternParts = [];
  
  for (const pip of mot.values) {
    // Handle rests
    if (pip.tag === 'r' || pip.hasTag('r')) {
      // Strudel uses '~' for rests
      const duration = formatDuration(pip.timeScale);
      patternParts.push(`~${duration}`);
      continue;
    }
    
    // Get the step value (relative semitones from root)
    const step = pip.step;
    const quantizedStep = quantizeStep(step);
    
    // Convert step to note representation
    // Steps are relative semitones, so step 0 = root, step 1 = root+1 semitone, etc.
    let note;
    if (outputFormat === 'midi') {
      note = rootNote + quantizedStep;
    } else {
      // Convert to note name (C, D, E, F, G, A, B)
      note = stepToNoteName(quantizedStep, octave);
    }
    
    // Format duration
    const duration = formatDuration(pip.timeScale);
    
    // Combine note and duration
    if (duration === '') {
      patternParts.push(String(note));
    } else {
      patternParts.push(`${note}${duration}`);
    }
  }
  
  return patternParts.join(' ');
}

/**
 * Converts a relative step to a note name
 * @param {number} step - Relative step (0 = root, 1 = semitone up, etc.)
 * @param {number} octave - Starting octave
 * @returns {string} Note name like "c4", "c#4", "d4", etc.
 */
function stepToNoteName(step, octave) {
  const noteNames = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
  
  // Calculate absolute step from root
  const absoluteStep = step;
  const octaveOffset = Math.floor(absoluteStep / 12);
  const noteIndex = ((absoluteStep % 12) + 12) % 12; // Handle negative steps
  
  const noteName = noteNames[noteIndex];
  const finalOctave = octave + octaveOffset;
  
  return `${noteName}${finalOctave}`;
}

/**
 * Formats a duration (timeScale) to Strudel duration notation
 * @param {number} timeScale - Duration value (1 = whole note, 0.5 = half note, etc.)
 * @returns {string} Strudel duration string like "/2", "/4", etc.
 */
function formatDuration(timeScale) {
  if (timeScale === 1) {
    return ''; // Default duration
  }
  
  // Strudel uses fractions: /2 = half note, /4 = quarter note, etc.
  // Crux timeScale: 1 = whole note, 0.5 = half note, 0.25 = quarter note
  
  // Convert to fraction notation
  const inv = 1 / Math.abs(timeScale);
  const invRounded = Math.round(inv);
  
  // Check if it's approximately 1/n
  if (Math.abs(inv - invRounded) < 1e-10 && invRounded !== 0) {
    return `/${invRounded}`;
  }
  
  // For non-standard durations, use decimal notation
  // Strudel supports decimal durations like "0.5" or "[1/3]"
  // Try to find a simple fraction representation
  const fraction = toFraction(timeScale);
  if (fraction) {
    return `[${fraction}]`;
  }
  
  // Fallback to decimal
  return `[${timeScale}]`;
}

/**
 * Converts a decimal to a simple fraction string
 * @param {number} decimal - Decimal number
 * @returns {string|null} Fraction string like "1/2" or null if not simple
 */
function toFraction(decimal) {
  const abs = Math.abs(decimal);
  const tolerance = 1e-6;
  
  // Try common fractions
  const commonFractions = [
    [1, 2], [1, 3], [2, 3], [1, 4], [3, 4],
    [1, 5], [2, 5], [3, 5], [4, 5],
    [1, 6], [5, 6], [1, 8], [3, 8], [5, 8], [7, 8],
    [1, 12], [5, 12], [7, 12], [11, 12]
  ];
  
  for (const [num, den] of commonFractions) {
    const value = num / den;
    if (Math.abs(abs - value) < tolerance) {
      return `${num}/${den}`;
    }
  }
  
  return null;
}

/**
 * Main registration function for Strudel
 * This should be called in Strudel with register()
 * 
 * Example usage:
 * ```javascript
 * // First, load Crux library (you'll need to do this externally)
 * // Then in Strudel:
 * register({
 *   crux: (code, options) => {
 *     if (typeof golden === 'undefined') {
 *       throw new Error('Crux library not loaded. Load crux.cjs first.');
 *     }
 *     const result = golden.crux_interp(code);
 *     return cruxToStrudel(result, options);
 *   }
 * });
 * 
 * // Use it:
 * crux("[0 -> [4]]").s("piano")
 * ```
 */

// Export for ES modules
export {
  cruxToStrudel,
  stepToNoteName,
  formatDuration,
  toFraction,
  quantizeStep
};

// Also export for CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    cruxToStrudel,
    stepToNoteName,
    formatDuration,
    toFraction,
    quantizeStep
  };
}

// Export for browser/global environments
if (typeof window !== 'undefined') {
  window.cruxStrudel = {
    cruxToStrudel,
    stepToNoteName,
    formatDuration,
    toFraction,
    quantizeStep
  };
}

