#!/usr/bin/env python3
"""Render a deterministic, runtime-only visual QA pack for converted Design Assets.

The renderer intentionally uses only Python's standard library, NumPy and Pillow.
It does not make fidelity or scale claims. Its output is evidence for human QA;
publication gates remain false until an independent review and scale source exist.
"""

from __future__ import annotations

import hashlib
import io
import json
import math
import struct
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import PIL
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
CONVERSION_METRIC = ROOT / "data/metrics/sweet-home-3d-design-asset-conversion-latest.json"
OUTPUT_ROOT = ROOT / ".runtime/design-assets/qa-pack/v0.1"
OUTPUT_METRIC = ROOT / "data/metrics/kator-legaz-design-asset-visual-qa-v0.1.json"
IMAGE_SIZE = 640
BACKGROUND = (239, 241, 244, 255)
FLOOR = (210, 215, 222, 255)
GRID = (178, 185, 195, 180)
EDGE = (34, 39, 47, 24)
AXIS_COLORS = {
    "X": (214, 54, 54, 255),
    "Y": (35, 148, 82, 255),
    "Z": (43, 105, 210, 255),
}

VIEW_SPECS = {
    "front": {"direction": (0.0, 0.0, 1.0), "up": (0.0, 1.0, 0.0), "target_y": 0.48},
    "rear": {"direction": (0.0, 0.0, -1.0), "up": (0.0, 1.0, 0.0), "target_y": 0.48},
    "left": {"direction": (-1.0, 0.0, 0.0), "up": (0.0, 1.0, 0.0), "target_y": 0.48},
    "right": {"direction": (1.0, 0.0, 0.0), "up": (0.0, 1.0, 0.0), "target_y": 0.48},
    "three_quarter": {"direction": (1.0, 0.42, 1.0), "up": (0.0, 1.0, 0.0), "target_y": 0.42},
    "top": {"direction": (0.0, 1.0, 0.0), "up": (0.0, 0.0, -1.0), "target_y": 0.0},
    "floor_contact": {"direction": (1.0, 0.16, 1.0), "up": (0.0, 1.0, 0.0), "target_y": 0.12},
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def unit(vector: np.ndarray) -> np.ndarray:
    length = float(np.linalg.norm(vector))
    return vector / length if length > 1e-12 else vector


def finite_number(value: float) -> float:
    return float(value) if math.isfinite(float(value)) else 0.0


@dataclass
class Material:
    name: str
    color: tuple[float, float, float, float]
    texture: Image.Image | None
    alpha_mode: str
    double_sided: bool


@dataclass
class Primitive:
    positions: np.ndarray
    normals: np.ndarray | None
    uvs: np.ndarray | None
    triangles: np.ndarray
    material: Material


class Glb:
    COMPONENT_DTYPES = {
        5120: np.int8,
        5121: np.uint8,
        5122: np.int16,
        5123: np.uint16,
        5125: np.uint32,
        5126: np.float32,
    }
    TYPE_WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}

    def __init__(self, path: Path):
        self.path = path
        raw = path.read_bytes()
        if raw[:4] != b"glTF" or struct.unpack_from("<I", raw, 4)[0] != 2:
            raise ValueError(f"invalid GLB: {path}")
        offset = 12
        self.document = None
        self.binary = b""
        while offset + 8 <= len(raw):
            length, chunk_type = struct.unpack_from("<II", raw, offset)
            offset += 8
            chunk = raw[offset : offset + length]
            offset += length
            if chunk_type == 0x4E4F534A:
                self.document = json.loads(chunk.decode("utf-8").rstrip(" \x00"))
            elif chunk_type == 0x004E4942:
                self.binary = chunk
        if self.document is None:
            raise ValueError(f"GLB JSON chunk missing: {path}")
        self.images = self._load_images()
        self.materials = self._load_materials()
        self.primitives = self._load_primitives()

    def accessor(self, index: int) -> np.ndarray:
        accessor = self.document["accessors"][index]
        view = self.document["bufferViews"][accessor["bufferView"]]
        dtype = np.dtype(self.COMPONENT_DTYPES[accessor["componentType"]]).newbyteorder("<")
        width = self.TYPE_WIDTHS[accessor["type"]]
        count = int(accessor["count"])
        byte_offset = int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0))
        stride = int(view.get("byteStride", dtype.itemsize * width))
        if stride == dtype.itemsize * width:
            values = np.frombuffer(self.binary, dtype=dtype, count=count * width, offset=byte_offset)
            return values.reshape(count, width).copy()
        return np.ndarray(
            shape=(count, width),
            dtype=dtype,
            buffer=self.binary,
            offset=byte_offset,
            strides=(stride, dtype.itemsize),
        ).copy()

    def _load_images(self) -> list[Image.Image]:
        images = []
        for record in self.document.get("images", []):
            view = self.document["bufferViews"][record["bufferView"]]
            start = int(view.get("byteOffset", 0))
            end = start + int(view["byteLength"])
            image = Image.open(io.BytesIO(self.binary[start:end])).convert("RGBA")
            images.append(image)
        return images

    def _load_materials(self) -> list[Material]:
        materials = []
        textures = self.document.get("textures", [])
        for index, record in enumerate(self.document.get("materials", [])):
            pbr = record.get("pbrMetallicRoughness", {})
            factor = pbr.get("baseColorFactor", [0.72, 0.72, 0.72, 1.0])
            texture = None
            texture_record = pbr.get("baseColorTexture")
            if texture_record is not None:
                texture_index = int(texture_record["index"])
                if texture_index < len(textures):
                    image_index = int(textures[texture_index]["source"])
                    if image_index < len(self.images):
                        texture = self.images[image_index]
            materials.append(Material(
                name=record.get("name", f"material-{index}"),
                color=tuple(float(item) for item in factor),
                texture=texture,
                alpha_mode=record.get("alphaMode", "OPAQUE"),
                double_sided=record.get("doubleSided", False) is True,
            ))
        if not materials:
            materials.append(Material("default", (0.72, 0.72, 0.72, 1.0), None, "OPAQUE", False))
        return materials

    def _load_primitives(self) -> list[Primitive]:
        primitives = []
        mesh_instances = []
        nodes = self.document.get("nodes", [])

        def local_matrix(node):
            if "matrix" in node:
                return np.array(node["matrix"], dtype=np.float64).reshape((4, 4), order="F")
            translation = np.array(node.get("translation", [0, 0, 0]), dtype=np.float64)
            scale = np.array(node.get("scale", [1, 1, 1]), dtype=np.float64)
            x, y, z, w = node.get("rotation", [0, 0, 0, 1])
            rotation = np.array([
                [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)],
            ], dtype=np.float64)
            matrix = np.eye(4, dtype=np.float64)
            matrix[:3, :3] = rotation @ np.diag(scale)
            matrix[:3, 3] = translation
            return matrix

        def visit(index, parent):
            node = nodes[index]
            world = parent @ local_matrix(node)
            if "mesh" in node:
                mesh_instances.append((int(node["mesh"]), world))
            for child in node.get("children", []):
                visit(int(child), world)

        scene_index = int(self.document.get("scene", 0))
        scenes = self.document.get("scenes", [])
        if scenes and nodes:
            for node_index in scenes[scene_index].get("nodes", []):
                visit(int(node_index), np.eye(4, dtype=np.float64))
        else:
            mesh_instances = [(index, np.eye(4, dtype=np.float64)) for index in range(len(self.document.get("meshes", [])))]

        for mesh_index, transform in mesh_instances:
            mesh = self.document.get("meshes", [])[mesh_index]
            for primitive in mesh.get("primitives", []):
                attributes = primitive["attributes"]
                positions = self.accessor(attributes["POSITION"]).astype(np.float64)
                normals = self.accessor(attributes["NORMAL"]).astype(np.float64) if "NORMAL" in attributes else None
                positions = (np.column_stack([positions, np.ones(len(positions))]) @ transform.T)[:, :3]
                if normals is not None:
                    normal_matrix = np.linalg.inv(transform[:3, :3]).T
                    normals = normals @ normal_matrix.T
                    lengths = np.linalg.norm(normals, axis=1)
                    normals = normals / np.where(lengths > 1e-12, lengths, 1.0)[:, None]
                uvs = self.accessor(attributes["TEXCOORD_0"]).astype(np.float64) if "TEXCOORD_0" in attributes else None
                indices = self.accessor(primitive["indices"]).reshape(-1).astype(np.int64)
                if len(indices) % 3:
                    raise ValueError(f"triangle index count is not divisible by three: {self.path}")
                material_index = int(primitive.get("material", 0))
                primitives.append(Primitive(
                    positions=positions,
                    normals=normals,
                    uvs=uvs,
                    triangles=indices.reshape(-1, 3),
                    material=self.materials[material_index],
                ))
        if not primitives:
            raise ValueError(f"GLB has no primitives: {self.path}")
        return primitives

    def all_positions(self) -> np.ndarray:
        return np.concatenate([primitive.positions for primitive in self.primitives], axis=0)


def camera_basis(bounds_min: np.ndarray, bounds_max: np.ndarray, spec: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    center = (bounds_min + bounds_max) * 0.5
    height = max(1e-6, float(bounds_max[1] - bounds_min[1]))
    center[1] = bounds_min[1] + height * float(spec["target_y"])
    diagonal = max(1.0, float(np.linalg.norm(bounds_max - bounds_min)))
    direction = unit(np.array(spec["direction"], dtype=np.float64))
    eye = center + direction * diagonal * 3.0
    forward = unit(center - eye)
    up_hint = unit(np.array(spec["up"], dtype=np.float64))
    right = unit(np.cross(forward, up_hint))
    up = unit(np.cross(right, forward))
    return eye, forward, right, up


def texture_color(material: Material, uv: np.ndarray | None) -> tuple[float, float, float, float]:
    base = np.array(material.color, dtype=np.float64)
    if material.texture is None or uv is None:
        return tuple(base)
    width, height = material.texture.size
    u = float(uv[0]) % 1.0
    v = float(uv[1]) % 1.0
    pixel = np.array(material.texture.getpixel((min(width - 1, int(u * width)), min(height - 1, int(v * height)))), dtype=np.float64) / 255.0
    return tuple(np.clip(base * pixel, 0.0, 1.0))


def composite_polygon(image: Image.Image, polygon: list[tuple[float, float]], color: tuple[int, int, int, int]) -> Image.Image:
    """Draw a polygon with real source-over alpha compositing.

    ImageDraw on an RGBA target replaces pixels (including alpha). Converting
    that target to RGB later makes translucent glass appear opaque. Drawing to
    a transparent layer and alpha-compositing preserves geometry behind it.
    """
    if color[3] < 255:
        overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
        overlay_draw = ImageDraw.Draw(overlay, "RGBA")
        overlay_draw.polygon(polygon, fill=color, outline=EDGE)
        return Image.alpha_composite(image, overlay)
    ImageDraw.Draw(image, "RGBA").polygon(polygon, fill=color, outline=EDGE)
    return image


def render_view(glb: Glb, view_name: str, destination: Path, declared_mm: dict, source_transform: dict) -> dict:
    spec = VIEW_SPECS[view_name]
    all_positions = glb.all_positions()
    bounds_min = all_positions.min(axis=0)
    bounds_max = all_positions.max(axis=0)
    eye, forward, right, up = camera_basis(bounds_min, bounds_max, spec)

    relative = all_positions - eye
    # NumPy on some macOS Accelerate builds emits spurious divide-by-zero
    # warnings for matrix-vector matmul even when every operand/result is
    # finite. Explicit component sums are deterministic and avoid that path.
    projected_x = np.sum(relative * right, axis=1)
    projected_y = np.sum(relative * up, axis=1)
    x_min, x_max = float(projected_x.min()), float(projected_x.max())
    y_min, y_max = float(projected_y.min()), float(projected_y.max())
    span_x = max(1e-6, x_max - x_min)
    span_y = max(1e-6, y_max - y_min)
    margin = 0.13
    scale = min(IMAGE_SIZE * (1 - margin * 2) / span_x, IMAGE_SIZE * (1 - margin * 2) / span_y)
    center_x = (x_min + x_max) * 0.5
    center_y = (y_min + y_max) * 0.5

    def project(points: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        rel = points - eye
        x = (np.sum(rel * right, axis=1) - center_x) * scale + IMAGE_SIZE * 0.5
        y = IMAGE_SIZE * 0.5 - (np.sum(rel * up, axis=1) - center_y) * scale
        depth = np.sum(rel * forward, axis=1)
        return np.column_stack([x, y]), depth

    image = Image.new("RGBA", (IMAGE_SIZE, IMAGE_SIZE), BACKGROUND)
    draw = ImageDraw.Draw(image, "RGBA")
    mask = Image.new("L", (IMAGE_SIZE, IMAGE_SIZE), 0)
    mask_draw = ImageDraw.Draw(mask)

    floor_extent = max(1.0, float(np.max(bounds_max - bounds_min)) * 1.25)
    floor_corners = np.array([
        [-floor_extent, 0.0, -floor_extent],
        [floor_extent, 0.0, -floor_extent],
        [floor_extent, 0.0, floor_extent],
        [-floor_extent, 0.0, floor_extent],
    ])
    floor_pixels, _ = project(floor_corners)
    if view_name != "top":
        draw.polygon([tuple(item) for item in floor_pixels], fill=FLOOR)
        for fraction in np.linspace(-1.0, 1.0, 9):
            x_line = np.array([[fraction * floor_extent, 0.0, -floor_extent], [fraction * floor_extent, 0.0, floor_extent]])
            z_line = np.array([[-floor_extent, 0.0, fraction * floor_extent], [floor_extent, 0.0, fraction * floor_extent]])
            for line in (x_line, z_line):
                pixels, _ = project(line)
                draw.line([tuple(item) for item in pixels], fill=GRID, width=1)

    light = unit(np.array([0.32, 0.88, 0.36], dtype=np.float64))
    triangles = []
    degenerate = 0
    front_facing = 0
    back_facing = 0
    culled_back_faces = 0
    normal_diagnostics = []
    for primitive in glb.primitives:
        pixels, depths = project(primitive.positions)
        for indices in primitive.triangles:
            points = primitive.positions[indices]
            face_normal = np.cross(points[1] - points[0], points[2] - points[0])
            magnitude = float(np.linalg.norm(face_normal))
            if magnitude <= 1e-12:
                degenerate += 1
                continue
            face_normal /= magnitude
            centroid = points.mean(axis=0)
            toward_eye = unit(eye - centroid)
            facing = float(np.dot(face_normal, toward_eye))
            if facing > 0.0:
                front_facing += 1
            else:
                back_facing += 1
            normal_diagnostics.append((centroid, face_normal, facing > 0.0))
            if not primitive.material.double_sided and facing <= 0.0:
                culled_back_faces += 1
                continue
            screen_triangle = pixels[indices]
            depth_triangle = depths[indices]
            uv_triangle = primitive.uvs[indices] if primitive.uvs is not None else None
            intensity = 0.54 + 0.46 * max(0.0, float(np.dot(face_normal if facing >= 0 else -face_normal, light)))

            def append_render_triangle(screen_points: np.ndarray, depth_points: np.ndarray, uv_points: np.ndarray | None) -> None:
                uv = uv_points.mean(axis=0) if uv_points is not None else None
                color = np.array(texture_color(primitive.material, uv), dtype=np.float64)
                color[:3] = np.clip(color[:3] * intensity, 0.0, 1.0)
                if primitive.material.alpha_mode != "BLEND":
                    color[3] = 1.0
                triangles.append((
                    float(depth_points.mean()),
                    [tuple(item) for item in screen_points],
                    tuple(int(round(item * 255)) for item in color),
                ))

            if primitive.material.texture is None or uv_triangle is None:
                append_render_triangle(screen_triangle, depth_triangle, uv_triangle)
                continue

            # Texture QA needs more than one centroid sample on large faces
            # (a rug may be represented by only two triangles). Tessellate in
            # screen space so the embedded UV pattern remains inspectable.
            edge_lengths = [
                float(np.linalg.norm(screen_triangle[(index + 1) % 3] - screen_triangle[index]))
                for index in range(3)
            ]
            divisions = min(24, max(1, math.ceil(max(edge_lengths) / 18.0)))

            def sample(i: int, j: int) -> tuple[np.ndarray, float, np.ndarray]:
                a = i / divisions
                b = j / divisions
                weights = np.array([1.0 - a - b, a, b])
                return (
                    np.sum(screen_triangle * weights[:, None], axis=0),
                    float(np.sum(depth_triangle * weights)),
                    np.sum(uv_triangle * weights[:, None], axis=0),
                )

            for i in range(divisions):
                for j in range(divisions - i):
                    p0, d0, u0 = sample(i, j)
                    p1, d1, u1 = sample(i + 1, j)
                    p2, d2, u2 = sample(i, j + 1)
                    append_render_triangle(
                        np.array([p0, p1, p2]),
                        np.array([d0, d1, d2]),
                        np.array([u0, u1, u2]),
                    )
                    if i + j < divisions - 1:
                        p3, d3, u3 = sample(i + 1, j + 1)
                        append_render_triangle(
                            np.array([p1, p3, p2]),
                            np.array([d1, d3, d2]),
                            np.array([u1, u3, u2]),
                        )

    triangles.sort(key=lambda item: item[0], reverse=True)
    for _, polygon, color in triangles:
        image = composite_polygon(image, polygon, color)
        draw = ImageDraw.Draw(image, "RGBA")
        mask_draw.polygon(polygon, fill=255)

    # Diagnostic overlays deliberately expose the mechanical coordinate
    # contract. They are evidence aids, not semantic source-orientation proof.
    box = np.array([
        [bounds_min[0], bounds_min[1], bounds_min[2]],
        [bounds_max[0], bounds_min[1], bounds_min[2]],
        [bounds_max[0], bounds_max[1], bounds_min[2]],
        [bounds_min[0], bounds_max[1], bounds_min[2]],
        [bounds_min[0], bounds_min[1], bounds_max[2]],
        [bounds_max[0], bounds_min[1], bounds_max[2]],
        [bounds_max[0], bounds_max[1], bounds_max[2]],
        [bounds_min[0], bounds_max[1], bounds_max[2]],
    ])
    box_pixels, _ = project(box)
    for start, end in ((0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4), (0, 4), (1, 5), (2, 6), (3, 7)):
        draw.line([tuple(box_pixels[start]), tuple(box_pixels[end])], fill=(68, 75, 86, 125), width=1)

    axis_length = max(0.05, float(np.max(bounds_max - bounds_min)) * 0.18)
    axis_points = np.array([
        [0.0, 0.0, 0.0],
        [axis_length, 0.0, 0.0],
        [0.0, axis_length, 0.0],
        [0.0, 0.0, axis_length],
    ])
    axis_pixels, _ = project(axis_points)
    origin_pixel = tuple(axis_pixels[0])
    for index, axis in enumerate(("X", "Y", "Z"), start=1):
        endpoint = tuple(axis_pixels[index])
        draw.line([origin_pixel, endpoint], fill=AXIS_COLORS[axis], width=4)
        draw.ellipse((endpoint[0] - 3, endpoint[1] - 3, endpoint[0] + 3, endpoint[1] + 3), fill=AXIS_COLORS[axis])
        draw.text((endpoint[0] + 4, endpoint[1] - 7), axis, fill=AXIS_COLORS[axis], font=ImageFont.load_default())
    draw.ellipse((origin_pixel[0] - 6, origin_pixel[1] - 6, origin_pixel[0] + 6, origin_pixel[1] + 6), fill=(255, 255, 255, 230), outline=(108, 55, 176, 255), width=2)
    draw.line([(origin_pixel[0] - 8, origin_pixel[1]), (origin_pixel[0] + 8, origin_pixel[1])], fill=(108, 55, 176, 255), width=2)
    draw.line([(origin_pixel[0], origin_pixel[1] - 8), (origin_pixel[0], origin_pixel[1] + 8)], fill=(108, 55, 176, 255), width=2)

    if normal_diagnostics:
        sample_count = min(28, len(normal_diagnostics))
        sample_indices = np.linspace(0, len(normal_diagnostics) - 1, sample_count, dtype=int)
        normal_length = max(0.02, float(np.max(bounds_max - bounds_min)) * 0.045)
        for diagnostic_index in sample_indices:
            centroid, normal, is_front = normal_diagnostics[int(diagnostic_index)]
            normal_points = np.array([centroid, centroid + normal * normal_length])
            normal_pixels, _ = project(normal_points)
            color = (0, 132, 122, 205) if is_front else (224, 105, 35, 205)
            draw.line([tuple(normal_pixels[0]), tuple(normal_pixels[1])], fill=color, width=2)

    label_font = ImageFont.load_default()
    label = f"{view_name.replace('_', ' ').upper()}  |  {declared_mm['width']}×{declared_mm['depth']}×{declared_mm['height']} mm"
    rotation = source_transform.get("model_rotation", {})
    rotation_label = "SRC ROT DECLARED" if rotation.get("declared") is True else "SRC ROT UNDECLARED"
    back_face_label = "DOUBLE-SIDED" if source_transform.get("back_face_shown") is True else "BACK-FACE CULL"
    diagnostic_label = f"{rotation_label}  |  {back_face_label}  |  PURPLE=PIVOT"
    label_width = max(360, len(label) * 6, len(diagnostic_label) * 6)
    draw.rounded_rectangle((12, 12, 12 + label_width, 54), radius=5, fill=(255, 255, 255, 225))
    draw.text((20, 19), label, fill=(28, 32, 38, 255), font=label_font)
    draw.text((20, 36), diagnostic_label, fill=(58, 63, 72, 255), font=label_font)
    legend = "AXES X/Y/Z  |  NORMALS teal=front orange=back  |  grey=bounds"
    legend_width = min(IMAGE_SIZE - 24, len(legend) * 6 + 16)
    draw.rounded_rectangle((12, IMAGE_SIZE - 32, 12 + legend_width, IMAGE_SIZE - 10), radius=4, fill=(255, 255, 255, 215))
    draw.text((20, IMAGE_SIZE - 27), legend, fill=(42, 47, 55, 255), font=label_font)

    destination.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(destination, format="PNG", optimize=True)
    coverage = float(np.count_nonzero(np.array(mask))) / float(IMAGE_SIZE * IMAGE_SIZE)
    return {
        "view": view_name,
        "file": destination.name,
        "sha256": sha256_file(destination),
        "bytes": destination.stat().st_size,
        "silhouette_pixel_coverage": round(coverage, 6),
        "visible_triangles": len(triangles),
        "degenerate_triangles": degenerate,
        "front_facing_triangles": front_facing,
        "back_facing_triangles": back_facing,
        "culled_back_faces": culled_back_faces,
        "diagnostic_overlays": ["canonical_axes", "mechanical_origin_pivot", "bounds", "sampled_face_normals", "back_face_counts"],
    }


def contact_sheet(asset_id: str, views: list[dict], asset_dir: Path) -> Path:
    tile = 300
    label_height = 28
    sheet = Image.new("RGB", (tile * 4, (tile + label_height) * 2 + 44), (250, 250, 251))
    draw = ImageDraw.Draw(sheet)
    draw.text((16, 14), f"{asset_id} — canonical visual QA v0.1", fill=(22, 26, 32), font=ImageFont.load_default())
    for index, view in enumerate(views):
        image = Image.open(asset_dir / view["file"]).convert("RGB")
        image.thumbnail((tile - 12, tile - 12), Image.Resampling.LANCZOS)
        column = index % 4
        row = index // 4
        x = column * tile + (tile - image.width) // 2
        y = 44 + row * (tile + label_height) + (tile - image.height) // 2
        sheet.paste(image, (x, y))
        draw.text((column * tile + 10, 44 + row * (tile + label_height) + tile + 5), view["view"].replace("_", " "), fill=(36, 40, 47))
    path = asset_dir / "contact-sheet.png"
    sheet.save(path, format="PNG", optimize=True)
    return path


def master_sheet(asset_records: list[dict]) -> Path:
    tile_width = 420
    tile_height = 250
    columns = 3
    rows = math.ceil(len(asset_records) / columns)
    sheet = Image.new("RGB", (tile_width * columns, tile_height * rows + 44), (247, 248, 250))
    draw = ImageDraw.Draw(sheet)
    draw.text((16, 15), "Kator/Legaz Design Assets — seven-view QA contact sheets", fill=(22, 26, 32))
    for index, record in enumerate(asset_records):
        contact = Image.open(OUTPUT_ROOT / record["asset_directory"] / "contact-sheet.png").convert("RGB")
        contact.thumbnail((tile_width - 12, tile_height - 34), Image.Resampling.LANCZOS)
        column = index % columns
        row = index // columns
        x = column * tile_width + (tile_width - contact.width) // 2
        y = 44 + row * tile_height
        sheet.paste(contact, (x, y))
        draw.text((column * tile_width + 10, 44 + row * tile_height + tile_height - 25), record["design_asset_id"], fill=(32, 36, 44))
    path = OUTPUT_ROOT / "all-assets-contact-sheet.png"
    sheet.save(path, format="PNG", optimize=True)
    return path


def main() -> None:
    conversion = json.loads(CONVERSION_METRIC.read_text())
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    records = []
    for asset in conversion.get("assets", []):
        if asset.get("status") != "GLB_CONVERTED_DECLARED_ENVELOPE_APPLIED_VISUAL_QA_REQUIRED":
            continue
        glb_path = ROOT / asset["runtime_glb_path"]
        glb = Glb(glb_path)
        asset_directory = asset["design_asset_id"].lower()
        asset_dir = OUTPUT_ROOT / asset_directory
        views = [
            render_view(glb, view_name, asset_dir / f"{view_name}.png", asset["declared_mm"], asset["source_transform"])
            for view_name in VIEW_SPECS
        ]
        contact = contact_sheet(asset["design_asset_id"], views, asset_dir)
        positions = glb.all_positions()
        bounds_min = positions.min(axis=0)
        bounds_max = positions.max(axis=0)
        center = (bounds_min + bounds_max) * 0.5
        triangle_count = sum(len(primitive.triangles) for primitive in glb.primitives)
        records.append({
            "design_asset_id": asset["design_asset_id"],
            "source_model_name": asset["source_model_name"],
            "asset_directory": asset_directory,
            "runtime_glb_sha256": sha256_file(glb_path),
            "declared_mm": asset["declared_mm"],
            "geometry_level_before_review": "G1",
            "source_scale_independently_verified": False,
            "automated_checks": {
                "finite_geometry": bool(np.isfinite(positions).all()),
                "triangle_count": triangle_count,
                "floor_contact_error_mm": round(abs(finite_number(bounds_min[1])) * 1000.0, 6),
                "centre_pivot_offset_mm": {
                    "x": round(abs(finite_number(center[0])) * 1000.0, 6),
                    "z": round(abs(finite_number(center[2])) * 1000.0, 6),
                },
                "material_count": len(glb.materials),
                "embedded_texture_count": sum(1 for material in glb.materials if material.texture is not None),
                "alpha_material_count": sum(1 for material in glb.materials if material.alpha_mode == "BLEND" or material.color[3] < 0.999),
                "double_sided_material_count": sum(1 for material in glb.materials if material.double_sided),
                "all_seven_views_rendered": len(views) == 7 and all(view["bytes"] > 0 for view in views),
            },
            "views": views,
            "contact_sheet": {"file": contact.name, "sha256": sha256_file(contact), "bytes": contact.stat().st_size},
            "manual_review": {
                "state": "PENDING_INDEPENDENT_VISUAL_REVIEW",
                "orientation": None,
                "silhouette": None,
                "proportions": None,
                "floor_contact": None,
                "centre_pivot": None,
                "normals_back_faces": None,
                "texture_embedding": None,
                "glass_alpha": None,
                "material_colours": None,
                "attribution": None,
                "blockers": [
                    "independent visual review not yet recorded",
                    "independent physical scale evidence absent",
                    "customer-facing attribution display not yet verified",
                ],
            },
            "promotion": {
                "geometry_level": "G1",
                "canonical_view_visual_qa_passed": False,
                "independent_scale_qa_passed": False,
                "publication_allowed": False,
            },
        })

    master = master_sheet(records)
    metric = {
        "version": "0.1",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "record_lane": "DESIGN_ASSET",
        "renderer": {
            "script": str(Path(__file__).resolve().relative_to(ROOT)),
            "script_sha256": sha256_file(Path(__file__)),
            "python": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            "numpy": np.__version__,
            "pillow": PIL.__version__,
            "requirements": "requirements-design-asset-qa.txt",
        },
        "status": "CANONICAL_RENDER_PACK_COMPLETE_INDEPENDENT_REVIEW_REQUIRED",
        "policy": "Renders are runtime-only QA evidence. They do not prove independent scale, rights clearance, publication readiness, Product Twin identity, or procurement readiness.",
        "view_contract": list(VIEW_SPECS),
        "summary": {
            "assets": len(records),
            "views_per_asset": 7,
            "rendered_views": sum(len(record["views"]) for record in records),
            "g2_promoted": 0,
            "publication_allowed": 0,
        },
        "runtime_pack": {
            "directory": str(OUTPUT_ROOT.relative_to(ROOT)),
            "master_contact_sheet": master.name,
            "master_contact_sheet_sha256": sha256_file(master),
        },
        "assets": records,
    }
    OUTPUT_METRIC.write_text(json.dumps(metric, indent=2) + "\n")
    print(json.dumps({
        "status": metric["status"],
        "assets": len(records),
        "rendered_views": metric["summary"]["rendered_views"],
        "metric": str(OUTPUT_METRIC.relative_to(ROOT)),
        "master_contact_sheet": str(master.relative_to(ROOT)),
    }, indent=2))


if __name__ == "__main__":
    main()
