#!/usr/bin/env python3
"""Extract title metadata from an installed music21 catalogue without importing it.

Usage: python3 tools/build-chorale-titles.py path/to/music21/corpus/chorales.py
Writes corpus/bach-chorale-titles.json. The title table is read as Python AST data;
no library code is executed. Numbered variants inherit titles only when their
base BWV is present. Unmatched pieces remain explicitly untitled.
"""
import ast
import json
import sys
from pathlib import Path

source = Path(sys.argv[1])
root = ast.parse(source.read_text())
cls = next(n for n in root.body if isinstance(n, ast.ClassDef) and n.name == 'ChoraleListRKBWV')
table = next(n.value for n in ast.walk(cls) if isinstance(n, ast.Constant)
             and isinstance(n.value, str) and n.value.startswith('1---||---269'))
titles = {}
for line in table.splitlines():
    number, bwv, title, kalmus = line.strip().split('---||---')
    # The local RKBWV table contains a duplicated A in the BWV 2.6 title.
    if title.startswith('AAch '):
        title = title[1:]
    entry = titles.setdefault('bwv' + bwv, {'title': title, 'aliases': [], 'riemenschneider': []})
    if title != entry['title'] and title not in entry['aliases']:
        entry['aliases'].append(title)
    entry['riemenschneider'].append(int(number))
# BWV 1.6's local MusicXML credit names this tune, with a damaged ö encoding.
# The spelling below agrees with the same hymn title elsewhere in music21.
titles['bwv1.6'] = {'title': 'Wie schön leuchtet der Morgenstern', 'aliases': [],
                    'riemenschneider': [], 'source': 'bwv1.6.mxl credit-words; normalized ö'}
output = Path(__file__).resolve().parent.parent / 'corpus' / 'bach-chorale-titles.json'
output.write_text(json.dumps({'source': 'music21 corpus.chorales.ChoraleListRKBWV',
                             'pieces': titles}, ensure_ascii=False, indent=2) + '\n')
print(f'Extracted {len(titles)} title records to {output}')
