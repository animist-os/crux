// Minimal XML parser sufficient for MusicXML: elements, attributes, text, entities.
// Comments, processing instructions, DOCTYPE and CDATA are handled; namespaces are stripped.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decode(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (match, code) => {
    if (code[0] === '#') return String.fromCodePoint(code[1] === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10));
    return ENTITIES[code] ?? match;
  });
}

/** Element: { tag, attrs, children: Element[], text }. Helpers below navigate it. */
export function parseXml(source) {
  const text = typeof source === 'string' ? source : source.toString('utf8');
  const root = { tag: '#document', attrs: {}, children: [], text: '' };
  const stack = [root];
  let i = 0;
  while (i < text.length) {
    const lt = text.indexOf('<', i);
    if (lt < 0) break;
    if (lt > i) stack[stack.length - 1].text += decode(text.slice(i, lt));
    const need = (marker, from) => {
      const at = text.indexOf(marker, from);
      if (at < 0) throw new Error(`Unterminated XML construct (expected ${marker}).`);
      return at;
    };
    if (text.startsWith('<!--', lt)) { i = need('-->', lt) + 3; continue; }
    if (text.startsWith('<![CDATA[', lt)) {
      const end = need(']]>', lt);
      stack[stack.length - 1].text += text.slice(lt + 9, end);
      i = end + 3; continue;
    }
    if (text.startsWith('<?', lt)) { i = need('?>', lt) + 2; continue; }
    if (text.startsWith('<!', lt)) {
      // DOCTYPE, possibly with an internal subset in brackets.
      let depth = 0, j = lt + 2;
      for (; j < text.length; j++) {
        if (text[j] === '[') depth++;
        else if (text[j] === ']') depth--;
        else if (text[j] === '>' && depth === 0) break;
      }
      i = j + 1; continue;
    }
    const gt = findTagEnd(text, lt);
    const body = text.slice(lt + 1, gt);
    if (body[0] === '/') {
      const tag = stripNs(body.slice(1).trim());
      const open = stack.pop();
      if (!open || open.tag !== tag) throw new Error(`Mismatched XML close tag </${tag}>.`);
    } else {
      const selfClosing = body.endsWith('/');
      const inner = selfClosing ? body.slice(0, -1) : body;
      const match = /^\s*([^\s/>]+)/.exec(inner);
      const element = { tag: stripNs(match[1]), attrs: {}, children: [], text: '' };
      const attrRe = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
      let m;
      const rest = inner.slice(match[0].length);
      while ((m = attrRe.exec(rest))) element.attrs[stripNs(m[1])] = decode(m[3] ?? m[4]);
      stack[stack.length - 1].children.push(element);
      if (!selfClosing) stack.push(element);
    }
    i = gt + 1;
  }
  if (stack.length !== 1) throw new Error(`Unclosed XML element <${stack[stack.length - 1].tag}>.`);
  return root;
}

function findTagEnd(text, start) {
  let quote = null;
  for (let j = start + 1; j < text.length; j++) {
    const c = text[j];
    if (quote) { if (c === quote) quote = null; }
    else if (c === '"' || c === "'") quote = c;
    else if (c === '>') return j;
  }
  throw new Error('Unterminated XML tag.');
}

const stripNs = name => name.includes(':') ? name.slice(name.indexOf(':') + 1) : name;

export const child = (el, tag) => el?.children.find(c => c.tag === tag) ?? null;
export const children = (el, tag) => el ? el.children.filter(c => c.tag === tag) : [];
export const textOf = (el, tag, fallback = null) => {
  const c = child(el, tag);
  return c ? c.text.trim() : fallback;
};
/** Depth-first search for all descendants with a tag. */
export function descendants(el, tag, out = []) {
  for (const c of el.children) {
    if (c.tag === tag) out.push(c);
    descendants(c, tag, out);
  }
  return out;
}
/** Path lookup such as 'part-list/score-part'. */
export function select(el, path) {
  let current = [el];
  for (const tag of path.split('/')) current = current.flatMap(c => children(c, tag));
  return current;
}
