# Renders docs/screens/01-placeability.png from the committed extraction report.
# Every number is read from .runtime/dims-report.json -- nothing typed by hand.
import json, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

BG, CARD, PAPER, BRONZE = '#101916', '#17241f', '#f5f1e8', '#d8b874'
AUTH, INDIC, DERIV = '#176b52', '#c18a2d', '#497aa2'

rep = json.load(open('.runtime/dims-report.json'))
rows = sorted(rep.items(), key=lambda kv: -kv[1]['twins'])

T = sum(s['twins'] for _, s in rows)
B = sum(s['before_placeable'] for _, s in rows)
A = sum(s['after_placeable'] for _, s in rows)
F = sum(s['footprint_only'] for _, s in rows)

fig = plt.figure(figsize=(14, 8.6), facecolor=BG)
fig.text(0.04, 0.955, 'Placeability — dimensions_mm coverage', color=PAPER,
         fontsize=23, fontfamily='serif', va='top')
fig.text(0.04, 0.906, 'AVATAR sprint item 1 · cascade: GLB bounds > Shopify options > description regex > title regex · zero-LLM',
         color=BRONZE, fontsize=10.5, va='top')

ax = fig.add_axes([0.115, 0.12, 0.525, 0.74]); ax.set_facecolor(CARD)
for s in ax.spines.values(): s.set_visible(False)
labels = [c for c, _ in rows]
y = range(len(rows))
before = [100 * s['before_placeable'] / s['twins'] for _, s in rows]
after = [100 * s['after_placeable'] / s['twins'] for _, s in rows]
foot = [100 * s['footprint_only'] / s['twins'] for _, s in rows]

h = 0.34
ax.barh([i + h/2 for i in y], after, height=h, color=AUTH, label='full W×D×H (placeable)')
ax.barh([i + h/2 for i in y], foot, height=h, left=after, color=DERIV, label='footprint W×D only (height unknown)')
ax.barh([i - h/2 for i in y], before, height=h, color=INDIC, label='before this run')
ax.set_yticks(list(y)); ax.set_yticklabels(labels, color=PAPER, fontsize=10.5)
ax.invert_yaxis()
ax.tick_params(colors='#7d8d86', labelsize=9)
ax.set_xlabel('')
ax.set_xlim(0, 100); ax.grid(axis='x', color='#243430', lw=0.7)
ax.set_axisbelow(True)
leg = ax.legend(loc='upper center', bbox_to_anchor=(0.5, -0.075), ncol=3, facecolor=CARD, edgecolor='#243430', fontsize=9.2)
for t in leg.get_texts(): t.set_color(PAPER)

for i, (c, s) in enumerate(rows):
    tot = s['twins']
    end = after[i] + foot[i]
    inside = end > 62
    ax.text(min(end + 1.2, 97) if not inside else end - 1.2, i + h/2,
            f"{s['after_placeable']:,} + {s['footprint_only']:,} / {tot:,}",
            color='#9fb0a8' if not inside else PAPER, fontsize=8.6, va='center',
            ha='left' if not inside else 'right')

# right-hand totals card
cx = 0.68
fig.patches.append(Rectangle((cx, 0.12), 0.28, 0.74, transform=fig.transFigure,
                             facecolor=CARD, edgecolor='#243430'))
def stat(dy, big, small, col=PAPER):
    fig.text(cx + 0.02, dy, big, color=col, fontsize=27, fontfamily='serif', va='top')
    fig.text(cx + 0.02, dy - 0.052, small, color='#7d8d86', fontsize=9.6, va='top')

stat(0.82, f'{100*A/T:.1f}%', f'full W×D×H  ({A:,} of {T:,} twins)', AUTH)
stat(0.66, f'{100*F/T:.1f}%', f'footprint only  ({F:,})', DERIV)
stat(0.50, f'{100*(A+F)/T:.1f}%', f'any usable dims  ({A+F:,})')
stat(0.34, f'{100*B/T:.1f}%', f'before this run  ({B:,})', INDIC)
fig.text(cx + 0.02, 0.22, 'Heights are never invented:\na 2-number "80x200" is stored\nas footprint with height=null.',
         color='#7d8d86', fontsize=9, va='top')

fig.text(0.115, 0.012, 'source: .runtime/dims-report.json · scripts/extract-dimensions.mjs --write · 2026-09-20',
         color='#4f6159', fontsize=8.6)
fig.savefig('docs/screens/01-placeability.png', dpi=110, facecolor=BG)
print('WROTE docs/screens/01-placeability.png')
