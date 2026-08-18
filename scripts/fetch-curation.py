"""
Monta a Curadoria Horizonte a partir de obras com licença verificada na fonte.

Três tipos de fonte:

  archive  Internet Archive — licença lida do JSON de metadados (`licenseurl`).
  direct   site do próprio autor, com download anônimo e URLs previsíveis.
  manual   a licença é verificável por rede, mas o único download legítimo é
           um fluxo humano (Bandcamp "name your price", que pede e-mail). Você
           baixa e coloca os arquivos em .cache/manual/<slug>/; o script valida
           licença, tracklist e durações antes de aceitar.

  blocked  registrado e NUNCA baixado — a licença não permite, ou não pôde ser
           confirmada. Fica documentado em CURADORIA.md.

O script falha explicitamente quando:
  * a licença encontrada na fonte não corresponde à esperada;
  * um download esperado não está mais disponível (HTTP != 200);
  * metadados essenciais não podem ser confirmados (tracklist, durações, capa).

    python3 scripts/fetch-curation.py [--only <slug>] [--force] [--strict]

`--strict` também falha nas entradas `manual` cujos arquivos ainda não foram
fornecidos (útil em CI); sem ela, essas entradas são reportadas como PENDENTE.
"""
import argparse
import json
import math
import os
import re
import subprocess
import sys
import time
import unicodedata
import urllib.parse
from datetime import date

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MUSIC = os.path.join(ROOT, "public", "music")
CACHE = os.path.join(ROOT, ".cache", "curation")
MANUAL = os.path.join(ROOT, ".cache", "manual")
OUT_TS = os.path.join(ROOT, "src", "components", "horizonte", "content", "curation.generated.ts")

CC_BY_4 = "http://creativecommons.org/licenses/by/4.0/"
CC_BY_4_ALT = "https://creativecommons.org/licenses/by/4.0/"
BITRATE = 96000
COVER_PX = 1024
AUDIO_EXT = (".mp3", ".flac", ".wav", ".m4a", ".aiff", ".aif", ".ogg", ".opus")
IMAGE_EXT = (".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff")
DUR_TOLERANCE = 5.0
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"

CC_BY = dict(name="CC BY 4.0", url=CC_BY_4_ALT)


def tl(pairs):
    return [dict(n=i + 1, title=t, dur=d) for i, (t, d) in enumerate(pairs)]


CURATION = [
    # =========================================================== curadoria nova
    dict(
        kind="manual", cat="H—001", slug="tristan-lohengrin-le-manoir",
        artist="Tristan Lohengrin", title="Le Manoir", year="2019",
        label="Tristan Lohengrin (auto-publicado)",
        verify_url="https://tristanlohengrin.bandcamp.com/album/le-manoir-album-cc-by-40",
        expect_license_url=CC_BY_4_ALT, license=CC_BY, verified="2026-08-18",
        cover=dict(license="Não declarada pelo autor", credit="Arte de David Harrington",
                   source="https://tristanlohengrin.bandcamp.com/album/le-manoir-album-cc-by-40"),
        note="O autor acrescenta um termo extra: proibido registrar em Content ID.",
        tracks=tl([("Le Manoir", 96), ("Dans le Jardin", 240), ("Le Hall", 53),
                   ("A travers les couloirs", 73), ("La Salle de Bal", 119), ("La Chambre", 138),
                   ("Le Couloir Secret", 123), ("La Salle de Torture", 194), ("Poursuivi", 90),
                   ("Le Dernier Couloir", 85), ("Le Fantôme", 110)]),
    ),
    dict(
        kind="manual", cat="H—002", slug="jono-terbakar-lebar",
        artist="Jono Terbakar", title="lebar", year="2023", label="Sangat Records",
        verify_url="https://jonoterbakar.bandcamp.com/album/lebar",
        expect_license_url=CC_BY_4_ALT, license=CC_BY, verified="2026-08-18",
        cover=dict(license="Não declarada", source="https://jonoterbakar.bandcamp.com/album/lebar"),
        tracks=tl([("nirlaba", 263), ("tetes embun yang merasa samudera", 113),
                   ("balada seni dari ujung bumi", 147), ("bajigurik - radio edit", 145),
                   ("liat tanah, tanah liat", 257), ("jika dan hanya jika", 169),
                   ("mungkin hanya cinta yang akan mencintai", 249),
                   ("pergantian siang ke malam", 110), ("kebun bunga matahari", 187)]),
    ),
    dict(
        kind="manual", cat="H—003", slug="le-morte-dabby-0p",
        artist="Le Morte d'Abby", title="0p", year="2022",
        label="Le Morte d'Abby (auto-publicado)",
        verify_url="https://lemortedabby.bandcamp.com/album/0p",
        expect_license_url=CC_BY_4_ALT, license=CC_BY, verified="2026-08-18",
        cover=dict(license="Não declarada", source="https://lemortedabby.bandcamp.com/album/0p"),
        tracks=tl([("0pVI", 283), ("0pVII", 304), ("0pVIII", 420), ("0pIX", 384),
                   ("0pX", 395), ("0pXI", 580), ("0pXII", 344)]),
    ),
    dict(
        kind="manual", cat="H—004", slug="mark-wilson-x-dark-thoughts",
        artist="Mark Wilson X", title="Dark Thoughts", year="2023",
        label="Mark Wilson X (auto-publicado)",
        verify_url="https://freemusicarchive.org/music/mark-wilson-x/dark-thoughts/",
        expect_license_url=CC_BY_4_ALT, license=CC_BY, verified="2026-08-18",
        cover=dict(license="Unsplash License", credit="Foto de Riccardo Pelati (Unsplash)",
                   source="https://markwilsonx.bandcamp.com/album/dark-thoughts-cc-by"),
        note="Crédito exigido pelo autor: “[TÍTULO] © 2023 by Mark Wilson X is licensed under CC BY 4.0”.",
        tracks=tl([("Ritual", 216), ("The Stranger", 208), ("The Killer Awoke", 183),
                   ("Terror Drome", 173), ("Something Not Right Part One", 131),
                   ("Something Not Right Part Two", 127), ("A Killer In Me", 249),
                   ("Alienscape", 214), ("Doppler Piano", 113), ("Ruminations", 180)]),
    ),
    dict(
        kind="blocked", cat="H—005", slug="widder-shadows-of-widder",
        artist="WIDDER", title="shadows of WIDDER", year="2023",
        verify_url="https://widder-music.bandcamp.com/album/shadows-of-widder",
        reason=("Licença contraditória na própria página: o selo Creative Commons aponta para "
                "by-sa/4.0 enquanto o texto afirma “Attribution 4.0 International”. BY-SA e BY "
                "impõem obrigações diferentes; escolher uma seria presumir. Precisa de "
                "confirmação do artista."),
        verified="2026-08-18",
    ),
    dict(
        kind="blocked", cat="H—006", slug="noctilia-grah-background-music",
        artist="Noctilia Grah",
        title="Background Music For Video Essays About Video Games", year="—",
        verify_url="https://noctiliagrah.bandcamp.com/",
        reason=("Sem licença Creative Commons verificável. O subdomínio noctiliagrah.bandcamp.com "
                "não existe (o Bandcamp o oferece para cadastro). A única declaração encontrada é "
                "um termo próprio, “free to use in noncommercial works, with credit”, que não é CC "
                "e é incompatível com hospedar o arquivo num projeto potencialmente comercial."),
        verified="2026-08-18",
    ),
    dict(
        kind="manual", cat="H—007", slug="darin-wilson-meanderings",
        artist="Darin Wilson", title="Meanderings", year="2022",
        label="Darin Wilson (auto-publicado)",
        verify_url="https://darinwilson.bandcamp.com/album/meanderings",
        expect_license_url=CC_BY_4_ALT, license=CC_BY, verified="2026-08-18",
        cover=dict(license="Não declarada", source="https://darinwilson.bandcamp.com/album/meanderings"),
        note=("Preço mínimo de US$ 1 no Bandcamp — não é name-your-price. A licença CC BY 4.0 "
              "permite redistribuir depois de adquirido. A cópia em archive.org "
              "(darin-wilson-meanderings) é reupload de terceiro, sem licença declarada, e não foi usada."),
        tracks=tl([("Part 1", 208), ("Part 2", 283), ("Part 3", 204),
                   ("Part 4", 195), ("Part 5", 240), ("Part 6", 167)]),
    ),
    dict(
        kind="blocked", cat="H—008", slug="ivan-duch-sand",
        artist="Ivan Duch", title="Sand", year="2021",
        verify_url="https://ivanduch.com/albums/sand/",
        reason=("Não é CC BY. É um pack comercial de US$ 4,00 sob “licença não-exclusiva que exige "
                "atribuição” — termo proprietário do autor, sem permissão de redistribuição. A "
                "biblioteca CC BY 4.0 do Ivan Duch existe, mas Sand não faz parte dela."),
        verified="2026-08-18",
    ),
    dict(
        kind="direct", cat="H—009", slug="zero-project-e-world",
        artist="zero-project", title="e-world", year="2011", label="zero-project",
        verify_url="https://www.zero-project.gr/music/albums/e-world/",
        expect_license_text="CC BY 4.0", license=CC_BY, verified="2026-08-18",
        cover_url="https://www.zero-project.gr/covers/e-world_front_cover.jpg",
        cover=dict(license="CC BY 4.0 (mesma da obra)",
                   source="https://www.zero-project.gr/music/albums/e-world/"),
        base="https://www.zero-project.gr/albums/e-world/mp3s/",
        file_tpl="zero-project - {n:02d} - {title}.mp3",
        tracks=tl([("Intro", None), ("Echoes", None), ("In the beginning", None), ("e-world", None),
                   ("Labyrinth", None), ("Psychodrama", None), ("Lost signal", None),
                   ("Silence", None), ("Behind the mind", None), ("Moon flight", None),
                   ("Distant thoughts", None), ("Ocean trip", None), ("Beyond earth", None),
                   ("The journey", None), ("Inner voices", None), ("A new world", None)]),
    ),
    dict(
        kind="manual", cat="H—010", slug="ifness-jazz-royalty-free",
        artist="Justin Allan Arnold / IFNESS", title="Jazz — Royalty Free Compilation",
        year="2025", label="Ifness Music",
        verify_url="https://justinallanarnold.bandcamp.com/album/jazz-royalty-free-compilation",
        expect_license_url=CC_BY_4_ALT, license=CC_BY, verified="2026-08-18",
        cover=dict(license="CC BY-SA 4.0",
                   credit="“Sign in front of former Eddie's House of Jazz, Main Street, Buffalo, "
                          "New York” via Wikimedia Commons",
                   source="https://commons.wikimedia.org/wiki/Main_Page"),
        note=("A capa é CC BY-SA 4.0 (share-alike) — obrigação diferente da do áudio, que é CC BY 4.0. "
              "São 65 faixas: a régua de faixas foi generalizada para acompanhar o tamanho da lista. "
              "No Bandcamp o álbum custa US$ 10,99; MP3 avulsos gratuitos em ifnessfreemusic.com, "
              "mas o site não agrupa por álbum."),
        tracks=tl([("Vincent in Paris", 94), ("Chicago or Bust", 101), ("Ornette Ornette", 119),
                   ("Blue Messenger", 66), ("Careful There", 135), ("Back Porch Blues", 180),
                   ("La Resistencia", 111), ("Jazz Fugue #6 for Keyboard", 54),
                   ("Malcolm Martin Muhammad", 129), ("Bailarina", 223)]),
        partial_tracks=True,
    ),
    # ============================ mantidos até a curadoria nova fechar (task 2)
    dict(
        kind="archive", cat="H—R01", slug="tale-twist-wry-way",
        identifier="tranz060TaleTwist-WryWay",
        verify_url="https://archive.org/details/tranz060TaleTwist-WryWay", artist="Tale Twist", title="Wry Way",
        year="2016", label="Tranzmitter Netlabel", original_cat="TRANZ060",
        cover_file="01.tranz060CoverFront.jpg", strip=r"^\s*\d+\.\s*Tale Twist\s*-\s*",
        license=CC_BY, verified="2026-08-18",
        cover=dict(license="CC BY 4.0 (mesma do item no Internet Archive)",
                   source="https://archive.org/details/tranz060TaleTwist-WryWay"),
    ),
    dict(
        kind="archive", cat="H—R02", slug="meho-mkultra",
        identifier="Meho-Mkultracz015",
        verify_url="https://archive.org/details/Meho-Mkultracz015", artist="Meho", title="MKUltra",
        year="2015", label="Cezanne Records", original_cat="cz015",
        cover_file="CoverMkultra.jpg", license=CC_BY, verified="2026-08-18",
        cover=dict(license="CC BY 4.0 (mesma do item no Internet Archive)",
                   source="https://archive.org/details/Meho-Mkultracz015"),
    ),
    dict(
        kind="archive", cat="H—R03", slug="mescaline-sessions-jajce",
        identifier="Session17-20jajceSessionscz012",
        verify_url="https://archive.org/details/Session17-20jajceSessionscz012", artist="Mescaline Sessions",
        title="Jajce Sessions", year="2014", label="Cezanne Records", original_cat="cz012",
        cover_file="CoverJajce.jpg", license=CC_BY, verified="2026-08-18",
        cover=dict(license="CC BY 4.0 (mesma do item no Internet Archive)",
                   source="https://archive.org/details/Session17-20jajceSessionscz012"),
    ),
]


class Falha(SystemExit):
    def __init__(self, slug, msg):
        super().__init__(f"\nFALHA [{slug}]: {msg}\n")


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
    l_, m_, s_ = (v ** (1 / 3) if v > 0 else 0 for v in (l, m, s))
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
    return (
        linear_to_srgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        linear_to_srgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        linear_to_srgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
    )


def oklch(r, g, b):
    L, a, bb = rgb_to_oklab(r, g, b)
    return L, math.hypot(a, bb), math.atan2(bb, a)


def max_chroma(hue, L):
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
    """Força a cor para oklch(L .50–.62, C .13–.18) — a faixa que unifica a coleção."""
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
    """Duas dominantes da capa; capa quase monocromática usa ângulo determinístico."""
    small = img.convert("RGB").resize((160, 160))
    pal = small.quantize(colors=24, method=Image.Quantize.MEDIANCUT)
    table = pal.getpalette()
    entries = []
    for count, idx in sorted(pal.getcolors(), key=lambda c: -c[0]):
        r, g, b = (c / 255 for c in table[idx * 3: idx * 3 + 3])
        L, C, h = oklch(r, g, b)
        if L < 0.18 or L > 0.93:
            continue
        entries.append(dict(count=count, L=L, C=C, h=h, score=count * (0.06 + C)))

    fallback = GOLDEN * index + 0.6
    if not entries or max(e["C"] for e in entries) < 0.035:
        return (force_range(fallback, L=0.56, C=0.155),
                force_range(fallback + 2.2, L=0.56, C=0.145))

    entries.sort(key=lambda e: -e["score"])
    a = entries[0]

    def gap(e):
        d = abs(e["h"] - a["h"]) % (2 * math.pi)
        return min(d, 2 * math.pi - d)

    b = max(entries[1:], key=lambda e: gap(e) * e["score"]) if len(entries) > 1 else a
    if gap(b) < 0.6:
        b = dict(b, h=a["h"] + 2.2)
    return force_range(a["h"], L=a["L"], C=a["C"]), force_range(b["h"], L=b["L"], C=b["C"])


# ------------------------------------------------------------------- rede/util

def sh(args, slug="?"):
    r = subprocess.run(args, capture_output=True)
    if r.returncode != 0:
        raise Falha(slug, f"{args[0]} falhou: {r.stderr.decode()[:400]}")
    return r


def http_get(url, dest, slug, referer=None, tries=4, expect_size=None):
    """
    Baixa com retentativa. Falha transitória de rede não é o mesmo que download
    indisponível — só desiste (e falha alto) depois de esgotar as tentativas.
    """
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    last = ""
    for attempt in range(1, tries + 1):
        args = ["curl", "-sL", "--fail", "--max-time", "900", "--retry", "2",
                "--retry-delay", "2", "--retry-connrefused", "-A", UA]
        if referer:
            args += ["-e", referer]
        args += [url, "-o", dest]
        r = subprocess.run(args, capture_output=True)
        got = os.path.getsize(dest) if os.path.exists(dest) else 0
        if r.returncode == 0 and got > 0:
            # Download truncado passa pelo --fail do curl: comparar com o
            # Content-Length é o que separa arquivo íntegro de arquivo cortado.
            if expect_size is None or got == expect_size:
                return dest
            last = f"tamanho não confere: {got} bytes recebidos, {expect_size} esperados"
        else:
            last = r.stderr.decode()[:200] or f"curl exit {r.returncode}"
        if os.path.exists(dest):
            os.unlink(dest)
        if attempt < tries:
            time.sleep(3 * attempt)
    raise Falha(slug, f"download indisponível depois de {tries} tentativas: {url}\n           {last}")


def http_text(url, slug):
    r = subprocess.run(["curl", "-sL", "--fail", "--max-time", "120", "-A", UA, url],
                       capture_output=True)
    if r.returncode != 0:
        raise Falha(slug, f"não foi possível ler a fonte para verificar a licença: {url}")
    return r.stdout.decode("utf-8", "replace")


def http_head(url, referer=None):
    """(disponível, tamanho esperado em bytes ou None)."""
    args = ["curl", "-sIL", "--max-time", "120", "-A", UA,
            "-w", "\nHTTPCODE:%{http_code}\nCLEN:%{size_header}\n"]
    if referer:
        args += ["-e", referer]
    r = subprocess.run(args + [url], capture_output=True)
    out = r.stdout.decode("utf-8", "replace")
    code = re.findall(r"HTTPCODE:(\d+)", out)
    lens = re.findall(r"(?im)^content-length:\s*(\d+)", out)
    ok = bool(code) and code[-1] == "200"
    return ok, (int(lens[-1]) if lens else None)


def duration_of(path, slug):
    """Duração real do arquivo, via afinfo (CoreAudio)."""
    r = subprocess.run(["afinfo", path], capture_output=True)
    m = re.search(r"estimated duration:\s*([0-9.]+)", r.stdout.decode("utf-8", "replace"))
    if not m:
        raise Falha(slug, f"não foi possível confirmar a duração de {os.path.basename(path)}")
    return round(float(m.group(1)), 2)


def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower() or "faixa"


def square_cover(src, dest, slug):
    try:
        im = Image.open(src).convert("RGB")
    except Exception as e:
        raise Falha(slug, f"capa ilegível ({src}): {e}")
    w, h = im.size
    if min(w, h) < 500:
        raise Falha(slug, f"capa pequena demais: {w}x{h} (mínimo 500px)")
    side = min(w, h)
    im = im.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))
    im = im.resize((COVER_PX, COVER_PX), Image.LANCZOS)
    im.save(dest, "WEBP", quality=84, method=6)
    return im


def encode(src, dest, slug):
    sh(["afconvert", "-f", "m4af", "-d", "aac", "-b", str(BITRATE),
        "-q", "127", "--src-quality", "127", src, dest], slug)


# ------------------------------------------------------------- verificação


def check_license_page(entry):
    """Confere na fonte que a licença é a esperada. Falha se divergir."""
    slug, url = entry["slug"], entry["verify_url"]
    html = http_text(url, slug)
    if "expect_license_url" in entry:
        want = entry["expect_license_url"].replace("https://", "").replace("http://", "").rstrip("/")
        if want not in html.replace("https://", "").replace("http://", ""):
            raise Falha(slug, f"licença esperada ({entry['expect_license_url']}) não encontrada em {url}")
    if "expect_license_text" in entry:
        plain = re.sub(r"<[^>]+>", " ", html)
        if entry["expect_license_text"] not in plain:
            raise Falha(slug, f"texto de licença “{entry['expect_license_text']}” não encontrado em {url}")
    return True


def check_meta(entry):
    for k in ("artist", "title", "year", "cat", "slug"):
        if not entry.get(k):
            raise Falha(entry.get("slug", "?"), f"metadado essencial ausente: {k}")
    # `archive` tira a tracklist do próprio JSON de metadados da fonte; as outras
    # precisam declará-la aqui para que exista contra o que validar.
    if entry["kind"] in ("direct", "manual") and not entry.get("tracks"):
        raise Falha(entry["slug"], "tracklist ausente — metadados não confirmados")


# ------------------------------------------------------------------ fontes


def build_archive(entry, index, force):
    slug, ident = entry["slug"], entry["identifier"]
    path = os.path.join(CACHE, f"{ident}.json")
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        http_get(f"https://archive.org/metadata/{ident}", path, slug)
    meta = json.load(open(path))
    md = meta.get("metadata", {})
    if md.get("licenseurl") not in (CC_BY_4, CC_BY_4_ALT):
        raise Falha(slug, f"licença na fonte é {md.get('licenseurl')!r}, esperado CC BY 4.0")

    out_dir = os.path.join(MUSIC, slug)
    os.makedirs(out_dir, exist_ok=True)
    raw = http_get(f"https://archive.org/download/{ident}/{urllib.parse.quote(entry['cover_file'])}",
                   os.path.join(CACHE, ident, "cover-src"), slug) \
        if not os.path.exists(os.path.join(CACHE, ident, "cover-src")) \
        else os.path.join(CACHE, ident, "cover-src")
    cover_img = square_cover(raw, os.path.join(out_dir, "cover.webp"), slug)

    files = sorted([f for f in meta["files"] if f.get("name", "").lower().endswith(".mp3")],
                   key=lambda f: f["name"])
    if not files:
        raise Falha(slug, "nenhum MP3 no item — download indisponível")
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
            src = os.path.join(CACHE, ident, f"{i:02d}.mp3")
            if not os.path.exists(src):
                http_get(f"https://archive.org/download/{ident}/{urllib.parse.quote(f['name'])}", src, slug)
            encode(src, dest, slug)
        tracks.append(dict(base=base, title=title, dur=duration_of(dest, slug)))
        print(f"  {base:<44} {tracks[-1]['dur']/60:5.1f}min", flush=True)
    return cover_img, tracks


def build_direct(entry, index, force):
    slug = entry["slug"]
    check_license_page(entry)
    out_dir = os.path.join(MUSIC, slug)
    os.makedirs(out_dir, exist_ok=True)
    cdir = os.path.join(CACHE, slug)
    os.makedirs(cdir, exist_ok=True)

    cov = os.path.join(cdir, "cover-src")
    if not os.path.exists(cov):
        http_get(entry["cover_url"], cov, slug, referer=entry["verify_url"])
    cover_img = square_cover(cov, os.path.join(out_dir, "cover.webp"), slug)

    tracks = []
    for t in entry["tracks"]:
        name = entry["file_tpl"].format(n=t["n"], title=t["title"])
        url = entry["base"] + urllib.parse.quote(name)
        base = f"{t['n']:02d}-{slugify(t['title'])}"
        dest = os.path.join(out_dir, base + ".m4a")
        if force or not os.path.exists(dest):
            ok, size = http_head(url, referer=entry["verify_url"])
            if not ok:
                raise Falha(slug, f"download indisponível (HTTP != 200): {url}")
            src = os.path.join(cdir, f"{t['n']:02d}.src")
            if os.path.exists(src) and size and os.path.getsize(src) != size:
                os.unlink(src)  # cache truncado de uma tentativa anterior
            if not os.path.exists(src):
                http_get(url, src, slug, referer=entry["verify_url"], expect_size=size)
                time.sleep(1.2)  # servidor de artista independente: sem rajada
            encode(src, dest, slug)
        tracks.append(dict(base=base, title=t["title"], dur=duration_of(dest, slug)))
        print(f"  {base:<44} {tracks[-1]['dur']/60:5.1f}min", flush=True)
    return cover_img, tracks


def build_manual(entry, index, force, strict):
    """Arquivos fornecidos por você; licença ainda é verificada por rede."""
    slug = entry["slug"]
    check_license_page(entry)
    src_dir = os.path.join(MANUAL, slug)
    have = os.path.isdir(src_dir)
    audio = sorted(f for f in os.listdir(src_dir) if f.lower().endswith(AUDIO_EXT)) if have else []
    images = sorted(f for f in os.listdir(src_dir) if f.lower().endswith(IMAGE_EXT)) if have else []

    # Pasta ausente ou vazia = ainda não fornecido. Pasta com áudio mas conteúdo
    # errado = erro de verdade, e falha alto mais abaixo.
    if not audio:
        msg = (f"aguardando arquivos em .cache/manual/{slug}/\n"
               f"           licença confirmada em {entry['verify_url']}\n"
               f"           coloque as {len(entry['tracks'])} faixas + a capa nessa pasta e rode de novo")
        if strict:
            raise Falha(slug, msg)
        print(f"  PENDENTE — {msg}")
        return None, None
    if not images:
        raise Falha(slug, f"há áudio mas nenhuma capa em {src_dir} — a proveniência da capa é sua")
    expected = entry["tracks"]
    if not entry.get("partial_tracks") and len(audio) != len(expected):
        raise Falha(slug, f"tracklist não confere: {len(audio)} arquivos, {len(expected)} faixas esperadas")

    out_dir = os.path.join(MUSIC, slug)
    os.makedirs(out_dir, exist_ok=True)
    cover_img = square_cover(os.path.join(src_dir, images[0]),
                             os.path.join(out_dir, "cover.webp"), slug)

    tracks = []
    for i, fname in enumerate(audio):
        exp = expected[i] if i < len(expected) else None
        title = exp["title"] if exp else re.sub(r"^\d+[\s.\-]*", "", os.path.splitext(fname)[0])
        base = f"{i+1:02d}-{slugify(title)}"
        dest = os.path.join(out_dir, base + ".m4a")
        if force or not os.path.exists(dest):
            encode(os.path.join(src_dir, fname), dest, slug)
        dur = duration_of(dest, slug)
        if exp and exp["dur"] and abs(dur - exp["dur"]) > DUR_TOLERANCE:
            raise Falha(slug, f"duração de “{title}” não confere: {dur}s no arquivo, "
                              f"{exp['dur']}s na fonte (tolerância {DUR_TOLERANCE}s). "
                              f"Confira se {fname} é a faixa {i+1}.")
        tracks.append(dict(base=base, title=title, dur=dur))
        print(f"  {base:<44} {dur/60:5.1f}min", flush=True)
    return cover_img, tracks


# ---------------------------------------------------------------- emissão TS


def emit(albums, blocked):
    def ts(v, ind=2):
        pad = " " * ind
        if isinstance(v, str):
            return json.dumps(v, ensure_ascii=False)
        if isinstance(v, bool):
            return "true" if v else "false"
        if v is None:
            return "null"
        if isinstance(v, (int, float)):
            return repr(round(v, 4) if isinstance(v, float) else v)
        if isinstance(v, list):
            if v and isinstance(v[0], (int, float)):
                return "[" + ", ".join(ts(x) for x in v) + "]"
            if not v:
                return "[]"
            return "[\n" + ",\n".join(pad + "  " + ts(x, ind + 2) for x in v) + "\n" + pad + "]"
        if isinstance(v, dict):
            return "{\n" + ",\n".join(f"{pad}  {k}: {ts(x, ind + 2)}" for k, x in v.items()) + "\n" + pad + "}"
        raise TypeError(type(v))

    body = ",\n".join("  " + ts(a, 2) for a in albums)
    blk = ",\n".join("  " + ts(b, 2) for b in blocked)
    src = f"""// GERADO por scripts/fetch-curation.py — não editar à mão.
//
// Curadoria Horizonte. Cada álbum registra origem, licença do áudio, licença da
// capa, atribuição exigida, alterações feitas no arquivo original e a data em
// que a licença foi verificada na fonte.
import type {{ Album }} from "./types";

export interface CuratedAlbum extends Album {{
  /** Número de catálogo da edição original, quando existe. */
  originalCat?: string;
  label?: string;
  /** Observação de licenciamento relevante para esta obra. */
  note?: string;
}}

/** Itens da curadoria desejada que NÃO podem ser usados, e por quê. */
export interface BlockedAlbum {{
  cat: string;
  artist: string;
  title: string;
  source: string;
  reason: string;
  verifiedAt: string;
}}

export const CURATION: CuratedAlbum[] = [
{body},
];

export const BLOCKED: BlockedAlbum[] = [
{blk},
];
"""
    os.makedirs(os.path.dirname(OUT_TS), exist_ok=True)
    open(OUT_TS, "w").write(src)


DOC = os.path.join(ROOT, "CURADORIA.md")


def emit_doc(albums, blocked, pending):
    """CURADORIA.md sai do mesmo lugar que o catálogo — não pode divergir."""
    L = []
    L.append("# Curadoria Horizonte — procedência e licenças\n")
    L.append("Documento **gerado** por `scripts/fetch-curation.py`. Não editar à mão.\n")
    L.append("Cada asset em `public/music/` tem aqui a origem, a licença do áudio, a licença da")
    L.append("capa, a atribuição exigida, o que foi alterado no arquivo original e a data em que a")
    L.append("licença foi verificada na fonte.\n")
    L.append("```bash\npython3 scripts/fetch-curation.py\n```\n")
    L.append("O script falha explicitamente se a licença na fonte divergir da esperada, se um")
    L.append("download deixar de estar disponível ou se a tracklist/duração não puder ser")
    L.append("confirmada. `--strict` também falha nas entradas ainda sem arquivos.\n")

    L.append("## Resumo\n")
    L.append("| Artista | Álbum | Faixas | Licença áudio | Licença capa | Fonte | Status |")
    L.append("| --- | --- | --: | --- | --- | --- | --- |")
    for a in albums:
        host = re.sub(r"^https?://(www\.)?", "", a["license"]["source"]).split("/")[0]
        L.append(f"| {a['artist']} | {a['title']} | {len(a['tracks'])} | {a['license']['name']} "
                 f"| {a['license']['cover']['license']} | {host} | APROVADO |")
    for b in blocked:
        host = re.sub(r"^https?://(www\.)?", "", b["source"]).split("/")[0]
        L.append(f"| {b['artist']} | {b['title']} | — | ver motivo | — | {host} | **BLOQUEADO** |")
    for p_ in pending:
        host = re.sub(r"^https?://(www\.)?", "", p_["source"]).split("/")[0]
        L.append(f"| {p_['artist']} | {p_['title']} | {p_['n']} | {p_['license']} | {p_['cover']} "
                 f"| {host} | AGUARDANDO ARQUIVOS |")
    L.append("")

    L.append("## Aprovados — hospedados em `public/music/`\n")
    for a in albums:
        lic, cov = a["license"], a["license"]["cover"]
        L.append(f"### {a['artist']} — *{a['title']}* · `{a['cat']}`\n")
        L.append(f"- **Fonte**: {a.get('label') or a['artist']}"
                 + (f" · catálogo original `{a['originalCat']}`" if a.get("originalCat") else ""))
        L.append(f"- **URL de origem**: {lic['source']}")
        L.append(f"- **Licença do áudio**: {lic['name']} — {lic['url']}")
        cred = f" · {cov['credit']}" if cov.get("credit") else ""
        csrc = f" · {cov['source']}" if cov.get("source") else ""
        L.append(f"- **Licença/proveniência da capa**: {cov['license']}{cred}{csrc}")
        L.append(f"- **Atribuição exigida**: {lic['attribution']}")
        L.append(f"- **Alterações no original**: " + " ".join(lic["changes"]))
        L.append(f"- **Data da verificação**: {lic['verifiedAt']}")
        L.append(f"- **Ano · faixas**: {a['year']} · {len(a['tracks'])}")
        if a.get("note"):
            L.append(f"- **Observação**: {a['note']}")
        L.append("")

    if pending:
        L.append("## Aguardando arquivos\n")
        L.append("Licença já verificada na fonte, mas o único download legítimo é um fluxo humano")
        L.append("(Bandcamp *name your price* pede e-mail; o Free Music Archive passou a exigir")
        L.append("login). Baixe do link e coloque as faixas + a capa em `.cache/manual/<slug>/`;")
        L.append("o script confere licença, tracklist e durações antes de aceitar.\n")
        for p_ in pending:
            L.append(f"### {p_['artist']} — *{p_['title']}* · `{p_['cat']}`\n")
            L.append(f"- **URL de origem**: {p_['source']}")
            L.append(f"- **Licença do áudio (verificada)**: {p_['license']}")
            L.append(f"- **Licença/proveniência da capa**: {p_['cover']}")
            L.append(f"- **Faixas esperadas**: {p_['n']}")
            L.append(f"- **Pasta**: `.cache/manual/{p_['slug']}/`")
            L.append(f"- **Data da verificação**: {p_['verifiedAt']}")
            if p_.get("note"):
                L.append(f"- **Observação**: {p_['note']}")
            L.append("")

    if blocked:
        L.append("## Bloqueados — não usar\n")
        for b in blocked:
            L.append(f"### {b['artist']} — *{b['title']}* · `{b['cat']}`\n")
            L.append(f"- **URL verificada**: {b['source']}")
            L.append(f"- **Motivo**: {b['reason']}")
            L.append(f"- **Data da verificação**: {b['verifiedAt']}")
            L.append("")

    L.append("## Notas de fonte\n")
    L.append("- **Jamendo**: a API exige `client_id` de conta de desenvolvedor. Sem a credencial não")
    L.append("  há acesso programático ao catálogo nem aos campos de licença/download.")
    L.append("- **Free Music Archive**: a API foi desativada, o endpoint de download passou a exigir")
    L.append("  login e os termos proíbem hotlinking e scraping da busca. O FMA autoriza")
    L.append("  explicitamente auto-hospedar a música respeitando a licença CC — por isso ele serve")
    L.append("  como fonte de verificação de licença, não de download automatizado.")
    L.append("- **Bandcamp**: *name your price* exige e-mail e o acesso automatizado é vedado pelos")
    L.append("  termos. Daí a aquisição manual para esses álbuns.")
    open(DOC, "w").write("\n".join(L) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--strict", action="store_true")
    args = ap.parse_args()

    albums, blocked, pending = [], [], []
    for i, entry in enumerate(CURATION):
        if args.only and entry["slug"] != args.only:
            continue
        check_meta(entry)
        head = f"{entry['cat']} · {entry['artist']} — {entry['title']}"

        if entry["kind"] == "blocked":
            print(f"== {head}\n  BLOQUEADO — {entry['reason'][:110]}…", flush=True)
            blocked.append(dict(cat=entry["cat"], artist=entry["artist"], title=entry["title"],
                                source=entry["verify_url"], reason=entry["reason"],
                                verifiedAt=entry["verified"]))
            continue

        print(f"== {head}", flush=True)
        builder = {"archive": build_archive, "direct": build_direct}.get(entry["kind"])
        if builder:
            cover_img, tracks = builder(entry, i, args.force)
        else:
            cover_img, tracks = build_manual(entry, i, args.force, args.strict)
        if tracks is None:
            pending.append(dict(cat=entry["cat"], slug=entry["slug"], artist=entry["artist"],
                                title=entry["title"], source=entry["verify_url"],
                                license=entry["license"]["name"],
                                cover=entry["cover"]["license"], n=len(entry["tracks"]),
                                verifiedAt=entry["verified"], note=entry.get("note")))
            continue

        inkA, inkB = extract_inks(cover_img, i)
        changes = ["Áudio recodificado para AAC 96 kbps (.m4a) para entrega web; sem edição de conteúdo.",
                   "Capa recortada em quadrado central e reamostrada para 1024 px WebP."]
        album = dict(
            id=entry["slug"], provider="curadoria", artist=entry["artist"], title=entry["title"],
            year=entry["year"], cat=entry["cat"], cover=f"/music/{entry['slug']}/cover.webp",
            inkA=list(inkA), inkB=list(inkB),
            tracks=[dict(id=f"{entry['slug']}/{t['base']}", title=t["title"], dur=t["dur"],
                         source=dict(kind="local", src=f"/music/{entry['slug']}/{t['base']}.m4a",
                                     mime="audio/mp4"))
                    for t in tracks],
            license=dict(
                name=entry["license"]["name"], url=entry["license"]["url"],
                source=entry["verify_url"],
                attribution=f"{entry['artist']} — {entry['title']} "
                            f"({entry.get('label', entry['artist'])}, {entry['year']}). "
                            f"Licenciado sob {entry['license']['name']}.",
                redistributable=True,
                cover=entry["cover"],
                verifiedAt=entry["verified"],
                changes=changes,
            ),
        )
        if entry.get("original_cat"):
            album["originalCat"] = entry["original_cat"]
        if entry.get("label"):
            album["label"] = entry["label"]
        if entry.get("note"):
            album["note"] = entry["note"]
        albums.append(album)

    if not args.only:
        emit(albums, blocked)
        emit_doc(albums, blocked, pending)
    total = sum(os.path.getsize(os.path.join(dp, f))
                for dp, _, fs in os.walk(MUSIC) for f in fs) if os.path.isdir(MUSIC) else 0
    print(f"\n{len(albums)} álbuns aprovados · {sum(len(a['tracks']) for a in albums)} faixas · "
          f"{total/1048576:.0f} MB em public/music")
    if blocked:
        print(f"{len(blocked)} bloqueados: " + ", ".join(b["artist"] for b in blocked))
    if pending:
        print(f"{len(pending)} aguardando arquivos manuais:")
        for p in pending:
            print(f"   - {p['cat']} {p['artist']} — {p['title']}  (.cache/manual/{p['slug']}/)")
    if not args.only:
        print(f"escrito: {os.path.relpath(OUT_TS, ROOT)}")


if __name__ == "__main__":
    sys.exit(main())
