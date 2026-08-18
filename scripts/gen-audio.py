"""
Gera os arquivos de áudio reais do catálogo Horizonte (.m4a, AAC-LC mono).

Substitui a simulação por envelope de BPM do protótipo: o app toca estes
arquivos num HTMLAudioElement e extrai bass/mid/treb de um AnalyserNode.
Cada faixa é sintetizada com a duração e o BPM do catálogo, com conteúdo real
nas três bandas (20–160 / 160–2k / 2k–12k Hz).

    python3 scripts/gen-audio.py [--only a-001]

Para o catálogo real, basta trocar os arquivos em public/audio/ mantendo os
nomes — nada no app muda.
"""
import argparse
import math
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np

SR = 32000
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "audio"))
BITRATE = 48000

ALBUMS = [
    dict(id="a-001", bpm=88, seed=7, root=55.0, mode="densidade",
         tracks=[("Peso Morto", 214), ("Densidade", 252), ("Colapso Suave", 188),
                 ("Anel", 301), ("Fuga de Massa", 176)]),
    dict(id="b-014", bpm=104, seed=31, root=73.42, mode="queda",
         tracks=[("Queda Livre", 197), ("Vento de Cauda", 233), ("Cinza Clara", 165),
                 ("Órbita Baixa", 288)]),
    dict(id="c-028", bpm=76, seed=91, root=49.0, mode="mare",
         tracks=[("Maré de Sizígia", 268), ("Baixa-mar", 199), ("Sal", 154),
                 ("Interior", 322), ("Corrente Fria", 205)]),
    dict(id="d-037", bpm=122, seed=53, root=65.41, mode="bloco",
         tracks=[("Bloco", 181), ("Silêncio Sólido", 244), ("Prensa", 167),
                 ("Vazio Cheio", 276)]),
    dict(id="e-052", bpm=68, seed=17, root=43.65, mode="ferro",
         tracks=[("Ferro Doce", 289), ("Rebite", 172), ("Solda Fria", 231),
                 ("Bigorna", 198), ("Lima", 143)]),
]

# graus de acorde por modo (semitons sobre a fundamental), 4 acordes
PROGRESSIONS = {
    "densidade": [(0, 3, 7, 10), (0, 3, 7, 10), (-2, 3, 5, 10), (-4, 3, 7, 12)],
    "queda":     [(0, 4, 7, 11), (-3, 4, 7, 9), (2, 5, 9, 12), (-5, 2, 7, 11)],
    "mare":      [(0, 3, 7, 12), (-5, 2, 7, 10), (0, 3, 8, 12), (-7, 0, 5, 10)],
    "bloco":     [(0, 3, 7, 10), (0, 3, 6, 10), (-1, 2, 6, 11), (0, 5, 7, 12)],
    "ferro":     [(0, 5, 7, 12), (-4, 3, 7, 10), (0, 3, 7, 14), (-2, 5, 9, 12)],
}


def st(n):
    return 2.0 ** (n / 12.0)


def spectral_noise(n, rng, tilt, lo=None, hi=None):
    """Ruído com envelope espectral, via FFT (rápido e sem scipy)."""
    x = rng.normal(0, 1, n)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    g = np.ones_like(f)
    g[1:] = (f[1:] / 1000.0) ** tilt
    if lo:
        g *= 1.0 / (1.0 + (lo / np.maximum(f, 1e-6)) ** 4)
    if hi:
        g *= 1.0 / (1.0 + (np.maximum(f, 1e-6) / hi) ** 4)
    return np.fft.irfft(X * g, n)


def kick(rng, punch=1.0, length=0.42):
    n = int(SR * length)
    t = np.arange(n) / SR
    f = 46 + 105 * np.exp(-t * 26)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5.2)
    click = spectral_noise(n, rng, 0.4, lo=800) * np.exp(-t * 90) * 0.25 * punch
    return (body + click) * 0.95


def hat(rng, length=0.11, bright=1.0):
    n = int(SR * length)
    t = np.arange(n) / SR
    return spectral_noise(n, rng, 1.2 * bright, lo=3800) * np.exp(-t * 46) * 0.30


def thump(rng, length=0.55):
    """Peça metálica / percussão média, alimenta a banda do meio."""
    n = int(SR * length)
    t = np.arange(n) / SR
    partials = sum(
        np.sin(2 * np.pi * fq * t) * a
        for fq, a in ((196, 1.0), (293, 0.55), (441, 0.35), (712, 0.22), (1103, 0.12))
    )
    return partials * np.exp(-t * 9.0) * 0.22 + spectral_noise(n, rng, 0.6, lo=500, hi=6000) * np.exp(-t * 24) * 0.16


def place(buf, sample, at):
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sample))
    buf[i:j] += sample[: j - i]


def pad(n, root, chord, bars, bar_len, rng, warmth=1.0):
    """Colchão harmônico: aditivo, com LFO lento. Ocupa a banda do meio."""
    t = np.arange(n) / SR
    out = np.zeros(n)
    for bi in range(bars):
        c = chord[bi % len(chord)]
        i0, i1 = int(bi * bar_len * SR), int(min(n, (bi + 1) * bar_len * SR))
        if i0 >= n:
            break
        seg = np.arange(i1 - i0) / SR
        env = np.minimum(1.0, seg / (bar_len * 0.35)) * np.minimum(
            1.0, (bar_len - seg) / (bar_len * 0.45)
        )
        env = np.clip(env, 0, 1)
        v = np.zeros(i1 - i0)
        for d in c:
            f0 = root * st(d) * 4
            for h, amp in ((1, 1.0), (2, 0.42), (3, 0.24), (5, 0.11), (7, 0.06)):
                det = 1.0 + (rng.random() - 0.5) * 0.006
                v += np.sin(2 * np.pi * f0 * h * det * (seg + t[i0]) + rng.random() * 6.28) * (
                    amp / (h ** (1.25 / warmth))
                )
        out[i0:i1] += v * env / (len(c) * 3.0)
    lfo = 0.72 + 0.28 * np.sin(2 * np.pi * 0.043 * t + rng.random() * 6.28)
    return out * lfo * 0.5


def drone(n, root, rng):
    t = np.arange(n) / SR
    v = np.zeros(n)
    for f, a in ((root, 1.0), (root * 2, 0.34), (root * 1.005, 0.5), (root * 3, 0.10)):
        v += np.sin(2 * np.pi * f * t + rng.random() * 6.28) * a
    swell = 0.55 + 0.45 * np.sin(2 * np.pi * 0.017 * t + rng.random() * 6.28)
    return v * swell * 0.16


def air(n, rng, gain=1.0):
    """Textura de agudos, alimenta a banda 2k–12k."""
    v = spectral_noise(n, rng, 0.9, lo=2600, hi=12500)
    t = np.arange(n) / SR
    mod = 0.35 + 0.65 * np.abs(np.sin(2 * np.pi * 0.031 * t + rng.random() * 6.28))
    return v * mod * 0.05 * gain


def synth(dur, bpm, seed, root, mode):
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    beat = 60.0 / bpm
    bar_len = beat * 4
    bars = int(math.ceil(dur / bar_len))
    chord = PROGRESSIONS[mode]

    buf = np.zeros(n)
    k = kick(rng, punch=1.3 if mode in ("bloco", "densidade") else 0.8)
    h = hat(rng, bright=1.3 if mode in ("queda", "bloco") else 0.8)
    th = thump(rng)

    for b in range(bars):
        sect = (b // 8) % 4
        t0 = b * bar_len
        if t0 > dur:
            break
        dense = sect != 0
        for s in range(4):
            at = t0 + s * beat
            if at > dur:
                break
            if mode == "mare" and s % 2 == 1 and not dense:
                continue
            place(buf, k * (1.0 if s == 0 else 0.72), at)
            if dense and s in (1, 3):
                place(buf, th * 0.9, at)
        if dense:
            for s in range(8):
                at = t0 + s * beat / 2 + beat / 4
                if at > dur:
                    break
                place(buf, h * (0.55 + 0.45 * ((s % 3) == 0)), at)

    buf += pad(n, root, chord, bars, bar_len, rng, warmth=1.2 if mode == "ferro" else 1.0)
    buf += drone(n, root, rng)
    buf += air(n, rng, gain=1.4 if mode == "queda" else 1.0)

    # limitador suave + normalização + fades
    buf = np.tanh(buf * 1.15)
    peak = np.max(np.abs(buf)) or 1.0
    buf *= 0.84 / peak
    fi, fo = int(SR * 1.2), int(SR * 2.5)
    buf[:fi] *= np.linspace(0, 1, fi)
    buf[-fo:] *= np.linspace(1, 0, fo)
    return buf


def write_wav(path, x):
    a = np.clip(x, -1, 1)
    pcm = (a * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def encode(wav_path, m4a_path):
    subprocess.run(
        ["afconvert", "-f", "m4af", "-d", "aac", "-b", str(BITRATE), "-q", "127",
         "--src-quality", "127", wav_path, m4a_path],
        check=True, capture_output=True,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default=None, help="id do álbum, ex.: a-001")
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for alb in ALBUMS:
        if args.only and alb["id"] != args.only:
            continue
        for k, (title, dur) in enumerate(alb["tracks"]):
            name = f"{alb['id']}-{k + 1:02d}.m4a"
            dest = os.path.join(OUT, name)
            x = synth(dur, alb["bpm"], alb["seed"] * 101 + k * 17, alb["root"], alb["mode"])
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp_path = tmp.name
            try:
                write_wav(tmp_path, x)
                encode(tmp_path, dest)
            finally:
                os.unlink(tmp_path)
            size = os.path.getsize(dest)
            total += size
            print(f"{name}  {dur}s  {size/1024:.0f} KB  ({title})", flush=True)
    print(f"total {total/1024/1024:.1f} MB")


if __name__ == "__main__":
    sys.exit(main())
