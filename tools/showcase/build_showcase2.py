#!/usr/bin/env python3
"""
Showcase builder v2 — real developer renders, not massing.
Per villa: a full-bleed hero exterior, a spec ledger, and an interior gallery.
  python3 build_showcase2.py <config.json> <out.html>
Config: see data/sites/essence-moraira/showcase/showcase2.json
"""
import base64, json, os, sys

def uri(path):
    ext = os.path.splitext(path)[1].lower()
    mime = {'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4'}.get(ext,'application/octet-stream')
    with open(path,'rb') as f:
        return f"data:{mime};base64," + base64.b64encode(f.read()).decode()

CSS = """
:root{--bg:#EEEFEC;--panel:#F6F6F3;--ink:#12201F;--muted:#5A6866;--line:#D6D9D3;--sea:#1E6E74;--sand:#B4915A;--shadow:0 30px 70px -34px rgba(18,32,31,.4)}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0B1618;--panel:#111f21;--ink:#EDF1ED;--muted:#9BADAB;--line:#1e3437;--sea:#54B5B9;--sand:#D6B47E;--shadow:0 30px 70px -30px rgba(0,0,0,.65)}}
:root[data-theme=dark]{--bg:#0B1618;--panel:#111f21;--ink:#EDF1ED;--muted:#9BADAB;--line:#1e3437;--sea:#54B5B9;--sand:#D6B47E;--shadow:0 30px 70px -30px rgba(0,0,0,.65)}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Instrument Sans",system-ui,sans-serif;font-size:17px;line-height:1.62;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
.eyebrow{font-family:"IBM Plex Mono",monospace;font-size:11.5px;letter-spacing:.3em;text-transform:uppercase;color:var(--sea);margin:0 0 .6em}
h1,h2,h3{font-family:"Fraunces",Georgia,serif;font-weight:300;line-height:1.02;letter-spacing:-.01em;margin:0;text-wrap:balance}
.lede{color:var(--muted);max-width:52ch}
.hero{position:relative;min-height:98vh;display:flex;align-items:flex-end;overflow:hidden}
.hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,18,20,.32),rgba(6,18,20,0) 36%,rgba(6,18,20,.66))}
.hero-inner{position:relative;z-index:2;padding:clamp(24px,6vw,88px);max-width:1240px;margin:0 auto;width:100%;color:#F2F5F2}
.hero .eyebrow{color:#CDE8E8}.hero h1{font-size:clamp(58px,14vw,180px);color:#fff}
.hero .sub{max-width:38ch;color:#DEE8E7;font-size:clamp(16px,2vw,22px);margin:.55em 0 0}
.wrap{max-width:1200px;margin:0 auto;padding:0 clamp(20px,5vw,56px)}
.thesis{padding:clamp(74px,12vw,158px) 0 clamp(20px,5vw,54px)}
.thesis h2{font-size:clamp(30px,5.2vw,60px);max-width:17ch}
.thesis .lede{font-size:clamp(17px,2vw,21px);margin-top:1.4em;max-width:58ch}
.thesis .meta{display:flex;flex-wrap:wrap;gap:2.6em;margin-top:2.8em;padding-top:1.7em;border-top:1px solid var(--line);font-family:"IBM Plex Mono",monospace;font-size:12.5px;color:var(--muted)}
.thesis .meta b{color:var(--ink);font-weight:500;display:block;font-size:22px;font-family:"Fraunces",serif}
.villa{padding:clamp(64px,10vw,132px) 0 0}
.villa-hero{position:relative;max-width:1440px;margin:0 auto;padding:0 clamp(0px,2vw,28px)}
.villa-hero img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:4px;box-shadow:var(--shadow)}
.villa-hero .tag{position:absolute;left:clamp(20px,4vw,60px);bottom:clamp(20px,3vw,40px);z-index:2;color:#fff;font-family:"IBM Plex Mono",monospace;font-size:11.5px;letter-spacing:.28em;text-transform:uppercase;text-shadow:0 2px 20px rgba(0,0,0,.6)}
.villa-head{max-width:1200px;margin:0 auto;padding:clamp(32px,4vw,54px) clamp(20px,5vw,56px) 0;display:grid;grid-template-columns:1.05fr .95fr;gap:clamp(24px,4vw,64px);align-items:end}
.villa-head h2{font-size:clamp(42px,7vw,86px)}
.villa-head .blurb{color:var(--muted);font-size:clamp(16px,1.6vw,19px);max-width:50ch}
.ledger{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:3px;overflow:hidden;max-width:1200px;margin:clamp(28px,3.5vw,44px) auto 0;width:calc(100% - 2*clamp(20px,5vw,56px))}
.ledger>div{background:var(--panel);padding:16px 20px}
.ledger dt{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-bottom:.6em}
.ledger dd{margin:0;font-family:"Fraunces",serif;font-size:30px;font-weight:400}
.ledger dd small{font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--muted);font-weight:400}
.gallery{max-width:1200px;margin:clamp(20px,3vw,36px) auto 0;padding:0 clamp(20px,5vw,56px);display:grid;grid-template-columns:2fr 1fr;grid-template-rows:1fr 1fr;gap:12px}
.gallery img{width:100%;height:100%;object-fit:cover;border-radius:3px;box-shadow:var(--shadow)}
.gallery a{display:block}.gallery .big{grid-row:1/3}
.film{max-width:1440px;margin:clamp(80px,11vw,150px) auto 0;padding:0 clamp(0px,2vw,28px)}
.film-head{max-width:1200px;margin:0 auto clamp(24px,3vw,40px);padding:0 clamp(20px,5vw,56px)}
.film-head h2{font-size:clamp(30px,5vw,56px);margin:.15em 0 .5em}
.film video{width:100%;border-radius:4px;box-shadow:var(--shadow);background:#081315;aspect-ratio:16/9;object-fit:cover}
footer{background:#0C2022;color:#E7F2F1;margin-top:clamp(80px,11vw,150px)}
:root[data-theme=dark] footer,@media (prefers-color-scheme:dark){footer{background:#081416}}
footer .wrap{padding:clamp(56px,8vw,104px) clamp(20px,5vw,56px)}
footer h2{color:#fff;font-size:clamp(28px,4.4vw,50px);max-width:18ch}
.credits{display:flex;flex-wrap:wrap;gap:2.4em 4em;margin-top:3em;padding-top:2em;border-top:1px solid rgba(255,255,255,.16);font-family:"IBM Plex Mono",monospace;font-size:12px}
.credits div span{display:block;color:#8FBAB9;text-transform:uppercase;letter-spacing:.2em;font-size:10px;margin-bottom:.6em}
.credits div b{font-weight:500;color:#fff;font-family:"Instrument Sans",sans-serif;font-size:15px;letter-spacing:0}
.note{margin-top:2.6em;color:#A9CCCB;max-width:62ch;font-size:13.5px;line-height:1.7}
.reveal{opacity:0;transform:translateY(24px);transition:opacity .9s ease,transform .9s ease}.reveal.in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none}html{scroll-behavior:auto}}
@media (max-width:860px){.villa-head{grid-template-columns:1fr;align-items:start;gap:16px}.ledger{grid-template-columns:repeat(2,1fr)}.gallery{grid-template-columns:1fr;grid-template-rows:none}.gallery .big{grid-row:auto}body{font-size:16px}}
"""

def build(cfg_path, out_path):
    cfg = json.load(open(cfg_path))
    base = os.path.join(os.path.dirname(os.path.abspath(cfg_path)), cfg.get('assets_dir','assets'))
    A = lambda f: uri(os.path.join(base, f))

    def villa(v):
        beds = f'<div><dt>Bedrooms</dt><dd>{v["beds"]}</dd></div>'
        built = f'<div><dt>Built</dt><dd>{v["built"]} <small>m²</small></dd></div>'
        plot = f'<div><dt>Plot</dt><dd>{v["plot"]} <small>m²</small></dd></div>'
        status = f'<div><dt>Status</dt><dd style="font-family:\'Instrument Sans\',sans-serif;font-size:18px">{v["status"]}</dd></div>'
        gal = v.get('gallery', [])
        gimgs = ''
        cls = ['big','','']
        for i, g in enumerate(gal[:3]):
            gimgs += f'<img class="{cls[i] if i<len(cls) else ""}" src="{A(g)}" alt="{v["name"]} interior" loading="lazy">'
        return f'''
  <section class="villa reveal">
    <div class="villa-hero"><img src="{A(v['hero'])}" alt="{v['name']} — {cfg['name']}" loading="lazy"><span class="tag">{v['tag']}</span></div>
    <div class="villa-head">
      <div><p class="eyebrow">{v['eyebrow']}</p><h2>{v['name']}</h2></div>
      <p class="blurb">{v['blurb']}</p>
    </div>
    <dl class="ledger">{beds}{built}{plot}{status}</dl>
    <div class="gallery">{gimgs}</div>
  </section>'''

    villas = ''.join(villa(v) for v in cfg['villas'])
    meta = ''.join(f'<span><b>{a}</b>{b}</span>' for a,b in cfg.get('meta',[]))
    credits = ''.join(f'<div><span>{a}</span><b>{b}</b></div>' for a,b in cfg.get('credits',[]))
    film = ''
    if cfg.get('film'):
        film = f'''
  <section class="film reveal">
    <div class="film-head"><p class="eyebrow">Film</p><h2>{cfg.get('film_h','')}</h2><p class="lede">{cfg.get('film_lede','')}</p></div>
    <video src="{A(cfg['film'])}" autoplay muted loop playsinline controls poster="{A(cfg['hero'])}"></video>
  </section>'''

    html = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{cfg.get('title', cfg['name'])}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400&family=Instrument+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body>
  <header class="hero"><img src="{A(cfg['hero'])}" alt="{cfg['name']}">
    <div class="hero-inner"><p class="eyebrow">{cfg['location']}</p><h1>{cfg['name']}</h1><p class="sub">{cfg['sub']}</p></div></header>
  <div class="wrap thesis reveal"><p class="eyebrow">{cfg['thesis_eyebrow']}</p><h2>{cfg['thesis_h']}</h2>
    <p class="lede">{cfg['thesis_lede']}</p><div class="meta">{meta}</div></div>
  {villas}
  {film}
  <footer><div class="wrap reveal"><h2>{cfg.get('foot_h','')}</h2><div class="credits">{credits}</div><p class="note">{cfg['twin_note']}</p></div></footer>
<script>
const io=new IntersectionObserver(e=>e.forEach(x=>{{if(x.isIntersecting){{x.target.classList.add('in');io.unobserve(x.target)}}}}),{{threshold:.1}});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
</script></body></html>'''
    with open(out_path,'w') as f:
        f.write(html)
    print(f"wrote {out_path}  ({len(html)/1048576:.2f} MB)")

if __name__ == '__main__':
    build(sys.argv[1], sys.argv[2])
