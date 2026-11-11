"""
Assinatura de movimento de cada faixa do Horizonte.

Roda depois de `analyze-audio.py`, sobre o mesmo cache de WAV, e gera
`src/components/horizonte/content/motion.generated.ts`.

    python3 scripts/analyze-motion.py [--only <slug>] [--report]

`analyze-audio.py` mede quanto um disco pesa e `analyze-form.py` mede o que
cada faixa faz ao longo dos minutos. Este script mede **como o som se move na
escala do evento**: se ele ataca de repente ou chega aos poucos, se se sustenta
ou some, onde está o peso e se existe uma grade em que os ataques caem. É daí
que sai a assinatura de movimento (`motion.ts`): o tempo de ataque e de
relaxamento da reação ao vivo, a janela do acento e a divisão da reação entre
massa e luz.

Os mesmos princípios de determinismo da assinatura:

  * Toda normalização usa **âncoras fixas** (constantes deste arquivo), nunca o
    resto do acervo. Acrescentar um disco não muda a assinatura de nenhum outro.
    As âncoras (`ANCHOR`) vêm do intervalo medido nas 103 faixas (p05 a p95,
    com folga); o que passa delas é cortado: o descritor satura, não reescala.
  * Tudo é função pura do áudio da própria faixa.

Descritores por faixa, escolhidos por medição nas 103 faixas do acervo em
11/11/2026 (estabilidade = correlação entre a primeira e a segunda metade da
faixa; redundância = maior |r| contra nível, dinâmica, brilho, pulso,
articulação, movimento de textura e recorrência):

  * `sharpness`  nitidez de ataque: p99 do envelope de ataques clareado (o mesmo
                 de `pulse_of`) sobre a mediana dele, em escala log2.
                 Estabilidade 0,76; redundância 0,52 (pulso).
  * `sustain`    sustentação: 1 menos a parte percussiva da energia, numa
                 separação harmônico-percussiva por mediana (17 quadros no
                 tempo, 17 raias na frequência, 60 Hz a 8 kHz).
                 Estabilidade 0,85; redundância 0,44 (pulso).
  * `weight`     peso do grave: parte da potência abaixo de 120 Hz.
                 Estabilidade 0,81; redundância 0,22 (nível). Correlaciona 0,62
                 com a percussividade, porque um bumbo é as duas coisas.
  * `contrast`   microdinâmica: mediana, nos blocos de 1 s com som, da distância
                 entre p90 e p10 do nível em janelas de 25 ms.
                 Estabilidade 0,91; redundância 0,41 (articulação).
  * `beat`       período do pulso, em segundos, **só quando a grade é
                 confiável** (pulso da faixa ≥ 0,5); senão 0. O andamento vem da
                 autocorrelação do mesmo envelope, com preferência log-normal
                 em torno de 120 BPM (uma oitava de desvio) para decidir entre
                 dobro e metade. Nas 103 faixas, as duas metades concordam em
                 ±6% em 55% dos casos; com pulso ≥ 0,5 (29 faixas), em 93%, e em
                 100% descontando dobro e metade.

Recusados na mesma medição: concentração de croma (passa nos números e reprova
na escuta: o piano de Impromptu sai no meio da tabela), mudança harmônica
(0,72 com a recorrência) e decaimento depois do ataque (0,67 entre metades;
mede a densidade da textura, não o espaço).
"""
import argparse
import glob
import importlib.util
import json
import math
import os
import sys
from multiprocessing import Pool

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MUSIC = os.path.join(ROOT, "public", "music")
OUT_TS = os.path.join(ROOT, "src", "components", "horizonte", "content", "motion.generated.ts")

PULSE_GRID = 0.5
TEMPO_PRIOR_BPM = 120.0
TEMPO_PRIOR_OCTAVES = 1.0
HPSS_SIZE = 17
HPSS_BAND = (60.0, 8000.0)
LOW_HZ = 120.0
MICRO_FRAME_S = 0.025
MICRO_BLOCK = 40
CHUNK = 2048

ANCHOR = {
    "sharpness": (math.log2(1.3), math.log2(10.0)),
    "percussive": (0.15, 0.60),
    "weight": (0.05, 0.80),
    "contrast": (3.0, 9.0),
}


def load_audio_module():
    """Reusa decodificação, janelas e envelope de ataques de analyze-audio.py."""
    path = os.path.join(ROOT, "scripts", "analyze-audio.py")
    spec = importlib.util.spec_from_file_location("analyze_audio", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


AA = load_audio_module()
FREQS = np.fft.rfftfreq(AA.FFT, 1 / AA.SR)


def clamp(v, a=0.0, b=1.0):
    return a if v < a else b if v > b else v


def norm(value, key):
    lo, hi = ANCHOR[key]
    return clamp((value - lo) / (hi - lo))


def median_axis(m, size, axis):
    """Mediana deslizante centrada, com as bordas repetidas, em blocos.

    Equivale a `scipy.ndimage.median_filter(mode="nearest")` num eixo só, sem
    acrescentar o SciPy às dependências dos scripts.
    """
    half = size // 2
    out = np.empty_like(m)
    if axis == 1:
        pad = np.pad(m, ((0, 0), (half, half)), mode="edge")
        for s in range(0, m.shape[0], CHUNK):
            e = min(m.shape[0], s + CHUNK)
            win = np.lib.stride_tricks.sliding_window_view(pad[s:e], size, axis=1)
            out[s:e] = np.median(win, axis=-1)
        return out
    pad = np.pad(m, ((half, half), (0, 0)), mode="edge")
    for s in range(0, m.shape[0], CHUNK):
        e = min(m.shape[0], s + CHUNK)
        win = np.lib.stride_tricks.sliding_window_view(pad[s : e + 2 * half], size, axis=0)
        out[s:e] = np.median(win, axis=-1)
    return out


def percussive_share(mag):
    """Parte percussiva da energia: mediana no tempo dá o harmônico, na frequência, o percussivo."""
    sel = (FREQS >= HPSS_BAND[0]) & (FREQS <= HPSS_BAND[1])
    m = mag[:, sel].astype(np.float32)
    h = median_axis(m, HPSS_SIZE, 0)
    p = median_axis(m, HPSS_SIZE, 1)
    h2 = float((h.astype(np.float64) ** 2).sum())
    p2 = float((p.astype(np.float64) ** 2).sum())
    return p2 / (h2 + p2 + 1e-12)


def low_share(mag):
    pw = mag.astype(np.float64) ** 2
    return float(pw[:, FREQS < LOW_HZ].sum() / (pw.sum() + 1e-12))


def micro_contrast(x):
    w = int(round(MICRO_FRAME_S * AA.SR))
    n = len(x) // w
    if n < MICRO_BLOCK * 4:
        return None
    r = np.sqrt((x[: n * w].reshape(n, w).astype(np.float64) ** 2).mean(axis=1)) + 1e-9
    db = 20 * np.log10(r)
    k = len(db) // MICRO_BLOCK
    blk = db[: k * MICRO_BLOCK].reshape(k, MICRO_BLOCK)
    hi = np.percentile(blk, 90, axis=1)
    lo = np.percentile(blk, 10, axis=1)
    loud = hi > np.percentile(hi, 25)
    return float(np.median((hi - lo)[loud]))


def whitened(env):
    """O mesmo clareamento por mediana de `pulse_of`, vetorizado."""
    n = len(env)
    half = AA.MED_HALF
    pad = np.pad(env, (half, half), mode="constant", constant_values=np.nan)
    win = np.lib.stride_tricks.sliding_window_view(pad, 2 * half + 1)
    m = np.nanmedian(win, axis=1)
    w = np.where(m > 1e-9, env / np.maximum(m, 1e-9), 0.0)
    return w - w.mean()


def beat_of(env, pulse):
    """Período do pulso em segundos, ou 0 quando a grade não é confiável."""
    if pulse < PULSE_GRID or len(env) < AA.MIN_PULSE_FRAMES:
        return 0.0
    w = whitened(env)
    n = len(w)
    spec = np.fft.rfft(w, 2 * n)
    ac = np.fft.irfft(spec * np.conj(spec))[: AA.LAG_HI + 1]
    ac = ac / max(ac[0], 1e-12)
    lags = np.arange(AA.LAG_LO, AA.LAG_HI + 1)
    bpm = 60.0 * AA.FPS / lags
    prior = np.exp(-0.5 * (np.log2(bpm / TEMPO_PRIOR_BPM) / TEMPO_PRIOR_OCTAVES) ** 2)
    i = int(np.argmax(np.maximum(ac[AA.LAG_LO : AA.LAG_HI + 1], 0) * prior))
    return float(lags[i] / AA.FPS)


def analyze_track(path):
    x = AA.decode(path)
    fr, mag = AA.frames(x)
    if fr is None:
        return None
    env = AA.onset_envelope(mag)
    pulse = AA.pulse_of(env)
    spiky = float(np.percentile(env, 99) / max(float(np.median(env)), 1e-9))
    contrast = micro_contrast(x)
    measured = dict(
        sharpness=spiky,
        percussive=percussive_share(mag),
        weight=low_share(mag),
        contrast=contrast if contrast is not None else 0.0,
        pulse=pulse,
        beat=beat_of(env, pulse),
    )
    return dict(
        measured=measured,
        sharpness=round(norm(math.log2(max(spiky, 1.0)), "sharpness"), 4),
        sustain=round(1 - norm(measured["percussive"], "percussive"), 4),
        weight=round(norm(measured["weight"], "weight"), 4),
        contrast=round(norm(measured["contrast"], "contrast"), 4),
        beat=round(measured["beat"], 4),
    )


def emit(albums):
    lines = [
        'import type { TrackMotion } from "./motion";',
        "",
        "export const MOTIONS: Record<string, (TrackMotion | null)[]> = {",
    ]
    for slug, tracks in albums:
        lines.append(f"  {json.dumps(slug)}: [")
        for t in tracks:
            if t is None:
                lines.append("    null,")
                continue
            lines.append(
                "    { "
                f"sharpness: {json.dumps(t['sharpness'])}, sustain: {json.dumps(t['sustain'])}, "
                f"weight: {json.dumps(t['weight'])}, contrast: {json.dumps(t['contrast'])}, "
                f"beat: {json.dumps(t['beat'])} }},"
            )
        lines.append("  ],")
    lines += ["};", ""]
    open(OUT_TS, "w", encoding="utf-8").write("\n".join(lines))


def tracks_of(slug):
    d = os.path.join(MUSIC, slug)
    return sorted(
        f for f in glob.glob(os.path.join(d, "*"))
        if os.path.splitext(f)[1].lower() in (".m4a", ".mp3", ".ogg", ".opus")
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only")
    ap.add_argument("--report", action="store_true")
    ap.add_argument("--jobs", type=int, default=max(1, (os.cpu_count() or 2) - 2))
    args = ap.parse_args()

    order = [slug for slug, _cover in AA.album_order() if not args.only or args.only == slug]
    jobs = [(slug, f) for slug in order for f in tracks_of(slug)]
    with Pool(args.jobs) as pool:
        results = pool.map(analyze_track, [f for _slug, f in jobs])
    by_album = {slug: [] for slug in order}
    for (slug, _f), r in zip(jobs, results):
        by_album[slug].append(r)
    albums = [(slug, by_album[slug]) for slug in order]

    if args.only:
        print(json.dumps(albums, indent=1))
        return
    emit(albums)

    if args.report:
        print(f"{'album':40}{'nítido':>8}{'sustent':>8}{'grave':>8}{'contr':>8}{'grade':>7}")
        for slug, tracks in albums:
            ok = [t for t in tracks if t]
            mean = lambda k: sum(t[k] for t in ok) / max(1, len(ok))
            grid = sum(1 for t in ok if t["beat"] > 0)
            print(f"{slug[:40]:40}{mean('sharpness'):8.2f}{mean('sustain'):8.2f}"
                  f"{mean('weight'):8.2f}{mean('contrast'):8.2f}{grid:4d}/{len(ok)}")
    print(f"escrito {os.path.relpath(OUT_TS, ROOT)}", file=sys.stderr)


if __name__ == "__main__":
    main()
