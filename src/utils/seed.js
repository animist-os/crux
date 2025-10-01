// Seed utilities for random number generation

export function stringToSeed(str) {
  let hash = 5381;
  let i = str.length;

  while (i) {
    hash = (hash * 33) ^ str.charCodeAt(--i);
  }

  // Ensure the hash is a positive 32-bit integer
  return hash >>> 0;
}

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
