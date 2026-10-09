"""
Forma de cada faixa do Horizonte — seções, retornos e identidade por faixa.

Roda depois de `analyze-audio.py`, sobre o mesmo cache de WAV, e gera
`src/components/horizonte/content/form.generated.ts`.

    python3 scripts/analyze-form.py [--only <slug>] [--report]

`analyze-audio.py` mede o que um disco *é*. Este script mede o que cada faixa
*faz* ao longo do tempo: em que seções ela se divide, quais seções voltam, onde
ela suspende e para onde ela caminha. É a matéria das três escalas temporais da
morfologia (identidade da faixa, estado de seção, acontecimento).

Os mesmos princípios de determinismo da assinatura:

  * Toda normalização usa **âncoras e escalas fixas** (constantes deste
    arquivo), nunca o resto do acervo. Acrescentar um disco não muda a forma de
    nenhuma faixa existente.
  * Segmentação, agrupamento e eventos são funções puras do áudio da própria
    faixa. Nada é sorteado.

Descritores por faixa, escolhidos por medição no acervo (103 faixas): cada um é
estável entre a primeira e a segunda metade da faixa e não repete nenhum
descritor existente.

  * `level`        nível médio (dB), com as âncoras de volume do álbum.
  * `articulation` atividade de ataque: fluxo espectral clareado médio.
                   |r| máximo 0,20 contra os descritores existentes; r 0,76
                   entre metades.
  * `motion`       quanto a textura muda de janela para janela.
                   |r| máximo 0,41; r 0,77 entre metades.
  * `recurrence`   fração da faixa que reencontra material já ouvido (≥ 20 s
                   antes). |r| máximo 0,23; r 0,72 entre metades.
  * `trajectory`   variação de nível ao longo dos 80% centrais da faixa, com
                   sinal. Ignora introdução e coda para não ler fade como forma.

Recusados por redundância: planura espectral (r 0,97 com o brilho por faixa),
taxa de ataques (0,63 com o pulso por faixa), proporção de graves (0,62 com o
brilho por faixa).
"""
import argparse
import base64
import glob
import importlib.util
import json
import math
import os
import struct
import sys

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MUSIC = os.path.join(ROOT, "public", "music")
OUT_TS = os.path.join(ROOT, "src", "components", "horizonte", "content", "form.generated.ts")

# ----------------------------------------------------------------- parâmetros
SR = 22050
N = 2048                # janela da FFT: resolução de croma suficiente para seções
HOP = 1024
FPS = SR / HOP
WIN_S = 2.0             # janela de agregação: a menor unidade de forma
WF = int(round(WIN_S * FPS))

# Escalas fixas das cinco grandezas de timbre, em unidades próprias. Calibradas
# no acervo (desvio-padrão por janela) e congeladas: não são recalculadas.
SCALE = {"rms": 10.0, "cent": 1.0, "flat": 1.5, "low": 0.25, "on": 18.0}
TIMBRE = ["rms", "cent", "flat", "low", "on"]

ANCHOR = {
    "level": (-32.0, -12.0),        # dB, as mesmas âncoras de volume do álbum
    "articulation": (135.0, 172.0),
    "motion": (0.25, 1.30),
    "recurrence": (0.20, 0.95),
}

NOVELTY_HALF = 6        # janelas de cada lado do núcleo de Foote (12 s)
NOVELTY_GAIN = 0.6      # limiar de pico: média + 0,6 desvio da curva da faixa
MIN_SECTION = 4         # janelas (8 s): seção mais curta que se aceita
MAX_SECTIONS = 24
MERGE_DIST = 0.42       # seções vizinhas mais próximas que isto são uma só
CLUSTER_DIST = 0.55     # seções não vizinhas mais próximas que isto são retorno
RECUR_LAG = 10          # janelas (20 s): distância mínima de um reencontro
RECUR_SIM = 0.92
PAUSE_DB = 12.0         # suspensão: 12 dB abaixo da mediana da faixa

FREQS = np.fft.rfftfreq(N, 1 / SR)
HANN = np.hanning(N).astype(np.float32)
PC_SEL = (FREQS >= 100) & (FREQS <= 4000)
PC = np.mod(np.round(69 + 12 * np.log2(np.maximum(FREQS, 1e-6) / 440.0)), 12).astype(int)


def load_audio_module():
    """Reusa a decodificação e a ordem do acervo de analyze-audio.py."""
    path = os.path.join(ROOT, "scripts", "analyze-audio.py")
    spec = importlib.util.spec_from_file_location("analyze_audio", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


AA = load_audio_module()


def clamp(v, a=0.0, b=1.0):
    return a if v < a else b if v > b else v


def norm(value, key):
    lo, hi = ANCHOR[key]
    return round(clamp((value - lo) / (hi - lo)), 4)


# ------------------------------------------------------------------ por quadro
def frame_features(x):
    """Cinco grandezas de timbre e croma por quadro de 46 ms."""
    k = (len(x) - N) // HOP
    out = {key: [] for key in TIMBRE}
    chroma = []
    peak = None
    prev = None
    for s in range(0, max(0, k), 4096):
        e = min(k, s + 4096)
        idx = np.arange(s, e)[:, None] * HOP + np.arange(N)[None, :]
        fr = x[idx] * HANN
        mag = np.abs(np.fft.rfft(fr, axis=1)).astype(np.float32)
        pw = mag ** 2 + 1e-12
        out["rms"].append(20 * np.log10(np.sqrt((fr ** 2).mean(axis=1)) + 1e-9))
        out["cent"].append(np.log2(np.maximum((mag * FREQS).sum(1) / (mag.sum(1) + 1e-9), 20)))
        out["flat"].append(np.log10(np.exp(np.log(pw).mean(1)) / pw.mean(1)))
        out["low"].append(pw[:, FREQS < 250].sum(1) / pw.sum(1))
        # fluxo clareado: cada raia dividida pelo próprio pico recente, como o
        # pulso de analyze-audio.py; mede atividade de ataque, não brilho
        on = np.zeros(e - s)
        for i in range(e - s):
            row = mag[i]
            peak = row.copy() if peak is None else np.maximum(row, 0.9 * peak)
            w = row / np.maximum(peak, 1e-4)
            if prev is not None:
                d = w - prev
                on[i] = d[d > 0].sum()
            prev = w
        out["on"].append(on)
        c = np.zeros((e - s, 12), np.float32)
        sub = pw[:, PC_SEL]
        for p in range(12):
            c[:, p] = sub[:, PC[PC_SEL] == p].sum(1)
        chroma.append(c / (c.sum(1, keepdims=True) + 1e-12))
    if not chroma:
        return None
    f = {key: np.concatenate(v) for key, v in out.items()}
    f["chroma"] = np.concatenate(chroma)
    return f


def windows(f):
    """Agrega em janelas de 2 s. Nível em média de potência."""
    n = len(f["rms"]) // WF
    W = {}
    for key in TIMBRE:
        v = f[key][: n * WF].reshape(n, WF)
        W[key] = 10 * np.log10(np.mean(10 ** (v / 10), 1)) if key == "rms" else v.mean(1)
    c = f["chroma"][: n * WF].reshape(n, WF, 12).mean(1)
    W["chroma"] = c / (np.linalg.norm(c, axis=1, keepdims=True) + 1e-9)
    return W


def power_db(v):
    return float(10 * np.log10(np.mean(10 ** (np.asarray(v) / 10))))


# ------------------------------------------------------------------- seções
def features(W):
    """Vetor por janela: timbre em escala fixa, centrado na mediana da faixa, e croma."""
    Z = np.stack([(W[k] - np.median(W[k])) / SCALE[k] for k in TIMBRE], 1)
    return Z, W["chroma"]


def novelty(Z, C):
    F = np.concatenate([Z / math.sqrt(len(TIMBRE)), C], 1)
    Fn = F / (np.linalg.norm(F, axis=1, keepdims=True) + 1e-9)
    S = Fn @ Fn.T
    n = len(S)
    h = NOVELTY_HALF
    ax = np.arange(-h, h) + 0.5
    g = np.exp(-(ax ** 2) / (2 * (h / 2) ** 2))
    K = np.outer(g, g) * np.outer(np.sign(ax), np.sign(ax))
    nov = np.zeros(n)
    for i in range(h, n - h):
        nov[i] = float((S[i - h:i + h, i - h:i + h] * K).sum())
    return nov, S


def section_vector(Z, C, a, b):
    z = Z[a:b].mean(0)
    c = C[a:b].mean(0)
    return z, c / (np.linalg.norm(c) + 1e-9)


def distance(u, v):
    """Distância entre seções: timbre em unidades de escala, mais harmonia."""
    return float(np.linalg.norm(u[0] - v[0]) / math.sqrt(len(TIMBRE)) + (1.0 - float(u[1] @ v[1])) * 2.0)


def segment(Z, C):
    n = len(Z)
    nov, S = novelty(Z, C)
    thr = nov.mean() + NOVELTY_GAIN * nov.std()
    peaks = []
    for i in range(1, n - 1):
        lo, hi = max(0, i - 4), min(n, i + 5)
        if nov[i] >= thr and nov[i] == nov[lo:hi].max():
            if (not peaks or i - peaks[-1] >= MIN_SECTION) and i >= MIN_SECTION and n - i >= MIN_SECTION:
                peaks.append(i)
    bounds = [0] + peaks + [n]

    # vizinhas parecidas são uma seção só: a fronteira era ruído
    merged = True
    while merged and len(bounds) > 2:
        merged = False
        vecs = [section_vector(Z, C, bounds[i], bounds[i + 1]) for i in range(len(bounds) - 1)]
        gaps = [distance(vecs[i], vecs[i + 1]) for i in range(len(vecs) - 1)]
        j = int(np.argmin(gaps))
        if gaps[j] < MERGE_DIST or len(bounds) - 1 > MAX_SECTIONS:
            del bounds[j + 1]
            merged = True
    return bounds, S


def cluster(vecs):
    """Uma seção que reencontra uma seção não vizinha herda o grupo dela: é um retorno."""
    ids = []
    for i, v in enumerate(vecs):
        best, who = CLUSTER_DIST, -1
        for j in range(0, i - 1):
            d = distance(v, vecs[j])
            if d < best:
                best, who = d, ids[j]
        ids.append(who if who >= 0 else (max(ids) + 1 if ids else 0))
    return ids


def recurrence_of(S):
    n = len(S)
    hits = [S[i, : i - RECUR_LAG + 1].max() > RECUR_SIM for i in range(RECUR_LAG, n)]
    return float(np.mean(hits)) if hits else 0.0


def motion_of(Z):
    if len(Z) < 3:
        return 0.0
    return float(np.median(np.linalg.norm(np.diff(Z, axis=0), axis=1)))


def trajectory_of(levels):
    n = len(levels)
    if n < 6:
        return 0.0
    a, b = int(n * 0.1), max(int(n * 0.1) + 3, int(n * 0.9))
    y = np.asarray(levels[a:b])
    t = np.arange(len(y))
    slope = np.polyfit(t, y, 1)[0]
    return round(clamp(slope * len(y) / 12.0, -1.0, 1.0), 4)


def pauses_of(levels):
    n = len(levels)
    med = float(np.median(levels))
    out = []
    i = 2
    while i < n - 2:
        if levels[i] < med - PAUSE_DB:
            j = i
            while j + 1 < n - 2 and levels[j + 1] < med - PAUSE_DB:
                j += 1
            out.append((i, j + 1))
            i = j + 1
        i += 1
    return out


def i8(v):
    return int(round(clamp(v, -1.0, 1.0) * 127))


def u8(v):
    return int(round(clamp(v, 0.0, 1.0) * 255))


def analyze_track(x):
    f = frame_features(x)
    if f is None or len(f["rms"]) < WF * MIN_SECTION * 2:
        return None
    W = windows(f)
    n = len(W["rms"])
    Z, C = features(W)
    bounds, S = segment(Z, C)
    vecs = [section_vector(Z, C, bounds[i], bounds[i + 1]) for i in range(len(bounds) - 1)]
    ids = cluster(vecs)
    level = power_db(W["rms"])
    onset = float(W["on"].mean())
    cent = float(W["cent"].mean())

    blob = bytearray()
    sections = []
    for i in range(len(bounds) - 1):
        a, b = bounds[i], bounds[i + 1]
        seg = W["rms"][a:b]
        third = max(1, (b - a) // 3)
        sec = dict(
            at=a / n,
            level=(power_db(seg) - level) / 12.0,
            articulation=(float(W["on"][a:b].mean()) - onset) / SCALE["on"],
            brightness=(float(W["cent"][a:b].mean()) - cent) / SCALE["cent"],
            contrast=0.0 if i == 0 else distance(vecs[i - 1], vecs[i]) / 3.0,
            cluster=ids[i],
            slope=(power_db(seg[-third:]) - power_db(seg[:third])) / 12.0,
        )
        sections.append(sec)
        blob += struct.pack(
            ">HbbbBBb",
            min(65535, int(round(sec["at"] * 65535))),
            i8(sec["level"]),
            i8(sec["articulation"]),
            i8(sec["brightness"]),
            u8(sec["contrast"]),
            min(255, sec["cluster"]),
            i8(sec["slope"]),
        )

    pause_blob = bytearray()
    pauses = pauses_of(W["rms"])
    for a, b in pauses:
        pause_blob += struct.pack(">HH", int(round(a / n * 65535)), int(round(min(1.0, b / n) * 65535)))

    return dict(
        level=norm(level, "level"),
        articulation=norm(onset, "articulation"),
        motion=norm(motion_of(Z), "motion"),
        recurrence=norm(recurrence_of(S), "recurrence"),
        trajectory=trajectory_of(W["rms"]),
        sections=base64.b64encode(bytes(blob)).decode(),
        pauses=base64.b64encode(bytes(pause_blob)).decode(),
        _sections=sections,
        _pauses=pauses,
        _windows=n,
    )


# ------------------------------------------------------------------- emissão
def emit(albums):
    def num(v):
        return json.dumps(v)

    lines = [
        'import type { TrackForm } from "./form";',
        "",
        "export const FORMS: Record<string, (TrackForm | null)[]> = {",
    ]
    for slug, forms in albums:
        lines.append(f"  {json.dumps(slug)}: [")
        for t in forms:
            if t is None:
                lines.append("    null,")
                continue
            lines.append(
                "    { "
                f"level: {num(t['level'])}, articulation: {num(t['articulation'])}, "
                f"motion: {num(t['motion'])}, recurrence: {num(t['recurrence'])}, "
                f"trajectory: {num(t['trajectory'])}, "
                f"sections: {json.dumps(t['sections'])}, pauses: {json.dumps(t['pauses'])} }},"
            )
        lines.append("  ],")
    lines += ["};", ""]
    open(OUT_TS, "w", encoding="utf-8").write("\n".join(lines))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only")
    ap.add_argument("--report", action="store_true")
    args = ap.parse_args()

    albums = []
    for slug, _cover in AA.album_order():
        if args.only and args.only != slug:
            continue
        d = os.path.join(MUSIC, slug)
        files = sorted(
            f for f in glob.glob(os.path.join(d, "*"))
            if os.path.splitext(f)[1].lower() in (".m4a", ".mp3", ".ogg", ".opus")
        )
        if not files:
            print(f"  · {slug}: sem arquivos de áudio, pulando", file=sys.stderr)
            continue
        forms = [analyze_track(AA.decode(f)) for f in files]
        albums.append((slug, forms))
        print(f"  · {slug}: {len(files)} faixas", file=sys.stderr)

    emit(albums)
    print(f"\n{len(albums)} álbuns → {os.path.relpath(OUT_TS, ROOT)}")

    if args.report:
        tracks = [t for _, forms in albums for t in forms if t]
        secs = [len(t["_sections"]) for t in tracks]
        lens = [(t["_sections"][i + 1]["at"] if i + 1 < len(t["_sections"]) else 1.0) - s["at"]
                for t in tracks for i, s in enumerate(t["_sections"])]
        returns = [sum(1 for i, s in enumerate(t["_sections"])
                       if any(p["cluster"] == s["cluster"] for p in t["_sections"][:max(0, i - 1)]))
                   for t in tracks]
        print(f"\nfaixas {len(tracks)}")
        print(f"seções por faixa     p10 {np.percentile(secs,10):.0f}  mediana {np.median(secs):.0f}  p90 {np.percentile(secs,90):.0f}  máx {max(secs)}")
        print(f"faixas com retorno   {np.mean([r > 0 for r in returns]):.2f}")
        print(f"faixas com suspensão {np.mean([len(t['_pauses']) > 0 for t in tracks]):.2f}")
        for key in ["level", "articulation", "motion", "recurrence", "trajectory"]:
            v = np.array([t[key] for t in tracks])
            print(f"{key:13} p10 {np.percentile(v,10):.2f}  mediana {np.median(v):.2f}  p90 {np.percentile(v,90):.2f}")


if __name__ == "__main__":
    main()
