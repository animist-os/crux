#!/usr/bin/env python3
"""Export written soprano note events from local Bach MXL scores to MIDI fixtures.

Standard library only. Repeats are read once (written form); ties are merged.
No score download or dependency installation is needed. Scores without a named
soprano, grace notes, or transposing parts are reported as skipped, not guessed.
"""
import argparse
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import struct
import xml.etree.ElementTree as ET
from zipfile import ZipFile


def read_soprano(path):
    with ZipFile(path) as archive:
        container = ET.fromstring(archive.read('META-INF/container.xml'))
        filename = next(e.attrib['full-path'] for e in container.iter()
                        if e.tag.split('}')[-1] == 'rootfile')
        root = ET.fromstring(archive.read(filename))
    for element in root.iter():
        element.tag = element.tag.split('}')[-1]
    part_id = next((p.attrib['id'] for p in root.findall('part-list/score-part')
                    if (p.findtext('part-name') or '').lower().startswith('sopran')), None)
    if part_id is None:
        raise ValueError('no named soprano part')
    part = next(p for p in root.findall('part') if p.attrib['id'] == part_id)
    if part.find('.//transpose') is not None:
        raise ValueError('transposing soprano part')
    notes, active_ties = [], {}
    measure_start, divisions = Fraction(0), None
    for measure in part.findall('measure'):
        cursor, end, last_onset = measure_start, measure_start, measure_start
        for item in measure:
            if item.tag == 'attributes' and item.find('divisions') is not None:
                divisions = int(item.findtext('divisions'))
            if item.tag not in ('note', 'backup', 'forward'):
                continue
            if item.find('grace') is not None:
                raise ValueError('grace notes need an explicit performance policy')
            if divisions is None or item.find('duration') is None:
                raise ValueError('missing divisions or duration')
            duration = Fraction(item.findtext('duration')) / divisions
            if item.tag == 'backup':
                cursor -= duration
                continue
            if item.tag == 'forward':
                cursor += duration
                end = max(end, cursor)
                continue
            onset = last_onset if item.find('chord') is not None else cursor
            if item.find('chord') is None:
                last_onset = onset
                cursor += duration
            end = max(end, onset + duration)
            if item.find('rest') is not None:
                continue
            pitch = item.find('pitch')
            if pitch is None:
                raise ValueError('unpitched soprano note')
            alteration = Fraction(pitch.findtext('alter', '0'))
            if alteration.denominator != 1:
                raise ValueError('microtonal pitch')
            midi = 12 * (int(pitch.findtext('octave')) + 1) + int(alteration) + {
                'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[pitch.findtext('step')]
            key = (item.findtext('voice', '1'), midi)
            ties = {t.attrib['type'] for t in item.findall('tie')}
            if 'stop' in ties:
                note = active_ties.pop(key, None)
                if note is None or note['onset'] + note['duration'] != onset:
                    raise ValueError('unmatched tie')
                note['duration'] += duration
            else:
                note = {'midi': midi, 'onset': onset, 'duration': duration}
                notes.append(note)
            if 'start' in ties:
                active_ties[key] = note
        measure_start = end
    if active_ties:
        raise ValueError('unterminated tie')
    events = []
    for note in notes:
        ticks, duration = note['onset'] * 480, note['duration'] * 480
        if ticks.denominator != 1 or duration.denominator != 1 or duration <= 0:
            raise ValueError('timing cannot be represented at 480 PPQ')
        events.append({'midi': note['midi'], 'ticks': int(ticks), 'durationTicks': int(duration)})
    if not events:
        raise ValueError('empty soprano')
    return sorted(events, key=lambda n: (n['ticks'], n['midi'], n['durationTicks']))


def vlq(number):
    values = [number & 127]
    while number >> 7:
        number >>= 7
        values.insert(0, (number & 127) | 128)
    return bytes(values)


def write_midi(notes, destination):
    events = []
    for note in notes:
        events.append((note['ticks'], 1, bytes([0x90, note['midi'], 80])))
        events.append((note['ticks'] + note['durationTicks'], 0, bytes([0x80, note['midi'], 0])))
    data, previous = bytearray(), 0
    for ticks, _, event in sorted(events):
        data += vlq(ticks - previous) + event
        previous = ticks
    data += b'\x00\xff\x2f\x00'
    destination.write_bytes(b'MThd' + struct.pack('>IHHH', 6, 0, 1, 480) +
                           b'MTrk' + struct.pack('>I', len(data)) + data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--ids', nargs='+', help='Score stems; omit to export all named sopranos')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    paths = [args.source / f'{name}.mxl' for name in args.ids] if args.ids else sorted(args.source.glob('*.mxl'))
    manifest = {'source': 'Local music21 Bach MusicXML corpus', 'part': 'named soprano',
                'policy': 'written form, repeats once, ties merged, 480 PPQ', 'pieces': [], 'skipped': []}
    for path in paths:
        try:
            notes = read_soprano(path)
            write_midi(notes, args.output / f'{path.stem}.mid')
            manifest['pieces'].append({'id': path.stem, 'sourceFile': path.name,
                'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'notes': notes})
        except (ValueError, OSError) as error:
            manifest['skipped'].append({'id': path.stem, 'reason': str(error)})
    (args.output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f"Exported {len(manifest['pieces'])}; skipped {len(manifest['skipped'])}")
    if args.ids and manifest['skipped']:
        raise SystemExit(json.dumps(manifest['skipped']))


if __name__ == '__main__':
    main()
