#!/usr/bin/env python3
"""
Read a window of a Cloud-Optimised GeoTIFF over HTTP range requests.

The 1 m height tile is 246 MB and we need a 20 × 7 m patch of it. A COG is laid out so that
exactly this is possible: read the header, find the tiles the window touches, and fetch only
those. For HOUSE_BAR that is ONE 512 × 512 tile — a few hundred kilobytes instead of a quarter
of a gigabyte.

Credentials come from the environment (LM_BASIC_AUTH as user:pass) and are never logged, never
written to a receipt, and never returned by any function here. A caller may record that
credentials were used; it may not record what they were.

Supports what Lantmäteriet's mhm tiles actually are — classic little-endian TIFF, tiled,
Deflate-compressed, 32-bit IEEE float, horizontal differencing predictor 3 — and refuses
anything else rather than guessing.
"""
import base64, math, os, struct, urllib.error, urllib.request, zlib

TYPE_SIZE = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8}
TAG = {"ImageWidth": 256, "ImageLength": 257, "BitsPerSample": 258, "Compression": 259,
       "SamplesPerPixel": 277, "Predictor": 317, "TileWidth": 322, "TileLength": 323,
       "TileOffsets": 324, "TileByteCounts": 325, "SampleFormat": 339,
       "ModelPixelScale": 33550, "ModelTiepoint": 33922, "NoData": 42113}


class CogError(RuntimeError):
    """Anything that would make a returned height untrustworthy. Never swallowed."""


class RemoteCog:
    def __init__(self, url, auth=None, timeout=60):
        self.url = url
        self._auth = auth or os.environ.get("LM_BASIC_AUTH")
        self.timeout = timeout
        self.bytes_read = 0
        self.requests = 0
        self._read_header()

    # ---- transport -------------------------------------------------------
    def _range(self, start, end):
        request = urllib.request.Request(self.url, headers={"Range": f"bytes={start}-{end}"})
        if self._auth:
            token = base64.b64encode(self._auth.encode()).decode()
            request.add_header("Authorization", "Basic " + token)
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                if response.status not in (200, 206):
                    raise CogError(f"range request returned HTTP {response.status}")
                data = response.read()
        except urllib.error.HTTPError as exc:
            raise CogError(f"HTTP {exc.code} reading the tile"
                           f"{' (no credentials in the environment)' if not self._auth else ''}") from None
        self.requests += 1
        self.bytes_read += len(data)
        return data

    # ---- header ----------------------------------------------------------
    def _read_header(self):
        head = self._range(0, 65535)
        if head[:2] != b"II" or struct.unpack_from("<H", head, 2)[0] != 42:
            raise CogError("not a classic little-endian TIFF")
        offset = struct.unpack_from("<I", head, 4)[0]
        count = struct.unpack_from("<H", head, offset)[0]
        tags = {}
        for i in range(count):
            entry = offset + 2 + i * 12
            tag, typ, n = struct.unpack_from("<HHI", head, entry)
            size = TYPE_SIZE.get(typ, 1) * n
            if size <= 4:
                raw = head[entry + 8:entry + 8 + size]
            else:
                at = struct.unpack_from("<I", head, entry + 8)[0]
                raw = head[at:at + size] if at + size <= len(head) else self._range(at, at + size - 1)
            tags[tag] = (typ, n, raw)
        self.tags = tags

        def ints(name, fmt="<I"):
            typ, n, raw = tags[TAG[name]]
            code = {3: "<H", 4: "<I"}.get(typ, fmt)
            step = 2 if code == "<H" else 4
            return [struct.unpack_from(code, raw, i * step)[0] for i in range(n)]

        def doubles(name):
            _, n, raw = tags[TAG[name]]
            return [struct.unpack_from("<d", raw, i * 8)[0] for i in range(n)]

        self.width, self.height = ints("ImageWidth")[0], ints("ImageLength")[0]
        self.tile_w, self.tile_h = ints("TileWidth")[0], ints("TileLength")[0]
        self.tile_offsets, self.tile_bytes = ints("TileOffsets"), ints("TileByteCounts")
        self.compression = ints("Compression")[0]
        self.predictor = ints("Predictor")[0] if TAG["Predictor"] in tags else 1
        self.sample_format = ints("SampleFormat")[0]
        self.bits = ints("BitsPerSample")[0]
        self.samples = ints("SamplesPerPixel")[0] if TAG["SamplesPerPixel"] in tags else 1

        if self.compression != 8:
            raise CogError(f"compression {self.compression} is not Deflate; refusing to guess")
        if (self.sample_format, self.bits, self.samples) != (3, 32, 1):
            raise CogError(f"expected single-band 32-bit float, got format={self.sample_format} "
                           f"bits={self.bits} samples={self.samples}")
        if self.predictor not in (1, 3):
            raise CogError(f"predictor {self.predictor} is not supported")

        scale = doubles("ModelPixelScale")
        tie = doubles("ModelTiepoint")
        self.px, self.py = scale[0], scale[1]
        self.origin_e, self.origin_n = tie[3], tie[4]
        self.nodata = None
        if TAG["NoData"] in tags:
            try:
                self.nodata = float(tags[TAG["NoData"]][2].split(b"\x00")[0].decode())
            except ValueError:
                self.nodata = None
        self.tiles_across = math.ceil(self.width / self.tile_w)

    # ---- geometry --------------------------------------------------------
    def pixel_of(self, easting, northing):
        return ((easting - self.origin_e) / self.px, (self.origin_n - northing) / self.py)

    def _tile(self, tx, ty):
        index = ty * self.tiles_across + tx
        if not (0 <= index < len(self.tile_offsets)):
            raise CogError(f"tile ({tx},{ty}) is outside the image")
        start = self.tile_offsets[index]
        raw = self._range(start, start + self.tile_bytes[index] - 1)
        data = zlib.decompress(raw)
        if self.predictor == 3:
            data = _undo_float_predictor(data, self.tile_w, self.tile_h, self.samples)
        expected = self.tile_w * self.tile_h * 4
        if len(data) != expected:
            raise CogError(f"tile decompressed to {len(data)} bytes, expected {expected}")
        return data

    def sample(self, easting, northing):
        """Nearest-cell height, or None where the raster says nodata."""
        fx, fy = self.pixel_of(easting, northing)
        col, row = int(math.floor(fx)), int(math.floor(fy))
        if not (0 <= col < self.width and 0 <= row < self.height):
            raise CogError(f"({easting}, {northing}) falls outside the tile "
                           f"[{self.origin_e}..{self.origin_e + self.width * self.px}] × "
                           f"[{self.origin_n - self.height * self.py}..{self.origin_n}]")
        tx, ty = col // self.tile_w, row // self.tile_h
        key = (tx, ty)
        if not hasattr(self, "_cache"):
            self._cache = {}
        if key not in self._cache:
            self._cache[key] = self._tile(tx, ty)
        data = self._cache[key]
        at = ((row % self.tile_h) * self.tile_w + (col % self.tile_w)) * 4
        value = struct.unpack_from("<f", data, at)[0]
        if self.nodata is not None and value == self.nodata:
            return None
        return value


def _undo_float_predictor(data, width, height, samples=1):
    """
    TIFF predictor 3, the floating-point one. Two steps, and both are easy to get wrong:

    1. Byte-wise cumulative sum along the row with a stride of SAMPLES PER PIXEL — not the row
       width. Getting this wrong yields plausible-looking bytes and absurd floats (my first
       attempt sampled the pin as -3.0e18 m).
    2. De-shuffle the byte planes. The row is stored most-significant plane first, so for a
       little-endian float the planes are read back in reverse: plane 0 is the pixel's high byte.
    """
    out = bytearray(len(data))
    row_bytes = width * samples * 4
    for row in range(height):
        base = row * row_bytes
        line = bytearray(data[base:base + row_bytes])
        for i in range(samples, row_bytes):
            line[i] = (line[i] + line[i - samples]) & 0xFF
        count = width * samples
        for i in range(count):
            out[base + i * 4 + 3] = line[0 * count + i]      # most significant plane first
            out[base + i * 4 + 2] = line[1 * count + i]
            out[base + i * 4 + 1] = line[2 * count + i]
            out[base + i * 4 + 0] = line[3 * count + i]
    return bytes(out)
