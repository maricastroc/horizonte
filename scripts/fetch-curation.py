"""
Monta a Curadoria Horizonte a partir de obras licenciadas em CC BY 4.0.

O que faz, por álbum:
  1. lê os metadados do Internet Archive e ABORTA se a licença não for CC BY 4.0;
  2. baixa capa e faixas originais;
  3. recorta a capa em quadrado 1024 WebP;
  4. extrai duas cores dominantes e as força para oklch(L .50–.62, C .13–.18),
     como o handoff exige ao trocar por catálogo real;
  5. transcodifica o áudio para AAC (permitido por CC BY, que autoriza adaptação);
  6. gera src/components/horizonte/content/curation.generated.ts.

Rodar de novo é idempotente — os assets não precisam ser versionados.

    python3 scripts/fetch-curation.py [--force]
"""
import argparse
import json
import math
import os
import re
import subprocess
import sys
import unicodedata
import urllib.parse

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MUSIC = os.path.join(ROOT, "public", "music")
CACHE = os.path.join(ROOT, ".cache", "curation")
OUT_TS = os.path.join(ROOT, "src", "components", "horizonte", "content", "curation.generated.ts")

CC_BY_4 = "http://creativecommons.org/licenses/by/4.0/"
BITRATE = 96000
COVER_PX = 1024

# Curadoria. `cat` é o índice da coleção Horizonte; o número de catálogo da
# edição original fica registrado em `originalCat`.
CURATION = [
    dict(
        identifier="tranz060TaleTwist-WryWay",
        slug="tale-twist-wry-way",
        cat="H—001",
        original_cat="TRANZ060",
        artist="Tale Twist",
        title="Wry Way",
        year="2016",
        label="Tranzmitter Netlabel",
        cover="01.tranz060CoverFront.jpg",
        strip=r"^\s*\d+\.\s*Tale Twist\s*-\s*",
    ),
    dict(
        identifier="Meho-Mkultracz015",
        slug="meho-mkultra",
        cat="H—002",
        original_cat="cz015",
        artist="Meho",
        title="MKUltra",
        year="2015",
        label="Cezanne Records",
        cover="CoverMkultra.jpg",
        strip=None,
    ),
    dict(
        identifier="Session17-20jajceSessionscz012",
        slug="mescaline-sessions-jajce",
        cat="H—003",
        original_cat="cz012",
        artist="Mescaline Sessions",
        title="Jajce Sessions",
        year="2014",
        label="Cezanne Records",
        cover="CoverJajce.jpg",
        strip=None,
    ),
]


# --------------------------------------------------------------------- oklch

def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def linear_to_srgb(c):
    return c * 12.92 if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055


def rgb_to_oklab(r, g, b):
    r, g, b = srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b)
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = l ** (1 / 3) if l > 0 else 0, m ** (1 / 3) if m > 0 else 0, s ** (1 / 3) if s > 0 else 0
    return (
        0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
    )


def oklab_to_rgb(L, a, b):
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return tuple(linear_to_srgb(v) for v in (r, g, bb))


def oklch(r, g, b):
    L, a, bb = rgb_to_oklab(r, g, b)
    return L, math.hypot(a, bb), math.atan2(bb, a)


def max_chroma(hue, L):
    """Maior croma alcançável em sRGB para este matiz e esta luminância."""
    lo, hi = 0.0, 0.40
    for _ in range(28):
        mid = (lo + hi) / 2
        rgb = oklab_to_rgb(L, mid * math.cos(hue), mid * math.sin(hue))
        if all(-0.001 <= v <= 1.001 for v in rgb):
            lo = mid
        else:
            hi = mid
    return lo


L_LO, L_HI, C_LO, C_HI = 0.50, 0.62, 0.13, 0.18


def force_range(hue, L=None, C=None):
    """
    Força uma cor para oklch(L .50–.62, C .13–.18) — a faixa estreita que dá
    unidade à coleção. Se o matiz não alcança C .13 dentro dessa luminância
    (amarelos, por exemplo), gira o matiz o mínimo necessário em vez de
    entregar uma cor fora da faixa.
    """
    target_C = min(max(C if C is not None else 0.155, C_LO), C_HI)
    L0 = min(max(L if L is not None else 0.56, L_LO), L_HI)
    steps = [L_LO + i * (L_HI - L_LO) / 24 for i in range(25)]
    for dh in (0, 0.12, -0.12, 0.25, -0.25, 0.4, -0.4, 0.6, -0.6, 0.9, -0.9, 1.3, -1.3, 1.8, -1.8):
        h = hue + dh
        best = None
        for Lc in steps:
            cm = max_chroma(h, Lc)
            if cm < C_LO:
                continue
            c = min(target_C, cm, C_HI)
            score = abs(Lc - L0)
            if best is None or score < best[0]:
                best = (score, Lc, c)
        if best:
            _, Lc, c = best
            rgb = oklab_to_rgb(Lc, c * math.cos(h), c * math.sin(h))
            return tuple(round(min(max(v, 0.0), 1.0), 3) for v in rgb)
    rgb = oklab_to_rgb(0.56, C_LO * math.cos(hue), C_LO * math.sin(hue))
    return tuple(round(min(max(v, 0.0), 1.0), 3) for v in rgb)


GOLDEN = 2.399963229728653


def extract_inks(img, index):
    """
    Duas cores dominantes da capa, com matizes distintos, forçadas à faixa.

    Capas quase monocromáticas (o caso de boa parte do dark ambient) não têm
    matiz a extrair. Nesse caso a tinta vem de um ângulo determinístico por
    posição na coleção — os álbuns continuam distintos entre si e a faixa de
    luminância/croma continua sendo a mesma para todos.
    """
    small = img.convert("RGB").resize((160, 160))
    pal = small.quantize(colors=24, method=Image.Quantize.MEDIANCUT)
    counts = sorted(pal.getcolors(), key=lambda c: -c[0])
    table = pal.getpalette()
    entries = []
    for count, idx in counts:
        r, g, b = (c / 255 for c in table[idx * 3: idx * 3 + 3])
        L, C, h = oklch(r, g, b)
        if L < 0.18 or L > 0.93:
            continue  # preto e branco de fundo não são tinta
        entries.append(dict(count=count, L=L, C=C, h=h, score=count * (0.06 + C)))

    fallback_a = GOLDEN * index + 0.6
    if not entries or max(e["C"] for e in entries) < 0.035:
        return (force_range(fallback_a, L=0.56, C=0.155),
                force_range(fallback_a + 2.2, L=0.56, C=0.145))

    entries.sort(key=lambda e: -e["score"])
    a = entries[0]

    def hue_gap(e):
        d = abs(e["h"] - a["h"]) % (2 * math.pi)
        return min(d, 2 * math.pi - d)

    b = max(entries[1:], key=lambda e: hue_gap(e) * e["score"]) if len(entries) > 1 else a
    if hue_gap(b) < 0.6:  # matizes colados: joga a segunda tinta para o complemento
        b = dict(b, h=a["h"] + 2.2)
    return force_range(a["h"], L=a["L"], C=a["C"]), force_range(b["h"], L=b["L"], C=b["C"])


# ------------------------------------------------------------------- helpers

def sh(args):
    r = subprocess.run(args, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(f"{args[0]} falhou: {r.stderr.decode()[:400]}")
    return r


def fetch(identifier, name, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return dest
    url = f"https://archive.org/download/{identifier}/{urllib.parse.quote(name)}"
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    sh(["curl", "-sL", "--fail", "--max-time", "600", "-A", "horizonte-curation/1.0", url, "-o", dest])
    return dest


def metadata(identifier):
    path = os.path.join(CACHE, f"{identifier}.json")
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        sh(["curl", "-sL", "--fail", "--max-time", "120",
            f"https://archive.org/metadata/{identifier}", "-o", path])
    return json.load(open(path))


def seconds(v):
    v = str(v or "0")
    if ":" in v:
        parts = [float(p) for p in v.split(":")][::-1]
        return sum(p * m for p, m in zip(parts, [1, 60, 3600]))
    return float(v or 0)


def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "faixa"


def square_cover(src, dest):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    side = min(w, h)
    im = im.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))
    im = im.resize((COVER_PX, COVER_PX), Image.LANCZOS)
    im.save(dest, "WEBP", quality=84, method=6)
    return im


# ---------------------------------------------------------------------- main

def build(entry, index, force):
    ident = entry["identifier"]
    meta = metadata(ident)
    md = meta["metadata"]
    lic = md.get("licenseurl")
    if lic != CC_BY_4:
        raise SystemExit(f"ABORTADO: {ident} não é CC BY 4.0 (licenceurl={lic}). Na dúvida, não usar.")

    out_dir = os.path.join(MUSIC, entry["slug"])
    os.makedirs(out_dir, exist_ok=True)

    raw_cover = fetch(ident, entry["cover"], os.path.join(CACHE, ident, "cover-src"))
    cover_path = os.path.join(out_dir, "cover.webp")
    cover_img = square_cover(raw_cover, cover_path)
    inkA, inkB = extract_inks(cover_img, index)

    files = [f for f in meta["files"] if f.get("name", "").lower().endswith(".mp3")]
    files.sort(key=lambda f: f["name"])
    strip = re.compile(entry["strip"]) if entry.get("strip") else None

    tracks = []
    for i, f in enumerate(files, 1):
        title = (f.get("title") or os.path.splitext(f["name"])[0]).strip()
        if strip:
            title = strip.sub("", title).strip()
        title = re.sub(r"^\d+\s*[.\-]\s*", "", title).strip()
        base = f"{i:02d}-{slugify(title)}"
        dest = os.path.join(out_dir, base + ".m4a")
        if force or not os.path.exists(dest):
            src = fetch(ident, f["name"], os.path.join(CACHE, ident, f"{i:02d}.mp3"))
            sh(["afconvert", "-f", "m4af", "-d", "aac", "-b", str(BITRATE),
                "-q", "127", "--src-quality", "127", src, dest])
        tracks.append(dict(
            id=f"{entry['slug']}/{base}",
            title=title,
            dur=round(seconds(f.get("length")), 2),
            src=f"/music/{entry['slug']}/{base}.m4a",
            size=os.path.getsize(dest),
        ))
        print(f"  {base:<40} {tracks[-1]['dur']/60:5.1f}min  {tracks[-1]['size']/1048576:5.1f}MB", flush=True)

    return dict(
        id=entry["slug"], provider="curadoria", artist=entry["artist"], title=entry["title"],
        year=entry["year"], cat=entry["cat"], cover=f"/music/{entry['slug']}/cover.webp",
        inkA=list(inkA), inkB=list(inkB), tracks=tracks,
        license=dict(
            name="CC BY 4.0", url=CC_BY_4,
            source=f"https://archive.org/details/{ident}",
            attribution=f"{entry['artist']} — {entry['title']} ({entry['label']}, {entry['year']}). "
                        f"Licenciado sob CC BY 4.0. Áudio recodificado para entrega web.",
            redistributable=True,
        ),
        originalCat=entry["original_cat"],
        label=entry["label"],
    )


def emit(albums):
    def ts(v, ind=2):
        pad = " " * ind
        if isinstance(v, str):
            return json.dumps(v, ensure_ascii=False)
        if isinstance(v, bool):
            return "true" if v else "false"
        if isinstance(v, (int, float)):
            return repr(round(v, 4) if isinstance(v, float) else v)
        if isinstance(v, list):
            if v and isinstance(v[0], (int, float)):
                return "[" + ", ".join(ts(x) for x in v) + "]"
            inner = ",\n".join(pad + "  " + ts(x, ind + 2) for x in v)
            return "[\n" + inner + "\n" + pad + "]"
        if isinstance(v, dict):
            inner = ",\n".join(f"{pad}  {k}: {ts(x, ind + 2)}" for k, x in v.items())
            return "{\n" + inner + "\n" + pad + "}"
        raise TypeError(type(v))

    body = ",\n".join("  " + ts(a, 2) for a in albums)
    src = f"""// GERADO por scripts/fetch-curation.py — não editar à mão.
//
// Curadoria Horizonte: obras sob CC BY 4.0, com áudio hospedado pelo projeto.
// Cada álbum registra origem, licença e atribuição exigida.
import type {{ Album }} from "./types";

export interface CuratedAlbum extends Album {{
  /** Número de catálogo da edição original. */
  originalCat: string;
  label: string;
}}

export const CURATION: CuratedAlbum[] = [
{body},
];
"""
    os.makedirs(os.path.dirname(OUT_TS), exist_ok=True)
    open(OUT_TS, "w").write(src)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    albums = []
    for i, entry in enumerate(CURATION):
        print(f"== {entry['artist']} — {entry['title']}", flush=True)
        raw = build(entry, i, args.force)
        # o TS não precisa de `size`
        for t in raw["tracks"]:
            t.pop("size", None)
            t["source"] = {"kind": "local", "src": t.pop("src"), "mime": "audio/mp4"}
        albums.append(raw)
    emit(albums)
    total = sum(os.path.getsize(os.path.join(dp, f))
                for dp, _, fs in os.walk(MUSIC) for f in fs)
    print(f"\n{len(albums)} álbuns · {sum(len(a['tracks']) for a in albums)} faixas · "
          f"{total/1048576:.0f} MB em public/music")
    print(f"escrito: {os.path.relpath(OUT_TS, ROOT)}")


if __name__ == "__main__":
    sys.exit(main())
