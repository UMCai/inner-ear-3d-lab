#!/usr/bin/env python3
"""
Gate 3 / `lemo-opuscar` Clinical Compositor (`src/render/hud_compositor.py`)
============================================================================
Implements the radical UI simplification and Gate 3 visual system (`Medaium-BPPV-001` style):
  - Top Bar (`84 px`, `PANEL = (22, 31, 35)`): `MEDAIUM / EPLEY MANEUVER` + active step badge.
  - Full-bleed 3D Main Viewport (`1920 x 811`, `y = 84..895`) + 1 linked Picture-in-Picture (PiP) Inset.
  - Dynamic Role Swap with smooth cross-dissolve (`role_swap_blend` in `[0, 1]`):
      * Movement Phase (`role_swap_blend = 0.0`): 3/4 External Patient View dominates Main Viewport;
        synchronized Right Labyrinth sits in the top-right PiP inset (`RIGHT INNER EAR · LIVE POSE`).
      * Settling Hold Phase (`role_swap_blend = 1.0`): Gate 3 IE-Map Right Labyrinth Close-Up dominates
        Main Viewport (with compact `GRAVITY` arrow and warm canalith halo rings); Patient Hold Pose
        sits in the top-left PiP inset (`PATIENT POSE · HOLD 30–60 s`).
  - Temporally staged pill labels (`1–2 max` on screen at any time, smooth fade-in/out, zero crossed leader lines).
  - Gate 3 Editorial Lower-Third (`y = 895..1080`, `185 px`): `PANEL` background, `12 px` left `CYAN` accent bar,
    bold `Headline` (`font(31, True)`), concise `Support` sentence (`font(20, False)`), timecode, and chapter progress bar.
"""

import math
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
from PIL import Image, ImageDraw, ImageFont


# Gate 3 (`Medaium-BPPV-001`) Color Palette
BG_RGB = (7, 16, 20)
BG_RGBA = (7, 16, 20, 255)
PANEL = (22, 31, 35, 255)
PANEL_TRANSLUCENT = (18, 27, 32, 232)
PANEL_BORDER = (46, 68, 78, 255)
WHITE = (234, 247, 248, 255)
MUTED = (182, 202, 207, 255)
CYAN = (82, 220, 242, 255)
WARM = (240, 170, 98, 255)
SAGE = (118, 200, 158, 255)
LAVENDER = (162, 178, 238, 255)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = (
        [
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
            "/Library/Fonts/Arial Bold.ttf",
        ]
        if bold
        else [
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
            "/Library/Fonts/Arial.ttf",
        ]
    )
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size=size)
            except Exception:
                continue
    return ImageFont.load_default()


def with_alpha(color: Tuple[int, int, int, int], alpha_scale: float) -> Tuple[int, int, int, int]:
    a = int(round(max(0.0, min(1.0, alpha_scale)) * color[3]))
    return (color[0], color[1], color[2], a)


def smoothstep(edge0: float, edge1: float, x: float) -> float:
    if edge1 <= edge0:
        return 1.0 if x >= edge0 else 0.0
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def window_alpha(u: float, u_start: float, u_end: float, fade: float = 0.08) -> float:
    """Smooth fade-in / fade-out window over normalized shot progress `u in [0, 1]`."""
    fade_in = smoothstep(u_start, u_start + fade, u)
    fade_out = 1.0 - smoothstep(u_end - fade, u_end, u)
    return float(max(0.0, min(1.0, fade_in * fade_out)))


def draw_arrow(
    draw: ImageDraw.ImageDraw,
    p1: Tuple[float, float],
    p2: Tuple[float, float],
    color: Tuple[int, int, int, int],
    width: int = 3,
    head_len: float = 13.0,
    head_angle_deg: float = 26.0,
):
    x1, y1 = p1
    x2, y2 = p2
    dx = x2 - x1
    dy = y2 - y1
    length = math.hypot(dx, dy)
    if length < 2.0:
        return
    draw.line([p1, p2], fill=color, width=width)
    ang = math.atan2(dy, dx)
    ha = math.radians(head_angle_deg)
    lx = x2 - head_len * math.cos(ang - ha)
    ly = y2 - head_len * math.sin(ang - ha)
    rx = x2 - head_len * math.cos(ang + ha)
    ry = y2 - head_len * math.sin(ang + ha)
    draw.polygon([(x2, y2), (lx, ly), (rx, ry)], fill=color)


def draw_rounded_box(
    draw: ImageDraw.ImageDraw,
    bbox: Tuple[int, int, int, int],
    radius: int,
    fill: Tuple[int, int, int, int],
    outline: Optional[Tuple[int, int, int, int]] = None,
    width: int = 1,
):
    draw.rounded_rectangle(bbox, radius=radius, fill=fill, outline=outline, width=width)


class ClinicalHUDCompositor:
    """
    Gate 3 / `lemo-opuscar` Compositor that transforms the `2560 x 1080` dual-stage Blender render
    (`left 1280x1080 = Patient Stage`, `right 1280x1080 = Labyrinth Stage`) into the `1920 x 1080`
    educational video frame with Dynamic Role Swap, 1–2 temporally staged pill labels, and the
    Gate 3 editorial lower-third.
    """

    def __init__(self, width: int = 1920, height: int = 1080):
        self.width = width
        self.height = height

        # Gate 3 Typography Hierarchy
        self.f_top_brand = load_font(18, bold=True)
        self.f_top_sub = load_font(17, bold=False)
        self.f_step_badge = load_font(15, bold=True)
        self.f_pip_hdr = load_font(14, bold=True)
        self.f_pip_sub = load_font(13, bold=False)
        self.f_pill_bold = load_font(18, bold=True)
        self.f_pill_sub = load_font(14, bold=False)
        self.f_gravity = load_font(15, bold=True)
        self.f_headline = load_font(31, bold=True)
        self.f_headline_med = load_font(27, bold=True)
        self.f_support = load_font(20, bold=False)
        self.f_support_med = load_font(18, bold=False)
        self.f_timecode = load_font(16, bold=True)
        self.f_card_title = load_font(22, bold=True)
        self.f_card_body = load_font(17, bold=False)

        # Viewport geometry
        # Patient crop in 2560x1080 source: x in [0, 1280), y in [0, 1080), center = (640, 540)
        # Labyrinth crop in 2560x1080 source: x in [1280, 2560), y in [0, 1080), center = (1920, 540)
        self.pat_main_scale = 1.02
        self.pat_main_center = (720.0, 492.0)

        self.lab_main_scale = 1.00
        self.lab_main_center = (1050.0, 488.0)

        # PiP Inset rectangles (x0, y0, x1, y1)
        self.pip_right_rect = (1328, 114, 1868, 454)   # Used when Patient is Main (Movement phase)
        self.pip_left_rect = (52, 114, 552, 424)       # Used when Labyrinth is Main (Settling hold phase)

    def map_patient_pt_to_main(self, pt_src: Tuple[float, float]) -> Tuple[float, float]:
        sx, sy = pt_src
        cx, cy = self.pat_main_center
        s = self.pat_main_scale
        return (cx + (sx - 640.0) * s, cy + (sy - 540.0) * s)

    def map_patient_pt_to_pip(self, pt_src: Tuple[float, float]) -> Tuple[float, float]:
        x0, y0, x1, y1 = self.pip_left_rect
        hdr_h = 34
        pw = x1 - x0
        ph = (y1 - y0) - hdr_h
        s = min(pw / 1080.0, ph / 760.0)
        cx = x0 + pw * 0.5
        cy = y0 + hdr_h + ph * 0.54
        return (cx + (pt_src[0] - 640.0) * s, cy + (pt_src[1] - 540.0) * s)

    def map_labyrinth_pt_to_main(self, pt_src: Tuple[float, float]) -> Tuple[float, float]:
        sx, sy = pt_src
        cx, cy = self.lab_main_center
        s = self.lab_main_scale
        return (cx + (sx - 1920.0) * s, cy + (sy - 540.0) * s)

    def map_labyrinth_pt_to_pip(self, pt_src: Tuple[float, float]) -> Tuple[float, float]:
        x0, y0, x1, y1 = self.pip_right_rect
        hdr_h = 34
        pw = x1 - x0
        ph = (y1 - y0) - hdr_h
        s = min(pw / 980.0, ph / 720.0)
        cx = x0 + pw * 0.5
        cy = y0 + hdr_h + ph * 0.52
        return (cx + (pt_src[0] - 1920.0) * s, cy + (pt_src[1] - 540.0) * s)

    def _paste_stage_crop(
        self,
        canvas: Image.Image,
        stage_img: Image.Image,
        src_center: Tuple[float, float],
        dst_center: Tuple[float, float],
        scale: float,
        clip_rect: Optional[Tuple[int, int, int, int]] = None,
    ):
        sw, sh = stage_img.size
        nw = max(1, int(round(sw * scale)))
        nh = max(1, int(round(sh * scale)))
        resized = stage_img.resize((nw, nh), Image.Resampling.LANCZOS)

        paste_x = int(round(dst_center[0] - src_center[0] * scale))
        paste_y = int(round(dst_center[1] - src_center[1] * scale))

        if clip_rect is None:
            canvas.paste(resized, (paste_x, paste_y))
            return

        cx0, cy0, cx1, cy1 = clip_rect
        ix0 = max(cx0, paste_x)
        iy0 = max(cy0, paste_y)
        ix1 = min(cx1, paste_x + nw)
        iy1 = min(cy1, paste_y + nh)
        if ix1 > ix0 and iy1 > iy0:
            sub = resized.crop((ix0 - paste_x, iy0 - paste_y, ix1 - paste_x, iy1 - paste_y))
            canvas.paste(sub, (ix0, iy0))

    def _draw_pill_callout(
        self,
        draw: ImageDraw.ImageDraw,
        text: str,
        subtext: Optional[str],
        target_xy: Tuple[float, float],
        box_center_xy: Tuple[float, float],
        accent_color: Tuple[int, int, int, int],
        alpha: float = 1.0,
    ):
        if alpha <= 0.02:
            return
        tx, ty = target_xy
        bx, by = box_center_xy

        tb1 = draw.textbbox((0, 0), text, font=self.f_pill_bold)
        tw1 = tb1[2] - tb1[0]
        th1 = tb1[3] - tb1[1]

        tw2 = 0
        th2 = 0
        if subtext:
            tb2 = draw.textbbox((0, 0), subtext, font=self.f_pill_sub)
            tw2 = tb2[2] - tb2[0]
            th2 = tb2[3] - tb2[1]

        pad_x = 18
        pad_y = 11
        box_w = max(tw1, tw2) + pad_x * 2 + 6
        box_h = th1 + (th2 + 6 if subtext else 0) + pad_y * 2

        x0 = int(round(bx - box_w * 0.5))
        y0 = int(round(by - box_h * 0.5))
        x1 = x0 + box_w
        y1 = y0 + box_h

        # Clamp inside main viewport safe area
        x0 = max(36, min(self.width - 36 - box_w, x0))
        y0 = max(100, min(878 - box_h, y0))
        x1 = x0 + box_w
        y1 = y0 + box_h

        # Connect from closest edge/corner of pill to target_xy
        anchor_x = float(np.clip(tx, x0 + 12, x1 - 12))
        anchor_y = float(np.clip(ty, y0 + 8, y1 - 8))
        if abs(tx - (x0 + x1) * 0.5) > box_w * 0.45:
            anchor_x = float(x1 if tx > (x0 + x1) * 0.5 else x0)
            anchor_y = float((y0 + y1) * 0.5)

        line_col = with_alpha(accent_color, 0.88 * alpha)
        glow_col = with_alpha(accent_color, 0.28 * alpha)
        draw.line([(anchor_x, anchor_y), (tx, ty)], fill=glow_col, width=5)
        draw.line([(anchor_x, anchor_y), (tx, ty)], fill=line_col, width=2)

        # Target ring & dot
        r_dot = 5
        draw.ellipse(
            (tx - r_dot - 3, ty - r_dot - 3, tx + r_dot + 3, ty + r_dot + 3),
            outline=line_col,
            width=2,
        )
        draw.ellipse(
            (tx - r_dot + 1, ty - r_dot + 1, tx + r_dot - 1, ty + r_dot - 1),
            fill=with_alpha(WHITE, alpha),
        )

        # Pill box with left accent bar
        draw_rounded_box(
            draw,
            (x0, y0, x1, y1),
            radius=12,
            fill=with_alpha(PANEL_TRANSLUCENT, alpha),
            outline=with_alpha(accent_color, 0.85 * alpha),
            width=2,
        )
        draw_rounded_box(
            draw,
            (x0 + 6, y0 + 8, x0 + 11, y1 - 8),
            radius=2,
            fill=with_alpha(accent_color, alpha),
        )

        draw.text(
            (x0 + pad_x + 4, y0 + pad_y - 1),
            text,
            font=self.f_pill_bold,
            fill=with_alpha(WHITE, alpha),
        )
        if subtext:
            draw.text(
                (x0 + pad_x + 4, y0 + pad_y + th1 + 5),
                subtext,
                font=self.f_pill_sub,
                fill=with_alpha(MUTED, alpha),
            )

    def _draw_labyrinth_highlights(
        self,
        draw: ImageDraw.ImageDraw,
        frame_meta: Dict,
        in_main: bool,
        alpha: float = 1.0,
    ):
        """
        Draw subtle warm amber rings around the 5 canalith particles, a clean migration trajectory
        along the posterior canal, and (when `in_main=True`) the compact Gate 3 `GRAVITY` arrow.
        """
        if alpha <= 0.02:
            return

        mapper = self.map_labyrinth_pt_to_main if in_main else self.map_labyrinth_pt_to_pip

        # 1. Subtle dotted migration path along the active trajectory up to current particle position
        trail_pts_src = frame_meta.get("trail_pts_2d", [])
        if len(trail_pts_src) >= 2:
            mapped_trail = [mapper((p[0], p[1])) for p in trail_pts_src]
            line_w = 3 if in_main else 2
            draw.line(mapped_trail, fill=with_alpha(WARM, 0.38 * alpha), width=line_w)

        # 2. Warm halo rings around the 5 enlarged canalith particles
        particles_src = frame_meta.get("particles_2d", [])
        r_ring = 11 if in_main else 5
        for pt in particles_src:
            px, py = mapper((pt[0], pt[1]))
            draw.ellipse(
                (px - r_ring, py - r_ring, px + r_ring, py + r_ring),
                outline=with_alpha(WARM, 0.82 * alpha),
                width=2 if in_main else 1,
            )
            if in_main:
                draw.ellipse(
                    (px - 3, py - 3, px + 3, py + 3),
                    fill=with_alpha((255, 232, 185, 255), 0.90 * alpha),
                )

        # 3. Compact Gate 3 GRAVITY arrow during close-up holds in Main Viewport
        if in_main:
            gx = 1740
            gy_top = 152
            gy_bot = 264
            draw_rounded_box(
                draw,
                (gx - 68, gy_top - 36, gx + 68, gy_bot + 18),
                radius=12,
                fill=with_alpha(PANEL_TRANSLUCENT, 0.92 * alpha),
                outline=with_alpha(PANEL_BORDER, 0.90 * alpha),
                width=1,
            )
            lbl = "GRAVITY"
            tb = draw.textbbox((0, 0), lbl, font=self.f_gravity)
            tw = tb[2] - tb[0]
            draw.text((gx - tw // 2, gy_top - 24), lbl, font=self.f_gravity, fill=with_alpha(WARM, alpha))
            draw_arrow(
                draw,
                (gx, gy_top + 6),
                (gx, gy_bot),
                color=with_alpha(WARM, alpha),
                width=4,
                head_len=15.0,
            )

            # Short tangential settling arrow next to the particle cluster when actively migrating along canal
            g_along = float(frame_meta.get("gravity_along_canal", 0.0))
            phi_cur = float(frame_meta.get("otoconia_phi_deg", 0.0))
            step_id = frame_meta.get("step_id", "")
            if step_id in {"step2", "step3", "step4"} and g_along > 0.04 and phi_cur < 176.0:
                c_src = frame_meta.get("otoconia_center_2d")
                t_src = frame_meta.get("otoconia_tan_end_2d")
                if c_src and t_src:
                    cx, cy = mapper((c_src[0], c_src[1]))
                    tx, ty = mapper((t_src[0], t_src[1]))
                    dx = tx - cx
                    dy = ty - cy
                    norm = math.hypot(dx, dy)
                    if norm > 3.0:
                        ux, uy = dx / norm, dy / norm
                        nx, ny = -uy, ux
                        p_start = (cx + nx * 24.0 - ux * 10.0, cy + ny * 24.0 - uy * 10.0)
                        p_end = (p_start[0] + ux * 54.0, p_start[1] + uy * 54.0)
                        draw_arrow(draw, p_start, p_end, color=with_alpha(CYAN, 0.92 * alpha), width=3, head_len=12.0)

    def _build_patient_dominant_layer(self, raw_img: Image.Image, frame_meta: Dict) -> Image.Image:
        """
        Build the `1920 x 1080` viewport canvas for the **Patient-Dominant** layout:
          - Main Viewport (`y = 84..895`): 3/4 External Patient View.
          - Top-Right PiP Inset (`1328, 114, 1868, 454`): Synchronized IE-Map Right Labyrinth (`RIGHT INNER EAR · LIVE POSE`).
          - Dynamic cyan leader line from the patient's `Right_ear_locator_ring` to the PiP inset.
        """
        bg_px = raw_img.getpixel((4, 4))
        bg_col = (bg_px[0], bg_px[1], bg_px[2], 255)
        canvas = Image.new("RGBA", (self.width, self.height), bg_col)
        patient_stage = raw_img.crop((0, 0, 1280, 1080))
        labyrinth_stage = raw_img.crop((1280, 0, 2560, 1080))

        step_id = frame_meta.get("step_id", "")
        pat_center = (520.0, 492.0) if step_id == "outro" else self.pat_main_center

        # 1. Paste 3/4 Patient Stage into Main Viewport
        self._paste_stage_crop(
            canvas,
            patient_stage,
            src_center=(640.0, 540.0),
            dst_center=pat_center,
            scale=self.pat_main_scale,
            clip_rect=(0, 84, self.width, 895),
        )

        # In Shot 8 (`outro`), the right half displays the 4-item Clinical Summary Card instead of the PiP inset
        if step_id == "outro":
            return canvas

        # 2. Paste Right Labyrinth Stage into Top-Right PiP Inset
        x0, y0, x1, y1 = self.pip_right_rect
        hdr_h = 34
        pw = x1 - x0
        ph = (y1 - y0) - hdr_h
        s_pip = min(pw / 980.0, ph / 720.0)

        overlay = Image.new("RGBA", (self.width, self.height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        draw_rounded_box(draw, (x0, y0, x1, y1), radius=12, fill=bg_col, outline=CYAN, width=2)
        canvas = Image.alpha_composite(canvas, overlay)

        self._paste_stage_crop(
            canvas,
            labyrinth_stage,
            src_center=(640.0, 540.0),
            dst_center=(x0 + pw * 0.5, y0 + hdr_h + ph * 0.52),
            scale=s_pip,
            clip_rect=(x0 + 3, y0 + hdr_h, x1 - 3, y1 - 3),
        )

        overlay2 = Image.new("RGBA", (self.width, self.height), (0, 0, 0, 0))
        draw2 = ImageDraw.Draw(overlay2)

        # Highlight particles inside the PiP inset
        self._draw_labyrinth_highlights(draw2, frame_meta, in_main=False, alpha=1.0)

        # PiP Header strip & border
        draw_rounded_box(draw2, (x0, y0, x1, y0 + hdr_h), radius=10, fill=PANEL)
        draw2.line([(x0, y0 + hdr_h), (x1, y0 + hdr_h)], fill=PANEL_BORDER, width=1)
        draw_rounded_box(draw2, (x0, y0, x1, y1), radius=12, fill=(0, 0, 0, 0), outline=CYAN, width=2)
        draw2.text((x0 + 16, y0 + 8), "RIGHT INNER EAR · LIVE POSE", font=self.f_pip_hdr, fill=CYAN)

        # Dynamic leader line from patient's Right Ear Locator Ring to the PiP Inset
        ear_src = frame_meta.get("patient_right_ear_2d")
        if ear_src:
            ex, ey = self.map_patient_pt_to_main((ear_src[0], ear_src[1]))
            pip_anchor = (float(x0), float(y0 + hdr_h + ph * 0.45))
            draw2.line([(ex, ey), pip_anchor], fill=with_alpha(CYAN, 0.25), width=5)
            draw2.line([(ex, ey), pip_anchor], fill=with_alpha(CYAN, 0.78), width=2)
            draw2.ellipse((ex - 6, ey - 6, ex + 6, ey + 6), outline=CYAN, width=2)

        return Image.alpha_composite(canvas, overlay2)

    def _build_labyrinth_dominant_layer(self, raw_img: Image.Image, frame_meta: Dict) -> Image.Image:
        """
        Build the `1920 x 1080` viewport canvas for the **Labyrinth-Dominant** layout:
          - Main Viewport (`y = 84..895`): Gate 3 IE-Map Right Labyrinth Close-Up + `GRAVITY` arrow + particle rings.
          - Top-Left PiP Inset (`52, 114, 552, 424`): 3/4 External Patient Hold Pose (`PATIENT POSE · HOLD 30–60 s`).
        """
        bg_px = raw_img.getpixel((4, 4))
        bg_col = (bg_px[0], bg_px[1], bg_px[2], 255)
        canvas = Image.new("RGBA", (self.width, self.height), bg_col)
        patient_stage = raw_img.crop((0, 0, 1280, 1080))
        labyrinth_stage = raw_img.crop((1280, 0, 2560, 1080))

        # 1. Paste Gate 3 Right Labyrinth Close-Up into Main Viewport
        self._paste_stage_crop(
            canvas,
            labyrinth_stage,
            src_center=(640.0, 540.0),
            dst_center=self.lab_main_center,
            scale=self.lab_main_scale,
            clip_rect=(0, 84, self.width, 895),
        )

        # 2. Paste 3/4 Patient Stage into Top-Left PiP Inset
        x0, y0, x1, y1 = self.pip_left_rect
        hdr_h = 34
        pw = x1 - x0
        ph = (y1 - y0) - hdr_h
        s_pip = min(pw / 1080.0, ph / 760.0)

        overlay = Image.new("RGBA", (self.width, self.height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        draw_rounded_box(draw, (x0, y0, x1, y1), radius=12, fill=bg_col, outline=CYAN, width=2)
        canvas = Image.alpha_composite(canvas, overlay)

        self._paste_stage_crop(
            canvas,
            patient_stage,
            src_center=(640.0, 540.0),
            dst_center=(x0 + pw * 0.5, y0 + hdr_h + ph * 0.54),
            scale=s_pip,
            clip_rect=(x0 + 3, y0 + hdr_h, x1 - 3, y1 - 3),
        )

        overlay2 = Image.new("RGBA", (self.width, self.height), (0, 0, 0, 0))
        draw2 = ImageDraw.Draw(overlay2)

        # Highlight particles & compact Gravity arrow in Main Viewport
        self._draw_labyrinth_highlights(draw2, frame_meta, in_main=True, alpha=1.0)

        # PiP Header strip & border
        step_id = frame_meta.get("step_id", "")
        pip_title = (
            "PATIENT POSE · HOLD 30–60 s"
            if step_id in {"step2", "step3", "step4"}
            else ("PATIENT POSE · UPRIGHT" if step_id == "step5" else "HEAD CONTEXT · RIGHT EAR")
        )
        draw_rounded_box(draw2, (x0, y0, x1, y0 + hdr_h), radius=10, fill=PANEL)
        draw2.line([(x0, y0 + hdr_h), (x1, y0 + hdr_h)], fill=PANEL_BORDER, width=1)
        draw_rounded_box(draw2, (x0, y0, x1, y1), radius=12, fill=(0, 0, 0, 0), outline=CYAN, width=2)
        draw2.text((x0 + 16, y0 + 8), pip_title, font=self.f_pip_hdr, fill=CYAN)

        return Image.alpha_composite(canvas, overlay2)

    def _draw_staged_labels(self, draw: ImageDraw.ImageDraw, frame_meta: Dict):
        """
        Render at most 1–2 temporally staged pill callouts for the current shot & sub-phase,
        guaranteeing zero crossed leader lines and generous reading time.
        """
        step_id = frame_meta.get("step_id", "locate")
        u = float(frame_meta.get("scene_progress", 0.5))

        landmarks_src = frame_meta.get("landmarks_2d", {})
        otoconia_src = frame_meta.get("otoconia_center_2d", [1920.0, 540.0])
        ear_src = frame_meta.get("patient_right_ear_2d", [640.0, 420.0])
        emb_ear_src = frame_meta.get("patient_embedded_ear_2d", ear_src)
        nose_src = frame_meta.get("patient_nose_tip_2d", [680.0, 430.0])
        pillow_src = frame_meta.get("pillow_2d", [540.0, 620.0])

        def lab_main(key: str) -> Tuple[float, float]:
            pt = landmarks_src.get(key, [1920.0, 540.0])
            return self.map_labyrinth_pt_to_main((pt[0], pt[1]))

        oto_main = self.map_labyrinth_pt_to_main((otoconia_src[0], otoconia_src[1]))
        ear_main = self.map_patient_pt_to_main((ear_src[0], ear_src[1]))
        emb_ear_main = self.map_patient_pt_to_main((emb_ear_src[0], emb_ear_src[1]))
        nose_main = self.map_patient_pt_to_main((nose_src[0], nose_src[1]))
        pillow_main = self.map_patient_pt_to_main((pillow_src[0], pillow_src[1]))

        if step_id == "locate":
            # First half (0..0.52): Semi-transparent head cutaway in Main Viewport
            a1 = window_alpha(u, 0.04, 0.48, fade=0.06)
            if a1 > 0.02:
                self._draw_pill_callout(
                    draw,
                    "Right Inner Ear Labyrinth",
                    "Embedded inside right temporal bone",
                    emb_ear_main,
                    (emb_ear_main[0] - 260.0, emb_ear_main[1] - 95.0),
                    WARM,
                    alpha=a1,
                )
            # Second half (0.52..0.98): Gate 3 Labyrinth Close-Up in Main Viewport
            a2 = window_alpha(u, 0.54, 0.96, fade=0.06)
            if a2 > 0.02:
                sp_xy = lab_main("posterior_duct")
                ut_xy = lab_main("utricle")
                self._draw_pill_callout(
                    draw,
                    "Posterior Semicircular Canal",
                    "Target canal in right-ear BPPV",
                    sp_xy,
                    (sp_xy[0] - 265.0, max(455.0, sp_xy[1] - 35.0)),
                    CYAN,
                    alpha=a2,
                )
                self._draw_pill_callout(
                    draw,
                    "Utricle",
                    "Destination vestibule",
                    ut_xy,
                    (ut_xy[0] + 250.0, min(800.0, ut_xy[1] + 95.0)),
                    SAGE,
                    alpha=a2,
                )

        elif step_id == "intro":
            # Shot 2: Pathology close-up of the right labyrinth
            a1 = window_alpha(u, 0.04, 0.52, fade=0.06)
            if a1 > 0.02:
                ap_xy = lab_main("posterior_ampulla")
                self._draw_pill_callout(
                    draw,
                    "Displaced Otoconia (Canaliths)",
                    "Settled at lowest point of canal",
                    oto_main,
                    (oto_main[0] - 275.0, min(815.0, oto_main[1] + 55.0)),
                    WARM,
                    alpha=a1,
                )
                self._draw_pill_callout(
                    draw,
                    "Posterior Ampulla",
                    "Cupula sensory receptor base",
                    ap_xy,
                    (ap_xy[0] + 265.0, min(815.0, ap_xy[1] + 70.0)),
                    WARM,
                    alpha=a1,
                )
            a2 = window_alpha(u, 0.54, 0.96, fade=0.06)
            if a2 > 0.02:
                sp_xy = lab_main("posterior_duct")
                cc_xy = lab_main("common_crus")
                self._draw_pill_callout(
                    draw,
                    "Posterior Semicircular Canal",
                    "Active migration pathway",
                    sp_xy,
                    (sp_xy[0] - 265.0, max(455.0, sp_xy[1] - 35.0)),
                    CYAN,
                    alpha=a2,
                )
                self._draw_pill_callout(
                    draw,
                    "Common Crus → Utricle",
                    "Exit channel back to utricle",
                    cc_xy,
                    (cc_xy[0] + 255.0, max(165.0, cc_xy[1] - 75.0)),
                    LAVENDER,
                    alpha=a2,
                )

        elif step_id == "step1":
            # Step 1: 45 deg Right Head Turn
            a1 = window_alpha(u, 0.04, 0.52, fade=0.06)
            if a1 > 0.02:
                self._draw_pill_callout(
                    draw,
                    "Turn Head 45° Right",
                    "Toward affected right ear",
                    ear_main,
                    (ear_main[0] - 245.0, max(160.0, ear_main[1] - 90.0)),
                    CYAN,
                    alpha=a1,
                )
                self._draw_pill_callout(
                    draw,
                    "Shoulder Pillow",
                    "Placed behind upper back",
                    pillow_main,
                    (pillow_main[0] - 210.0, min(815.0, pillow_main[1] + 95.0)),
                    CYAN,
                    alpha=a1,
                )
            a2 = window_alpha(u, 0.56, 0.96, fade=0.06)
            if a2 > 0.02:
                sp_xy = lab_main("posterior_duct")
                self._draw_pill_callout(
                    draw,
                    "Posterior Canal Aligned",
                    "Coplanar with upcoming recline",
                    sp_xy,
                    (sp_xy[0] - 265.0, max(465.0, sp_xy[1] - 35.0)),
                    CYAN,
                    alpha=a2,
                )
                self._draw_pill_callout(
                    draw,
                    "Otoconia Near Ampulla",
                    "Ready for gravity-driven sweep",
                    oto_main,
                    (oto_main[0] - 255.0, min(820.0, oto_main[1] + 65.0)),
                    WARM,
                    alpha=a2,
                )

        elif step_id == "step2":
            # Step 2: Recline to Supine with 20-30 deg Neck Extension
            a1 = window_alpha(u, 0.03, 0.40, fade=0.05)
            if a1 > 0.02:
                pil_target = (pillow_main[0] - 42.0, pillow_main[1] + 22.0)
                self._draw_pill_callout(
                    draw,
                    "20–30° Neck Extension",
                    "Shoulders rest on pillow",
                    pil_target,
                    (pil_target[0] - 180.0, min(800.0, pil_target[1] + 100.0)),
                    WARM,
                    alpha=a1,
                )
                self._draw_pill_callout(
                    draw,
                    "Maintain 45° Right Turn",
                    "Keep right ear down while reclining",
                    ear_main,
                    (ear_main[0] - 205.0, max(160.0, ear_main[1] - 135.0)),
                    CYAN,
                    alpha=a1,
                )
            a2 = window_alpha(u, 0.44, 0.96, fade=0.06)
            if a2 > 0.02:
                ap_xy = lab_main("posterior_ampulla")
                self._draw_pill_callout(
                    draw,
                    "Otoconia Migrate Along Canal",
                    "Pulled away from ampulla by gravity",
                    oto_main,
                    (oto_main[0] - 280.0, min(815.0, oto_main[1] + 65.0)),
                    WARM,
                    alpha=a2,
                )
                self._draw_pill_callout(
                    draw,
                    "Posterior Ampulla",
                    "Particles moving ampullofugally",
                    ap_xy,
                    (ap_xy[0] + 255.0, max(180.0, ap_xy[1] - 60.0)),
                    MUTED,
                    alpha=a2,
                )

        elif step_id == "step3":
            # Step 3: 90 deg Contralateral Left Turn (Facing 45 deg Left)
            a1 = window_alpha(u, 0.03, 0.40, fade=0.05)
            if a1 > 0.02:
                pil_target = (pillow_main[0] - 42.0, pillow_main[1] + 22.0)
                self._draw_pill_callout(
                    draw,
                    "Rotate Head 90° Left",
                    "Now facing 45° left (keep extension)",
                    nose_main,
                    (nose_main[0] - 190.0, max(160.0, nose_main[1] - 135.0)),
                    CYAN,
                    alpha=a1,
                )
                self._draw_pill_callout(
                    draw,
                    "Do Not Lift Head",
                    "Keep shoulders on pillow",
                    pil_target,
                    (pil_target[0] - 180.0, min(800.0, pil_target[1] + 100.0)),
                    WARM,
                    alpha=a1,
                )
            a2 = window_alpha(u, 0.44, 0.96, fade=0.06)
            if a2 > 0.02:
                cc_xy = lab_main("common_crus")
                self._draw_pill_callout(
                    draw,
                    "Otoconia Enter Common Crus",
                    "Guided over superior canal arch",
                    oto_main,
                    (oto_main[0] - 280.0, max(465.0, oto_main[1] - 65.0)),
                    WARM,
                    alpha=a2,
                )
                self._draw_pill_callout(
                    draw,
                    "Common Crus",
                    "Shared vertical drainage limb",
                    cc_xy,
                    (cc_xy[0] + 255.0, min(815.0, cc_xy[1] + 75.0)),
                    LAVENDER,
                    alpha=a2,
                )

        elif step_id == "step4":
            # Step 4: Roll Onto Left Shoulder, Nose 45 deg Down
            a1 = window_alpha(u, 0.03, 0.40, fade=0.05)
            if a1 > 0.02:
                self._draw_pill_callout(
                    draw,
                    "Roll Onto Left Shoulder",
                    "Turn head 90° left (nose 45° down)",
                    ear_main,
                    (ear_main[0] - 210.0, max(160.0, ear_main[1] - 125.0)),
                    WARM,
                    alpha=a1,
                )
            a2 = window_alpha(u, 0.44, 0.96, fade=0.06)
            if a2 > 0.02:
                ut_xy = lab_main("utricle")
                self._draw_pill_callout(
                    draw,
                    "Otoconia Drain Down Common Crus",
                    "Steep downward alignment with gravity",
                    oto_main,
                    (oto_main[0] - 285.0, min(815.0, oto_main[1] + 65.0)),
                    WARM,
                    alpha=a2,
                )
                self._draw_pill_callout(
                    draw,
                    "Utricle Opening",
                    "Exit at base of common crus",
                    ut_xy,
                    (ut_xy[0] + 250.0, max(260.0, ut_xy[1] - 70.0)),
                    SAGE,
                    alpha=a2,
                )

        elif step_id == "step5":
            # Step 5: Return Slowly to Upright Sitting
            a1 = window_alpha(u, 0.03, 0.40, fade=0.05)
            if a1 > 0.02:
                self._draw_pill_callout(
                    draw,
                    "Return Slowly Upright",
                    "Keep chin slightly tucked",
                    ear_main,
                    (ear_main[0] - 240.0, max(165.0, ear_main[1] - 90.0)),
                    CYAN,
                    alpha=a1,
                )
            a2 = window_alpha(u, 0.44, 0.98, fade=0.05)
            if a2 > 0.02:
                ut_xy = lab_main("utricle")
                self._draw_pill_callout(
                    draw,
                    "Otoconia Repositioned → Maneuver Complete",
                    "Particles settled inside utricle",
                    oto_main,
                    (oto_main[0] - 295.0, min(815.0, oto_main[1] + 80.0)),
                    WARM,
                    alpha=a2,
                )
                self._draw_pill_callout(
                    draw,
                    "Utricle",
                    "Canal cleared of loose otoconia",
                    ut_xy,
                    (ut_xy[0] + 245.0, max(220.0, ut_xy[1] - 85.0)),
                    SAGE,
                    alpha=a2,
                )

        elif step_id == "outro":
            # Shot 8: Clean 3-Point Clinical Execution Summary Card on the right half
            self._draw_summary_card(draw, alpha=window_alpha(u, 0.02, 0.98, fade=0.04))

    def _draw_summary_card(self, draw: ImageDraw.ImageDraw, alpha: float = 1.0):
        if alpha <= 0.02:
            return
        x0, y0, x1, y1 = (1020, 140, 1856, 835)
        draw_rounded_box(
            draw,
            (x0, y0, x1, y1),
            radius=16,
            fill=with_alpha(PANEL_TRANSLUCENT, 0.95 * alpha),
            outline=with_alpha(CYAN, 0.85 * alpha),
            width=2,
        )
        draw_rounded_box(
            draw,
            (x0 + 24, y0 + 24, x0 + 32, y0 + 68),
            radius=3,
            fill=with_alpha(CYAN, alpha),
        )
        draw.text(
            (x0 + 48, y0 + 28),
            "KEY CLINICAL CHECKPOINTS — RIGHT EPLEY MANEUVER",
            font=self.f_card_title,
            fill=with_alpha(WHITE, alpha),
        )

        pearls = [
            (
                "1. Shoulder Pillow Placement (Step 1 & 2)",
                "Position the pillow under the upper back so the head extends 20–30° below horizontal when supine.",
                CYAN,
            ),
            (
                "2. Pure Axial Rotation Without Lifting (Step 3)",
                "Rotate the head 90° left to face 45° left while keeping full neck extension; raising the head allows particles to fall backward.",
                WARM,
            ),
            (
                "3. Full 30–60 s Settling Holds (Steps 2, 3 & 4)",
                "Hold each position for 30–60 seconds (until positional vertigo subsides) so otoconia reach each gravitational low point.",
                SAGE,
            ),
            (
                "4. Controlled Return to Upright Sitting (Step 5)",
                "Keep the chin slightly tucked while sitting up and steady the patient upright for 1–2 minutes.",
                LAVENDER,
            ),
        ]

        cy = y0 + 96
        for title, body, col in pearls:
            draw_rounded_box(
                draw,
                (x0 + 28, cy, x1 - 28, cy + 132),
                radius=12,
                fill=with_alpha((14, 22, 26, 240), alpha),
                outline=with_alpha(col, 0.65 * alpha),
                width=1,
            )
            draw_rounded_box(
                draw,
                (x0 + 40, cy + 16, x0 + 46, cy + 116),
                radius=2,
                fill=with_alpha(col, alpha),
            )
            draw.text((x0 + 62, cy + 18), title, font=self.f_pill_bold, fill=with_alpha(WHITE, alpha))
            # Wrap body text cleanly
            words = body.split()
            lines = []
            cur = ""
            for w in words:
                test = f"{cur} {w}".strip()
                if draw.textbbox((0, 0), test, font=self.f_card_body)[2] <= (x1 - x0 - 110):
                    cur = test
                else:
                    lines.append(cur)
                    cur = w
            if cur:
                lines.append(cur)
            for idx_l, ln in enumerate(lines[:2]):
                draw.text((x0 + 62, cy + 54 + idx_l * 26), ln, font=self.f_card_body, fill=with_alpha(MUTED, alpha))
            cy += 148

    def _draw_top_bar_and_lower_third(self, draw: ImageDraw.ImageDraw, frame_meta: Dict):
        # 1. Gate 3 Top Bar (`y = 0..84`)
        draw.rectangle((0, 0, self.width, 84), fill=PANEL)
        draw.line([(0, 84), (self.width, 84)], fill=PANEL_BORDER, width=2)

        brand_txt = "MEDAIUM / EPLEY MANEUVER"
        draw.text((56, 30), brand_txt, font=self.f_top_brand, fill=CYAN)
        bw = draw.textbbox((0, 0), brand_txt, font=self.f_top_brand)[2]
        draw.text((56 + bw + 18, 31), "·   RIGHT POSTERIOR-CANAL BPPV", font=self.f_top_sub, fill=MUTED)

        # Active step badge on the right of the Top Bar
        step_badge = frame_meta.get("step_badge", "STEP 1 OF 5")
        tb_b = draw.textbbox((0, 0), step_badge, font=self.f_step_badge)
        bw_b = tb_b[2] - tb_b[0]
        bx0 = self.width - 56 - bw_b - 36
        bx1 = self.width - 56
        draw_rounded_box(
            draw,
            (bx0, 20, bx1, 64),
            radius=10,
            fill=(14, 22, 26, 255),
            outline=CYAN,
            width=2,
        )
        draw.text((bx0 + 18, 33), step_badge, font=self.f_step_badge, fill=WHITE)

        # 2. Gate 3 Editorial Lower-Third (`y = 895..1080`, `185 px`)
        draw.rectangle((0, 895, self.width, self.height), fill=PANEL)
        draw.line([(0, 895), (self.width, 895)], fill=PANEL_BORDER, width=2)

        # Left 12px Medaium Cyan vertical accent bar
        draw_rounded_box(draw, (56, 922, 68, 1028), radius=3, fill=CYAN)

        headline = frame_meta.get("headline", "")
        support = frame_meta.get("support", "")

        h_font = self.f_headline
        if draw.textbbox((0, 0), headline, font=h_font)[2] > 1520:
            h_font = self.f_headline_med
        draw.text((92, 922), headline, font=h_font, fill=WHITE)

        s_font = self.f_support
        if draw.textbbox((0, 0), support, font=s_font)[2] > 1540:
            s_font = self.f_support_med
        draw.text((92, 974), support, font=s_font, fill=MUTED)

        # Timecode on right side of lower-third
        t_sec = float(frame_meta.get("time_sec", 0.0))
        tot_sec = float(frame_meta.get("total_duration_sec", 110.2))
        m_cur, s_cur = int(t_sec) // 60, int(t_sec) % 60
        m_tot, s_tot = int(tot_sec) // 60, int(tot_sec) % 60
        tc_str = f"{m_cur:02d}:{s_cur:02d} / {m_tot:02d}:{s_tot:02d}"
        tb_tc = draw.textbbox((0, 0), tc_str, font=self.f_timecode)
        tw_tc = tb_tc[2] - tb_tc[0]
        draw.text((self.width - 56 - tw_tc, 928), tc_str, font=self.f_timecode, fill=MUTED)

        # Thin Chapter Progress Line (`y = 1046..1052`) with 8 shot ticks
        px0 = 92
        px1 = self.width - 56
        py_bar = 1048
        draw_rounded_box(draw, (px0, py_bar, px1, py_bar + 6), radius=3, fill=(12, 18, 22, 255))
        prog = max(0.0, min(1.0, t_sec / max(1e-3, tot_sec)))
        px_cur = int(round(px0 + (px1 - px0) * prog))
        if px_cur > px0 + 4:
            draw_rounded_box(draw, (px0, py_bar, px_cur, py_bar + 6), radius=3, fill=CYAN)

        for tick_frac in frame_meta.get("shot_tick_fracs", []):
            tx = int(round(px0 + (px1 - px0) * float(tick_frac)))
            draw.line([(tx, py_bar - 4), (tx, py_bar + 10)], fill=PANEL_BORDER, width=2)

    def compose_frame(
        self,
        base_image_path: Path,
        output_path: Path,
        frame_meta: Dict,
    ):
        """
        Composite a single `1920 x 1080` Gate 3 video frame from the `2560 x 1080` dual-stage Blender render.
        """
        raw_img = Image.open(base_image_path).convert("RGBA")
        if raw_img.size != (2560, 1080):
            raw_img = raw_img.resize((2560, 1080), Image.Resampling.LANCZOS)

        blend = float(np.clip(frame_meta.get("role_swap_blend", 0.0), 0.0, 1.0))
        if blend <= 0.005:
            viewport_img = self._build_patient_dominant_layer(raw_img, frame_meta)
        elif blend >= 0.995:
            viewport_img = self._build_labyrinth_dominant_layer(raw_img, frame_meta)
        else:
            pat_layer = self._build_patient_dominant_layer(raw_img, frame_meta)
            lab_layer = self._build_labyrinth_dominant_layer(raw_img, frame_meta)
            viewport_img = Image.blend(pat_layer, lab_layer, blend)

        ui_overlay = Image.new("RGBA", (self.width, self.height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(ui_overlay)

        # Temporally staged pill labels (1–2 max)
        self._draw_staged_labels(draw, frame_meta)

        # Gate 3 Top Bar & Editorial Lower-Third
        self._draw_top_bar_and_lower_third(draw, frame_meta)

        final_img = Image.alpha_composite(viewport_img, ui_overlay).convert("RGB")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        final_img.save(output_path, format="PNG", compress_level=1)
