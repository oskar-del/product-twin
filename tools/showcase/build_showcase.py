#!/usr/bin/env python3
"""
Reusable per-development showcase builder.
Turns one config JSON + an assets folder into a single self-contained microsite HTML
(coastal-modern editorial class: cinematic hero, alternating villa spreads with real
renders / floorplans / mono spec ledgers, embedded film, developer + Opero credit).

  python3 build_showcase.py <config.json> <out.html>

Next development = new config.json + assets folder. Same design class, swapped data.
See data/sites/essence-moraira/showcase.json for the canonical example.
"""
import base64, json, os, sys

def uri(path):
    ext=os.path.splitext(path)[1].lower()
    mime={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.mp4':'video/mp4','.webp':'image/webp'}.get(ext,'application/octet-stream')
    return f"data:{mime};base64,"+base64.b64encode(open(path,'rb').read()).decode()

def build(cfg_path, out_path):
    cfg=json.load(open(cfg_path))
    base=os.path.join(os.path.dirname(os.path.abspath(cfg_path)), cfg.get('assets_dir','.'))
    A=lambda f: uri(os.path.join(base,f))
    hero=A(cfg['hero'])
    def cell(k,val,unit):
        inner=('<span class="fig">'+val+'</span> '+unit) if unit else ('<span class="lv">'+val+'</span>')
        return '<div><dt>'+k+'</dt><dd>'+inner+'</dd></div>'
    def villa_sec(v,i):
        rev='rev' if i%2==1 else ''
        ledger=cell("Plot",v['plot'],"m2".replace("2","²"))+cell("Built",v['built'],"m2".replace("2","²"))+cell("Levels",v['levels'],"")
        plan=f'<figure class="plan"><img src="{A(v["plan"])}" alt="{v["name"]} floorplan" loading="lazy"><figcaption>{cfg.get("plan_caption","Ground floor · from the architect’s plans")}</figcaption></figure>' if v.get('plan') else ''
        return f'''
    <section class="villa reveal {rev}">
      <figure class="villa-shot"><img src="{A(v['img'])}" alt="{v['name']} — {cfg['name']}" loading="lazy"></figure>
      <div class="villa-body">
        <p class="eyebrow">{v['name']}</p>
        <h2>{v['name']}</h2>
        <p class="lede">{v['blurb']}</p>
        <dl class="ledger">{ledger}</dl>
        {plan}
      </div>
    </section>'''
    villas=''.join(villa_sec(v,i) for i,v in enumerate(cfg['villas']))
    meta=''.join(f"<span><b>{a}</b> {b}</span>" for a,b in cfg.get('meta',[]))
    credits=''.join(f"<div><span>{a}</span><b>{b}</b></div>" for a,b in cfg.get('credits',[]))
    film=''
    if cfg.get('film'):
        film=f'''
  <section class="film reveal">
    <div class="film-head"><p class="eyebrow">Film</p><h2>{cfg.get('film_h','The site, in motion')}</h2>
    <p class="lede">{cfg.get('film_lede','')}</p></div>
    <video src="{A(cfg['film'])}" autoplay muted loop playsinline controls poster="{hero}"></video>
  </section>'''
    tpl=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'template.html')).read()
    html=(tpl.replace('{{TITLE}}',cfg.get('title',cfg['name']))
             .replace('{{HERO}}',hero).replace('{{EYEBROW}}',cfg['location'])
             .replace('{{NAME}}',cfg['name']).replace('{{SUB}}',cfg['sub'])
             .replace('{{THESIS_EYEBROW}}',cfg['thesis_eyebrow']).replace('{{THESIS_H}}',cfg['thesis_h'])
             .replace('{{THESIS_LEDE}}',cfg['thesis_lede']).replace('{{META}}',meta)
             .replace('{{VILLAS}}',villas).replace('{{FILM}}',film)
             .replace('{{FOOT_H}}',cfg.get('foot_h','Brought to life before a stone is laid.'))
             .replace('{{CREDITS}}',credits).replace('{{TWIN_NOTE}}',cfg['twin_note']))
    open(out_path,'w').write(html)
    print(f"wrote {out_path}  ({len(html)/1048576:.2f} MB)")

if __name__=='__main__':
    build(sys.argv[1], sys.argv[2])
