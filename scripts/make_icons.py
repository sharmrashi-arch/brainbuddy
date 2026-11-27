"""Generate PWA icons and the OG image from the app logo (frontend/assets/logo.png)."""
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BASE = Path(__file__).resolve().parent.parent
ASSETS = BASE / "frontend" / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)

TEAL = (15, 118, 110)
WHITE = (255, 255, 255)
DARK = (17, 24, 39)
MUTED = (75, 85, 99)
WINFONTS = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts"


def font(size, bold=True):
    names = ["arialbd.ttf", "segoeuib.ttf", "DejaVuSans-Bold.ttf", "arial.ttf"] if bold else \
            ["arial.ttf", "segoeui.ttf", "DejaVuSans.ttf"]
    for n in names:
        p = WINFONTS / n
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size)
            except Exception:
                pass
    return ImageFont.load_default()


def load_logo():
    candidates = [
        ASSETS / "logo.png",
        Path(os.environ.get("USERPROFILE", "")) / "Downloads" / "logo image.png",
    ]
    for cand in candidates:
        try:
            if cand.exists():
                return Image.open(cand).convert("RGB")
        except Exception:
            pass
    return None


def make_icon(size, logo):
    if logo is not None:
        return logo.resize((size, size), Image.LANCZOS)
    img = Image.new("RGB", (size, size), TEAL)
    d = ImageDraw.Draw(img)
    f = font(int(size * 0.6))
    bb = d.textbbox((0, 0), "B", font=f)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    d.text(((size - w) / 2 - bb[0], (size - h) / 2 - bb[1]), "B", fill=WHITE, font=f)
    return img


def main():
    logo = load_logo()
    for s in (192, 512):
        make_icon(s, logo).save(ASSETS / ("icon-%d.png" % s))
    make_icon(180, logo).save(ASSETS / "apple-touch-icon.png")
    make_icon(32, logo).save(ASSETS / "favicon-32.png")

    W, H = 1200, 630
    og = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(og)
    d.rectangle([0, 0, 18, H], fill=TEAL)
    og.paste(make_icon(150, logo), (80, 80))
    d.text((265, 72), "BrainBuddy", fill=DARK, font=font(74))
    d.text((268, 165), "Har Sawal ka Jawab", fill=TEAL, font=font(40))
    d.line([(80, 300), (1120, 300)], fill=(229, 231, 235), width=2)
    d.text((80, 340), "AI assistant for everything:", fill=DARK, font=font(30, bold=True))
    d.text((80, 392), "Studies - Work - Writing - Maths - Photos - 100+ languages", fill=MUTED, font=font(26, bold=False))
    d.text((80, 438), "Notes - Presentations - PDF/Word/PPT - Voice - Chat history", fill=MUTED, font=font(26, bold=False))
    d.text((80, 540), "brainbuddy", fill=TEAL, font=font(24, bold=True))
    og.save(ASSETS / "og-image.png")
    print("Icons + OG written to", ASSETS)


if __name__ == "__main__":
    main()