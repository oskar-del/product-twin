#!/usr/bin/env python3
"""MIMER · Svärtinge 54:28 — assemble the microsite (Mission step 6, Essence pattern).
Single portable HTML: cinematic first view → plot → sun → house → systems → value.
Vault images are base64-embedded so the file stands alone. Buyer-facing editorial
aesthetic (warm/serif/imagery), truth badges on every section.
Output: vault root MIMER-microsite.html"""
import base64, os
VROOT="/Users/oskarpeterson/Documents/Opero/Concept Casa/Projects/Svärtinge 54.28 ( MIMER )"

def b64(rel):
    p=os.path.join(VROOT,rel)
    with open(p,"rb") as f: return "data:image/png;base64,"+base64.b64encode(f.read()).decode()

IMG={
 "hero":   b64("01-Site-Intelligence/svartinge-terrain-hillshade.png"),
 "plot":   b64("01-Site-Intelligence/svartinge-site-plan.png"),
 "sun":    b64("02-Sun-and-Views/sun-study-sheet.png"),
 "section":b64("04-House-Design/concept-section.png"),
 "house":  b64("04-House-Design/concept-plans.png"),
 "systems":b64("05-Systems/systems-section.png"),
 "heart":  b64("05-Systems/house-heart.png"),
 "value":  b64("06-Value-Ladder/value-ladder.png"),
}

SECTIONS=[
 ("plot","01 · The plot","A shelf that faces the water",
  "SVÄRTINGE 54:28 rises from a low SW corner up a 14° slope. Its only gentle ground is a "
  "narrow shelf near the 70 m contour — and it faces the same way as the Glan view, the sun, "
  "and the road. Access, drainage and view all point SW.",
  "DERIVED terrain (1 m Lantmäteriet DEM) · boundary indicative · GATE_SE_TERRAIN open"),
 ("sun","02 · Sun & light","The light is measured, not promised",
  "Summer sun climbs to 53°; winter noon barely 8°. A SW terrace catches midday-to-sunset "
  "sun and the water together — and a SW roof still yields ~912 kWh/kWp, 97% of the "
  "south-optimal. No trade-off between the view and the solar.",
  "DERIVED sun geometry · PVGIS v5.2 external model · roof CONCEPT"),
 ("section","03 · The house","A house that steps down to the view",
  "The land writes the design: a Swedish sluttningshus (souterräng 1.5-plan). Enter at the "
  "NE grade against the bank; drop the living to a lower level that walks out SW to a terrace "
  "at the view; two storeys of glass to Glan and the sun; a mono-pitch roof that becomes the "
  "PV plane.",
  "House geometry CONCEPT · on DERIVED terrain"),
 ("house","","Living to the view, service to the bank",
  "Great room, kitchen and master open SW behind full-height glass. Entry, carport, tech and "
  "the House Heart tuck against the cool NE bank. Bedrooms and a gallery sit over the living "
  "on the upper 1.5 level.",
  "Schematic plans · CONCEPT"),
 ("systems","04 · Systems","The slope does the work",
  "Because the house sits above the road, foul water falls to the main by gravity — no pump. "
  "Heat comes from the ground (bergvärme); air is balanced with heat recovery; stormwater "
  "soaks into the permeable esker. Every service converges on one House Heart.",
  "CONCEPT services · rulebook patterns to verify vs BBR + utility"),
 ("heart","","One core, every service — and the twin's data feed",
  "The House Heart holds water, power, heat, ventilation and the smart-metering that makes the "
  "finished home an instrumented digital twin.",
  "CONCEPT"),
 ("value","05 · The value","Why a plot becomes a product",
  "Each block moves the asset up a rung — informed, light-proven, development-ready, designed, "
  "buildable — and each rung compresses the risk a buyer, a bank and an architect price in. "
  "The slope a normal listing hides is exactly where the value is.",
  "Evidence-derived · no invented valuations · open gates unlock the next tier"),
]

def sec_html(key,kicker,title,body,badge):
    kick=f'<div class="kicker">{kicker}</div>' if kicker else ''
    return f"""
  <section class="story">
    <div class="story-text">
      {kick}
      <h2>{title}</h2>
      <p>{body}</p>
      <div class="badge">{badge}</div>
    </div>
    <div class="story-img"><img src="{IMG[key]}" alt="{title}"></div>
  </section>"""

html=f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MIMER · Svärtinge 54:28</title>
<style>
:root{{--ink:#22282e;--gold:#b8892f;--paper:#f7f3ea;--card:#fffdf8;--mut:#6b6357}}
*{{box-sizing:border-box}}
html{{scroll-behavior:smooth}}
body{{margin:0;font-family:Georgia,"Iowan Old Style",serif;color:var(--ink);background:var(--paper);line-height:1.6}}
.hero{{position:relative;height:100vh;display:grid;place-items:center;text-align:center;
  background:linear-gradient(rgba(20,22,20,.42),rgba(20,22,20,.62)),url('{IMG["hero"]}') center/cover;color:#fff}}
.hero .wrap{{max-width:760px;padding:0 24px}}
.hero .eyebrow{{letter-spacing:.32em;font-size:12px;text-transform:uppercase;opacity:.85;font-family:Inter,system-ui,sans-serif}}
.hero h1{{font-size:clamp(44px,8vw,88px);margin:.15em 0 .1em;font-weight:400;letter-spacing:.01em}}
.hero .sub{{font-size:clamp(16px,2.4vw,21px);opacity:.94}}
.hero .meta{{margin-top:14px;font-size:13px;opacity:.8;font-family:Inter,system-ui,sans-serif}}
.cta{{display:inline-block;margin-top:30px;padding:14px 30px;border:1px solid rgba(255,255,255,.85);
  color:#fff;text-decoration:none;letter-spacing:.14em;font-size:13px;text-transform:uppercase;
  font-family:Inter,system-ui,sans-serif;transition:.25s;border-radius:2px}}
.cta:hover{{background:#fff;color:var(--ink)}}
.scroll-hint{{position:absolute;bottom:26px;left:50%;transform:translateX(-50%);font-size:11px;
  letter-spacing:.2em;opacity:.8;font-family:Inter,system-ui,sans-serif}}
.story{{max-width:1160px;margin:0 auto;padding:76px 24px;display:grid;grid-template-columns:1fr 1.25fr;
  gap:48px;align-items:center;border-top:1px solid #e7ded0}}
.story:nth-child(even) .story-text{{order:2}}
.story-text .kicker{{color:var(--gold);letter-spacing:.16em;font-size:13px;text-transform:uppercase;
  font-family:Inter,system-ui,sans-serif;margin-bottom:10px}}
.story-text h2{{font-size:clamp(28px,4vw,42px);font-weight:400;margin:.1em 0 .5em;line-height:1.15}}
.story-text p{{font-size:17px;color:#3a3c39}}
.story-text .badge{{margin-top:18px;display:inline-block;font-family:Inter,system-ui,sans-serif;
  font-size:11px;letter-spacing:.03em;color:var(--mut);background:#efe8da;border-radius:3px;padding:7px 11px}}
.story-img img{{width:100%;border-radius:6px;box-shadow:0 14px 40px rgba(40,34,20,.14);background:var(--card)}}
.outro{{text-align:center;padding:90px 24px 40px;border-top:1px solid #e7ded0;max-width:820px;margin:0 auto}}
.outro h2{{font-weight:400;font-size:clamp(26px,4vw,38px);margin-bottom:.4em}}
.outro p{{color:var(--mut);font-size:15px}}
.truth{{font-family:Inter,system-ui,sans-serif;font-size:12px;color:var(--mut);background:#efe8da;
  border-radius:6px;padding:18px 22px;margin:28px auto 0;max-width:820px;text-align:left;line-height:1.7}}
footer{{text-align:center;padding:34px;font-family:Inter,system-ui,sans-serif;font-size:11px;
  letter-spacing:.06em;color:var(--mut)}}
@media(max-width:820px){{.story{{grid-template-columns:1fr;gap:26px}}.story:nth-child(even) .story-text{{order:0}}}}
</style></head>
<body>
<div class="hero"><div class="wrap">
  <div class="eyebrow">Concept Casa · Sweden pilot</div>
  <h1>MIMER</h1>
  <div class="sub">Säterdalsvägen 14 · Svärtinge 54:28 · a for-sale plot, taken to a project</div>
  <div class="meta">Norrköping · ~1,939 m² · Glan view · 58.65°N</div>
  <a class="cta" href="03-Context-3D/svartinge-cinematic.html">▶ Cinematic flyover</a>
</div><div class="scroll-hint">SCROLL ↓</div></div>
{''.join(sec_html(*s) for s in SECTIONS)}
<div class="outro">
  <h2>We propose and check. Professionals stamp.</h2>
  <p>Every image above discloses its evidence class. Nothing here is a claim dressed as a fact.</p>
  <div class="truth"><b>Truth law.</b> Seller figures stay REPORTED_UNVERIFIED. Terrain is DERIVED from the
  real 1 m Lantmäteriet DEM (RH2000) with GATE_SE_TERRAIN still open — bare-earth, provisional, not official
  survey. The house and all building systems are CONCEPT — proposed intent, not engineered design. Solar is
  an external PVGIS model. Open gates (legal boundary & area, HV-corridor location, entitlement, geotech &
  infiltration, VA connection) must close before any concept becomes a bankable fact.</div>
</div>
<footer>MIMER · Svärtinge 54:28 — internal Concept Casa working microsite · not a public listing or offer</footer>
</body></html>"""

out=os.path.join(VROOT,"MIMER-microsite.html")
with open(out,"w") as f: f.write(html)
print("wrote",out,f"({len(html)//1024} KB)")
