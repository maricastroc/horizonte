"""
Gera as capas reais do catálogo Horizonte como arquivos de imagem (1024px WebP).

Não é a "arte gerada" do protótipo: aqui cada capa é uma composição autoral,
assada uma vez em disco. O runtime carrega o arquivo e aplica só o tratamento
de unificação (dessaturar ~8%, overprint da tinta, grão comum).

Estrutura pensada para o anel: as COLUNAS da capa viram fatias angulares e o
eixo vertical vira raio — por isso as composições têm estrutura vertical forte.

    python3 scripts/gen-covers.py
"""
import math
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 1024
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "covers")

VOID = (10, 9, 16)
PAPER = (237, 231, 220)


def ink(rgb, a=1.0):
    return (int(rgb[0] * 255), int(rgb[1] * 255), int(rgb[2] * 255), int(a * 255))


def base(color=VOID):
    return Image.new("RGB", (S, S), color)


def layer():
    return Image.new("RGBA", (S, S), (0, 0, 0, 0))


def paste(img, lyr):
    img.paste(lyr, (0, 0), lyr)


def vgrad(c0, c1, angle=0.0):
    """Gradiente linear em `angle` radianos, retornado como RGBA."""
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) / S
    t = xx * math.cos(angle) + yy * math.sin(angle)
    t = (t - t.min()) / (t.max() - t.min())
    out = np.zeros((S, S, 4), np.float32)
    for i in range(4):
        out[..., i] = c0[i] + (c1[i] - c0[i]) * t
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def grain(img, amount=14.0, seed=0):
    rng = np.random.default_rng(seed)
    a = np.asarray(img, np.float32)
    n = rng.normal(0.0, amount, (S, S, 1))
    a = np.clip(a + n, 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGB")


def vignette(img, strength=0.42):
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) / S
    d = np.hypot(xx - 0.5, yy - 0.5) / 0.707
    m = np.clip(1.0 - (d ** 2.2) * strength, 0, 1)[..., None]
    a = np.asarray(img, np.float32) * m
    return Image.fromarray(a.astype(np.uint8), "RGB")


def bands(d, colors, ys, alpha=200):
    for (y0, y1), c in zip(ys, colors):
        d.rectangle([-10, int(y0 * S), S + 10, int(y1 * S)], fill=c[:3] + (alpha,))


# ---------------------------------------------------------------- composições

def orova(A, B):
    """OROVA — Densidade. Massa que ocupa. Bloco pesado, horizonte comprimido."""
    img = base()
    g = vgrad(ink(B, 0.0) , ink(B, 0.85), angle=1.25)
    paste(img, g)
    l = layer()
    d = ImageDraw.Draw(l)
    d.polygon([(0, S * 0.18), (S, 0), (S, S * 0.70), (0, S * 0.88)], fill=ink(B, 0.95))
    d.rectangle([S * 0.06, S * 0.22, S * 0.66, S * 0.80], fill=ink(A, 1.0))
    d.ellipse([S * 0.44, S * 0.30, S * 0.92, S * 0.78], fill=VOID + (255,))
    paste(img, l)
    l2 = layer()
    d2 = ImageDraw.Draw(l2)
    d2.rectangle([0, S * 0.755, S, S * 0.808], fill=PAPER + (235,))
    for i, x in enumerate((0.12, 0.30, 0.47, 0.71, 0.86)):
        w = S * (0.014 + 0.010 * ((i * 7) % 3))
        d2.rectangle([S * x, S * 0.22, S * x + w, S * 0.755], fill=VOID + (150,))
    paste(img, l2)
    return img


def mira(A, B):
    """MIRA SELVA — Queda Livre. Verticais em queda, corte diagonal."""
    img = base()
    paste(img, vgrad(ink(A, 0.10), ink(A, 0.62), angle=1.9))
    l = layer()
    d = ImageDraw.Draw(l)
    for i in range(11):
        x = S * (0.02 + i * 0.092)
        h = S * (0.30 + ((i * 13) % 7) * 0.085)
        y0 = S * (0.06 + ((i * 5) % 4) * 0.06)
        col = ink(A, 0.95) if i % 3 else ink(B, 0.95)
        d.rectangle([x, y0, x + S * 0.052, y0 + h], fill=col)
    paste(img, l)
    l2 = layer()
    d2 = ImageDraw.Draw(l2)
    d2.polygon([(0, S * 0.96), (S, S * 0.58), (S, S), (0, S)], fill=VOID + (250,))
    d2.polygon([(0, S * 0.92), (S, S * 0.54), (S, S * 0.60), (0, S * 0.98)], fill=ink(B, 0.9))
    d2.rectangle([0, S * 0.20, S, S * 0.245], fill=PAPER + (225,))
    paste(img, l2)
    return img


def terra(A, B):
    """TERRA NULA — Marés Internas. Faixas de maré, deslocamento lateral."""
    img = base()
    paste(img, vgrad(ink(B, 0.75), ink(B, 0.05), angle=1.57))
    l = layer()
    d = ImageDraw.Draw(l)
    ys = [(0.10, 0.20), (0.235, 0.28), (0.33, 0.47), (0.52, 0.545), (0.60, 0.72), (0.775, 0.80)]
    cols = [ink(A, 0.95), PAPER + (220,), ink(A, 1.0), ink(B, 0.95), VOID + (240,), PAPER + (200,)]
    bands(d, cols, ys, alpha=255)
    paste(img, l)
    l2 = layer()
    d2 = ImageDraw.Draw(l2)
    # deslocamento de maré: metade direita empurrada
    d2.rectangle([S * 0.58, 0, S, S], fill=(0, 0, 0, 0))
    paste(img, l2)
    right = img.crop((int(S * 0.58), 0, S, S)).transform(
        (S - int(S * 0.58), S), Image.AFFINE, (1, 0, 0, 0, 1, -S * 0.055)
    )
    img.paste(right, (int(S * 0.58), 0))
    l3 = layer()
    d3 = ImageDraw.Draw(l3)
    d3.ellipse([S * 0.62, S * 0.60, S * 0.99, S * 0.97], fill=VOID + (255,))
    d3.rectangle([S * 0.575, 0, S * 0.585, S], fill=PAPER + (120,))
    paste(img, l3)
    return img


def nucleo(A, B):
    """NÚCLEO 9 — Silêncio Sólido. Um bloco. Prensa. Vazio no centro."""
    img = base()
    paste(img, vgrad(ink(B, 0.55), ink(B, 0.0), angle=0.6))
    l = layer()
    d = ImageDraw.Draw(l)
    d.rectangle([S * 0.14, S * 0.10, S * 0.86, S * 0.90], fill=ink(A, 1.0))
    d.rectangle([S * 0.32, S * 0.30, S * 0.68, S * 0.70], fill=VOID + (255,))
    for i in range(9):
        x = S * (0.14 + i * 0.0805)
        d.rectangle([x, S * 0.10, x + S * 0.006, S * 0.90], fill=VOID + (110,))
    paste(img, l)
    l2 = layer()
    d2 = ImageDraw.Draw(l2)
    d2.rectangle([0, S * 0.455, S, S * 0.495], fill=PAPER + (240,))
    d2.rectangle([0, S * 0.86, S, S * 0.875], fill=ink(B, 0.9))
    paste(img, l2)
    return img


def alma(A, B):
    """ALMA CRUA — Ferro Doce. Chapa, rebite, oxidação."""
    img = base()
    paste(img, vgrad(ink(A, 0.70), ink(A, 0.10), angle=2.4))
    l = layer()
    d = ImageDraw.Draw(l)
    d.polygon([(0, S * 0.30), (S, S * 0.12), (S, S * 0.58), (0, S * 0.74)], fill=ink(B, 0.92))
    d.rectangle([S * 0.20, S * 0.36, S * 0.55, S * 0.99], fill=VOID + (245,))
    paste(img, l)
    l2 = layer()
    d2 = ImageDraw.Draw(l2)
    for i in range(14):
        cx = S * (0.06 + i * 0.068)
        cy = S * (0.66 + 0.055 * math.sin(i * 1.1))
        r = S * 0.011
        d2.ellipse([cx - r, cy - r, cx + r, cy + r], fill=PAPER + (215,))
    d2.rectangle([0, S * 0.235, S, S * 0.268], fill=PAPER + (225,))
    d2.rectangle([S * 0.62, 0, S * 0.655, S], fill=ink(A, 0.85))
    paste(img, l2)
    return img


ALBUMS = [
    ("a-001", orova, (0.96, 0.53, 0.25), (0.29, 0.55, 0.72), 7),
    ("b-014", mira, (0.55, 0.78, 0.60), (0.86, 0.36, 0.42), 31),
    ("c-028", terra, (0.92, 0.72, 0.30), (0.36, 0.40, 0.66), 91),
    ("d-037", nucleo, (0.88, 0.42, 0.62), (0.30, 0.62, 0.64), 53),
    ("e-052", alma, (0.82, 0.50, 0.34), (0.52, 0.58, 0.44), 17),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, fn, A, B, seed in ALBUMS:
        img = fn(A, B)
        img = img.filter(ImageFilter.GaussianBlur(0.4))
        img = vignette(img)
        img = grain(img, 9.0, seed)
        path = os.path.abspath(os.path.join(OUT, f"{name}.webp"))
        img.save(path, "WEBP", quality=82, method=6)
        print(f"{path}  {os.path.getsize(path)/1024:.0f} KB")


if __name__ == "__main__":
    main()
