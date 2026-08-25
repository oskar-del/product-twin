#!/usr/bin/env python3
"""Render the MIMER Lender Dossier MD → a bank-ready, print-styled A4 HTML."""
import markdown, os
V="/Users/oskarpeterson/Documents/Opero/Concept Casa/Projects/Svärtinge 54.28 ( MIMER )/07-Lender-Dossier"
src=open(f"{V}/MIMER-LENDER-DOSSIER.md").read()
body=markdown.markdown(src, extensions=["tables","toc","sane_lists"])
html=f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MIMER · Lender Dossier · Svärtinge 54:28</title>
<style>
:root{{--ink:#1f242b;--gold:#9c7523;--mut:#5b6357;--line:#dcd6c8;--paper:#fbfaf6;--warn:#8a3b2f}}
*{{box-sizing:border-box}}
body{{margin:0;background:#e9e6dd;font-family:"Iowan Old Style",Georgia,serif;color:var(--ink);line-height:1.55}}
.page{{max-width:820px;margin:28px auto;background:var(--paper);padding:56px 60px;
  box-shadow:0 6px 30px rgba(0,0,0,.12)}}
h1{{font-size:26px;margin:0 0 2px;font-weight:600;letter-spacing:.01em}}
h3{{color:var(--gold);font-weight:600;margin:.2em 0 1.4em;font-size:15px;border-bottom:2px solid var(--gold);padding-bottom:12px}}
h2{{font-size:19px;margin:1.8em 0 .5em;padding-top:.4em;border-top:1px solid var(--line);font-weight:600}}
h2:first-of-type{{border-top:none}}
p,li{{font-size:13.5px}}
strong{{color:#111}}
table{{border-collapse:collapse;width:100%;margin:12px 0;font-size:11.7px;font-family:Inter,system-ui,sans-serif}}
th,td{{border:1px solid var(--line);padding:6px 9px;text-align:left;vertical-align:top}}
th{{background:#f0ead9;color:var(--ink);font-weight:600}}
tr:nth-child(even) td{{background:#faf7ef}}
code{{background:#f0ead9;padding:1px 5px;border-radius:3px;font-size:11px;font-family:ui-monospace,monospace}}
em{{color:var(--mut)}}
hr{{border:none;border-top:1px solid var(--line);margin:22px 0}}
.banner{{font-family:Inter,system-ui,sans-serif;font-size:11px;letter-spacing:.05em;color:var(--mut);
  background:#f0ead9;border-left:3px solid var(--gold);padding:9px 13px;margin:0 0 20px}}
h2#10-mandatory-not-verified-assumptions-ledger,
h2#3-ground-site-risk-screen-the-additive-module{{color:var(--warn);border-top-color:var(--warn)}}
@media print{{body{{background:#fff}}.page{{box-shadow:none;margin:0;max-width:none;padding:20mm}}}}
</style></head><body><div class="page">
<div class="banner">CONFIDENTIAL WORKING DOCUMENT · PRE-APPLICATION · not an offer, valuation, or credit application</div>
{body}
</div></body></html>"""
out=f"{V}/MIMER-LENDER-DOSSIER.html"
open(out,"w").write(html)
print("wrote",out,f"({len(html)//1024} KB)")
