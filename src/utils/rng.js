// Deterministic RNG factory (xorshift32 over a hashed seed)
export function createSeededRng(seed) {
  let state = hashSeedTo32Bit(seed);
  if (state === 0) state = 0x1; // avoid zero state
  return function rng() {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    // Convert to [0,1)
    return ((state >>> 0) / 0x100000000);
  };
}

export function hashSeedTo32Bit(seed) {
  const s = String(seed);
  let h = 2166136261 >>> 0; // FNV-1a 32-bit
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function warmUpRng(rng, steps) {
  for (let i = 0; i < steps; i++) rng();
}

export function computeWarmupStepsForRandNum(value) {
  let posSalt = 0;
  if (value && typeof value === 'object') {
    // RandomRange has startPos/endPos when numeric endpoints came from source
    if ('startPos' in value && typeof value.startPos === 'number') posSalt ^= value.startPos | 0;
    if ('endPos' in value && typeof value.endPos === 'number') posSalt ^= value.endPos | 0;
    // RandomChoice may carry positions array
    if (Array.isArray(value.positions)) {
      for (const p of value.positions) if (typeof p === 'number') posSalt ^= p | 0;
    }
  }
  // Seed is already a 32-bit number (via stringToSeed), but defend just in case
  const seedNum = (typeof value.seed === 'number') ? value.seed : hashSeedTo32Bit(value.seed ?? 0);
  // Mix seed with position salt to get a small step count in [1..256]
  const mixed = (seedNum ^ posSalt) >>> 0;
  return (mixed & 0xff) + 1;
}

export function stringToSeed(str) {
  let hash = 5381;
  let i = str.length;

  while (i) {
    hash = (hash * 33) ^ str.charCodeAt(--i);
  }

  // Ensure the hash is a positive 32-bit integer
  return hash >>> 0;
}

// Seed helpers for IDE-side annotation
export function formatSeed4(seed) {
  // Ensure 4 lowercase hex chars
  const s = String(seed).toLowerCase().replace(/[^0-9a-f]/g, '');
  const padded = (s + '0000').slice(0, 4);
  return padded;
}

export function generateSeed4() {
  const n = Math.floor(Math.random() * 0x10000);
  return n.toString(16).padStart(4, '0');
}

// Resolve a RandNum (RandomRange or RandomChoice) to a number
export function resolveRandNumToNumber(value, rng) {
  if (typeof value === 'number') return value;

  // Import classes as needed - in practice these will be passed as instances
  if (value && value.constructor && value.constructor.name === 'RandomRange') {
    const localRng = value.seed != null ? createSeededRng(value.seed) : rng;
    if (value.seed != null) {
      warmUpRng(localRng, computeWarmupStepsForRandNum(value));
    }
    const lo = Math.min(value.start, value.end);
    const hi = Math.max(value.start, value.end);
    return Math.floor(localRng() * (hi - lo + 1)) + lo;
  }

  if (value && value.constructor && value.constructor.name === 'RandomChoice') {
    if (value.options.length === 0) throw new Error('empty random choice');
    const localRng = value.seed != null ? createSeededRng(value.seed) : rng;
    if (value.seed != null) {
      warmUpRng(localRng, computeWarmupStepsForRandNum(value));
    }
    const idx = Math.floor(localRng() * value.options.length);
    return value.options[idx];
  }

  throw new Error('Unsupported RandNum');
}
