#!/usr/bin/env python3
"""MIMER · PVGIS solar-yield for candidate MIMER roof planes (Svärtinge 54:28).
Evidence class: EXTERNAL_MODEL (JRC PVGIS v5.2, SARAH2 irradiation DB).
Roof geometry = CONCEPT (proposed planes, not a built roof)."""
import json, os, urllib.request
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt

LAT, LON = 58.6522414431, 16.0317063331
VAULT = "/Users/oskarpeterson/Documents/Opero/Concept Casa/Projects/Svärtinge 54.28 ( MIMER )/02-Sun-and-Views"
BASE = "https://re.jrc.ec.europa.eu/api/v5_2/PVcalc"
LOSS = 14  # system loss %

# PVGIS aspect: 0=S, +west, -east. Plot faces SW (207° from N -> +27° W of S).
PLANES = [
    ("Optimal (PVGIS)",      None, None, True),
    ("South pitch 40°",      40,   0,    False),
    ("SW pitch 40° (view)",  40,   27,   False),
    ("SW pitch 22° (gentle)",22,   27,   False),
    ("Flat/low 10°",         10,   0,    False),
]

def call(angle, aspect, opt):
    q = (f"?lat={LAT}&lon={LON}&peakpower=1&loss={LOSS}&mountingplace=building"
         f"&pvtechchoice=crystSi&outputformat=json")
    q += "&optimalangles=1" if opt else f"&angle={angle}&aspect={aspect}"
    with urllib.request.urlopen(BASE+q, timeout=60) as r:
        return json.load(r)

def main():
    rows, monthly = [], {}
    for name, ang, asp, opt in PLANES:
        d = call(ang, asp, opt)
        tot = d["outputs"]["totals"]["fixed"]
        fixed = d["inputs"]["mounting_system"]["fixed"]
        slope = fixed["slope"]["value"]; azimuth = fixed["azimuth"]["value"]
        rows.append({
            "plane": name, "slope_deg": slope, "azimuth_pvgis": azimuth,
            "E_y_kWh_per_kWp": round(tot["E_y"], 1),
            "irr_y_kWh_m2": round(tot["H(i)_y"], 1),
            "sd_year": round(tot.get("SD_y", 0), 1),
        })
        monthly[name] = [round(m["E_m"], 1) for m in d["outputs"]["monthly"]["fixed"]]
        print(name, "->", round(tot["E_y"],1), "kWh/kWp/yr  slope", slope, "az", azimuth)

    # example array sizing note (typical MIMER roof ~ 8 kWp on south plane)
    best = max(rows, key=lambda r: r["E_y_kWh_per_kWp"])
    result = {
        "schema": "mimer-pvgis-yield/v0.1",
        "evidence_class": "EXTERNAL_MODEL (JRC PVGIS v5.2, SARAH2)",
        "roof_geometry": "CONCEPT — proposed planes, not a built/surveyed roof",
        "system_loss_pct": LOSS, "lat": LAT, "lon": LON,
        "planes": rows,
        "monthly_kWh_per_kWp": monthly,
        "note_shading": ("PVGIS uses its own horizon; local tree/neighbour shading NOT "
                         "modelled here. Site is open to the S/SW (downslope toward Glan), "
                         "so far-horizon losses are low, but on-plot trees must be surveyed."),
        "sizing_example": {
            "assumed_kWp": 8,
            "plane": best["plane"],
            "annual_kWh": round(best["E_y_kWh_per_kWp"] * 8),
        },
    }
    with open(f"{VAULT}/pvgis-yield.json", "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print("wrote", f"{VAULT}/pvgis-yield.json")

    # monthly chart
    months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    fig, ax = plt.subplots(figsize=(9, 4.6))
    for name in monthly:
        ax.plot(months, monthly[name], marker="o", ms=3.5, lw=1.8, label=name)
    ax.set_ylabel("kWh per kWp per month")
    ax.set_title("MIMER · Svärtinge 54:28 — modelled PV yield by roof plane\n"
                 "PVGIS v5.2 (SARAH2) · CONCEPT roof planes · 14% system loss", fontsize=11)
    ax.grid(alpha=0.3); ax.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(f"{VAULT}/pvgis-monthly.png", dpi=120); plt.close(fig)
    print("wrote", f"{VAULT}/pvgis-monthly.png")

if __name__ == "__main__":
    main()
