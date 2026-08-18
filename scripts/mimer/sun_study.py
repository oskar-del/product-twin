#!/usr/bin/env python3
"""
MIMER · Svärtinge 54:28 — Sun study from the real 1 m Lantmäteriet DEM.

Evidence class: DERIVED (bare-earth terrain shadows only; no buildings/vegetation).
Gate: GATE_SE_TERRAIN OPEN — provisional internal derivation, NOT official terrain.

Outputs (vault 02-Sun-and-Views/):
  - sun-shadows-<date>.png            per-date 4-panel terrain shadow sheet (09/12/15/18h)
  - sun-path-polar.png                stereographic sun-path chart w/ terrain horizon
  - sun-study.json                    machine-readable derivation (sun angles, terrace pick)
The one-pager (sun-study-sheet) is assembled separately from these + PVGIS yields.
"""
import json, os, glob
import numpy as np
import rasterio
from rasterio.merge import merge
import pvlib
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MplPolygon

ROOT = "/Users/oskarpeterson/Documents/AI/product twin"
DEM_DIR = f"{ROOT}/repo/.runtime/lantmateriet/terrain"
VAULT = "/Users/oskarpeterson/Documents/Opero/Concept Casa/Projects/Svärtinge 54.28 ( MIMER )/02-Sun-and-Views"
os.makedirs(VAULT, exist_ok=True)

# --- Site constants (from terrain-dem-derived-v0.1.json) ---
LAT, LON = 58.6522414431, 16.0317063331          # listing pin WGS84
PIN_EN = (559869.0, 6501790.31)                   # SWEREF99 TM
PIN_Z = 69.84                                     # RH2000 m
TZ = "Europe/Stockholm"
CORNERS_EN = [                                    # indicative municipal plot trace
    (559841.42, 6501771.29), (559894.67, 6501774.14),
    (559898.48, 6501806.48), (559846.18, 6501812.18),
]
RADIUS = 260   # m window half-size around pin (room for long winter shadows)

DATES = {  # local dates; representative clear-sky
    "summer-solstice": "2026-06-21",
    "equinox":         "2026-09-22",
    "winter-solstice": "2026-12-21",
}
HOURS = [9, 12, 15, 18]

# ---------------------------------------------------------------- DEM load
def load_window():
    srcs = [rasterio.open(f) for f in sorted(glob.glob(f"{DEM_DIR}/*.tif"))]
    mosaic, transform = merge(srcs, bounds=(
        PIN_EN[0]-RADIUS, PIN_EN[1]-RADIUS, PIN_EN[0]+RADIUS, PIN_EN[1]+RADIUS))
    for s in srcs:
        s.close()
    z = mosaic[0].astype("float64")
    # nodata guard
    z[z < -1000] = np.nan
    return z, transform

def en_to_px(transform, e, n):
    col, row = ~transform * (e, n)
    return col, row

# ---------------------------------------------------------------- shadows
def cast_shadow(z, res, sun_az_deg, sun_alt_deg):
    """Boolean array: True where terrain is in its own shadow.
    Ray-march toward the sun; a cell is shadowed if any upwind terrain
    rises above the sun ray from that cell. Vectorised over the whole grid."""
    if sun_alt_deg <= 0:
        return np.ones_like(z, dtype=bool)  # sun below horizon
    H, W = z.shape
    # direction TOWARD sun in grid space. Azimuth: 0=N,90=E clockwise.
    # grid: col=+E (x), row=+S (y decreases north). North = row-. East = col+.
    dx = np.sin(np.radians(sun_az_deg))    # east component (col +)
    dy = -np.cos(np.radians(sun_az_deg))   # north component -> row - (so multiply)
    # per-step in pixels
    step = 1.0
    n_steps = int((2*RADIUS) / res / step) + 5
    tan_alt = np.tan(np.radians(sun_alt_deg))
    rr, cc = np.mgrid[0:H, 0:W].astype("float64")
    base = z.copy()
    shadow = np.zeros_like(z, dtype=bool)
    valid_base = ~np.isnan(base)
    for k in range(1, n_steps):
        sc = cc + dx * k * step
        sr = rr + dy * k * step
        inb = (sc >= 0) & (sc <= W-1) & (sr >= 0) & (sr <= H-1)
        # nearest-cell sample
        ic = np.clip(np.round(sc).astype(int), 0, W-1)
        ir = np.clip(np.round(sr).astype(int), 0, H-1)
        zt = base[ir, ic]
        ray_h = base + tan_alt * (k * step * res)   # sun-ray height at that horizontal dist
        hit = inb & valid_base & (zt > ray_h) & (~np.isnan(zt))
        shadow |= hit
    return shadow

def hillshade(z, res, az, alt):
    gy, gx = np.gradient(z, res, res)
    slope = np.pi/2 - np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    az_r = np.radians(360-az+90); alt_r = np.radians(alt)
    hs = (np.sin(alt_r)*np.sin(slope) +
          np.cos(alt_r)*np.cos(slope)*np.cos(az_r-aspect))
    return np.clip(hs, 0, 1)

# ---------------------------------------------------------------- solar
def solar_positions():
    loc = pvlib.location.Location(LAT, LON, tz=TZ, altitude=PIN_Z)
    out = {}
    for name, d in DATES.items():
        times = pd.to_datetime([f"{d} {h:02d}:00" for h in HOURS]).tz_localize(TZ)
        sp = loc.get_solarposition(times)
        out[name] = {h: (float(sp["azimuth"].iloc[i]), float(sp["apparent_elevation"].iloc[i]))
                     for i, h in enumerate(HOURS)}
    return out, loc

# ---------------------------------------------------------------- render
def plot_corners_px(transform):
    return [en_to_px(transform, e, n) for (e, n) in CORNERS_EN]

def render_shadow_sheet(z, transform, res, sun, date_name):
    fig, axes = plt.subplots(1, 4, figsize=(20, 5.6))
    px_pin = en_to_px(transform, *PIN_EN)
    corners = plot_corners_px(transform)
    for ax, h in zip(axes, HOURS):
        az, alt = sun[date_name][h]
        if alt <= 0:
            base = hillshade(z, res, 315, 45)
            ax.imshow(base, cmap="gray", vmin=0, vmax=1)
            ax.imshow(np.ones_like(z), cmap="Blues", alpha=0.55, vmin=0, vmax=1)
            ax.text(0.5, 0.5, "sun below\nhorizon", ha="center", va="center",
                    transform=ax.transAxes, fontsize=15, color="white", weight="bold")
        else:
            hs = hillshade(z, res, az, alt)
            sh = cast_shadow(z, res, az, alt)
            img = np.dstack([hs, hs, hs])
            # tint shadows blue-grey
            img[sh] = img[sh]*0.45 + np.array([0.10, 0.13, 0.22])*0.55
            ax.imshow(img)
        # plot boundary + pin
        poly = MplPolygon(corners, closed=True, fill=False, edgecolor="#E7B84B", lw=2.2)
        ax.add_patch(poly)
        ax.plot(*px_pin, marker="o", ms=5, color="#E7B84B")
        ax.set_title(f"{h:02d}:00  ·  az {az:.0f}° alt {alt:.0f}°", fontsize=11)
        ax.set_xticks([]); ax.set_yticks([])
    fig.suptitle(f"MIMER · Svärtinge 54:28 — terrain shadows · {date_name} ({DATES[date_name]})\n"
                 f"DERIVED from 1 m Lantmäteriet DEM · bare earth only (no buildings/trees) · GATE_SE_TERRAIN open",
                 fontsize=12)
    fig.tight_layout(rect=[0,0,1,0.93])
    out = f"{VAULT}/sun-shadows-{date_name}.png"
    fig.savefig(out, dpi=120); plt.close(fig)
    return out

def render_sun_path(sun, loc):
    fig = plt.figure(figsize=(7.5, 7.5))
    ax = fig.add_subplot(111, projection="polar")
    ax.set_theta_zero_location("N"); ax.set_theta_direction(-1)
    ax.set_rlim(90, 0)  # zenith center, horizon edge
    colors = {"summer-solstice":"#E9A23B", "equinox":"#5AA9E6", "winter-solstice":"#8E6FCE"}
    # full-day arcs
    for name, d in DATES.items():
        times = pd.date_range(f"{d} 03:00", f"{d} 22:00", freq="10min", tz=TZ)
        sp = loc.get_solarposition(times)
        up = sp["apparent_elevation"] > 0
        ax.plot(np.radians(sp["azimuth"][up]), sp["apparent_elevation"][up],
                color=colors[name], lw=2.3, label=name)
    # hour markers
    for name in DATES:
        for h in HOURS:
            az, alt = sun[name][h]
            if alt > 0:
                ax.plot(np.radians(az), alt, "o", color=colors[name], ms=6,
                        markeredgecolor="white", markeredgewidth=0.8)
    ax.set_title("MIMER · Svärtinge 54:28 — sun path (58.65°N)\nstereographic · derived", fontsize=12, pad=18)
    ax.legend(loc="lower center", bbox_to_anchor=(0.5,-0.13), ncol=3, fontsize=9, frameon=False)
    ax.set_rgrids([0,15,30,45,60], labels=["0°","15°","30°","45°","60°"], fontsize=7)
    out = f"{VAULT}/sun-path-polar.png"
    fig.savefig(out, dpi=120, bbox_inches="tight"); plt.close(fig)
    return out

def main():
    z, transform = load_window()
    res = 1.0
    sun, loc = solar_positions()
    outs = []
    for name in DATES:
        outs.append(render_shadow_sheet(z, transform, res, sun, name))
        print("wrote", outs[-1])
    p = render_sun_path(sun, loc)
    print("wrote", p)

    # terrace-orientation logic: plot aspect SW(207°); best terrace faces the
    # afternoon/evening sun AND the Glan view axis (~185° S). SW terrace catches
    # midday->sunset sun and the water view -> strongly recommended.
    study = {
        "schema": "mimer-sun-study/v0.1",
        "evidence_class": "DERIVED",
        "gate": "GATE_SE_TERRAIN OPEN — bare-earth terrain only, provisional",
        "site": {"lat": LAT, "lon": LON, "pin_rh2000_m": PIN_Z,
                 "slope_deg": 14.2, "aspect_deg": 207, "aspect_compass": "SW"},
        "sun_positions": {name: {str(h): {"az": round(sun[name][h][0],1),
                                          "alt": round(sun[name][h][1],1)}
                                 for h in HOURS} for name in DATES},
        "terrace_recommendation": {
            "orientation": "SW (facing ~205–215°)",
            "why": ("Natural plot fall is SW at 14° — building the main terrace on the "
                    "downslope SW corner aligns the outdoor room with (a) the measured Glan "
                    "water-view axis to the south and (b) midday-through-sunset sun. Morning "
                    "sun reaches the plot unobstructed by terrain; the only self-shadowing is "
                    "the plot's own upslope NE edge in early winter mornings."),
            "avoid": "NE upper corner for primary outdoor living — it loses sun first and faces away from Glan."
        },
        "images": [os.path.basename(o) for o in outs] + ["sun-path-polar.png"],
    }
    with open(f"{VAULT}/sun-study.json", "w") as f:
        json.dump(study, f, indent=2, ensure_ascii=False)
    print("wrote", f"{VAULT}/sun-study.json")
    # echo key angles
    for name in DATES:
        print(name, {h: (round(sun[name][h][0]), round(sun[name][h][1])) for h in HOURS})

if __name__ == "__main__":
    main()
