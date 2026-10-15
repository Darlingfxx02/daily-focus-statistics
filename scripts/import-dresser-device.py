#!/usr/bin/env python3
"""Import one frame and its exact screen geometry from the local Dresser catalog."""
import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('mirror', type=Path)
parser.add_argument('--device', default='iphone-17-pro-max-deep-blue')
args = parser.parse_args()
source = (args.mirror / 'assets/index-local.js').read_text()
section = source.split('const wi = [', 1)[1].split('],\n    xE', 1)[0]
for match in re.finditer(r'ht\((.*?)\)', section, re.S):
    record = json.loads('[' + match[1].replace('void 0', 'null') + ']')
    if record[0] == args.device:
        break
else:
    parser.error(f'Device not found: {args.device}')

ident, model, color, filename, width, height, edges, *folder = record
asset = args.mirror / 'mockups' / Path(*folder) / filename
top, right, bottom, left = edges
root = Path(__file__).resolve().parents[1]
destination = root / 'public/dresser' / f'{ident}.png'
destination.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(asset, destination)
metadata = {
    'id': ident, 'model': model, 'color': color,
    'frame': f'dresser/{ident}.png', 'width': width, 'height': height,
    'screen': {'x': left, 'y': top, 'width': width - left - right,
               'height': height - top - bottom, 'radius': '9% / 4.2%'},
    'source': 'Local Dresser mirror; original PNG, unchanged',
    'sha256': hashlib.sha256(asset.read_bytes()).hexdigest(),
}
(root / 'src/device.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
print(f'Imported {model} · {color}: {width}×{height}, screen {width-left-right}×{height-top-bottom}')
