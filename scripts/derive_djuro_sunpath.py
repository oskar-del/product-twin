#!/usr/bin/env python3
"""Solar position (altitude/azimuth) via the standard NOAA/Meeus low-precision solar
position algorithm. DERIVED: deterministic astronomy formula, not fetched data."""
import math, json, sys

def solar_position(lat_deg, lon_deg, year, month, day, hour_utc):
    lat = math.radians(lat_deg)
    # Julian day
    a = (14 - month) // 12
    y = year + 4800 - a
    m = month + 12 * a - 3
    jdn = day + (153*m + 2)//5 + 365*y + y//4 - y//100 + y//400 - 32045
    jd = jdn + (hour_utc - 12) / 24.0
    n = jd - 2451545.0
    L = (280.460 + 0.9856474 * n) % 360
    g = math.radians((357.528 + 0.9856003 * n) % 360)
    lam = math.radians((L + 1.915*math.sin(g) + 0.020*math.sin(2*g)) % 360)
    epsilon = math.radians(23.439 - 0.0000004*n)
    ra = math.atan2(math.cos(epsilon)*math.sin(lam), math.cos(lam))
    decl = math.asin(math.sin(epsilon)*math.sin(lam))
    gmst = (18.697374558 + 24.06570982441908*n) % 24
    lst = (gmst + lon_deg/15.0) % 24
    ha = math.radians((lst*15.0 - math.degrees(ra)) % 360)
    if ha > math.pi: ha -= 2*math.pi
    alt = math.asin(math.sin(lat)*math.sin(decl) + math.cos(lat)*math.cos(decl)*math.cos(ha))
    # Azimuth from North, clockwise (standard compass bearing) — Meeus formula.
    cos_a = (math.sin(decl) - math.sin(alt)*math.sin(lat)) / (math.cos(alt)*math.cos(lat))
    cos_a = max(-1.0, min(1.0, cos_a))
    a = math.degrees(math.acos(cos_a))
    az = (360 - a) if math.sin(ha) > 0 else a
    return math.degrees(alt), az

def day_path(lat, lon, year, month, day, step_h=0.25):
    pts = []
    for i in range(int(24/step_h)+1):
        hour_utc = i*step_h
        alt, az = solar_position(lat, lon, year, month, day, hour_utc)
        if alt > -0.5:
            pts.append({"hour_utc": round(hour_utc,2), "altitude_deg": round(alt,2), "azimuth_deg": round(az,2)})
    return pts

if __name__ == "__main__":
    lat, lon = 59.3242380, 18.7076237
    out = {}
    for label, (y,m,d) in {
        "summer_solstice_2026": (2026,6,21),
        "winter_solstice_2026": (2026,12,21),
        "spring_equinox_2026": (2026,3,20),
    }.items():
        path = day_path(lat, lon, y, m, d)
        rise = path[0] if path else None
        highest = max(path, key=lambda p: p["altitude_deg"]) if path else None
        sset = path[-1] if path else None
        out[label] = {"date": f"{y}-{m:02d}-{d:02d}", "sunrise_approx": rise, "solar_noon_max_altitude": highest, "sunset_approx": sset, "path": path}
    json.dump(out, open("/tmp/djuro_sunpath.json","w"), indent=1)
    for k,v in out.items():
        print(k, "noon_alt", v["solar_noon_max_altitude"]["altitude_deg"], "az", v["solar_noon_max_altitude"]["azimuth_deg"])
        print("  sunrise az", v["sunrise_approx"]["azimuth_deg"] if v["sunrise_approx"] else None, "sunset az", v["sunset_approx"]["azimuth_deg"] if v["sunset_approx"] else None)
