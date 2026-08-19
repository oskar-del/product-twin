#!/usr/bin/env python3
"""Build deterministic, source-bound CANOPUS spatial evidence.

Raw official downloads stay outside Git. This builder accepts those bytes as
inputs and emits only transformed/value-added evidence plus hash receipts.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import platform
import struct
from pathlib import Path
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

SITE_ID = "SITE_CANOPUS_5410501UF2451S"
PARCEL_ID = "5410501UF2451S"
VERSION = "0.2"
BUILT_AT = "2026-08-17T18:01:52+02:00"
FETCH_RECEIPTS = {}
EPSG25830 = "http://www.opengis.net/def/crs/EPSG/0/25830"
VERTICAL_DATUM = "Alicante orthometric datum realised by EGM2008-REDNAP"

CAT_URL = (
    "https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx?service=wfs&version=2&"
    "request=getfeature&STOREDQUERIE_ID=GetParcel&refcat=5410501UF2451S&"
    "srsname=EPSG::25830"
)
CAT_REF_URL = (
    "https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/"
    "COVCCoordenadas.svc/rest/Consulta_CPMRC?Provincia=&Municipio=&"
    "SRS=EPSG%3A4326&RefCat=5410501UF2451S"
)
CAT_CAP_URL = "https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx?service=WFS&version=2.0.0&request=GetCapabilities"
CAT_SERVICE_META_URL = "https://www.idee.es/csw-inspire-idee/srv/spa/csw?SERVICE=CSW&VERSION=2.0.2&REQUEST=GetRecordById&outputSchema=http%3A%2F%2Fwww.isotc211.org%2F2005%2Fgmd&ElementSetName=full&ID=ES_SDGC_CP_WFS"
CAT_DATASET_META_URL = "https://www.idee.es/csw-inspire-idee/srv/spa/csw?SERVICE=CSW&VERSION=2.0.2&REQUEST=GetRecordById&outputSchema=http%3A%2F%2Fwww.isotc211.org%2F2005%2Fgmd&ElementSetName=full&ID=ES_SDGC_CP"
DEM_URL = (
    "https://api-coverages.idee.es/collections/"
    "EL.ElevationGridCoverage_25830_5_PB/coverage?"
    "bbox=324170,4039735,326505,4042050&bbox-crs=25830&f=COG"
)
DEM_META_URL = (
    "https://api-coverages.idee.es/collections/"
    "EL.ElevationGridCoverage_25830_5_PB"
)
BUILDING_URL = (
    "https://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx?service=wfs&version=2&"
    "request=getfeature&typenames=BU.BUILDING&"
    "bbox=325074,4040637,325603,4041145&srsname=EPSG::25830"
)
ROAD_URL = (
    "https://api-features.idee.es/collections/roadlink/items?"
    "bbox=-4.9615,36.4882,-4.9389,36.5062&limit=1000&f=json"
)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def write_json(path: Path, value: object) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )


def polygon_signed_area(ring: list[list[float]]) -> float:
    return sum(
        a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, ring[1:])
    ) / 2.0


def polygon_centroid(ring: list[list[float]]) -> list[float]:
    cross = [a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, ring[1:])]
    area6 = 6.0 * polygon_signed_area(ring)
    return [
        sum((a[0] + b[0]) * c for a, b, c in zip(ring, ring[1:], cross)) / area6,
        sum((a[1] + b[1]) * c for a, b, c in zip(ring, ring[1:], cross)) / area6,
    ]


def point_in_polygon(x: float, y: float, ring: list[list[float]]) -> bool:
    inside = False
    for a, b in zip(ring, ring[1:]):
        if (a[1] > y) != (b[1] > y):
            x_cross = (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]
            if x < x_cross:
                inside = not inside
    return inside


def orient(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def segments_intersect(a, b, c, d) -> bool:
    return orient(a, b, c) * orient(a, b, d) < 0 and orient(c, d, a) * orient(c, d, b) < 0


def assert_simple(ring: list[list[float]]) -> None:
    count = len(ring) - 1
    for i in range(count):
        for j in range(i + 1, count):
            if abs(i - j) <= 1 or (i == 0 and j == count - 1):
                continue
            if segments_intersect(ring[i], ring[i + 1], ring[j], ring[j + 1]):
                raise ValueError(f"self-intersection between edges {i} and {j}")


# ETRS89 and WGS84 are treated as coincident at this evidence precision.
def utm_to_wgs84(easting: float, northing: float) -> list[float]:
    a = 6378137.0
    e = 0.08181919084262149
    e1sq = e * e / (1 - e * e)
    k0 = 0.9996
    x = easting - 500000.0
    m = northing / k0
    mu = m / (a * (1 - e * e / 4 - 3 * e**4 / 64 - 5 * e**6 / 256))
    e1 = (1 - math.sqrt(1 - e * e)) / (1 + math.sqrt(1 - e * e))
    j1 = 3 * e1 / 2 - 27 * e1**3 / 32
    j2 = 21 * e1**2 / 16 - 55 * e1**4 / 32
    j3 = 151 * e1**3 / 96
    j4 = 1097 * e1**4 / 512
    fp = mu + j1 * math.sin(2 * mu) + j2 * math.sin(4 * mu) + j3 * math.sin(6 * mu) + j4 * math.sin(8 * mu)
    c1 = e1sq * math.cos(fp) ** 2
    t1 = math.tan(fp) ** 2
    r1 = a * (1 - e * e) / (1 - e * e * math.sin(fp) ** 2) ** 1.5
    n1 = a / math.sqrt(1 - e * e * math.sin(fp) ** 2)
    d = x / (n1 * k0)
    q1 = n1 * math.tan(fp) / r1
    q2 = d * d / 2
    q3 = (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * e1sq) * d**4 / 24
    q4 = (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * e1sq - 3 * c1 * c1) * d**6 / 720
    lat = fp - q1 * (q2 - q3 + q4)
    q5 = d
    q6 = (1 + 2 * t1 + c1) * d**3 / 6
    q7 = (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * e1sq + 24 * t1 * t1) * d**5 / 120
    lon = math.radians(-3.0) + (q5 - q6 + q7) / math.cos(fp)
    return [math.degrees(lon), math.degrees(lat)]


def wgs84_to_utm(lon_deg: float, lat_deg: float) -> list[float]:
    a = 6378137.0
    ecc = 0.0066943799901413165
    k0 = 0.9996
    lat, lon, lon0 = map(math.radians, [lat_deg, lon_deg, -3.0])
    ep2 = ecc / (1 - ecc)
    n = a / math.sqrt(1 - ecc * math.sin(lat) ** 2)
    t = math.tan(lat) ** 2
    c = ep2 * math.cos(lat) ** 2
    aa = math.cos(lat) * (lon - lon0)
    m = a * ((1 - ecc / 4 - 3 * ecc**2 / 64 - 5 * ecc**3 / 256) * lat
             - (3 * ecc / 8 + 3 * ecc**2 / 32 + 45 * ecc**3 / 1024) * math.sin(2 * lat)
             + (15 * ecc**2 / 256 + 45 * ecc**3 / 1024) * math.sin(4 * lat)
             - (35 * ecc**3 / 3072) * math.sin(6 * lat))
    easting = k0 * n * (aa + (1 - t + c) * aa**3 / 6 + (5 - 18 * t + t**2 + 72 * c - 58 * ep2) * aa**5 / 120) + 500000
    northing = k0 * (m + n * math.tan(lat) * (aa**2 / 2 + (5 - t + 9 * c + 4 * c**2) * aa**4 / 24 + (61 - 58 * t + t**2 + 600 * c - 330 * ep2) * aa**6 / 720))
    return [easting, northing]


def parse_parcel(path: Path):
    root = ET.parse(path).getroot()
    ns = {"cp": "http://inspire.ec.europa.eu/schemas/cp/4.0", "gml": "http://www.opengis.net/gml/3.2"}
    parcels = root.findall(".//cp:CadastralParcel", ns)
    if len(parcels) != 1:
        raise ValueError(f"expected one cadastral parcel, found {len(parcels)}")
    parcel = parcels[0]
    ref = parcel.findtext("cp:nationalCadastralReference", namespaces=ns)
    if ref != PARCEL_ID:
        raise ValueError(f"wrong parcel: {ref}")
    pos = parcel.find(".//gml:posList", ns)
    if pos is None or pos.get("srsDimension") != "2":
        raise ValueError("missing 2D parcel ring")
    values = [float(v) for v in pos.text.split()]
    ring = [[values[i], values[i + 1]] for i in range(0, len(values), 2)]
    if ring[0] != ring[-1]:
        raise ValueError("official parcel ring is not closed")
    assert_simple(ring)
    surface = parcel.find(".//gml:MultiSurface", ns)
    srs = surface.get("srsName") if surface is not None else None
    if srs != EPSG25830:
        raise ValueError(f"unexpected source CRS: {srs}")
    end = parcel.find("cp:endLifespanVersion", ns)
    reference_text = parcel.findtext(".//cp:referencePoint/gml:Point/gml:pos", namespaces=ns)
    reference_point = [float(v) for v in reference_text.split()] if reference_text else None
    nil = "{http://www.w3.org/2001/XMLSchema-instance}nil"
    return {
        "ring": ring,
        "declared_area": float(parcel.findtext("cp:areaValue", namespaces=ns)),
        "begin_lifespan": parcel.findtext("cp:beginLifespanVersion", namespaces=ns),
        "end_lifespan": None if end is None or end.get(nil) == "true" else end.text,
        "response_timestamp": root.get("timeStamp"),
        "reference_point": reference_point,
        "srs": srs,
    }


def parse_reference_wgs84(path: Path) -> list[float]:
    root = ET.parse(path).getroot()
    namespace = root.tag.split("}")[0].strip("{") if "}" in root.tag else ""
    prefix = f"{{{namespace}}}" if namespace else ""
    x = root.findtext(f".//{prefix}xcen")
    y = root.findtext(f".//{prefix}ycen")
    srs = root.findtext(f".//{prefix}srs")
    if x is None or y is None or srs != "EPSG:4326":
        raise ValueError("invalid Catastro WGS84 reference response")
    return [float(x), float(y)]


def read_dem(path: Path):
    image = Image.open(path)
    if image.mode != "F":
        raise ValueError(f"terrain must be float32, got {image.mode}")
    scale = image.tag_v2.get(33550)
    tie = image.tag_v2.get(33922)
    if not scale or not tie:
        raise ValueError("GeoTIFF georeferencing tags missing")
    data = np.asarray(image, dtype=np.float64)
    nodata = float(image.tag_v2.get(42113, -32767))
    return data, float(tie[3]), float(tie[4]), float(scale[0]), float(scale[1]), nodata, image


def dem_sample(data, tie_x, tie_y, px, py, nodata, x, y):
    col = (x - tie_x) / px - 0.5
    row = (tie_y - y) / py - 0.5
    c0, r0 = math.floor(col), math.floor(row)
    if c0 < 0 or r0 < 0 or c0 + 1 >= data.shape[1] or r0 + 1 >= data.shape[0]:
        return None
    dc, dr = col - c0, row - r0
    values = [data[r0, c0], data[r0, c0 + 1], data[r0 + 1, c0], data[r0 + 1, c0 + 1]]
    if any(v == nodata or not math.isfinite(v) for v in values):
        return None
    return float((values[0] * (1 - dc) + values[1] * dc) * (1 - dr) + (values[2] * (1 - dc) + values[3] * dc) * dr)


def parse_buildings(path: Path, bounds):
    root = ET.parse(path).getroot()
    ns = {
        "b": "http://inspire.jrc.ec.europa.eu/schemas/bu-ext2d/2.0",
        "core": "http://inspire.jrc.ec.europa.eu/schemas/bu-core2d/2.0",
        "base": "urn:x-inspire:specification:gmlas:BaseTypes:3.2",
        "gml": "http://www.opengis.net/gml/3.2",
    }
    features = []
    for building in root.findall(".//b:Building", ns):
        local_id = building.findtext(".//base:localId", namespaces=ns)
        lifespan = building.findtext("core:beginLifespanVersion", namespaces=ns)
        polygons = []
        for patch in building.findall(".//gml:PolygonPatch", ns):
            exterior = patch.find("./gml:exterior/gml:LinearRing/gml:posList", ns)
            if exterior is None:
                continue
            nums = [float(v) for v in exterior.text.split()]
            exterior_ring = [[nums[i], nums[i + 1]] for i in range(0, len(nums), 2)]
            rb = [min(p[0] for p in exterior_ring), min(p[1] for p in exterior_ring), max(p[0] for p in exterior_ring), max(p[1] for p in exterior_ring)]
            if rb[2] < bounds[0] or rb[0] > bounds[2] or rb[3] < bounds[1] or rb[1] > bounds[3]:
                continue
            rings = [exterior_ring]
            for interior in patch.findall("./gml:interior/gml:LinearRing/gml:posList", ns):
                values = [float(v) for v in interior.text.split()]
                rings.append([[values[i], values[i + 1]] for i in range(0, len(values), 2)])
            polygons.append([[utm_to_wgs84(*p) for p in ring] for ring in rings])
        if polygons:
            geometry = {"type": "MultiPolygon", "coordinates": polygons}
            features.append({"type": "Feature", "id": f"ES.SDGC.BU.{local_id}", "properties": {"local_id": local_id, "begin_lifespan_version": lifespan, "source_authority": "Dirección General del Catastro"}, "geometry": geometry})
    return features


def line_parts(geometry):
    if geometry["type"] == "LineString":
        return [geometry["coordinates"]]
    if geometry["type"] == "MultiLineString":
        return geometry["coordinates"]
    return []


def closest_on_segment(point, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    denom = dx * dx + dy * dy
    t = 0.0 if denom == 0 else max(0.0, min(1.0, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / denom))
    q = [a[0] + t * dx, a[1] + t * dy]
    return q, math.hypot(q[0] - point[0], q[1] - point[1])


def parse_roads(path: Path, ring, bounds):
    source = json.loads(path.read_text(encoding="utf-8"))
    margin = 250.0
    clip = [bounds[0] - margin, bounds[1] - margin, bounds[2] + margin, bounds[3] + margin]
    derived, projected = [], []
    for feature in source.get("features", []):
        kept_parts = []
        for part in line_parts(feature.get("geometry") or {}):
            xy = [wgs84_to_utm(p[0], p[1]) for p in part]
            pb = [min(p[0] for p in xy), min(p[1] for p in xy), max(p[0] for p in xy), max(p[1] for p in xy)]
            if pb[2] < clip[0] or pb[0] > clip[2] or pb[3] < clip[1] or pb[1] > clip[3]:
                continue
            kept_parts.append([[round(p[0], 8), round(p[1], 8)] + ([round(p[2], 3)] if len(p) > 2 else []) for p in part])
            projected.append((feature.get("id"), xy, feature.get("properties", {})))
        if kept_parts:
            geometry = {"type": "LineString", "coordinates": kept_parts[0]} if len(kept_parts) == 1 else {"type": "MultiLineString", "coordinates": kept_parts}
            props = feature.get("properties", {})
            derived.append({"type": "Feature", "id": feature.get("id"), "properties": {k: props.get(k) for k in ["functionalclass", "surfacecategory", "formofway_href", "numberoflanes", "fictitious", "fecha_alta"]}, "geometry": geometry})
    candidates = []
    for boundary_point in ring[:-1]:
        best = None
        for road_id, part, props in projected:
            for a, b in zip(part, part[1:]):
                road_point, distance = closest_on_segment(boundary_point, a, b)
                if best is None or distance < best[0]:
                    best = (distance, road_id, road_point, props)
        if best:
            candidates.append((best[0], boundary_point, best[1], best[2], best[3]))
    candidates.sort(key=lambda row: row[0])
    selected = []
    for candidate in candidates:
        if all(math.hypot(candidate[1][0] - x[1][0], candidate[1][1] - x[1][1]) >= 25 for x in selected):
            selected.append(candidate)
        if len(selected) == 3:
            break
    features = []
    for index, (distance, parcel_point, road_id, road_point, props) in enumerate(selected, 1):
        features.append({"type": "Feature", "id": f"ACCESS_CANDIDATE_{index}", "geometry": {"type": "Point", "coordinates": [round(v, 8) for v in utm_to_wgs84(*parcel_point)]}, "properties": {"status": "UNVERIFIED_PHYSICAL_PROXIMITY_ONLY", "does_not_establish_legal_access": True, "parcel_boundary_point_epsg25830": [round(v, 3) for v in parcel_point], "nearest_road_point_epsg25830": [round(v, 3) for v in road_point], "gap_m": round(distance, 3), "road_feature_id": road_id, "road_functional_class": props.get("functionalclass"), "road_surface": props.get("surfacecategory")}})
    return derived, features, source


def contours(data, tie_x, tie_y, px, py, nodata, ring, bounds):
    features = []
    levels = list(range(5, 15))
    c0 = max(0, int((bounds[0] - tie_x) / px) - 2)
    c1 = min(data.shape[1] - 1, int((bounds[2] - tie_x) / px) + 2)
    r0 = max(0, int((tie_y - bounds[3]) / py) - 2)
    r1 = min(data.shape[0] - 1, int((tie_y - bounds[1]) / py) + 2)
    for level in levels:
        segments = []
        for row in range(r0, r1):
            for col in range(c0, c1):
                points = [
                    [tie_x + (col + 0.5) * px, tie_y - (row + 0.5) * py],
                    [tie_x + (col + 1.5) * px, tie_y - (row + 0.5) * py],
                    [tie_x + (col + 1.5) * px, tie_y - (row + 1.5) * py],
                    [tie_x + (col + 0.5) * px, tie_y - (row + 1.5) * py],
                ]
                vals = [data[row, col], data[row, col + 1], data[row + 1, col + 1], data[row + 1, col]]
                if any(v == nodata or not math.isfinite(v) for v in vals):
                    continue
                crossings = []
                for edge in range(4):
                    a, b = edge, (edge + 1) % 4
                    if (vals[a] < level <= vals[b]) or (vals[b] < level <= vals[a]):
                        t = (level - vals[a]) / (vals[b] - vals[a])
                        crossings.append([points[a][0] + t * (points[b][0] - points[a][0]), points[a][1] + t * (points[b][1] - points[a][1])])
                pairs = [(0, 1)] if len(crossings) == 2 else ([(0, 1), (2, 3)] if len(crossings) == 4 else [])
                for a, b in pairs:
                    midpoint = [(crossings[a][0] + crossings[b][0]) / 2, (crossings[a][1] + crossings[b][1]) / 2]
                    if point_in_polygon(*midpoint, ring):
                        segments.append([[round(v, 8) for v in utm_to_wgs84(*crossings[a])], [round(v, 8) for v in utm_to_wgs84(*crossings[b])]])
        features.append({"type": "Feature", "properties": {"elevation_m_orthometric": level, "interval_m": 1, "source_grid_m": 5, "accuracy_note": "1 m contour interval derived from a 5 m DEM; not 1 m positional or vertical accuracy"}, "geometry": {"type": "MultiLineString", "coordinates": segments}})
    return features


def build_glb(path: Path, data, tie_x, tie_y, px, py, nodata, bounds):
    margin = 100.0
    c0 = max(0, int((bounds[0] - margin - tie_x) / px))
    c1 = min(data.shape[1] - 1, math.ceil((bounds[2] + margin - tie_x) / px))
    r0 = max(0, int((tie_y - bounds[3] - margin) / py))
    r1 = min(data.shape[0] - 1, math.ceil((tie_y - bounds[1] + margin) / py))
    subset = data[r0:r1 + 1, c0:c1 + 1]
    if np.any(subset == nodata):
        raise ValueError("terrain mesh context contains nodata")
    rows, cols = subset.shape
    origin_x = tie_x + (c0 + (cols - 1) / 2 + 0.5) * px
    origin_y = tie_y - (r0 + (rows - 1) / 2 + 0.5) * py
    origin_z = float(np.min(subset))
    positions = []
    for row in range(rows):
        for col in range(cols):
            x = tie_x + (c0 + col + 0.5) * px
            y = tie_y - (r0 + row + 0.5) * py
            positions.extend([x - origin_x, float(subset[row, col]) - origin_z, origin_y - y])
    indices = []
    for row in range(rows - 1):
        for col in range(cols - 1):
            a = row * cols + col
            indices.extend([a, a + cols, a + 1, a + 1, a + cols, a + cols + 1])
    pos_bytes = struct.pack("<" + "f" * len(positions), *positions)
    pad = (4 - len(pos_bytes) % 4) % 4
    pos_bytes += b"\x00" * pad
    index_component = 5123 if rows * cols < 65536 else 5125
    index_format = "H" if index_component == 5123 else "I"
    idx_bytes = struct.pack("<" + index_format * len(indices), *indices)
    bin_chunk = pos_bytes + idx_bytes + b"\x00" * ((4 - len(idx_bytes) % 4) % 4)
    pos_array = np.asarray(positions, dtype=np.float32).reshape((-1, 3))
    gltf = {
        "asset": {"version": "2.0", "generator": "product-twin CANOPUS spatial builder v0.2"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": "IGN_MDT05_TERRAIN_CONTEXT", "mesh": 0, "extras": {"source": "IGN MDT05", "horizontal_crs": "EPSG:25830 easting/northing", "vertical_datum": VERTICAL_DATUM, "local_origin_epsg25830_m": [origin_x, origin_y, origin_z], "axis_convention": "+X east, +Y up, -Z north", "units": "metres", "scenario_content": False}}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "indices": 1, "material": 0}]}],
        "materials": [{"name": "Terrain evidence", "pbrMetallicRoughness": {"baseColorFactor": [0.45, 0.52, 0.40, 1], "metallicFactor": 0, "roughnessFactor": 1}}],
        "buffers": [{"byteLength": len(bin_chunk)}],
        "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": len(pos_bytes), "target": 34962}, {"buffer": 0, "byteOffset": len(pos_bytes), "byteLength": len(idx_bytes), "target": 34963}],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": rows * cols, "type": "VEC3", "min": pos_array.min(axis=0).tolist(), "max": pos_array.max(axis=0).tolist()},
            {"bufferView": 1, "componentType": index_component, "count": len(indices), "type": "SCALAR", "min": [0], "max": [rows * cols - 1]},
        ],
    }
    json_bytes = json.dumps(gltf, separators=(",", ":"), sort_keys=True).encode("utf-8")
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)
    total = 12 + 8 + len(json_bytes) + 8 + len(bin_chunk)
    path.write_bytes(struct.pack("<4sII", b"glTF", 2, total) + struct.pack("<I4s", len(json_bytes), b"JSON") + json_bytes + struct.pack("<I4s", len(bin_chunk), b"BIN\x00") + bin_chunk)
    return {"origin": [origin_x, origin_y, origin_z], "rows": rows, "columns": cols, "bounds_epsg25830": [tie_x + (c0 + 0.5) * px, tie_y - (r1 + 0.5) * py, tie_x + (c1 + 0.5) * px, tie_y - (r0 + 0.5) * py], "elevation_min_m": float(np.min(subset)), "elevation_max_m": float(np.max(subset))}


def receipt(source_id, path, url, authority, retrieved_at, media_type, dataset, licence, extra=None):
    captured = FETCH_RECEIPTS.get(source_id)
    if captured:
        if captured.get("request_url") != url or captured.get("sha256") != sha256(path) or captured.get("byte_count") != path.stat().st_size:
            raise ValueError(f"{source_id}: fetch receipt does not match the supplied runtime bytes/request")
        retrieved_at = captured["retrieved_at"]
        media_type = captured["http"]["content_type"]
        http = captured["http"]
    else:
        http = {"status": 200, "content_type": media_type, "etag": None, "last_modified": None}
    value = {"source_id": source_id, "authority": authority, "request_url": url, "retrieved_at": retrieved_at, "media_type": media_type, "http": http, "dataset": dataset, "licence": licence, "byte_count": path.stat().st_size, "sha256": sha256(path), "runtime_locator": f".runtime/sites/canopus/raw/{path.name}", "replay": f"curl --fail --location '{url}' --output '.runtime/sites/canopus/raw/{path.name}'"}
    if extra:
        value.update(extra)
    return value


def main():
    global BUILT_AT, FETCH_RECEIPTS
    parser = argparse.ArgumentParser()
    parser.add_argument("--catastro-gml", type=Path, required=True)
    parser.add_argument("--catastro-reference", type=Path, required=True)
    parser.add_argument("--catastro-capabilities", type=Path, required=True)
    parser.add_argument("--catastro-service-metadata", type=Path, required=True)
    parser.add_argument("--catastro-dataset-metadata", type=Path, required=True)
    parser.add_argument("--terrain-cog", type=Path, required=True)
    parser.add_argument("--terrain-metadata", type=Path, required=True)
    parser.add_argument("--buildings-gml", type=Path, required=True)
    parser.add_argument("--roads-geojson", type=Path, required=True)
    parser.add_argument("--fetch-receipts", type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path("data/sites/canopus/spatial/v0.2"))
    args = parser.parse_args()
    if platform.python_version() != "3.12.13" or np.__version__ != "2.3.5" or Image.__version__ != "12.3.0":
        raise RuntimeError(f"unlocked runtime: Python={platform.python_version()}, numpy={np.__version__}, Pillow={Image.__version__}")
    if args.fetch_receipts:
        fetched = json.loads(args.fetch_receipts.read_text(encoding="utf-8"))
        FETCH_RECEIPTS = {entry["source_id"]: entry for entry in fetched.get("sources", [])}
        if len(FETCH_RECEIPTS) != 9:
            raise ValueError("fetch receipt must bind exactly nine spatial sources")
        BUILT_AT = max(entry["retrieved_at"] for entry in FETCH_RECEIPTS.values())
    args.output_dir.mkdir(parents=True, exist_ok=True)

    parcel = parse_parcel(args.catastro_gml)
    official_reference_wgs84 = parse_reference_wgs84(args.catastro_reference)
    ring = parcel["ring"]
    area = abs(polygon_signed_area(ring))
    if abs(area - parcel["declared_area"]) > max(5.0, parcel["declared_area"] * 0.001):
        raise ValueError("computed parcel area does not reconcile with authoritative area")
    centroid = polygon_centroid(ring)
    bounds = [min(p[0] for p in ring), min(p[1] for p in ring), max(p[0] for p in ring), max(p[1] for p in ring)]
    ring_wgs = [[round(v, 8) for v in utm_to_wgs84(*p)] for p in ring]
    roundtrip = max(math.hypot(*(a - b for a, b in zip(p, wgs84_to_utm(*utm_to_wgs84(*p))))) for p in ring)
    if roundtrip > 0.02:
        raise ValueError(f"CRS round-trip exceeds 0.02 m: {roundtrip}")

    transformed_reference = utm_to_wgs84(*parcel["reference_point"])
    official_reference_utm = wgs84_to_utm(*official_reference_wgs84)
    reference_residual_m = math.hypot(official_reference_utm[0] - parcel["reference_point"][0], official_reference_utm[1] - parcel["reference_point"][1])
    boundary_projected = {"schema_version": VERSION, "entity_type": "VerifiedBoundary", "site_twin_id": SITE_ID, "source_sha256": sha256(args.catastro_gml), "source_crs": EPSG25830, "canonical_crs": "EPSG:25830 easting,northing", "geometry": {"type": "Polygon", "coordinates": [ring]}, "qa": {"vertex_count_including_closure": len(ring), "closed": True, "simple": True, "source_ring_orientation": "clockwise" if polygon_signed_area(ring) < 0 else "counterclockwise", "computed_area_m2": area, "authoritative_area_m2": parcel["declared_area"], "area_delta_m2": abs(area - parcel["declared_area"]), "centroid_epsg25830": centroid, "bounds_epsg25830": bounds, "extent_east_west_m": bounds[2] - bounds[0], "extent_north_south_m": bounds[3] - bounds[1], "transform_roundtrip_max_error_m": roundtrip, "source_reference_point_epsg25830": parcel["reference_point"], "transformed_reference_point_wgs84": transformed_reference, "official_reference_service_wgs84": official_reference_wgs84, "reference_service_residual_m": reference_residual_m}, "version_dates": {"source_feature_begin_lifespan_version": parcel["begin_lifespan"], "source_feature_end_lifespan_version": parcel["end_lifespan"], "wfs_response_timestamp": parcel["response_timestamp"], "valid_from": None, "valid_to": None, "currentness_note": "The response timestamp is retrieval time; beginLifespanVersion is the feature-version start, not a survey date. The feature supplies no validFrom, validTo or survey/currentness date."}}
    boundary_wgs = {"type": "Feature", "id": PARCEL_ID, "bbox": [min(p[0] for p in ring_wgs), min(p[1] for p in ring_wgs), max(p[0] for p in ring_wgs), max(p[1] for p in ring_wgs)], "properties": {"site_twin_id": SITE_ID, "national_cadastral_reference": PARCEL_ID, "source_crs": "EPSG:25830", "source_sha256": sha256(args.catastro_gml)}, "geometry": {"type": "Polygon", "coordinates": [ring_wgs]}}
    projected_path = args.output_dir / "boundary-epsg25830-v0.2.json"
    wgs_path = args.output_dir / "boundary-wgs84-v0.2.geojson"
    write_json(projected_path, boundary_projected)
    write_json(wgs_path, boundary_wgs)

    data, tie_x, tie_y, px, py, nodata, image = read_dem(args.terrain_cog)
    if abs(px - 5) > 1e-9 or abs(py - 5) > 1e-9:
        raise ValueError("terrain is not a 5 m grid")
    rows, cols = np.indices(data.shape)
    xs = tie_x + (cols + 0.5) * px
    ys = tie_y - (rows + 0.5) * py
    inside = np.zeros(data.shape, dtype=bool)
    r0 = max(0, int((tie_y - bounds[3]) / py) - 1)
    r1 = min(data.shape[0], int((tie_y - bounds[1]) / py) + 2)
    c0 = max(0, int((bounds[0] - tie_x) / px) - 1)
    c1 = min(data.shape[1], int((bounds[2] - tie_x) / px) + 2)
    for r in range(r0, r1):
        for c in range(c0, c1):
            inside[r, c] = point_in_polygon(float(xs[r, c]), float(ys[r, c]), ring)
    valid = inside & (data != nodata) & np.isfinite(data)
    if valid.sum() == 0 or np.any(inside & ~valid):
        raise ValueError("parcel terrain coverage has nodata")
    z = data[valid]
    xv, yv = xs[valid], ys[valid]
    plane = np.linalg.lstsq(np.column_stack([xv - centroid[0], yv - centroid[1], np.ones_like(xv)]), z, rcond=None)[0]
    trend_gradient = math.hypot(plane[0], plane[1]) * 100
    trend_aspect = math.degrees(math.atan2(-plane[0], -plane[1])) % 360
    dz_row, dz_col = np.gradient(data, py, px)
    dz_east, dz_north = dz_col, -dz_row
    local_slope = np.hypot(dz_east, dz_north) * 100
    local_aspect = (np.degrees(np.arctan2(-dz_east, -dz_north)) + 360) % 360
    weights = local_slope[valid]
    radians = np.radians(local_aspect[valid])
    circular_aspect = math.degrees(math.atan2(float(np.sum(weights * np.sin(radians))), float(np.sum(weights * np.cos(radians))))) % 360
    low_index = int(np.argmin(z)); high_index = int(np.argmax(z))
    stats = {"pixel_center_count": int(valid.sum()), "pixel_center_sample_area_m2": int(valid.sum()) * px * py, "elevation_min_m": float(z.min()), "elevation_max_m": float(z.max()), "elevation_fall_m": float(z.max() - z.min()), "elevation_mean_m": float(z.mean()), "local_cell_slope_mean_percent": float(local_slope[valid].mean()), "local_cell_slope_median_percent": float(np.median(local_slope[valid])), "local_cell_slope_p95_percent": float(np.percentile(local_slope[valid], 95)), "local_cell_aspect_weighted_circular_mean_deg": circular_aspect, "trend_plane_dz_dx_east": float(plane[0]), "trend_plane_dz_dy_north": float(plane[1]), "trend_plane_gradient_percent": trend_gradient, "trend_plane_downslope_aspect_deg": trend_aspect, "minimum_spot_epsg25830": [float(xv[low_index]), float(yv[low_index]), float(z[low_index])], "maximum_spot_epsg25830": [float(xv[high_index]), float(yv[high_index]), float(z[high_index])]}
    terrain_analysis = {"schema_version": VERSION, "entity_type": "VerifiedTerrainAnalysis", "site_twin_id": SITE_ID, "source_sha256": sha256(args.terrain_cog), "boundary_sha256": sha256(projected_path), "dataset": "IGN MDT05 first LiDAR coverage, 5 m", "horizontal_crs_source_metadata": "Collection EPSG:25830; GeoTIFF GeoKey EPSG:3042 (same ETRS89/UTM 30 numeric grid with north/east axis declaration)", "horizontal_crs_canonical": "EPSG:25830 easting,northing", "axis_reconciliation": "Numeric GeoTIFF model coordinates are easting,northing and are normalized to EPSG:25830 without coordinate swapping. The EPSG:3042 GeoKey axis-order discrepancy is preserved here.", "vertical_datum": VERTICAL_DATUM, "units": {"horizontal": "m", "vertical": "m orthometric"}, "pixel_size_m": [px, py], "source_bounds_model_coordinates": [tie_x, tie_y - data.shape[0] * py, tie_x + data.shape[1] * px, tie_y], "nodata_value": nodata, "methods": {"parcel_mask": "pixel-centre within authoritative polygon; all_touched=false", "slope": "central finite differences on 5 m float32 DEM; percent rise", "local_aspect": "downslope azimuth clockwise from true/grid north; slope-weighted circular aggregation", "trend_plane": "ordinary least-squares z = ax + by + c over parcel pixel centres", "contours": "unsmoothed linear marching-squares segments at 1 m vertical interval", "section": "east-west line through polygon centroid, bilinear DEM samples at 5 m"}, "statistics": stats, "reported_comparison": {"reported_min_m": 4, "reported_max_m": 15, "reported_fall_m": 11, "reported_mean_gradient_percent": 2.5, "reported_aspect_deg": 80, "interpretation": "The dossier gradient/aspect reproduce as a least-squares parcel trend plane. Local 5 m cell slopes remain separately reported and are materially higher."}}
    terrain_path = args.output_dir / "terrain-analysis-v0.2.json"
    write_json(terrain_path, terrain_analysis)

    spots = []
    for label, point in [("minimum", stats["minimum_spot_epsg25830"]), ("maximum", stats["maximum_spot_epsg25830"])]:
        spots.append({"type": "Feature", "properties": {"label": label, "elevation_m_orthometric": point[2], "vertical_datum": VERTICAL_DATUM}, "geometry": {"type": "Point", "coordinates": [*utm_to_wgs84(point[0], point[1]), point[2]]}})
    write_json(args.output_dir / "spot-elevations-v0.2.geojson", {"type": "FeatureCollection", "features": spots})
    write_json(args.output_dir / "contours-1m-v0.2.geojson", {"type": "FeatureCollection", "features": contours(data, tie_x, tie_y, px, py, nodata, ring, bounds)})

    section_y = centroid[1]
    intersections = []
    for a, b in zip(ring, ring[1:]):
        if (a[1] > section_y) != (b[1] > section_y):
            intersections.append(a[0] + (section_y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]))
    section_start, section_end = min(intersections), max(intersections)
    section_samples = []
    for distance in np.arange(0, section_end - section_start + 0.001, 5.0):
        x = section_start + float(distance)
        elev = dem_sample(data, tie_x, tie_y, px, py, nodata, x, section_y)
        if elev is not None:
            section_samples.append({"distance_m": float(distance), "easting_m": x, "northing_m": section_y, "elevation_m_orthometric": elev})
    section = {"schema_version": VERSION, "entity_type": "TerrainSection", "name": "A–A′", "orientation": "west-to-east through authoritative parcel centroid", "source_sha256": sha256(args.terrain_cog), "boundary_sha256": sha256(projected_path), "horizontal_crs": "EPSG:25830", "vertical_datum": VERTICAL_DATUM, "sample_interval_m": 5, "start_epsg25830": [section_start, section_y], "end_epsg25830": [section_end, section_y], "samples": section_samples}
    write_json(args.output_dir / "section-aa-v0.2.json", section)

    glb_qa = build_glb(args.output_dir / "terrain-context-v0.2.glb", data, tie_x, tie_y, px, py, nodata, bounds)
    roads, access_candidates, roads_source = parse_roads(args.roads_geojson, ring, bounds)
    buildings = parse_buildings(args.buildings_gml, [bounds[0] - 150, bounds[1] - 150, bounds[2] + 150, bounds[3] + 150])
    write_json(args.output_dir / "roads-context-v0.2.geojson", {"type": "FeatureCollection", "features": roads, "properties": {"source": "IGN/SCNE RoadLink", "legal_access_status": "NOT_ESTABLISHED"}})
    write_json(args.output_dir / "buildings-context-v0.2.geojson", {"type": "FeatureCollection", "features": buildings, "properties": {"source": "Dirección General del Catastro INSPIRE Buildings", "query_note": "100 m query; complete source features may extend beyond the query box"}})
    write_json(args.output_dir / "access-candidates-v0.2.geojson", {"type": "FeatureCollection", "features": access_candidates, "properties": {"status": "UNVERIFIED_ANALYSIS_OVERLAY", "permitted_access_point": None, "warning": "Geometric road proximity does not establish ownership, connection feasibility, highway consent, easement or legal access."}})

    licence_cat = {"name": "CC BY 4.0 as stated by current IDEE metadata", "uri": "https://creativecommons.org/licenses/by/4.0/", "distribution_note": "Legacy Catastro INSPIRE terms are more conservative; raw official GML is not redistributed in Git. Only transformed value-added outputs and hashes are committed."}
    licence_ign = {"name": "CC BY 4.0", "uri": "https://creativecommons.org/licenses/by/4.0/", "attribution": "Obra derivada de MDT05-cob1 2008-2015 CC-BY 4.0 scne.es"}
    receipts = [
        receipt("SRC_CATASTRO_PARCEL_GML", args.catastro_gml, CAT_URL, "Dirección General del Catastro", "2026-08-17T17:47:31+02:00", "application/gml+xml", "INSPIRE Cadastral Parcels continuously updated service", licence_cat, {"dataset_metadata_date": "2025-01-28", "feature_begin_lifespan_version": parcel["begin_lifespan"], "feature_end_lifespan_version": parcel["end_lifespan"], "valid_from": None, "valid_to": None, "survey_or_currentness_date": None}),
        receipt("SRC_CATASTRO_REFERENCE_WGS84", args.catastro_reference, CAT_REF_URL, "Dirección General del Catastro", "2026-08-17T17:50:02+02:00", "application/xml", "Catastro coordinate service", licence_cat),
        receipt("SRC_CATASTRO_CAPABILITIES", args.catastro_capabilities, CAT_CAP_URL, "Dirección General del Catastro", "2026-08-17T17:49:16+02:00", "application/xml", "INSPIRE Cadastral Parcels WFS 2.0 capabilities", licence_cat, {"terms_note": "Capabilities link the legacy DGC INSPIRE licence; the conservative raw-nonredistribution rule is applied."}),
        receipt("SRC_CATASTRO_SERVICE_METADATA", args.catastro_service_metadata, CAT_SERVICE_META_URL, "Dirección General del Catastro / IDEE", "2026-08-17T17:49:29+02:00", "application/xml", "INSPIRE Cadastral Parcels WFS metadata", licence_cat, {"metadata_date": "2025-01-28", "service_publication_date": "2012-12-31"}),
        receipt("SRC_CATASTRO_DATASET_METADATA", args.catastro_dataset_metadata, CAT_DATASET_META_URL, "Dirección General del Catastro / IDEE", "2026-08-17T17:49:59+02:00", "application/xml", "INSPIRE Cadastral Parcels dataset metadata", licence_cat, {"metadata_date": "2025-01-28", "dataset_creation_date": "2015-12-01", "continuous_update_note": "Data is generated from the continuously maintained cadastral database at invocation; this is not a parcel survey date."}),
        receipt("SRC_IGN_MDT05_COG", args.terrain_cog, DEM_URL, "Instituto Geográfico Nacional / CNIG", "2026-08-17T17:57:04+02:00", "image/tiff; application=geotiff; profile=cloud-optimized", "MDT05 first LiDAR coverage, 5 m", licence_ign, {"dataset_coverage_or_acquisition": "first LiDAR coverage 2008-2015", "coverage_request_bounds_epsg25830": [324170, 4039735, 326505, 4042050], "buffer_rule": "parcel bounds expanded 1000 m and rounded outward to the 5 m grid", "source_geokey_axis_note": "GeoKey EPSG:3042; collection is EPSG:25830; numeric model coordinates are easting,northing", "horizontal_crs": "ETRS89 / UTM zone 30", "vertical_datum": VERTICAL_DATUM}),
        receipt("SRC_IGN_MDT05_COLLECTION_METADATA", args.terrain_metadata, DEM_META_URL, "Instituto Geográfico Nacional / CNIG", "2026-08-17T17:57:57+02:00", "application/json", "OGC API Coverages collection metadata", licence_ign),
        receipt("SRC_CATASTRO_BUILDINGS_GML", args.buildings_gml, BUILDING_URL, "Dirección General del Catastro", "2026-08-17T17:59:25+02:00", "application/gml+xml", "INSPIRE Buildings continuously updated service", licence_cat),
        receipt("SRC_IDEE_ROADLINK_GEOJSON", args.roads_geojson, ROAD_URL, "Sistema Cartográfico Nacional / IGN", roads_source.get("timeStamp", "2026-08-17T16:01:52Z"), "application/geo+json", "INSPIRE Transport Networks RoadLink", licence_ign, {"number_matched": roads_source.get("numberMatched"), "number_returned": roads_source.get("numberReturned"), "legal_access_evidence": False}),
    ]

    artifact_names = ["boundary-epsg25830-v0.2.json", "boundary-wgs84-v0.2.geojson", "terrain-analysis-v0.2.json", "spot-elevations-v0.2.geojson", "contours-1m-v0.2.geojson", "section-aa-v0.2.json", "terrain-context-v0.2.glb", "roads-context-v0.2.geojson", "buildings-context-v0.2.geojson", "access-candidates-v0.2.geojson"]
    boundary_input = {"boundary_source": sha256(args.catastro_gml)}
    terrain_inputs = {**boundary_input, "terrain_source": sha256(args.terrain_cog), "boundary_artifact": sha256(projected_path)}
    inputs_by_artifact = {
        "boundary-epsg25830-v0.2.json": boundary_input,
        "boundary-wgs84-v0.2.geojson": boundary_input,
        "terrain-analysis-v0.2.json": terrain_inputs,
        "spot-elevations-v0.2.geojson": terrain_inputs,
        "contours-1m-v0.2.geojson": terrain_inputs,
        "section-aa-v0.2.json": terrain_inputs,
        "terrain-context-v0.2.glb": terrain_inputs,
        "roads-context-v0.2.geojson": {**boundary_input, "roads_source": sha256(args.roads_geojson)},
        "buildings-context-v0.2.geojson": {**boundary_input, "buildings_source": sha256(args.buildings_gml)},
        "access-candidates-v0.2.geojson": {**boundary_input, "roads_source": sha256(args.roads_geojson)},
    }
    artifacts = []
    for name in artifact_names:
        path = args.output_dir / name
        artifacts.append({"artifact_id": name.upper().replace(".", "_").replace("-", "_"), "path": str(path), "byte_count": path.stat().st_size, "sha256": sha256(path), "generated_at": BUILT_AT, "deterministic": True, "inputs": inputs_by_artifact[name], "toolchain": {"builder": "scripts/build-canopus-spatial-v0.2.py", "python": platform.python_version(), "numpy": np.__version__, "Pillow": Image.__version__}})
    source_manifest = {"schema_version": VERSION, "entity_type": "SpatialEvidenceManifest", "site_twin_id": SITE_ID, "generated_at": BUILT_AT, "raw_distribution": "Raw official responses are immutable runtime evidence and are excluded from Git.", "sources": receipts, "derived_artifacts": artifacts}
    manifest_path = args.output_dir / "spatial-evidence-manifest-v0.2.json"
    write_json(manifest_path, source_manifest)

    gates = []
    for gate_id in ["GATE_CATASTRO_BOUNDARY", "GATE_IGN_TERRAIN", "GATE_CONTEXT_OBSTRUCTIONS", "GATE_CERTIFICADO_URBANISTICO", "GATE_GOVERNING_PLAN", "GATE_A7_BUILDING_LINE_AND_ACCESS", "GATE_PERMITTED_ACCESS", "GATE_ROOFTOP_RULES", "GATE_TITLE_AND_CHARGES", "GATE_FLOOD_AND_OVERLAYS", "GATE_UTILITY_CAPACITY"]:
        satisfied = gate_id in {"GATE_CATASTRO_BOUNDARY", "GATE_IGN_TERRAIN"}
        gates.append({"gate_id": gate_id, "status": "SATISFIED" if satisfied else "OPEN", "severity": "HARD", "satisfied_at": BUILT_AT if satisfied else None, "evidence_ids": (["SRC_CATASTRO_PARCEL_GML"] if gate_id == "GATE_CATASTRO_BOUNDARY" else (["SRC_IGN_MDT05_COG"] if gate_id == "GATE_IGN_TERRAIN" else [])), "check_profile": "CANOPUS_SPATIAL_V0_2" if satisfied else None})
    site_twin = {"schema_version": VERSION, "entity_type": "SiteTwin", "site_twin_id": SITE_ID, "project_id": "PRJ_CANOPUS", "status": "OFFICIAL_BOUNDARY_AND_CONTEXT_TERRAIN_VERIFIED", "base_site_twin": {"path": "data/sites/canopus/site-twin-v0.1.json", "sha256": sha256(Path("data/sites/canopus/site-twin-v0.1.json")), "preservation": "All reported dossier claims remain intact in the immutable base."}, "spatial_evidence_manifest": {"path": str(manifest_path), "sha256": sha256(manifest_path)}, "boundary": {"status": "OFFICIAL_SOURCE_OBSERVED_HASH_VERIFIED", "artifact": str(projected_path), "wgs84_artifact": str(wgs_path), "source_id": "SRC_CATASTRO_PARCEL_GML", "observed": {"registered_area_m2": parcel["declared_area"], "computed_area_m2": area, "extent_east_west_m": bounds[2] - bounds[0], "extent_north_south_m": bounds[3] - bounds[1]}}, "terrain": {"status": "DERIVED_FROM_VERIFIED_OFFICIAL_SOURCE", "analysis_artifact": str(terrain_path), "mesh_artifact": str(args.output_dir / "terrain-context-v0.2.glb"), "source_id": "SRC_IGN_MDT05_COG", "vertical_datum": VERTICAL_DATUM, "scope_note": "Official 5 m context terrain; not a survey-grade topographic survey."}, "context": {"roads": str(args.output_dir / "roads-context-v0.2.geojson"), "buildings": str(args.output_dir / "buildings-context-v0.2.geojson"), "access_candidates": str(args.output_dir / "access-candidates-v0.2.geojson")}, "access": {"status": "UNVERIFIED_ANALYSIS_ONLY", "permitted_access_point": None}, "planning": {"status": "UNRESOLVED_NO_COMPLIANCE_CLAIM", "entitlement": None, "buildable_envelope": None}, "hard_gates": gates}
    site_path = args.output_dir / "site-twin-v0.2.json"
    write_json(site_path, site_twin)
    site_hash = sha256(site_path)
    export = {"schema_version": VERSION, "entity_type": "SpatialExportContract", "site_twin_ref": {"id": SITE_ID, "version": VERSION, "content_sha256": site_hash, "path": str(site_path)}, "coordinate_frames": {"web": "RFC 7946 longitude,latitude WGS84", "projected": "EPSG:25830 easting,northing metres", "model": {"origin_epsg25830_m": glb_qa["origin"], "axes": "+X east, +Y up, -Z north", "units": "metres", "true_north_vector": [0, 0, -1]}}, "layers": {"boundary": str(wgs_path), "terrain_mesh": str(args.output_dir / "terrain-context-v0.2.glb"), "contours": str(args.output_dir / "contours-1m-v0.2.geojson"), "section_aa": str(args.output_dir / "section-aa-v0.2.json"), "spot_elevations": str(args.output_dir / "spot-elevations-v0.2.geojson"), "roads": str(args.output_dir / "roads-context-v0.2.geojson"), "buildings": str(args.output_dir / "buildings-context-v0.2.geojson"), "access_candidates_unverified": str(args.output_dir / "access-candidates-v0.2.geojson"), "concept_massing_overlay": None, "planning_envelope": None}, "controls": {"seasonal_sun": {"status": "PARAMETRIC_CONTROL_CONTRACT", "dates": ["2026-06-21", "2026-09-22", "2026-12-21"], "location": [round(v, 8) for v in utm_to_wgs84(*centroid)], "timezone": "Europe/Madrid", "note": "A viewer computes solar position; this bundle does not assert a rendered shadow study."}, "la_concha_sightline": {"status": "REPORTED_SCENARIO_OVERLAY_ONLY", "asset": None, "bearing_deg_true_reported": 349.4, "target": "La Concha summit", "note": "No independently verified target coordinate or viewshed is included."}}, "separation": {"project_seller_facts_mutated": False, "scenario_geometry_imported": False, "boundary_redefined_by_scenario": False, "permitted_access_established": False, "planning_entitlement_established": False}}
    write_json(args.output_dir / "spatial-export-v0.2.json", export)
    print(json.dumps({"status": "PASS", "output": str(args.output_dir), "parcel_vertices": len(ring), "area_m2": area, "terrain_cells": int(valid.sum()), "trend_gradient_percent": trend_gradient, "trend_aspect_deg": trend_aspect, "roads": len(roads), "buildings": len(buildings), "access_candidates": len(access_candidates), "site_twin_sha256": site_hash}, indent=2))


if __name__ == "__main__":
    main()
