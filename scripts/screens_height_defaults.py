# docs/screens/05-height-defaults.png -- figures read from .runtime/height-defaults-report.json
import json, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

BG, CARD, PAPER, BRONZE = '#101916', '#17241f', '#f5f1e8', '#d8b874'
AUTH, INDIC, REPORTED = '#176b52', '#c18a2d', '#a65b68'

st = json.load(open('.runtime/height-defaults-report.json'))
rows = sorted(st.items(), key=lambda kv: -kv[1]['twins'])
T = {}
for _, s in rows:
    for k, v in s.items(): T[k] = T.get(k, 0) + v

fig = plt.figure(figsize=(14.6, 8.8), facecolor=BG)
fig.text(0.035, 0.958, 'Height defaults — placeability by evidence tier', color=PAPER,
         fontsize=23, fontfamily='serif', va='top')
fig.text(0.035, 0.912, "Brain ruling 2026-09-20 · a defaulted height is INDICATIVE, never a product fact · tiers are never summed into one number",
         color=BRONZE, fontsize=10.2, va='top')

ax = fig.add_axes([0.125, 0.15, 0.50, 0.71]); ax.set_facecolor(CARD)
for sp in ax.spines.values(): sp.set_visible(False)
y = range(len(rows))
pc = lambda s, k: 100 * s[k] / s['twins']
wdh = [pc(s, 'wdh') + pc(s, 'verified') for _, s in rows]
wdf = [pc(s, 'wd_h_default') for _, s in rows]
inv = [pc(s, 'wdh_default') for _, s in rows]
ax.barh(list(y), wdh, color=AUTH, label='W×D×H stated by source')
ax.barh(list(y), wdf, left=wdh, color=INDIC, label='W×D source + H category default')
ax.barh(list(y), inv, left=[a + b for a, b in zip(wdh, wdf)], color=REPORTED, label='envelope fully invented by proxy build')
ax.set_yticks(list(y)); ax.set_yticklabels([c for c, _ in rows], color=PAPER, fontsize=10)
ax.invert_yaxis(); ax.set_xlim(0, 100)
ax.tick_params(colors='#7d8d86', labelsize=9)
ax.grid(axis='x', color='#243430', lw=0.7); ax.set_axisbelow(True)
leg = ax.legend(loc='upper center', bbox_to_anchor=(0.5, -0.07), ncol=1,
                facecolor=CARD, edgecolor='#243430', fontsize=9)
for t in leg.get_texts(): t.set_color(PAPER)
for i, (c, s) in enumerate(rows):
    tot = wdh[i] + wdf[i] + inv[i]
    inside = tot >= 88
    ax.text(min(tot + 1.5, 98.5) if not inside else tot - 1.5, i, f"{tot:.0f}%",
            color='#101916' if inside else '#9fb0a8', fontsize=8.4,
            va='center', ha='left' if not inside else 'right',
            fontweight='bold' if inside else 'normal')

cx = 0.66
fig.patches.append(Rectangle((cx, 0.15), 0.305, 0.71, transform=fig.transFigure,
                             facecolor=CARD, edgecolor='#243430'))
def stat(dy, big, small, col=PAPER, fs=25):
    fig.text(cx + 0.02, dy, big, color=col, fontsize=fs, fontfamily='serif', va='top')
    fig.text(cx + 0.02, dy - 0.048, small, color='#7d8d86', fontsize=9.4, va='top')

stat(0.825, f"{T['wdh'] + T['verified']:,}", f"W×D×H stated by source  ({100*(T['wdh']+T['verified'])/T['twins']:.1f}%)", AUTH)
stat(0.695, f"{T['wd_h_default']:,}", f"height from category table  ({100*T['wd_h_default']/T['twins']:.1f}%)", INDIC)
stat(0.565, f"{T['wdh_default']:,}", f"envelope fully invented  ({100*T['wdh_default']/T['twins']:.1f}%)", REPORTED)
stat(0.435, f"{T['footprint_no_default']:,}", 'footprint with NO default (refused)', PAPER, 21)
fig.text(cx + 0.02, 0.345,
         'Kungsängen 0% → 93.0%: 22,149 beds keep a\nreal "80x200" footprint and take a 600 mm\nindicative height.\n\n'
         'Newport\'s 28.4% is almost entirely the red\ntier — 3,645 of 3,673 are proxy-build\nenvelopes, not measurements. Only 28\nNewport twins state a size.',
         color='#7d8d86', fontsize=8.9, va='top')
fig.text(0.125, 0.012, 'source: .runtime/height-defaults-report.json · scripts/apply-height-defaults.mjs --write · 2026-09-20',
         color='#4f6159', fontsize=8.2)
fig.savefig('docs/screens/05-height-defaults.png', dpi=108, facecolor=BG)
print('WROTE docs/screens/05-height-defaults.png')
