# docs/screens/02-classification.png -- every figure read from .runtime/classify-report.json
import json, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

BG, CARD, PAPER, BRONZE = '#101916', '#17241f', '#f5f1e8', '#d8b874'
AUTH, INDIC, DERIV, REPORTED = '#176b52', '#c18a2d', '#497aa2', '#a65b68'

rep = json.load(open('.runtime/classify-report.json'))
rows = sorted(rep.items(), key=lambda kv: -kv[1]['twins'])
T = sum(s['twins'] for _, s in rows)
TAX = sum(s['from_taxonomy'] for _, s in rows)
TIT = sum(s['from_title'] for _, s in rows)
UN = sum(s['unmatched'] for _, s in rows)
roles = {k: sum(s['by_role'].get(k, 0) for _, s in rows) for k in ('base', 'attach', 'free')}

fig = plt.figure(figsize=(14, 8.6), facecolor=BG)
fig.text(0.04, 0.955, 'Category + role mapping — 6 CATALOG_ONLY catalogs', color=PAPER,
         fontsize=23, fontfamily='serif', va='top')
fig.text(0.04, 0.906, 'AVATAR sprint item 2 · merchant taxonomy first, title keywords as fallback · zero-LLM',
         color=BRONZE, fontsize=10.5, va='top')

ax = fig.add_axes([0.115, 0.145, 0.525, 0.715]); ax.set_facecolor(CARD)
for sp in ax.spines.values(): sp.set_visible(False)
y = range(len(rows))
tax = [100 * s['from_taxonomy'] / s['twins'] for _, s in rows]
tit = [100 * s['from_title'] / s['twins'] for _, s in rows]
un = [100 * s['unmatched'] / s['twins'] for _, s in rows]
ax.barh(list(y), tax, color=REPORTED, label='REPORTED — merchant taxonomy')
ax.barh(list(y), tit, left=tax, color=DERIV, label='DERIVED — title keywords')
ax.barh(list(y), un, left=[a + b for a, b in zip(tax, tit)], color='#3a4a44', label='unmatched')
ax.set_yticks(list(y)); ax.set_yticklabels([c for c, _ in rows], color=PAPER, fontsize=10.5)
ax.invert_yaxis(); ax.set_xlim(0, 100)
ax.tick_params(colors='#7d8d86', labelsize=9)
ax.grid(axis='x', color='#243430', lw=0.7); ax.set_axisbelow(True)
leg = ax.legend(loc='upper center', bbox_to_anchor=(0.5, -0.06), ncol=3,
                facecolor=CARD, edgecolor='#243430', fontsize=9.2)
for t in leg.get_texts(): t.set_color(PAPER)
for i, (c, s) in enumerate(rows):
    ax.text(98, i, f"{s['from_taxonomy'] + s['from_title']:,} / {s['twins']:,}",
            color=PAPER, fontsize=8.6, va='center', ha='right')

cx = 0.68
fig.patches.append(Rectangle((cx, 0.145), 0.28, 0.715, transform=fig.transFigure,
                             facecolor=CARD, edgecolor='#243430'))
def stat(dy, big, small, col=PAPER, fs=26):
    fig.text(cx + 0.02, dy, big, color=col, fontsize=fs, fontfamily='serif', va='top')
    fig.text(cx + 0.02, dy - 0.05, small, color='#7d8d86', fontsize=9.6, va='top')
stat(0.825, f'{100*(TAX+TIT)/T:.1f}%', f'classified  ({TAX+TIT:,} of {T:,})', AUTH)
stat(0.685, f'{TAX:,}', 'from merchant taxonomy (REPORTED)', REPORTED)
stat(0.545, f'{TIT:,}', 'from title keywords (DERIVED)', DERIV)
stat(0.405, f"{roles['base']:,} / {roles['attach']:,} / {roles['free']:,}", 'roles: base / attach / free', PAPER, 17)
fig.text(cx + 0.02, 0.30, 'Bugs caught by auditing output:\n'
         '· 15,170 bathroom vanities were filed\n  as bedroom dressers (rule order)\n'
         '· "Taklampor > Spotlights" read as\n  PENDANT (parent beat the leaf)\n'
         '· "Madrasskydd" (protector) read as\n  MATTRESS',
         color='#7d8d86', fontsize=8.8, va='top')
fig.text(0.115, 0.012, 'source: .runtime/classify-report.json · scripts/classify-catalogs.mjs --write · 2026-09-20',
         color='#4f6159', fontsize=8.6)
fig.savefig('docs/screens/02-classification.png', dpi=110, facecolor=BG)
print('WROTE docs/screens/02-classification.png')
