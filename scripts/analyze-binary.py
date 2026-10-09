"""
Peso binário de cada faixa do Horizonte: quanto ela se organiza em torno de dois
materiais de importância parecida que se alternam.

Roda depois de `analyze-form.py`, sobre o mesmo cache de WAV, e gera
`src/components/horizonte/content/binary.generated.ts`.

    python3 scripts/analyze-binary.py

O equilíbrio lido direto das seções de `analyze-form.py` não serve para decidir
arquitetura: medido no acervo (103 faixas), ruído de -55 dB ou um deslocamento de
0,7 s na grade de análise bastavam para levar 23 faixas de um centro para dois.
Este script mede a mesma grandeza de forma robusta:

  * soma um piso de ruído fixo (-50 dB, semente fixa) antes da análise, para que
    passagens quase silenciosas não dependam do ruído de cada codificação;
  * repete a segmentação em quatro grades deslocadas (0; 0,5; 1; 1,5 s);
  * em cada grade, peso = suave(segundo material / primeiro, 0,45 a 0,85)
    × mín(1, alternâncias entre os dois / 2)
    × suave(parte do par entre todos os materiais, 0,55 a 0,85). O último fator
    separa um sistema de dois materiais de uma faixa com quatro materiais iguais,
    que não é binária;
  * o peso da faixa é a média das quatro grades. Quando as grades discordam, a
    faixa fica a meio caminho em vez de saltar de uma arquitetura para outra.

Sob as mesmas perturbações, a confiabilidade (ICC) sobe de 0,81 para 0,95 e só 4
faixas variam mais de 0,3. Resultado no acervo: 67 faixas com um centro, 20 com
indício de binário, 10 intermediárias e 6 binárias fortes.
"""
import importlib.util
import json
import os
import sys

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_TS = os.path.join(ROOT, "src", "components", "horizonte", "content", "binary.generated.ts")

FLOOR_DB = -50.0
OFFSETS_S = (0.0, 0.5, 1.0, 1.5)
BALANCE = (0.45, 0.85)
PAIR = (0.55, 0.85)
SWITCHES = 2.0
SILENCE = -0.9
MIN_SHARE = 0.05


def load_form_module():
    path = os.path.join(ROOT, "scripts", "analyze-form.py")
    spec = importlib.util.spec_from_file_location("analyze_form", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


AF = load_form_module()
AA = AF.AA


def smooth(a, b, x):
    u = min(1.0, max(0.0, (x - a) / (b - a)))
    return u * u * (3 - 2 * u)


def grid_weight(x):
    f = AF.frame_features(x)
    if f is None or len(f["rms"]) < AF.WF * AF.MIN_SECTION * 2:
        return None
    W = AF.windows(f)
    n = len(W["rms"])
    Z, C = AF.features(W)
    bounds, _ = AF.segment(Z, C)
    vecs = [AF.section_vector(Z, C, bounds[i], bounds[i + 1]) for i in range(len(bounds) - 1)]
    ids = AF.cluster(vecs)
    level = AF.power_db(W["rms"])
    lv = [(AF.power_db(W["rms"][bounds[i]:bounds[i + 1]]) - level) / 12.0 for i in range(len(ids))]
    share = {}
    for i, c in enumerate(ids):
        if lv[i] <= SILENCE:
            continue
        share[c] = share.get(c, 0.0) + (bounds[i + 1] - bounds[i]) / n
    mats = sorted([(c, s) for c, s in share.items() if s >= MIN_SHARE], key=lambda t: -t[1])[:4]
    if len(mats) < 2:
        return 0.0
    top = {mats[0][0], mats[1][0]}
    switches, prev = 0, None
    for i, c in enumerate(ids):
        if c not in top or lv[i] <= SILENCE:
            continue
        if prev is not None and c != prev:
            switches += 1
        prev = c
    pair = (mats[0][1] + mats[1][1]) / sum(s for _, s in mats)
    return smooth(*BALANCE, mats[1][1] / mats[0][1]) * min(1.0, switches / SWITCHES) * smooth(*PAIR, pair)


def binary_weight(x):
    rng = np.random.default_rng(11)
    x = x + rng.normal(0, 10 ** (FLOOR_DB / 20), len(x)).astype(np.float32)
    ws = [grid_weight(x[int(o * AF.SR):]) for o in OFFSETS_S]
    ws = [w for w in ws if w is not None]
    return round(float(np.mean(ws)), 3) if ws else None


def emit(albums):
    lines = ["export const BINARY_WEIGHT: Record<string, (number | null)[]> = {"]
    for slug, ws in albums:
        lines.append(f"  {json.dumps(slug)}: {json.dumps(ws)},")
    lines += ["};", ""]
    open(OUT_TS, "w", encoding="utf-8").write("\n".join(lines))


def main():
    import glob

    albums = []
    for slug, _cover in AA.album_order():
        d = os.path.join(AF.MUSIC, slug)
        files = sorted(
            f for f in glob.glob(os.path.join(d, "*"))
            if os.path.splitext(f)[1].lower() in (".m4a", ".mp3", ".ogg", ".opus")
        )
        if not files:
            continue
        ws = [binary_weight(AA.decode(f)) for f in files]
        albums.append((slug, ws))
        print(f"  · {slug}: {' '.join('-' if w is None else f'{w:.2f}' for w in ws)}", file=sys.stderr)
    emit(albums)
    print(f"\n{len(albums)} álbuns → {os.path.relpath(OUT_TS, ROOT)}")


if __name__ == "__main__":
    main()
