"""
Assinatura sensorial do Horizonte — análise offline do áudio de cada álbum.

Roda depois de `fetch-curation.py`, sobre os arquivos já publicados em
`public/music/`, e gera `src/components/horizonte/content/signature.generated.ts`.

    python3 scripts/analyze-audio.py [--only <slug>] [--force] [--report]

Princípio: **a música define as constantes do mundo; a reprodução só as perturba.**
Tudo o que um disco *é* — volume, dinâmica, brilho, duração, forma — é medido aqui,
uma vez, e vira constante. O navegador não recalcula nada disto.

Duas garantias de determinismo:

  * Cada descritor é normalizado contra **âncoras fixas e absolutas** (constantes
    deste arquivo), nunca contra os outros álbuns da coleção. Acrescentar um álbum
    não muda a assinatura de nenhum outro.
  * A tinta de reserva das capas acromáticas vem do **próprio áudio** do álbum
    (balanço espectral), nunca da posição na lista de curadoria.

Sem dependências novas: `afconvert` (CoreAudio) decodifica para WAV, o módulo
`wave` da biblioteca padrão lê, e numpy faz o resto.
"""
import argparse
import base64
import glob
import importlib.util
import json
import math
import os
import subprocess
import sys
import wave

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MUSIC = os.path.join(ROOT, "public", "music")
CACHE = os.path.join(ROOT, ".cache", "analysis")
OUT_TS = os.path.join(
    ROOT, "src", "components", "horizonte", "content", "signature.generated.ts"
)
CURATION_TS = os.path.join(
    ROOT, "src", "components", "horizonte", "content", "curation.generated.ts"
)

# --------------------------------------------------------------- parâmetros DSP
SR = 22050          # taxa de análise: cobre até 11 kHz, suficiente para centróide
FFT = 1024          # o mesmo fftSize do AnalyserNode em runtime
HOP = 512
ENVELOPE_N = 512    # amostras do envelope por álbum (~0,7° de anel por amostra)
ENV_WIN = 0.20      # janela do envelope, em segundos

# Faixas de frequência — idênticas às de `audio/analysis.ts`.
BANDS = {"bass": (20, 160), "mid": (160, 2000), "treb": (2000, 11000)}

# Mapeamento dB → byte do AnalyserNode (valores padrão do Web Audio).
MIN_DB, MAX_DB = -100.0, -30.0

# ------------------------------------------------------- âncoras de normalização
# Absolutas e fixas: definem o que conta como "silencioso/alto", "comprimido/
# dinâmico", "escuro/brilhante" e "curto/longo" para *qualquer* disco, não só
# para os dez atuais. Calibradas com folga em volta do acervo medido para que
# um álbum novo caia dentro sem reescalar os existentes.
ANCHOR = {
    "loudness": (-32.0, -12.0),      # dB RMS médio
    "dynamics": (12.0, 36.0),        # dB entre p95 e p05 do RMS
    "brightness": (200.0, 2600.0),   # Hz, centróide espectral (interpolado em log2)
    "duration": (900.0, 5400.0),     # s, de 15 a 90 minutos
    "rolloff": (400.0, 4200.0),      # Hz, onde se acumulam 85% da energia (log2)
    "pulse": (0.08, 0.88),           # periodicidade do ataque, adimensional
    "bass_ratio": (0.20, 0.85),      # fração da energia abaixo de 300 Hz
}

CHROMA_GATE = 0.035  # mesmo limiar de `extract_inks`: abaixo disto a capa é acromática


def load_curation_module():
    """Importa fetch-curation.py para reusar a ciência de cor (OKLab/OKLCH)."""
    path = os.path.join(ROOT, "scripts", "fetch-curation.py")
    spec = importlib.util.spec_from_file_location("fetch_curation", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


FC = load_curation_module()


def clamp(v, a=0.0, b=1.0):
    return a if v < a else b if v > b else v


def norm(value, key, log=False):
    lo, hi = ANCHOR[key]
    if log:
        value, lo, hi = math.log2(max(value, 1e-6)), math.log2(lo), math.log2(hi)
    return round(clamp((value - lo) / (hi - lo)), 4)


# ------------------------------------------------------------------ decodificação
def decode(path):
    os.makedirs(CACHE, exist_ok=True)
    key = os.path.relpath(path, MUSIC).replace(os.sep, "--")
    dest = os.path.join(CACHE, key + ".wav")
    if not os.path.exists(dest):
        r = subprocess.run(
            ["afconvert", "-f", "WAVE", "-d", f"LEI16@{SR}", "-c", "1", path, dest],
            capture_output=True,
        )
        if r.returncode != 0:
            raise SystemExit(f"afconvert falhou em {path}:\n{r.stderr.decode()}")
    with wave.open(dest) as wf:
        n = wf.getnframes()
        x = np.frombuffer(wf.readframes(n), dtype="<i2").astype(np.float32) / 32768.0
    return x


def frames(x):
    """Janelas de Hann sobrepostas, como o AnalyserNode faz."""
    k = (len(x) - FFT) // HOP
    if k < 4:
        return None, None
    idx = np.arange(k)[:, None] * HOP + np.arange(FFT)[None, :]
    fr = x[idx] * np.hanning(FFT)
    return fr, np.abs(np.fft.rfft(fr, axis=1))


# --------------------------------------------------------------- pulso
# Periodicidade do ataque: autocorrelação do envelope de ataques entre 0,25 s e
# 2 s. Porte fiel de `pulseOf` em ingest/dsp.ts — mesmo clareamento por bin,
# mesma janela de mediana, mesmas fronteiras de lag.
PULSE_MEMORY = 0.90
PULSE_FLOOR = 1e-4
PULSE_MED_WIN_S = 1.5
PULSE_LAG_LO_S = 0.25
PULSE_LAG_HI_S = 2.0

FPS = SR / HOP
LAG_LO = max(2, round(PULSE_LAG_LO_S * FPS))
LAG_HI = round(PULSE_LAG_HI_S * FPS)
MED_HALF = max(1, round(PULSE_MED_WIN_S * FPS) // 2)
MIN_PULSE_FRAMES = LAG_HI * 2


def onset_envelope(mag):
    """Fluxo espectral com clareamento adaptativo por raia.

    Cada raia é dividida pelo próprio pico recente antes da diferença. É isso
    que impede o descritor de virar um proxy de brilho: sem o clareamento, a
    correlação com o brilho medido do acervo é 0,825.
    """
    n, bins = mag.shape
    floor = PULSE_FLOOR * (FFT / 2)
    peak = np.full(bins, floor)
    prev = np.zeros(bins)
    env = np.zeros(n)
    for f in range(n):
        row = mag[f]
        peak = np.maximum(np.maximum(row, PULSE_MEMORY * peak), floor)
        w = row / peak
        d = w - prev
        if f > 0:
            env[f] = float(d[d > 0].sum())
        prev = w
    return env


def pulse_of(env):
    n = len(env)
    if n < MIN_PULSE_FRAMES:
        return 0.0
    w = np.empty(n)
    for i in range(n):
        lo = max(0, i - MED_HALF)
        hi = min(n, i + MED_HALF + 1)
        m = float(np.median(env[lo:hi]))
        w[i] = env[i] / m if m > 1e-9 else 0.0
    w = w - w.mean()
    e0 = float((w * w).sum())
    if e0 < 1e-12:
        return 0.0
    best = 0.0
    for lag in range(LAG_LO, min(n - 1, LAG_HI) + 1):
        r = float((w[: n - lag] * w[lag:]).sum()) / e0
        if r > best:
            best = r
    return best


def band_bytes(mag):
    """Reproduz o valor 0..1 que `analysis.ts` lê de getByteFrequencyData."""
    freqs = np.fft.rfftfreq(FFT, 1 / SR)
    db = 20 * np.log10(np.maximum(mag / (FFT / 2), 1e-10))
    byte = np.clip((db - MIN_DB) / (MAX_DB - MIN_DB), 0, 1)
    out = {}
    for name, (lo, hi) in BANDS.items():
        sel = (freqs >= lo) & (freqs <= hi)
        out[name] = byte[:, sel].mean(axis=1)
    return out


# ------------------------------------------------------------------- por álbum
def analyze_album(slug, tracks_files):
    rms_all, cent_all, roll_all = [], [], []
    track_bright = []
    band_all = {k: [] for k in BANDS}
    env_parts, spans, dur_total = [], [], 0.0
    low_e = high_e = 0.0
    pulse_num = pulse_den = 0.0

    for f in tracks_files:
        x = decode(f)
        dur = len(x) / SR
        dur_total += dur
        spans.append(dur)

        fr, mag = frames(x)
        if fr is None:
            env_parts.append(np.zeros(1))
            track_bright.append(None)
            continue

        rms = np.sqrt((fr ** 2).mean(axis=1)) + 1e-9
        rms_all.append(rms)

        freqs = np.fft.rfftfreq(FFT, 1 / SR)
        msum = mag.sum(axis=1) + 1e-9
        cent = (mag * freqs).sum(axis=1) / msum
        cent_all.append(cent)
        track_bright.append(float(cent.mean()))
        cs = np.cumsum(mag, axis=1)
        roll_all.append(freqs[np.argmax(cs >= 0.85 * cs[:, -1:], axis=1)])

        for k, v in band_bytes(mag).items():
            band_all[k].append(v)

        if len(mag) >= MIN_PULSE_FRAMES:
            pulse_num += pulse_of(onset_envelope(mag)) * dur
            pulse_den += dur

        # balanço grave/agudo, para a tinta de reserva
        low_e += float(mag[:, freqs < 300].sum())
        high_e += float(mag.sum())

        # envelope no tempo do álbum
        hop_env = max(1, int(SR * ENV_WIN))
        kk = max(1, len(x) // hop_env)
        env_parts.append(
            np.sqrt((x[: kk * hop_env].reshape(kk, hop_env) ** 2).mean(axis=1))
        )

    R = np.concatenate(rms_all)
    C = np.concatenate(cent_all)
    RO = np.concatenate(roll_all)
    bands = {k: np.concatenate(v) for k, v in band_all.items()}

    loud_db = float(20 * np.log10(R.mean()))
    dyn_db = float(20 * np.log10(np.percentile(R, 95) / max(np.percentile(R, 5), 1e-9)))
    bright = float(C.mean())
    rolloff = float(RO.mean())
    bass_ratio = low_e / max(high_e, 1e-9)
    pulse = pulse_num / pulse_den if pulse_den > 0 else 0.0
    # Faixa curta demais para medir herda o brilho do álbum: não desloca a luz.
    track_bright = [round(bright if b is None else b, 1) for b in track_bright]

    # ---- envelope do álbum inteiro, reamostrado para ENVELOPE_N pontos
    env = np.concatenate(env_parts)
    xs = np.linspace(0, len(env) - 1, ENVELOPE_N)
    env_r = np.interp(xs, np.arange(len(env)), env)
    # percentis do próprio álbum: a forma é relativa ao disco, não à coleção
    lo, hi = np.percentile(env_r, 4), np.percentile(env_r, 96)
    env_n = np.clip((env_r - lo) / max(hi - lo, 1e-9), 0, 1)
    env_u8 = np.round(env_n * 255).astype(np.uint8)

    # ---- âncoras de banda para o runtime: p10/p90 do próprio álbum
    band_ref = {
        k: (round(float(np.percentile(v, 10)), 4), round(float(np.percentile(v, 90)), 4))
        for k, v in bands.items()
    }
    rms_ref = (
        round(float(np.percentile(R, 10)), 5),
        round(float(np.percentile(R, 90)), 5),
    )

    return dict(
        slug=slug,
        duration=round(dur_total, 2),
        loudness_db=round(loud_db, 2),
        dynamics_db=round(dyn_db, 2),
        brightness_hz=round(bright, 1),
        rolloff_hz=round(rolloff, 1),
        bass_ratio=round(bass_ratio, 4),
        pulse=round(pulse, 4),
        track_bright=track_bright,
        spans=[round(s / dur_total, 6) for s in spans],
        envelope=base64.b64encode(env_u8.tobytes()).decode(),
        band_ref=band_ref,
        rms_ref=rms_ref,
    )


# --------------------------------------------------------------- tinta por áudio
def cover_is_achromatic(cover_path):
    img = Image.open(cover_path).convert("RGB")
    small = img.resize((160, 160))
    pal = small.quantize(colors=24, method=Image.Quantize.MEDIANCUT)
    table = pal.getpalette()
    chroma = []
    for _count, idx in sorted(pal.getcolors(), key=lambda c: -c[0]):
        r, g, b = (c / 255 for c in table[idx * 3: idx * 3 + 3])
        L, C, _h = FC.oklch(r, g, b)
        if 0.18 <= L <= 0.93:
            chroma.append(C)
    return (not chroma) or max(chroma) < CHROMA_GATE


def ink_from_audio(sig):
    """
    Matiz a partir do balanço espectral do próprio álbum.

    Grave/escuro → âmbar quente; agudo/brilhante → azul frio. É a correspondência
    sinestésica convencional (frequência baixa = comprimento de onda longo) e,
    principalmente, é uma propriedade do disco: não muda se a coleção mudar.

    O eixo combina três medidas do mesmo contínuo escuro↔brilhante, porque
    nenhuma delas sozinha discrimina bem. Centróide e rolloff quase empatam entre
    discos escuros; `lowRatio` é o que de fato os separa (Meho 0,685 contra
    Jajce 0,578), então pesa mais.

    Discos que medem parecido recebem matizes próximas — isso é o sistema
    funcionando, não falhando: a identidade vem do som, e sons parecidos são
    parecidos. A separação não é forçada, porque forçá-la exigiria comparar os
    álbuns entre si e reintroduziria a dependência de coleção que se quer eliminar.
    """
    b = norm(sig["brightness_hz"], "brightness", log=True)
    r = norm(sig["rolloff_hz"], "rolloff", log=True)
    g = clamp((sig["bass_ratio"] - ANCHOR["bass_ratio"][0])
              / (ANCHOR["bass_ratio"][1] - ANCHOR["bass_ratio"][0]))
    axis = clamp(0.34 * b + 0.22 * r + 0.44 * (1.0 - g))

    # O arco vai de vermelho quente a azul frio passando por magenta e violeta —
    # e não pelo amarelo/verde. Não é gosto: no corredor oklch(L .50–.62,
    # C .13–.18) a região amarelo-verde não sustenta croma, então `force_range`
    # precisa caçar matiz e o mapeamento deixa de ser monotônico (um passo pedido
    # de 0,367 rad chega a virar 0,017, com um salto de 1,2 rad no meio do arco).
    # Pelo lado do magenta o passo se preserva quase exatamente (0,237 de 0,238),
    # então distâncias musicais viram distâncias de cor proporcionais.
    HUE_WARM, HUE_COOL = 0.60, -2.25       # radianos em OKLCH
    hue = HUE_WARM + (HUE_COOL - HUE_WARM) * axis
    a = FC.force_range(hue, L=0.56, C=0.155)
    b2 = FC.force_range(hue + 2.35, L=0.56, C=0.145)
    return a, b2


# ------------------------------------------------------------------- emissão TS
def album_order():
    """Ordem e ids/capas tal como estão no arquivo de curadoria gerado."""
    import re

    src = open(CURATION_TS, encoding="utf-8").read()
    return re.findall(
        r'id: "([^"]+)",\s*\n\s*provider:.*?cover: "([^"]+)"', src, re.S
    )


def emit(entries):
    def num(v):
        return json.dumps(v)

    # O TypeScript deste repo não leva comentários: a explicação vive aqui e em
    # docs/mapa-sensorial.md. Ver a docstring do módulo.
    lines = [
        'import type { AlbumSignature } from "./signature";',
        "",
        "export const SIGNATURES: Record<string, AlbumSignature> = {",
    ]
    for e in entries:
        s = e["sig"]
        lines += [
            f'  {json.dumps(s["slug"])}: {{',
            f'    loudness: {num(e["loudness"])},',
            f'    dynamics: {num(e["dynamics"])},',
            f'    brightness: {num(e["brightness"])},',
            f'    duration: {num(e["duration"])},',
            f'    pulse: {num(e["pulse"])},',
            "    measured: {",
            f'      loudnessDb: {num(s["loudness_db"])},',
            f'      dynamicsDb: {num(s["dynamics_db"])},',
            f'      brightnessHz: {num(s["brightness_hz"])},',
            f'      rolloffHz: {num(s["rolloff_hz"])},',
            f'      bassRatio: {num(s["bass_ratio"])},',
            f'      pulse: {num(s["pulse"])},',
            f'      durationS: {num(s["duration"])},',
            "    },",
            f'    spans: {json.dumps(s["spans"])},',
            "    trackBrightness: "
            + json.dumps([norm(hz, "brightness", log=True) for hz in s["track_bright"]])
            + ",",
            f'    envelope: {json.dumps(s["envelope"])},',
            "    reference: {",
            f'      bass: {json.dumps(list(s["band_ref"]["bass"]))},',
            f'      mid: {json.dumps(list(s["band_ref"]["mid"]))},',
            f'      treb: {json.dumps(list(s["band_ref"]["treb"]))},',
            f'      rms: {json.dumps(list(s["rms_ref"]))},',
            "    },",
        ]
        if e.get("ink"):
            a, b = e["ink"]
            lines += [
                f'    inkA: {json.dumps(list(a))},',
                f'    inkB: {json.dumps(list(b))},',
            ]
        lines.append("  },")
    lines += ["};", ""]
    open(OUT_TS, "w", encoding="utf-8").write("\n".join(lines))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only")
    ap.add_argument("--report", action="store_true")
    args = ap.parse_args()

    entries = []
    for slug, cover in album_order():
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
        sig = analyze_album(slug, files)
        entry = dict(
            sig=sig,
            loudness=norm(sig["loudness_db"], "loudness"),
            dynamics=norm(sig["dynamics_db"], "dynamics"),
            brightness=norm(sig["brightness_hz"], "brightness", log=True),
            duration=norm(sig["duration"], "duration"),
            pulse=norm(sig["pulse"], "pulse"),
        )
        cover_path = os.path.join(ROOT, "public", cover.lstrip("/"))
        if os.path.exists(cover_path) and cover_is_achromatic(cover_path):
            entry["ink"] = ink_from_audio(sig)
        entries.append(entry)
        print(f"  · {slug}: {len(files)} faixas, {sig['duration']/60:.1f} min")

    emit(entries)
    print(f"\n{len(entries)} álbuns → {os.path.relpath(OUT_TS, ROOT)}")

    if args.report:
        print(
            f"\n{'álbum':30}{'loud':>7}{'dyn':>7}{'bright':>8}{'dur':>7}{'pulso':>8}"
            "   normalizados"
        )
        for e in entries:
            s = e["sig"]
            tag = "  ← tinta do áudio" if e.get("ink") else ""
            print(
                f"{s['slug']:30}{s['loudness_db']:>7.1f}{s['dynamics_db']:>7.1f}"
                f"{s['brightness_hz']:>8.0f}{s['duration']/60:>7.1f}{s['pulse']:>8.3f}   "
                f"L{e['loudness']:.2f} D{e['dynamics']:.2f} "
                f"B{e['brightness']:.2f} T{e['duration']:.2f} P{e['pulse']:.2f}{tag}"
            )


if __name__ == "__main__":
    main()
