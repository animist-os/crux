/**
 * Crux Integration for Strudel - Ready-to-use Script
 * 
 * This script can be loaded in Strudel (nudel.cc) to add Crux support.
 * 
 * SETUP INSTRUCTIONS:
 * 
 * 1. Load Crux library first (you'll need to host crux.cjs somewhere or use a CDN):
 *    - Option A: Load from a CDN or your server
 *    - Option B: Copy crux.cjs content and ohm-js into the Strudel environment
 * 
 * 2. Load this script in Strudel using the register command:
 * 
 *    register({
 *      crux: (code, options = {}) => {
 *        // Ensure Crux is loaded
 *        if (typeof golden === 'undefined') {
 *          throw new Error('Crux library not loaded. Please load crux.cjs first.');
 *        }
 *        
 *        try {
 *          // Parse and evaluate Crux code
 *          const result = golden.crux_interp(code);
 *          
 *          // Convert to Strudel pattern using the conversion functions
 *          return cruxToStrudel(result, options);
 *        } catch (error) {
 *          console.error('Crux evaluation error:', error);
 *          throw error;
 *        }
 *      }
 *    });
 * 
 * 3. Use it in your Strudel code:
 * 
 *    crux("[0, 3] -> [4]").s("piano")
 *    crux("[0, 2, 4] * [0, 1]").s("sawtooth")
 *    crux("[0, 1, 2]", { rootNote: 60 }).s("piano")
 */

// Conversion functions (included inline for convenience)
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
    
    // Convert step to note representation
    // Steps are relative semitones, so step 0 = root, step 1 = root+1 semitone, etc.
    let note;
    if (outputFormat === 'midi') {
      note = rootNote + step;
    } else {
      // Convert to note name (C, D, E, F, G, A, B)
      note = stepToNoteName(step, octave);
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

// Register the crux function with Strudel
// This assumes you're in a Strudel environment where register() is available
if (typeof register === 'function') {
  register({
    crux: (code, options = {}) => {
      // Ensure Crux is loaded
      if (typeof golden === 'undefined') {
        throw new Error('Crux library not loaded. Please load crux.cjs first. You can load it via:\n' +
          'await import("https://your-server.com/crux.cjs") or similar.');
      }
      
      try {
        // Parse and evaluate Crux code
        const result = golden.crux_interp(code);
        
        // Convert to Strudel pattern
        const patternString = cruxToStrudel(result, options);
        
        // Return as a Strudel pattern
        // In Strudel, patterns can be strings which will be parsed
        return patternString;
      } catch (error) {
        console.error('Crux evaluation error:', error);
        throw error;
      }
    }
  });
  
  console.log('✅ Crux integration registered! Use crux("...") in your Strudel code.');
} else {
  console.warn('register() function not found. This script should be run in a Strudel environment.');
}

