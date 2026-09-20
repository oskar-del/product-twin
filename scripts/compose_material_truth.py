# Composites the Blender still with a data-driven label strip so the render works
# as EVIDENCE: without labels the two fallback controls render neutral grey and are
# indistinguishable from the piece that is legitimately "Gra".
import json, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.image as mpimg
from matplotlib.patches import Rectangle

BG, CARD, PAPER, BRONZE = '#101916', '#17241f', '#f5f1e8', '#d8b874'
REPORTED, DERIV = '#a65b68', '#497aa2'

items = json.load(open('.runtime/material-truth-resolved.json'))
img = mpimg.imread('.runtime/material-truth-raw.png')

fig = plt.figure(figsize=(16, 11.2), facecolor=BG)
fig.text(0.035, 0.972, 'Material truth — documented colour text drives the render', color=PAPER,
         fontsize=24, fontfamily='serif', va='top')
fig.text(0.035, 0.928, 'AVATAR sprint item 4 · material_cues.colour_text (REPORTED, merchant feed) → scripts/material_truth_lib.py → Blender override',
         color=BRONZE, fontsize=10.5, va='top')

ax = fig.add_axes([0.035, 0.335, 0.93, 0.565]); ax.imshow(img); ax.axis('off')

n = len(items)
cols = 7
rows_n = (n + cols - 1) // cols
y0, h = 0.285, 0.062
for i, it in enumerate(items):
    c, r = i % cols, i // cols
    x = 0.035 + c * (0.93 / cols)
    y = y0 - r * (h + 0.055)
    fig.patches.append(Rectangle((x, y - h), 0.93 / cols - 0.012, h, transform=fig.transFigure,
                                 facecolor=CARD, edgecolor='#243430'))
    fig.patches.append(Rectangle((x + 0.008, y - h + 0.012), 0.022, h - 0.024, transform=fig.transFigure,
                                 facecolor=tuple(it['rgb']), edgecolor='#2d3d37'))
    state = it['state']
    ok = state.startswith('documented')
    label = (it['colour_text'] or '(no colour in feed)')
    fig.text(x + 0.038, y - 0.016, label[:20] + ('…' if len(label) > 20 else ''),
             color=PAPER if ok else BRONZE, fontsize=9.4, va='top')
    fig.text(x + 0.038, y - 0.034, state[:24] + ('…' if len(state) > 24 else ''),
             color='#7d8d86', fontsize=7.8, va='top')
    fig.text(x + 0.038, y - 0.048, it['name'][:22] + ('…' if len(it['name']) > 22 else ''),
             color='#4f6159', fontsize=7.0, va='top')

doc = sum(1 for i in items if i['state'].startswith('documented'))
fig.text(0.035, 0.055,
         f'{doc} of {n} resolved from the merchant\'s own colour word · '
         f'{n - doc} fell back to a flagged neutral and were NOT given a guessed hue',
         color=PAPER, fontsize=10.5)
fig.text(0.035, 0.028,
         'Controls are deliberate: "Transparent" names no single hue, and the last piece has no colour field at all. '
         'Both must render neutral — that is the point.',
         color='#7d8d86', fontsize=8.8)
fig.text(0.035, 0.008, 'source: .runtime/material-truth-resolved.json · scripts/render_material_truth.py · 2026-09-20',
         color='#4f6159', fontsize=8.2)

fig.savefig('docs/screens/04-material-truth.png', dpi=104, facecolor=BG)
print('WROTE docs/screens/04-material-truth.png (composited)')
