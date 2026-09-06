#!/usr/bin/env python3
"""
Gera a fixture de paridade browser ↔ pipeline offline.

Por que existe: o teste de paridade real lê os WAVs completos de `.cache/analysis`
(2,1 GB, fora do git), então ele nunca roda em CI — a alegação "held to the same
numbers" ficava sem verificação pública. Este script recorta alguns segundos de um
álbum, roda o MESMO `analyze_album` do pipeline offline sobre o recorte e grava o
resultado como golden. O teste em CI passa os recortes pelo DSP em TypeScript e
exige que os números batam.

É o padrão dos vetores de conformidade do Gauntlet: uma entrada versionada, dois
motores independentes, e a obrigação de concordarem.

Uso:  python3 scripts/make-parity-fixture.py [--seconds 10] [--slug accasari]
Requer: .cache/analysis populado (ou seja, rodar uma vez na máquina que tem o acervo).
"""

import argparse
import importlib.util
import json
import os
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache", "analysis")
OUT = os.path.join(ROOT, "src", "components", "horizonte", "__tests__", "fixtures", "parity")
SR = 22050


def load_analyzer():
    """Importa analyze-audio.py como módulo (tem guarda __main__, não roda nada)."""
    spec = importlib.util.spec_from_file_location(
        "analyze_audio", os.path.join(ROOT, "scripts", "analyze-audio.py")
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def read_wav(path):
    with wave.open(path) as wf:
        assert wf.getnchannels() == 1, f"esperado mono: {path}"
        assert wf.getframerate() == SR, f"esperado {SR} Hz: {path}"
        n = wf.getnframes()
        return np.frombuffer(wf.readframes(n), dtype="<i2").astype(np.float32) / 32768.0


def write_wav(path, x):
    pcm = np.clip(x * 32768.0, -32768, 32767).astype("<i2")
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seconds", type=float, default=10.0)
    ap.add_argument("--slug", default="accasari")
    args = ap.parse_args()

    sources = sorted(
        os.path.join(CACHE, f)
        for f in os.listdir(CACHE)
        if f.startswith(f"{args.slug}--") and f.endswith(".wav")
    )
    if not sources:
        raise SystemExit(f"nenhum WAV de '{args.slug}' em {CACHE}")

    os.makedirs(OUT, exist_ok=True)
    keep = int(args.seconds * SR)

    # Recorta a partir de 30 s para evitar fade-in/silêncio inicial, que deixaria
    # o pulso degenerado e o teste fraco.
    skip = min(30 * SR, max(0, len(read_wav(sources[0])) - keep))

    cut_paths = []
    for i, src in enumerate(sources, 1):
        x = read_wav(src)
        seg = x[skip : skip + keep]
        if len(seg) < keep:
            seg = x[:keep]
        dest = os.path.join(OUT, f"track-{i:02d}.wav")
        write_wav(dest, seg)
        cut_paths.append(dest)
        print(f"  recorte {i}: {len(seg)/SR:.1f}s → {os.path.relpath(dest, ROOT)}")

    aa = load_analyzer()
    # decode() do pipeline resolve caminhos pela convenção MUSIC→CACHE; aqui os
    # arquivos já são WAV no formato de análise, então lemos direto.
    aa.decode = read_wav

    sig = aa.analyze_album(f"{args.slug}-parity-fixture", cut_paths)

    # Mapeia os nomes do pipeline Python para os do AlbumMeasurement em TypeScript,
    # para o teste comparar campo a campo sem tradução implícita.
    golden = {
        "_comment": (
            "Vetor de conformidade: gerado por scripts/make-parity-fixture.py a partir "
            "do pipeline offline (scripts/analyze-audio.py). Não editar à mão — regenerar."
        ),
        "sourceSlug": args.slug,
        "seconds": args.seconds,
        "sampleRate": SR,
        "tracks": [os.path.basename(p) for p in cut_paths],
        "expected": {
            "durationS": sig["duration"],
            "loudnessDb": sig["loudness_db"],
            "dynamicsDb": sig["dynamics_db"],
            "brightnessHz": sig["brightness_hz"],
            "rolloffHz": sig["rolloff_hz"],
            "bassRatio": sig["bass_ratio"],
            "pulse": sig["pulse"],
            "trackPulse": sig["track_pulse"],
            "trackBrightnessHz": sig["track_bright"],
            "spans": sig["spans"],
            "envelopeBase64": sig["envelope"],
        },
    }
    dest = os.path.join(OUT, "golden.json")
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(golden, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"  golden  → {os.path.relpath(dest, ROOT)}")


if __name__ == "__main__":
    main()
