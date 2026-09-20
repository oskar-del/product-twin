"""Shared material-truth resolution: documented colour TEXT -> render RGB.

Precedence (first hit wins), recorded per piece so a render can be audited:
  1. twin.material_cues.colour_text   - the merchant's own colour word (REPORTED)
  2. native-3d manifest Finish option - Shopify product option (REPORTED)
  3. undocumented                     - flat neutral, never a guessed hue

Every key in PALETTE is a colour word these feeds actually publish (measured across
the Newport feed's 451 distinct colour strings). Compound strings like
"Guld / Brun" resolve on the FIRST word: the merchant lists the dominant colour first.
"""
import json, os

PALETTE = {
    'vit': (0.88, 0.87, 0.84),      'svart': (0.045, 0.045, 0.05),
    'beige': (0.74, 0.68, 0.56),    'sand': (0.76, 0.70, 0.58),
    'brun': (0.33, 0.22, 0.14),     'guld': (0.72, 0.56, 0.25),
    'mässing': (0.70, 0.56, 0.28),  'silver': (0.71, 0.72, 0.74),
    'grå': (0.48, 0.48, 0.48),      'grön': (0.22, 0.34, 0.24),
    'blå': (0.20, 0.30, 0.45),      'rosa': (0.78, 0.60, 0.60),
    'gul': (0.80, 0.68, 0.26),      'röd': (0.45, 0.12, 0.12),
    'orange': (0.72, 0.38, 0.16),   'natur': (0.70, 0.60, 0.44),
    'ivory': (0.86, 0.83, 0.75),    'camel': (0.64, 0.48, 0.30),
    'krom': (0.75, 0.75, 0.78),     'chrome steel': (0.75, 0.75, 0.78),
    'black  steel': (0.03, 0.03, 0.035), 'black steel': (0.03, 0.03, 0.035),
}
# Colour words that name no single hue -> must NOT be mapped to one.
NOT_A_HUE = {'flerfärgad', 'transparent', 'multi'}
UNDOCUMENTED = (0.55, 0.55, 0.55)

METALS = {'guld', 'mässing', 'silver', 'krom', 'chrome steel'}


def resolve_colour(colour_text):
    """-> (rgb, metallic, state). Never invents a hue."""
    raw = (colour_text or '').strip().lower()
    if not raw:
        return UNDOCUMENTED, 0.0, 'undocumented'
    first = raw.split('/')[0].strip()
    if first in NOT_A_HUE:
        return UNDOCUMENTED, 0.0, f'no-single-hue:{first}'
    for word, rgb in PALETTE.items():
        if first == word or first.startswith(word) or word in first:
            return rgb, (1.0 if word in METALS else 0.0), f'documented:{word}'
    return UNDOCUMENTED, 0.0, f'unmapped:{first[:18]}'


def twin_cues(root, twin_id):
    p = os.path.join(root, 'data/twins', twin_id + '.json')
    if not os.path.exists(p):
        return None
    return json.load(open(p)).get('material_cues')
