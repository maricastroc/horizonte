"""
Cobertura do acervo — ferramenta de curadoria do Horizonte.

    python3 scripts/curadoria.py
    python3 scripts/curadoria.py --candidato public/music/<slug>
    python3 scripts/curadoria.py --ranquear ~/candidatos
    python3 scripts/curadoria.py --prospectar --limite 30
    python3 scripts/curadoria.py --vetor 0.15,0.85,0.10,0.80,0.75

Responde a uma pergunta só: **um disco novo aumenta a diversidade do acervo, ou
cai em cima do que já existe?**

Os cinco eixos são os mesmos que definem o mundo de cada álbum — volume,
dinâmica, brilho, duração e pulso — e a normalização é a de `analyze-audio.py`,
importada daqui, nunca reescrita. Âncoras absolutas: acrescentar um disco não
reescala nenhum outro, então cobrir o espaço é sempre ganho, jamais distorção.

**Distância contínua, não contagem de células.** Dividir o espaço em regiões e
contar quantas estão ocupadas trataria dois discos nos cantos opostos da mesma
célula como redundantes. A métrica principal aqui é o *raio de cobertura*: para
cada ponto do espaço, a distância até o álbum mais próximo. As regiões entram só
como leitura descritiva.

Isto **não é teste**. Cobertura de catálogo é decisão de curadoria, não condição
de correção do software — nada aqui entra na suíte nem trava CI.
"""
import argparse
import glob
import hashlib
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor
import time
import urllib.parse
import importlib.util
import json
import math
import os
import re
import sys

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def load_analyzer():
    """Importa analyze-audio.py para reusar âncoras, normalização e medição."""
    path = os.path.join(ROOT, "scripts", "analyze-audio.py")
    spec = importlib.util.spec_from_file_location("analyze_audio", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


AA = load_analyzer()
ANCHOR = AA.ANCHOR
norm = AA.norm

# `analyze-audio.py` já importa `fetch-curation.py`. Pegar o cliente HTTP, as
# constantes de licença e o tipo de falha por ali evita um segundo cliente do
# Internet Archive e uma segunda implementação do portão de licença.
FC = AA.FC

PROSPECT = os.path.join(ROOT, ".cache", "prospeccao")
PROSPECT_META = os.path.join(PROSPECT, "meta")
PROSPECT_AUDIO = os.path.join(PROSPECT, "audio")
PROSPECT_VECS = os.path.join(PROSPECT, "vetores.json")

# Um item precisa parecer um álbum para entrar: single de duas faixas mede
# dinâmica e pulso de um jeito que não representa um disco.
MIN_TRACKS = 3
MIN_MINUTES = 8.0

DOWNLOAD_WORKERS = 4

CACHE = os.path.join(ROOT, ".cache", "curadoria.json")

SIG_TS = os.path.join(
    ROOT, "src", "components", "horizonte", "content", "signature.generated.ts"
)

AXES = ["loudness", "dynamics", "brightness", "duration", "pulse"]
LOG_AXES = {"brightness"}

# Grade de amostragem do espaço. 11^5 = 161.051 pontos: fino o bastante para o
# raio de cobertura convergir e barato o bastante para rodar em segundos.
GRID_STEP = 0.1

# Separação mínima entre dois vazios reportados, para não listar cinco vezes o
# mesmo buraco com deslocamentos de uma casa da grade.
VOID_SPACING = 0.30


def clamp(v, a=0.0, b=1.0):
    return a if v < a else b if v > b else v


def denorm(t, key):
    """Inverte `norm`: normalizado 0..1 de volta à unidade física medida."""
    lo, hi = ANCHOR[key]
    if key in LOG_AXES:
        lo, hi = math.log2(lo), math.log2(hi)
        return 2 ** (lo + t * (hi - lo))
    return lo + t * (hi - lo)


# ------------------------------------------------------------------ catálogo
def read_catalog():
    """Lê os normalizados já publicados, sem redecodificar o acervo inteiro.

    `signature.generated.ts` é escrito pelo `emit()` de analyze-audio.py com
    forma fixa, então o recorte é estável. A validação abaixo falha alto se a
    forma mudar, em vez de devolver um acervo silenciosamente truncado.
    """
    src = open(SIG_TS, encoding="utf-8").read()
    blocks = re.findall(
        r'"([^"]+)":\s*\{\s*'
        r"loudness:\s*([-\d.]+),\s*"
        r"dynamics:\s*([-\d.]+),\s*"
        r"brightness:\s*([-\d.]+),\s*"
        r"duration:\s*([-\d.]+),\s*"
        r"pulse:\s*([-\d.]+),",
        src,
    )
    declared = len(re.findall(r"^\s{2}\"[^\"]+\":\s*\{", src, re.M))
    if not blocks or len(blocks) != declared:
        raise SystemExit(
            f"curadoria: li {len(blocks)} de {declared} álbuns em "
            f"{os.path.relpath(SIG_TS, ROOT)} — a forma do arquivo mudou."
        )
    names = [b[0] for b in blocks]
    vecs = np.array([[float(x) for x in b[1:]] for b in blocks], dtype=float)
    if vecs.min() < -1e-9 or vecs.max() > 1 + 1e-9:
        raise SystemExit("curadoria: normalizado fora de [0,1] — âncoras mudaram?")
    return names, vecs


def audio_files(path):
    return sorted(
        f
        for f in glob.glob(os.path.join(path, "*"))
        if os.path.splitext(f)[1].lower() in (".m4a", ".mp3", ".ogg", ".opus", ".wav", ".flac")
    )


def fingerprint(files):
    """Identidade do conteúdo: nome, tamanho e mtime de cada arquivo."""
    h = hashlib.sha256()
    for f in files:
        st = os.stat(f)
        h.update(f"{os.path.basename(f)}:{st.st_size}:{int(st.st_mtime)}|".encode())
    return h.hexdigest()[:16]


def cache_read():
    try:
        return json.load(open(CACHE, encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def cache_write(data):
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    json.dump(data, open(CACHE, "w", encoding="utf-8"), indent=1)


def measure_folder(path, cache=None):
    """Mede um candidato com o mesmo pipeline do acervo curado.

    Medir é caro; o lote costuma ser rodado várias vezes enquanto a busca anda.
    O cache é indexado pelo conteúdo da pasta, então trocar ou reencodar um
    arquivo invalida a entrada sozinho.
    """
    files = audio_files(path)
    if not files:
        raise SystemExit(f"curadoria: nenhum áudio em {path}")
    slug = os.path.basename(os.path.normpath(path))
    if cache is not None:
        hit = cache.get(path)
        if hit and hit.get("fp") == fingerprint(files):
            return slug, np.array(hit["vec"]), None
    print(f"medindo {slug}: {len(files)} faixas…", file=sys.stderr)
    sig = AA.analyze_album(slug, files)
    vec = np.array(
        [
            norm(sig["loudness_db"], "loudness"),
            norm(sig["dynamics_db"], "dynamics"),
            norm(sig["brightness_hz"], "brightness", log=True),
            norm(sig["duration"], "duration"),
            norm(sig["pulse"], "pulse"),
        ]
    )
    if cache is not None:
        cache[path] = dict(fp=fingerprint(files), vec=list(map(float, vec)))
    return slug, vec, sig


# ------------------------------------------------------------------ distância
def dist(a, b):
    """Mesma métrica de `musicalDistance` em perception/measure.ts."""
    d = np.asarray(a, dtype=float) - np.asarray(b, dtype=float)
    return float(np.sqrt(np.mean(d * d)))


def nearest(vecs, point, skip=-1):
    best, who = float("inf"), -1
    for i, v in enumerate(vecs):
        if i == skip:
            continue
        d = dist(v, point)
        if d < best:
            best, who = d, i
    return best, who


def grid_points(bounds=None):
    steps = int(round(1 / GRID_STEP)) + 1
    axis = np.linspace(0, 1, steps)
    mesh = np.meshgrid(*[axis] * len(AXES), indexing="ij")
    pts = np.stack([m.ravel() for m in mesh], axis=1)
    if bounds is not None:
        lo, hi = bounds
        keep = np.all((pts >= lo - 1e-9) & (pts <= hi + 1e-9), axis=1)
        pts = pts[keep]
    return pts


def radii(vecs, pts):
    """Raio de cobertura de cada ponto: distância até o álbum mais próximo."""
    d = pts[:, None, :] - vecs[None, :, :]
    return np.sqrt(np.mean(d * d, axis=2)).min(axis=1)


def coverage(vecs, pts):
    r = radii(vecs, pts)
    return dict(mean=float(r.mean()), worst=float(r.max()), p90=float(np.percentile(r, 90)))


def biggest_voids(vecs, pts, count=3):
    r = radii(vecs, pts)
    order = np.argsort(-r)
    chosen = []
    for idx in order:
        p = pts[idx]
        if all(dist(p, c["point"]) > VOID_SPACING for c in chosen):
            chosen.append({"point": p, "radius": float(r[idx])})
        if len(chosen) == count:
            break
    return chosen


# ------------------------------------------------------------------ linguagem
BANDS = {
    "loudness": [
        (0.20, "muito silencioso"),
        (0.40, "silencioso"),
        (0.62, "volume médio"),
        (0.82, "alto"),
        (1.01, "muito alto"),
    ],
    "dynamics": [
        (0.20, "esmagado pelo limiter"),
        (0.40, "comprimido"),
        (0.62, "dinâmica média"),
        (0.82, "dinâmico"),
        (1.01, "muito dinâmico, com silêncios e picos"),
    ],
    "brightness": [
        (0.20, "muito escuro, quase só grave"),
        (0.40, "escuro"),
        (0.62, "brilho médio"),
        (0.82, "brilhante"),
        (1.01, "muito brilhante, agudo e cortante"),
    ],
    "duration": [
        (0.20, "curto"),
        (0.40, "duração média-curta"),
        (0.62, "duração média"),
        (0.82, "longo"),
        (1.01, "muito longo"),
    ],
    "pulse": [
        (0.20, "sem grade, tempo livre"),
        (0.40, "pulso frouxo"),
        (0.62, "pulso presente"),
        (0.82, "pulso firme"),
        (1.01, "grade rígida, muito periódico"),
    ],
}

UNITS = {
    "loudness": lambda t: f"{denorm(t,'loudness'):.0f} dB RMS",
    "dynamics": lambda t: f"{denorm(t,'dynamics'):.0f} dB de faixa",
    "brightness": lambda t: f"{denorm(t,'brightness'):.0f} Hz de centróide",
    "duration": lambda t: f"{denorm(t,'duration')/60:.0f} min",
    "pulse": lambda t: f"pulso {denorm(t,'pulse'):.2f}",
}


def band_of(key, value):
    for edge, label in BANDS[key]:
        if value < edge:
            return label
    return BANDS[key][-1][1]


def describe(vec):
    return " · ".join(band_of(k, v) for k, v in zip(AXES, vec))


def physical(vec):
    return " · ".join(UNITS[k](v) for k, v in zip(AXES, vec))


def region_of(vec):
    return "".join("1" if v >= 0.5 else "0" for v in vec)


def region_label(code):
    parts = []
    for k, bit in zip(AXES, code):
        parts.append(("+" if bit == "1" else "−") + k[:4])
    return " ".join(parts)


# ------------------------------------------------------------------ relatório
def rule(title):
    print(f"\n── {title}")


def report(names, vecs):
    n = len(names)
    print(f"COBERTURA DO ACERVO · {n} álbuns · 5 eixos · âncoras absolutas")

    rule("posição normalizada")
    print(f"{'álbum':32}" + "".join(f"{a[:6]:>9}" for a in AXES))
    for name, v in zip(names, vecs):
        print(f"{name:32}" + "".join(f"{x:>9.3f}" for x in v))

    nn = []
    for i in range(n):
        d, who = nearest(vecs, vecs[i], skip=i)
        nn.append((d, names[i], names[who]))
    nn.sort()

    rule("isolamento — distância até o vizinho mais próximo")
    for d, a, b in nn:
        print(f"  {d:.3f}  {a:32}→ {b}")
    nn_d = np.array([d for d, _, _ in nn])
    print(
        f"\n  mediana {np.median(nn_d):.3f} · máximo {nn_d.max():.3f} · "
        f"mínimo {nn_d.min():.3f}"
    )

    pairs = []
    for i in range(n):
        for j in range(i + 1, n):
            pairs.append((dist(vecs[i], vecs[j]), names[i], names[j]))
    pairs.sort()

    rule("pares mais próximos")
    for d, a, b in pairs[:4]:
        print(f"  {d:.3f}  {a:30}{b}")
    rule("pares mais distantes")
    for d, a, b in reversed(pairs[-4:]):
        print(f"  {d:.3f}  {a:30}{b}")

    rule("distribuição por eixo")
    print(f"{'eixo':14}{'baixo':>8}{'meio':>8}{'alto':>8}   terços de [0,1]")
    for k, col in zip(AXES, vecs.T):
        lo = int((col < 1 / 3).sum())
        mid = int(((col >= 1 / 3) & (col < 2 / 3)).sum())
        hi = int((col >= 2 / 3).sum())
        flag = "  ← concentrado" if max(lo, mid, hi) >= 0.6 * n else ""
        print(f"{k:14}{lo:>8}{mid:>8}{hi:>8}{flag}")

    rule("regiões ocupadas")
    occupied = {}
    for name, v in zip(names, vecs):
        occupied.setdefault(region_of(v), []).append(name)
    print(f"  {len(occupied)} de {2 ** len(AXES)} regiões têm ao menos um disco")
    for code in sorted(occupied):
        print(f"  {code}  {region_label(code):44}{', '.join(occupied[code])}")

    pts = grid_points()
    cov = coverage(vecs, pts)
    rule("raio de cobertura — métrica contínua")
    print(f"  raio médio  {cov['mean']:.3f}   (quanto menor, melhor coberto)")
    print(f"  percentil 90 {cov['p90']:.3f}")
    print(f"  maior vazio {cov['worst']:.3f}")

    rule("maiores vazios do espaço, por prioridade")
    voids = biggest_voids(vecs, pts)
    for i, v in enumerate(voids, 1):
        p = v["point"]
        _, who = nearest(vecs, p)
        code = region_of(p)
        estado = "vazia" if code not in occupied else "já ocupada"
        print(f"\n  {i}. raio {v['radius']:.3f}   região {code} ({estado})")
        print(f"     alvo    " + "  ".join(f"{k[:4]}={x:.2f}" for k, x in zip(AXES, p)))
        print(f"     perfil  {describe(p)}")
        print(f"     medida  {physical(p)}")
        print(f"     vizinho mais próximo hoje: {names[who]} a {dist(p, vecs[who]):.3f}")

    lo = vecs.min(axis=0)
    hi = vecs.max(axis=0)
    inner = grid_points(bounds=(lo, hi))
    if len(inner):
        rule("maiores vazios dentro do envelope já ocupado")
        print("  (buracos entre os discos existentes, sem ir aos extremos do espaço)")
        for i, v in enumerate(biggest_voids(vecs, inner, count=2), 1):
            p = v["point"]
            print(f"\n  {i}. raio {v['radius']:.3f}")
            print(f"     alvo    " + "  ".join(f"{k[:4]}={x:.2f}" for k, x in zip(AXES, p)))
            print(f"     perfil  {describe(p)}")
            print(f"     medida  {physical(p)}")

    return dict(nn=nn_d, cov=cov, voids=voids, occupied=occupied, pts=pts)


# ------------------------------------------------------------------ candidato
def grade(d, nn_d):
    """Faixas derivadas da própria distribuição do acervo, não arbitradas.

    O acervo é a única referência disponível do que conta como "perto" ou
    "longe" neste espaço. A mediana das distâncias ao vizinho mais próximo diz
    quão apertado o acervo já é; o máximo diz quão isolado é o disco mais
    isolado que existe hoje. Um candidato que não passa da mediana entra em
    território já povoado; um que passa do máximo é mais isolado do que
    qualquer disco atual — ou seja, amplia o espaço em vez de adensá-lo.
    """
    med = float(np.median(nn_d))
    mx = float(nn_d.max())
    if d <= med:
        return "baixa", med, mx
    if d <= mx:
        return "média", med, mx
    return "alta", med, mx


def evaluate(names, vecs, cand_name, cand_vec, base):
    print(f"\n\nCANDIDATO · {cand_name}")

    rule("vetor normalizado")
    print(f"  " + "  ".join(f"{k[:4]}={x:.3f}" for k, x in zip(AXES, cand_vec)))
    print(f"  perfil  {describe(cand_vec)}")
    print(f"  medida  {physical(cand_vec)}")

    d, who = nearest(vecs, cand_vec)
    rule("vizinhança")
    print(f"  mais próximo   {names[who]} a {d:.3f}")
    ranked = sorted(
        ((dist(cand_vec, v), names[i]) for i, v in enumerate(vecs)),
    )[:3]
    for dd, nm in ranked[1:]:
        print(f"  em seguida     {nm} a {dd:.3f}")

    code = region_of(cand_vec)
    taken = base["occupied"].get(code)
    rule("região")
    print(f"  {code}  {region_label(code)}")
    print(
        f"  {'já ocupada por ' + ', '.join(taken) if taken else 'AINDA NÃO REPRESENTADA'}"
    )

    pts = base["pts"]
    after_vecs = np.vstack([vecs, cand_vec])
    after = coverage(after_vecs, pts)
    before = base["cov"]
    rule("simulação: acervo + candidato")
    print(f"{'métrica':22}{'antes':>10}{'depois':>10}{'delta':>10}")
    for key, label in (("mean", "raio médio"), ("p90", "percentil 90"), ("worst", "maior vazio")):
        b, a = before[key], after[key]
        print(f"{label:22}{b:>10.3f}{a:>10.3f}{a - b:>+10.3f}")

    rule("qual vazio ele ajuda a preencher")
    helped = None
    for i, v in enumerate(base["voids"], 1):
        dv = dist(cand_vec, v["point"])
        after_r = min(v["radius"], dv)
        cut = (v["radius"] - after_r) / v["radius"] if v["radius"] else 0
        mark = ""
        if cut > 0.01 and (helped is None or cut > helped[1]):
            helped = (i, cut)
            mark = "  ←"
        print(
            f"  vazio {i}: raio {v['radius']:.3f} → {after_r:.3f}"
            f"  ({cut * 100:.0f}% menor){mark}"
        )

    klass, med, mx = grade(d, base["nn"])
    rule("classificação de utilidade para diversidade")
    print(f"  {klass.upper()}")
    print(f"\n  critério 1 — distância ao vizinho mais próximo: {d:.3f}")
    print(f"    mediana do acervo {med:.3f} · disco mais isolado hoje {mx:.3f}")
    print(f"    {'não passa da mediana: entra em território povoado' if d <= med else ''}"
          f"{'entre a mediana e o mais isolado de hoje' if med < d <= mx else ''}"
          f"{'mais isolado que qualquer disco atual: amplia o espaço' if d > mx else ''}")
    cut_worst = (before["worst"] - after["worst"]) / before["worst"] * 100
    print(f"\n  critério 2 — encolhe o maior vazio em {cut_worst:.1f}%"
          f"  ({before['worst']:.3f} → {after['worst']:.3f})")
    if helped:
        print(f"    ataca principalmente o vazio {helped[0]} ({helped[1] * 100:.0f}% menor)")
    else:
        print("    não encosta em nenhum dos maiores vazios")
    print(f"\n  critério 3 — região: "
          f"{'já representada' if taken else 'nova, ainda não representada'}")

    return klass


def rank(names, vecs, folder, base):
    """Mede um lote de candidatos e ordena por utilidade para a diversidade.

    Duas leituras, porque respondem a perguntas diferentes:

    * **independente** — cada candidato contra o acervo de hoje. É o "qual
      destes é o melhor".
    * **incremental** — se você fosse levar mais de um, qual sequência cobre
      mais espaço. Dois candidatos podem ser ótimos individualmente *pelo mesmo
      motivo*, e aí o segundo quase não acrescenta depois do primeiro.
    """
    subdirs = sorted(
        d for d in glob.glob(os.path.join(folder, "*")) if os.path.isdir(d) and audio_files(d)
    )
    if not subdirs:
        raise SystemExit(
            f"curadoria: nenhuma pasta de álbum com áudio em {folder}\n"
            f"  esperado: {folder}/<slug>/<faixas>"
        )

    cache = cache_read()
    cands, falhas = [], []
    for d in subdirs:
        try:
            slug, vec, _ = measure_folder(d, cache)
            cands.append((slug, vec))
        except SystemExit as e:
            falhas.append((os.path.basename(d), str(e)))
        except Exception as e:
            falhas.append((os.path.basename(d), f"{type(e).__name__}: {e}"))
    cache_write(cache)

    if not cands:
        raise SystemExit("curadoria: nenhum candidato pôde ser medido")

    return rank_vectors(
        names, vecs, cands, base,
        titulo=f"RANQUEAMENTO · {len(cands)} candidatos em {os.path.relpath(folder, ROOT)}",
        falhas=falhas,
    )


def rank_vectors(names, vecs, cands, base, titulo, falhas=()):
    """Ordena candidatos já medidos. Compartilhado por --ranquear e --prospectar."""
    print(f"\n\n{titulo}")
    if falhas:
        rule("não medidos")
        for nome, motivo in falhas[:12]:
            print(f"  {nome}: {motivo}")
        if len(falhas) > 12:
            print(f"  … e mais {len(falhas) - 12}")

    pts, before = base["pts"], base["cov"]
    rows = []
    for slug, vec in cands:
        d, who = nearest(vecs, vec)
        after = coverage(np.vstack([vecs, vec]), pts)
        rows.append(
            dict(
                slug=slug,
                vec=vec,
                d=d,
                who=names[who],
                klass=grade(d, base["nn"])[0],
                worst_cut=(before["worst"] - after["worst"]) / before["worst"] * 100,
                mean_after=after["mean"],
                nova=region_of(vec) not in base["occupied"],
            )
        )
    rows.sort(key=lambda r: -r["d"])

    rule("ordenado por distância ao vizinho mais próximo")
    print(f"{'#':>3}  {'candidato':34}{'dist':>7}{'classe':>8}{'vazio':>9}   região")
    for i, r in enumerate(rows, 1):
        print(
            f"{i:>3}  {r['slug'][:33]:34}{r['d']:>7.3f}{r['klass']:>8}"
            f"{r['worst_cut']:>8.1f}%   {'nova' if r['nova'] else 'já ocupada'}"
        )

    acima = [r for r in rows if r["d"] > float(base["nn"].max())]
    rule(f"acima do isolamento máximo atual ({base['nn'].max():.3f})")
    if acima:
        for r in acima:
            print(f"  {r['d']:.3f}  {r['slug'][:40]:42}{describe(r['vec'])}")
    else:
        print("  nenhum")

    rule("distribuição das distâncias")
    ds = np.array([r["d"] for r in rows])
    med = float(np.median(base["nn"]))
    mx = float(base["nn"].max())
    faixas = [
        ("baixa  (≤ %.3f)" % med, int((ds <= med).sum())),
        ("média  (%.3f–%.3f]" % (med, mx), int(((ds > med) & (ds <= mx)).sum())),
        ("alta   (> %.3f)" % mx, int((ds > mx).sum())),
    ]
    for rotulo, n in faixas:
        barra = "█" * int(round(40 * n / max(1, len(ds))))
        print(f"  {rotulo:22}{n:>4}  {barra}")
    print(f"\n  mín {ds.min():.3f} · mediana {np.median(ds):.3f} · máx {ds.max():.3f}")

    uteis = [r for r in rows if r["klass"] != "baixa"]
    rule("veredito do lote")
    if not uteis:
        print(f"  Nenhum candidato passa da mediana do acervo ({np.median(base['nn']):.3f}).")
        print(f"  O melhor é {rows[0]['slug']} a {rows[0]['d']:.3f}, vizinho de {rows[0]['who']}.")
        print("  Adicionar não prejudica o que existe — as âncoras são absolutas — mas")
        print("  também não compra diversidade.")
    else:
        b = rows[0]
        print(f"  Melhor do lote: {b['slug']}  ({b['klass'].upper()})")
        print(f"  distância {b['d']:.3f} · vizinho mais próximo {b['who']}")
        print(f"  encolhe o maior vazio em {b['worst_cut']:.1f}% · "
              f"raio médio {before['mean']:.3f} → {b['mean_after']:.3f}")
        print(f"  perfil  {describe(b['vec'])}")

    if len(rows) > 1:
        rule("seleção incremental — se você fosse levar mais de um")
        pool = list(rows)
        atual = vecs
        cov_atual = before["mean"]
        for pos in range(1, min(3, len(pool)) + 1):
            melhor, ganho = None, 0.0
            for r in pool:
                c = coverage(np.vstack([atual, r["vec"]]), pts)["mean"]
                if cov_atual - c > ganho:
                    melhor, ganho = r, cov_atual - c
            if not melhor or ganho <= 1e-4:
                print(f"  {pos}º  nenhum outro candidato ainda reduz o raio médio")
                break
            atual = np.vstack([atual, melhor["vec"]])
            novo = cov_atual - ganho
            print(f"  {pos}º  {melhor['slug'][:30]:32}raio médio {cov_atual:.3f} → {novo:.3f}"
                  f"  ({-ganho:+.3f})")
            cov_atual = novo
            pool.remove(melhor)

    return rows[0]["slug"], rows[0]["vec"]


# --------------------------------------------------------------- prospecção
IA_SEARCH = "https://archive.org/advancedsearch.php"

CC_BY_QUERY = (
    'licenseurl:("{a}" OR "{b}")'.format(
        a=FC.CC_BY_4.replace(":", "\\:"), b=FC.CC_BY_4_ALT.replace(":", "\\:")
    )
    + " AND mediatype:audio"
)


def ia_search(query, limite):
    """Lista identificadores elegíveis. O índice é só descoberta, não prova."""
    achados, pagina, por_pagina = [], 1, 100
    total = None
    while len(achados) < limite:
        chave = hashlib.sha1(query.encode()).hexdigest()[:10]
        dest = os.path.join(PROSPECT_META, f"busca-{chave}-{pagina}.json")
        if not os.path.exists(dest):
            args = [
                "curl", "-sL", "--fail", "--max-time", "120", "-A", FC.UA, "-G", IA_SEARCH,
                "--data-urlencode", f"q={query}",
                "--data-urlencode", "fl[]=identifier",
                "--data-urlencode", "fl[]=title",
                "--data-urlencode", "fl[]=creator",
                "--data-urlencode", f"rows={por_pagina}",
                "--data-urlencode", f"page={pagina}",
                "--data-urlencode", "output=json",
                "-o", dest,
            ]
            os.makedirs(PROSPECT_META, exist_ok=True)
            r = subprocess.run(args, capture_output=True)
            if r.returncode != 0:
                corpo = ""
                if os.path.exists(dest):
                    corpo = open(dest, encoding="utf-8", errors="replace").read()[:200]
                    os.unlink(dest)
                raise SystemExit(
                    f"curadoria: busca no Internet Archive falhou (curl {r.returncode})\n"
                    f"  stderr: {r.stderr.decode('utf-8', 'replace')[:200]}\n"
                    f"  corpo:  {corpo}"
                )
            time.sleep(1.0)
        try:
            resp = json.load(open(dest, encoding="utf-8"))["response"]
        except (ValueError, KeyError):
            os.unlink(dest)
            raise SystemExit("curadoria: resposta inesperada da busca do Internet Archive")
        total = resp["numFound"] if total is None else total
        docs = resp.get("docs", [])
        if not docs:
            break
        achados.extend(docs)
        pagina += 1
    return achados[:limite], total


def parse_length(v):
    """O metadata traz duração como segundos ou como MM:SS / HH:MM:SS."""
    if v is None:
        return 0.0
    txt = str(v).strip()
    if ":" in txt:
        partes = [float(p) for p in txt.split(":")]
        seg = 0.0
        for p in partes:
            seg = seg * 60 + p
        return seg
    try:
        return float(txt)
    except ValueError:
        return 0.0


def ia_url(meta, ident, nome):
    """URL direta no nó de storage.

    `archive.org/download/...` responde 500 de forma intermitente e o redirect
    nem sempre é seguido. O próprio metadata declara o servidor e o diretório do
    item, então montar a URL final evita o salto e é mais estável.
    """
    servidores = meta.get("workable_servers") or [meta.get("server"), meta.get("d1"), meta.get("d2")]
    servidores = [x for x in servidores if x]
    diretorio = meta.get("dir", "")
    alvo = urllib.parse.quote(nome)
    if servidores and diretorio:
        return [f"https://{srv}{diretorio}/{alvo}" for srv in servidores]
    return [f"https://archive.org/download/{ident}/{alvo}"]


def ia_metadata(ident):
    dest = os.path.join(PROSPECT_META, f"{ident}.json")
    if not os.path.exists(dest):
        os.makedirs(PROSPECT_META, exist_ok=True)
        FC.http_get(f"https://archive.org/metadata/{ident}", dest, ident)
        time.sleep(0.4)
    return json.load(open(dest, encoding="utf-8"))


def elegivel(meta):
    """Portão de licença e de forma. Devolve (ok, motivo, arquivos, minutos)."""
    md = meta.get("metadata", {})
    lic = md.get("licenseurl")
    if lic not in (FC.CC_BY_4, FC.CC_BY_4_ALT):
        return False, f"licença {lic!r}", [], 0.0
    todos = [f for f in meta.get("files", []) if f.get("name", "").lower().endswith(".mp3")]
    vbr = [f for f in todos if "VBR" in (f.get("format") or "")]
    mp3 = vbr if len(vbr) >= MIN_TRACKS else todos
    mp3.sort(key=lambda f: f["name"])
    if len(mp3) < MIN_TRACKS:
        return False, f"{len(mp3)} faixas MP3", mp3, 0.0
    minutos = sum(parse_length(f.get("length")) for f in mp3) / 60
    if minutos < MIN_MINUTES:
        return False, f"{minutos:.1f} min", mp3, minutos
    return True, "", mp3, minutos


def baixar_e_medir(ident, arquivos, cache, meta=None):
    """Baixa o item, mede e **apaga o áudio**, guardando só o vetor."""
    hit = cache.get(ident)
    if hit:
        return np.array(hit["vec"])

    destino = os.path.join(PROSPECT_AUDIO, ident)
    os.makedirs(destino, exist_ok=True)
    locais = [os.path.join(destino, f"{i:02d}.mp3") for i in range(1, len(arquivos) + 1)]
    try:
        # Uma conexão só rende ~2 MB/s no nó do Internet Archive; quatro rendem
        # ~10 MB/s. O gargalo é por conexão, não banda total.
        def puxar(par):
            alvo, f = par
            if os.path.exists(alvo):
                return None
            erro = None
            for url in ia_url(meta or {}, ident, f["name"]):
                try:
                    FC.http_get(url, alvo, ident, tries=2)
                    return None
                except (Exception, SystemExit) as e:
                    erro = e
            return erro

        with ThreadPoolExecutor(max_workers=DOWNLOAD_WORKERS) as pool:
            for erro in pool.map(puxar, zip(locais, arquivos)):
                if erro is not None:
                    raise erro
        sig = AA.analyze_album(ident, locais)
        vec = np.array(
            [
                norm(sig["loudness_db"], "loudness"),
                norm(sig["dynamics_db"], "dynamics"),
                norm(sig["brightness_hz"], "brightness", log=True),
                norm(sig["duration"], "duration"),
                norm(sig["pulse"], "pulse"),
            ]
        )
        cache[ident] = dict(vec=list(map(float, vec)), n=len(locais))
        return vec
    finally:
        # `decode()` guarda o WAV descomprimido indexado pelo caminho relativo a
        # MUSIC. Um álbum de 75 min vira ~170 MB: sem apagar, uma prospecção de
        # algumas dezenas enche o disco. A chave é derivada, não adivinhada.
        shutil.rmtree(destino, ignore_errors=True)
        for local in locais:
            chave = os.path.relpath(local, AA.MUSIC).replace(os.sep, "--")
            wav = os.path.join(AA.CACHE, chave + ".wav")
            if os.path.exists(wav):
                os.unlink(wav)


def prospectar(names, vecs, base, limite, colecao, extra):
    query = CC_BY_QUERY
    if colecao:
        query += f" AND collection:{colecao}"
    if extra:
        query += f" AND ({extra})"

    print(f"\n\nPROSPECÇÃO · Internet Archive")
    print(f"  consulta: {query}")
    docs, total = ia_search(query, limite)
    print(f"  itens no índice: {total}   ·   examinando: {len(docs)}")

    cache = {}
    if os.path.exists(PROSPECT_VECS):
        try:
            cache = json.load(open(PROSPECT_VECS, encoding="utf-8"))
        except ValueError:
            cache = {}

    rotulo = {d["identifier"]: str(d.get("creator") or "?") + " — " + str(d.get("title") or d["identifier"])
              for d in docs}

    passou, recusados, medidos, falhas = 0, [], [], []
    for n, d in enumerate(docs, 1):
        ident = d["identifier"]
        try:
            meta = ia_metadata(ident)
        except (Exception, SystemExit) as e:
            falhas.append((ident, f"metadata: {str(e).strip()[:70]}"))
            continue
        ok, motivo, arquivos, minutos = elegivel(meta)
        if not ok:
            recusados.append((ident, motivo))
            continue
        passou += 1
        try:
            print(f"  [{n}/{len(docs)}] {ident[:40]:42} {minutos:5.1f} min", flush=True)
            vec = baixar_e_medir(ident, arquivos, cache, meta)
            medidos.append((ident, vec))
        except (Exception, SystemExit) as e:
            falhas.append((ident, str(e).strip().splitlines()[0][:80]))
        finally:
            os.makedirs(PROSPECT, exist_ok=True)
            json.dump(cache, open(PROSPECT_VECS, "w", encoding="utf-8"), indent=1)

    rule("funil")
    print(f"  encontrados no índice      {total}")
    print(f"  examinados                 {len(docs)}")
    print(f"  passaram no gate           {passou}")
    print(f"  medidos                    {len(medidos)}")
    print(f"  recusados                  {len(recusados)}")
    print(f"  falharam                   {len(falhas)}")
    if recusados:
        motivos = {}
        for _, m in recusados:
            chave = "licença" if m.startswith("licença") else ("poucas faixas" if "faixas" in m else "curto demais")
            motivos[chave] = motivos.get(chave, 0) + 1
        print("  motivos de recusa: " + " · ".join(f"{k} {v}" for k, v in sorted(motivos.items())))

    if falhas:
        rule("falhas")
        for ident, motivo in falhas[:10]:
            print(f"  {ident[:36]:38}{motivo}")
        if len(falhas) > 10:
            print(f"  … e mais {len(falhas) - 10}")

    if not medidos:
        raise SystemExit("curadoria: nenhum candidato pôde ser medido")

    cands = [(rotulo.get(i, i)[:60], v) for i, v in medidos]
    return rank_vectors(
        names, vecs, cands, base,
        titulo=f"RANQUEAMENTO · {len(cands)} candidatos medidos do Internet Archive",
        falhas=falhas,
    )


def main():
    ap = argparse.ArgumentParser(description="Cobertura do acervo do Horizonte")
    ap.add_argument("--candidato", metavar="PASTA", help="pasta com o áudio do candidato")
    ap.add_argument(
        "--ranquear",
        metavar="PASTA",
        help="pasta contendo várias pastas de álbum candidatas, ordenadas por utilidade",
    )
    ap.add_argument("--prospectar", action="store_true",
                    help="busca candidatos CC BY 4.0 no Internet Archive, mede e ranqueia")
    ap.add_argument("--limite", type=int, default=30, help="quantos itens examinar (padrão 30)")
    ap.add_argument("--colecao", default="netlabels", help="coleção do Internet Archive")
    ap.add_argument("--consulta", default="", help="termos extras para ampliar a descoberta")
    ap.add_argument("--vetor", metavar="L,D,B,T,P", help="candidato hipotético já normalizado")
    ap.add_argument("--json", action="store_true", help="emite o resumo em JSON")
    args = ap.parse_args()

    names, vecs = read_catalog()
    base = report(names, vecs)

    cand = None
    if args.prospectar:
        cand = prospectar(names, vecs, base, args.limite, args.colecao, args.consulta)
    elif args.ranquear:
        cand = rank(names, vecs, args.ranquear, base)
    elif args.candidato:
        cache = cache_read()
        slug, vec, _ = measure_folder(args.candidato, cache)
        cache_write(cache)
        cand = (slug, vec)
    elif args.vetor:
        parts = [float(x) for x in args.vetor.split(",")]
        if len(parts) != len(AXES):
            raise SystemExit(f"curadoria: --vetor precisa de {len(AXES)} números")
        cand = ("hipotético", np.array([clamp(p) for p in parts]))

    klass = None
    if cand:
        klass = evaluate(names, vecs, cand[0], cand[1], base)

    if args.json:
        out = dict(
            albums={n: list(map(float, v)) for n, v in zip(names, vecs)},
            coverage=base["cov"],
            voids=[dict(point=list(map(float, v["point"])), radius=v["radius"]) for v in base["voids"]],
        )
        if cand:
            out["candidate"] = dict(name=cand[0], vector=list(map(float, cand[1])), grade=klass)
        print("\n" + json.dumps(out, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
