// Helper utilities

export function stripLineComments(input) {
  // Replace '//' comments with spaces to preserve indices; keep newlines
  return input.replace(/\/\/.*$/gm, (m) => ' '.repeat(m.length));
}

export function requireMot(value) {
  // Import will be resolved at runtime - avoiding circular dependency
  if (!value || typeof value !== 'object') {
    throw new Error('Mot required!');
  }
  // Duck typing check - if it has values array, treat it as Mot-like
  if (!Array.isArray(value.values)) {
    throw new Error('Mot required!');
  }
  return value;
}

export function opKey(name) {
  return 'op:' + name;
}
