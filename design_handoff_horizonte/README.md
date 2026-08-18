# Handoff: Horizonte — experiência musical espacial

## Overview

Horizonte é uma experiência musical web cujo conceito é **"a música tem massa; massa deforma o espaço"**. Toda a composição — tipografia monumental, arte do álbum, poeira, vazio — é desenhada em dois planos 2D e **deformada por um shader de lente gravitacional**. Não existe cena 3D com UI por cima: o mesmo campo entorta imagem e texto. A navegação é uma mudança de escala física (**coleção → álbum → faixa → reprodução**), e uma camada separada de **instrumentos** (tipográfica, estável, nunca deformada) garante que todas as operações fundamentais sejam clicáveis e reconhecíveis.

Alvo declarado pelo cliente: **Next.js + three.js**.

## About the Design Files

Os arquivos deste pacote são **referências de design feitas em HTML/Canvas/WebGL** — protótipos que mostram aparência e comportamento pretendidos, **não código de produção para copiar**. A tarefa é **recriar estes designs no ambiente do projeto** (Next.js App Router + three.js, com os padrões e libs já estabelecidos ali). O GLSL e os números deste README são a especificação: podem ser reaproveitados literalmente. A estrutura JS dos protótipos (classe única, canvas 2D imperativo) deve ser **reorganizada** em módulos/hooks React.

- `Horizonte - Navegacao.dc.html` — **a referência principal**: fluxo completo (coleção → álbum → faixa → play → próxima → voltar) + camada de instrumentos.
- `Horizonte - Prototipo.dc.html` — referência anterior, uma faixa só, útil para isolar os 4 momentos de motion (repouso, cursor, colapso, fusão).
- `Direcao de Arte v2 - Quatro Direcoes.dc.html` — documento de direção de arte (o "porquê" de cada decisão; contém os anti-padrões proibidos).
- `shaders/field.frag.glsl`, `shaders/field.vert.glsl` — shader extraído, pronto para uso.
- `data/albums.ts` — dados fictícios com as tintas exatas.

Para abrir os `.dc.html`: são páginas auto-suficientes; abra no Chrome (precisam de WebGL).

## Fidelity

**High-fidelity.** Cores, tipografia, geometria, durações e easings abaixo são finais e devem ser reproduzidos com precisão. O que é explicitamente placeholder: **áudio (simulado por envelope de BPM)** e **capas (arte gerada proceduralmente)**. Ambos devem ser substituídos por áudio real (Web Audio + AnalyserNode) e imagens reais de capa — a arquitetura não muda.

---

## Arquitetura recomendada (Next + three)

```
app/page.tsx                     'use client' — monta <Horizonte />
components/horizonte/
  Horizonte.tsx                  shell: <canvas> WebGL + <Instruments />
  useField.ts                    loop rAF, máquina de estados, física do campo
  fieldMaterial.ts               ShaderMaterial (frag/vert acima) + uniforms
  composition/back.ts            desenha o plano de trás no CanvasTexture
  composition/front.ts           desenha o plano da frente (título) no CanvasTexture
  composition/ring.ts            buffers de anel (arco assado + setores por faixa)
  composition/cover.ts           tratamento/carga das capas (substitui arte gerada)
  Instruments.tsx                camada DOM: trilhos, réguas, transporte
  audio.ts                       HTMLAudioElement + AnalyserNode → 3 bandas
  data/albums.ts
shaders/field.frag.glsl
```

Notas de implementação em three:

- **Nada de cena/câmera 3D reais.** Use `OrthographicCamera` + `PlaneGeometry(2,2)` (ou um `BufferGeometry` de triângulo full-screen) com `ShaderMaterial`. A "profundidade" é toda simulada no shader e na composição 2D. Isso mantém o custo baixo e é o que produz o resultado aprovado.
- Os dois planos são `THREE.CanvasTexture` sobre `<canvas>` 2D offscreen (um "back", um "front"). Depois de desenhar cada frame: `texture.needsUpdate = true`. `flipY` do three já corresponde ao `UNPACK_FLIP_Y_WEBGL` do protótipo — mantenha `texture.flipY = true` (default) e não inverta UV no shader.
- Filtros: `minFilter/magFilter = THREE.LinearFilter`, `wrapS/T = ClampToEdgeWrapping`, `generateMipmaps = false`. `premultipliedAlpha` do front deve ser tratado como no protótipo (usa `.a` do front para compor).
- Renderer: `antialias: false`, `alpha: false`, `powerPreference: 'high-performance'`. **DPR limitado a 1.3** (`renderer.setPixelRatio(Math.min(devicePixelRatio, 1.3))`) — acima disso o custo de textura por frame dobra sem ganho visível.
- Canvas de composição: largura = `min(canvasPx, 1760)`, altura proporcional. Redesenhado a cada frame (o back tem partículas e progresso; o front tem o título).
- R3F é aceitável (`<mesh><shaderMaterial/></mesh>` + `useFrame`), mas o loop precisa continuar sendo **um único rAF** que faz: `step(dt)` → `drawBack()` → `drawFront()` → `render()` → `updateInstruments()`.

---

## Design Tokens

### Cor

| Token | Valor | Uso |
|---|---|---|
| `void` | `#07070A` | fundo do campo (todos os estados) |
| `void-2` | `#0A0910` | base das capas geradas |
| `paper` | `#EFEBE3` | tipografia monumental (artista) |
| `paper-hi` | `#F4F1EA` | título (plano da frente) |
| `ink-text` | `#E8E4DC` | texto ativo dos instrumentos |
| `ink-text-2` | `#CFC9C0` / `#C9C4BB` | subtítulos, hover intermediário |
| `ink-mute` | `#8C867E` | texto padrão dos instrumentos |
| `ink-dim` | `#6E6862` | timecode, artista secundário |
| `ink-faint` | `#5A554F` | nível inativo, duração |
| `ink-ghost` | `#3A3631` | marcador inativo |
| `rule` | `rgba(232,228,220,.14)` | régua superior dos trilhos |
| `rule-2` | `rgba(232,228,220,.08)` | divisória entre linhas |

**Tintas por álbum** (RGB 0..1, ver `data/albums.ts`) — cada álbum contribui com duas tintas, mantidas numa faixa estreita de luminância/croma para dar unidade à coleção. Regra dura: **o fundo nunca é pintado com a cor do álbum**; a tinta aparece só em (1) halo radial de baixa opacidade atrás do corpo, (2) rim light do corpo, (3) jato, (4) anel de arte, (5) marcadores dos instrumentos, (6) barra de progresso.

| Álbum | inkA | inkB |
|---|---|---|
| OROVA — Densidade | `0.96, 0.53, 0.25` | `0.29, 0.55, 0.72` |
| MIRA SELVA — Queda Livre | `0.55, 0.78, 0.60` | `0.86, 0.36, 0.42` |
| TERRA NULA — Marés Internas | `0.92, 0.72, 0.30` | `0.36, 0.40, 0.66` |
| NÚCLEO 9 — Silêncio Sólido | `0.88, 0.42, 0.62` | `0.30, 0.62, 0.64` |
| ALMA CRUA — Ferro Doce | `0.82, 0.50, 0.34` | `0.52, 0.58, 0.44` |

Ao trocar por catálogo real: extraia 2 cores dominantes da capa e **force** para `oklch(L 0.50–0.62, C 0.13–0.18)` antes de usar.

### Tipografia

Três famílias, todas Google Fonts:

- **Archivo 700** — nome do artista, monumental. `letter-spacing: -0.035em`.
- **Bodoni Moda italic 400** — título da faixa/álbum (plano da frente). `letter-spacing: -0.01em`.
- **JetBrains Mono 400/500** — toda a camada de dados e instrumentos. `letter-spacing: 0.18–0.22em`, `text-transform: uppercase`.

Escala (W = largura do canvas de composição, H = altura, `p` = playAmount 0..1, `z` = zoom 0..1):

```
artistSize = W * (0.185 - p*0.045 - z*0.088)     // e reduzido para caber: ver "fit"
artistBaseline ay = H * (0.555 + p*0.03)
titleSize  = artistSize * 0.53
titleBaseline ty = ay + artistSize * 0.50        // lockup único: NÃO calcular separado
monoSub    = W * 0.011, baseline = ty + artistSize * 0.24
labelsAnel = W * 0.0105  (mono 500, ls .2em)
instrumentos = 10.5px (mono, ls .2em, uppercase)
```

**Regra crítica do lockup:** artista, título e sub-linha derivam de UM cálculo (`ay` + offsets proporcionais a `artistSize`). Calcular baselines independentes causa colisão entre camadas quando `p` muda — foi um bug real do protótipo.

**Fit horizontal:** medir o nome do artista; se exceder `W*0.90` (escala coleção) ou `W*0.52` (álbum/faixa) menos a margem `W*0.028`, reduzir a fonte proporcionalmente, com piso de 55% do tamanho nominal.

### Espaço / geometria

```
margem lateral do mundo       W * 0.028 (texto), W * 0.032 (título)
margem dos instrumentos       34px (todos os lados), bottom 26px
âncora do corpo (coleção)     x 0.615, y 0.425 (fração do viewport)
âncora do corpo (álbum/faixa) x 0.600, y 0.440
raio do anel R                min(W,H) * (0.42 - zoom*0.115 + play*0.055)
achatamento do anel           scale(1, 0.62)  → elipse
espessura da banda do anel    0.25 * R (setor normal 0.82×, selecionado 1.16×)
rótulos do anel               R * 1.24 (tick de R*1.08 a R*1.20)
espaçamento dos corpos        Δx = 0.285 * (i - nav) * (1 - zoom*0.6)
                              Δy = sin((i-nav)*1.15) * 0.10 * (1 - zoom)
profundidade                  depth = 1 / (1 + |i-nav| * 0.8)
raio do corpo vizinho         min(W,H) * 0.062 * depth
faixa de arte (play)          altura H * 0.115 * play, alpha 0.34 * play
scrim inferior                de H*0.885 a H, rgba(7,7,10,0) → .62 → .88
scrim superior                de 0 a H*0.10, rgba(7,7,10,.72) → 0
```

Sem raios de borda em nenhum elemento (`border-radius: 0`), sem sombras difusas, sem preenchimento de card. Profundidade vem de oclusão, escala e lente.

---

## O shader (mundo)

Ver `shaders/field.frag.glsl`. É um fragment shader full-screen que:

1. Converte `gl_FragCoord` em espaço `p = (uv - 0.5) * vec2(aspect, 1.0)`.
2. Soma o deslocamento de UV de **três massas**: corpo principal (`uM0`), corpo secundário (`uM1`) e **cursor** (`uCur`), via `pullOf()`:
   `k = min(m.z / (r² + 0.014), 0.85)`, offset radial `-dir * k * 0.13` + componente tangencial `tang * k * spin * 0.13`.
3. Soma a **onda de deformação** (`uWave.x` = raio, `uWave.y` = amplitude), gaussiana em torno do raio: `exp(-dr²*42)`.
4. Amostra o plano de trás com **dispersão cromática** (R/G/B com offsets `1±uDisp*1.6`) e **blur radial** de 4 amostras ao longo do offset (`uBlur`).
5. Aplica o **núcleo** (`coreOf`: `smoothstep(horizon, horizon*0.87, r)` → apaga a composição) e o **rim** — arco de luz rasante, não glow: `exp(-((r - h*1.01)/(h*0.028))²) * pow(max(0,dot(dir, normalize(vec2(-0.70,0.71)))), 3.5) * 1.25`.
6. Aplica o **jato** (`uJet`): faixa diagonal `exp(-axis²*900)` no eixo `(0.62, 0.78)`.
7. Amostra o **plano da frente** com **34% do offset** (paralaxe de plano) e compõe por alpha → é isto que faz o título passar **na frente** do corpo enquanto o resto passa atrás.
8. Ponto do cursor (`exp(-cd²*5200) * 0.55`), multiplicação por `uFade`, e **grão** por hash (`0.035` de amplitude, animado no tempo).

### Uniforms

| Uniform | Tipo | Significado / faixa |
|---|---|---|
| `uBack`, `uFront` | sampler2D | planos de composição |
| `uRes` | vec2 | resolução em px do canvas WebGL |
| `uM0` | vec4 | `xy` posição da massa principal (espaço `p`), `z` força (0.055–0.36), `w` horizonte (0.082–0.115) |
| `uM1` | vec4 | massa secundária (vizinho na coleção: z 0.030, w 0.052; corpo que chega na fusão) |
| `uCur` | vec3 | `xy` cursor em espaço `p`, `z` força = `(0.006 + vel*0.020) * intensidadeCampo` |
| `uWave` | vec3 | `x` raio (0→2.4), `y` amplitude (0.075 decaindo), `z` livre |
| `uSpin` | float | rotação do campo: 0.06 repouso · 0.16 álbum · 0.42+ tocando · até 2.4 no colapso |
| `uBlur` | float | 0 repouso · até 1.5 no colapso · `bass*0.12` tocando |
| `uFade` | float | exposição global (0.03 no vale do colapso, 1 normal) |
| `uGrain` | float | `0.035 * grao` |
| `uDisp` | float | `0.014 + uBlur*0.010` |
| `uJet` | float | 0 → 1.1 no pico do colapso, `0.10 + bass*0.22` tocando |
| `uInk` | vec3 | `inkA` do álbum atual |
| `uTime` | float | segundos |

Conversão de coordenadas (fração de viewport → espaço do shader): `mx = (fx - 0.5) * aspect`, `my = 0.5 - fy`.

---

## Composição (planos 2D)

### Plano de trás (`back`), nesta ordem

1. `fillRect` `#07070A`.
2. Halo radial na tinta do álbum, centro deslocado `-W*0.06` do corpo: `inkA(0.15 + energy*0.07)` → `inkB(0.06)` → transparente em `W*0.62`.
3. **Corpos vizinhos** (só na coleção, alpha `0.62*depth*(1-zoom)`): anel de arco assado + elipse `#0B0A0E` + arco de rim na tinta (`lineWidth 1.6`, de 2.0 a 4.1 rad) + nome do artista centralizado abaixo (`Archivo 700`, `min(W,H)*0.062*depth`) + linha mono `CAT · N FAIXAS`.
4. **Anel do álbum focado**: na coleção, buffer de arco assado (52–64% da circunferência, com fade nas pontas). No álbum/faixa, **anel setorizado** (um setor por faixa, gap angular `0.020`), desenhado num buffer quadrado de 1000px e só depois `scale(1,0.62)` + `rotate` — escalar antes de rotacionar produz falhas de cobertura entre fatias (bug real). Composite `lighter`.
5. **Rótulos das faixas** ao redor da elipse (mono, `R*1.24`), com tick radial. Só no semi-plano esquerdo/inferior (`cos(a) <= 0.30`) e nunca sobre a zona do lockup (`py > H*0.60 && px < W*0.46`), exceto a faixa selecionada/tocando, que é sempre visível.
6. **Poeira**: 240 partículas em órbita elíptica (`1.25x`, `0.72y`), alpha `(0.02 + z*0.13) * tw * (0.5 + energy*0.7)`, composite `lighter`, 1.1px. Cintilância só ao tocar.
7. **Nome do artista** monumental (com fit).
8. **Faixa de arte** inferior + barra de progresso de 2px na tinta (só quando `play > 0.02`).
9. **Scrims** superior e inferior — **por último** (protegem os instrumentos; desenhar antes deixa o mono ilegível).

### Plano da frente (`front`)

Título da faixa (Bodoni italic) + sub-linha mono + **um fragmento esticado da capa** (coluna estreita da capa, `blur(5px)`, máscara linear vertical + horizontal, alpha `0.26 + play*0.12`, rotação `0.26 rad`, ancorado em `W*0.855, H*0.08`). Fundo transparente — o alpha é o que o shader usa para compor.

### Anel setorizado (por faixa)

Buffer 1000×1000, `Rin = 350`, `Rout = 475`. Para cada faixa `k`: setor de `k/N + gap/2` a `(k+1)/N - gap/2`, 44 fatias por setor, cada fatia é uma coluna da capa (`drawImage` com 2px de sobreposição). Estados: normal `alpha 0.42`, hover `0.8`, selecionado `0.92` (raio interno −16% da espessura, espessura ×1.16), tocando `1.0`. Arco de progresso: `stroke` na tinta em `Rin - 10`, `lineWidth 4` no ativo (2 nos outros), varrendo `t0 → t0 + (t1-t0) * progresso`.

### Capas

No protótipo são geradas (campo diagonal em inkB, bloco em inkA, círculo escuro, faixa clara, 6 bandas, 900 pontos de grão). **Substituir por capas reais** com o mesmo tratamento de unificação: dessaturar ~8%, overprint leve da tinta do álbum, grão comum a todas. As capas alimentam: anel, fragmento da frente e faixa inferior — **nunca** aparecem como quadrado/card.

---

## Máquina de estados

### Escalas

`scale: 'campo' | 'album' | 'faixa'` + `zoom` contínuo (0 → 1, lerp `dt*4.2`) e `play` contínuo (0 → 1, lerp `dt*3.4`). As escalas **não** são telas: mudam âncora, raio, tamanho tipográfico e força da massa pela mesma interpolação.

`nav` (float) é a posição da câmera no campo: `nav += (navT - nav) * min(1, dt*5.5)`, `navT` clampado a `[0, n-1]`, snap para inteiro ao soltar o arrasto.

### Modos de reprodução

`mode: 'parado' | 'colapso' | 'toca' | 'pausa' | 'fusao'`

**Colapso (play), 2.25 s** — alvos por fase:

| t (s) | m0.z | m0.w | spin | blur | fade | jet | play |
|---|---|---|---|---|---|---|---|
| 0 → 1.1 | 0.055 → 0.355 (`e²`) | 0.112 → 0.142 | 0.06 → 2.36 | 0 → 1.5 | `1 - e^2.6` | 0 | 0 |
| 1.1 → 1.3 | 0.36 | 0.10 | 2.4 | 1.5 | **0.03** (vale) | 0 | 0 |
| 1.3 → 2.25 | 0.36 → 0.08 | 0.10 → 0.08 | 2.4 → 0.3 | 1.5 → 0 | → 1 | `sin(min(1,e*1.5)*π)*1.1` | 0 → 1 |

**Fusão (troca de faixa), 1.6 s** — a interação assinatura:

- `0 → 0.9 s`: corpo B espirala de `raio 1.5` a `0.02` (ângulo `-0.7 → 4.7`, `ease e²`), `m1.z 0.03 → 0.08`, `m1.w 0.055 → 0.075`, `mix 0 → 0.5` (as duas artes coexistem em arcos cruzados), `spin 0.42 → 1.32`, `blur → 0.4`.
- `0.9 s`: **emite a onda** (`waveR` de 0.02, cresce `dt*2.1`, amplitude `0.075 * (1 - r/2.3)`) que atravessa o viewport deformando tudo, inclusive a tipografia.
- `0.9 → 1.6 s`: `m1` decai (`×0.72/frame`), `mix → 1`, campo relaxa.
- Fim: A ← B, `pos = 0`, volta a `toca`. Se o usuário subiu para o álbum durante a fusão, **não** forçar a escala de volta para faixa.

**Tocando** — `m0.z = (0.075 + bass*0.030) * intensidadeCampo`, `m0.w = 0.082`, `spin = 0.42 + mid*0.14`, `jet = 0.10 + bass*0.22`, `blur = bass*0.12`. **Pausa** — mesmo layout com `play 0.86`, `spin 0.06`, `jet 0.02`, órbita desacelerando e poeira caindo (`r -= dt*0.012`).

Suavização geral dos alvos: `v += (target - v) * min(1, dt*9)`; `fade` usa `dt*14`.

### Cursor com massa

`mouse.x += (target - x) * min(1, dt*5.2)`; velocidade acumulada `v += dist*9`, decaindo `v *= 0.05^dt`; força `uCur.z = (0.006 + v*0.020) * intensidadeCampo`. É isto que dá a sensação de rastro/inércia — não usar hover CSS para nada disso.

### Áudio (substituir a simulação)

Protótipo: `bass = exp(-6.5 * frac(t*bpm/60))`, `mid = 0.5 + 0.5*sin(t*1.7)*sin(t*0.63)`, `treb = |sin(t*9.1)*sin(t*3.3)|³`.

Produção: `HTMLAudioElement` (ou `AudioBufferSourceNode`) → `AnalyserNode` (`fftSize 1024`, `smoothingTimeConstant 0.7`) → três bandas (20–160 Hz, 160–2k, 2k–12k) normalizadas para 0..1 com suavização de ~120 ms. Mapear exatamente para as mesmas variáveis. Teto rígido: curvatura não passa de ±15% do valor base — tipografia "dançando" mata o resultado. `pos/dur` vêm do elemento de áudio, não de um contador.

---

## Camada de instrumentos (DOM, não deformável)

Regra: **conteúdo experimental, controles estáveis.** Toda a camada é mono 10.5px, uppercase, `letter-spacing .2em`, sem fundo, sem borda arredondada, réguas de 1px. `position: absolute`, `pointer-events: none` no container e `auto` nos controles. O mundo tem `cursor: none` (o cursor É a massa); a camada de instrumentos restaura `cursor: default` e usa `pointer` nas linhas clicáveis.

**Auto-fade:** opacidade `1` quando houve movimento de ponteiro/tecla nos últimos **2600 ms**, senão **0.32**, `transition: opacity .35s ease`. Nunca desaparece por completo.

| Instrumento | Posição | Conteúdo e comportamento |
|---|---|---|
| Marca | `left 34, top 30` | "HORIZONTE", `#E8E4DC` |
| **Trilho de escala** | abaixo da marca | `Coleção › Álbum › Faixa`. Nível atual `#E8E4DC`, anteriores `#8C867E`, futuros `#5A554F`. Cada um clicável (volta/entra de nível) |
| **Régua de álbuns** | `right 34, top 56`, largura 214 | 5 linhas `grid 1fr 46px 7px`, altura 26px, divisória 1px. Nome · código · marcador 5px. Atual: texto `#E8E4DC` + marcador na tinta. Clique troca de álbum (anima `navT`); hover acende o corpo correspondente no mundo |
| **Régua de faixas** | `right 34, top 238`, largura 262 | `grid 22px 1fr 34px 7px`: número, título, duração, marcador. Selecionada branca (marcador 7px), tocando na tinta. Clique toca; hover acende o setor equivalente no anel. `opacity 0` + `pointer-events none` na escala coleção |
| **Transporte** | `left 34, bottom 26`, largura 600 | Linha 1: marcador + `NN · Título` + artista. Linha 2: régua de progresso de 1px (clicável = seek). Linha 3: `◂◂ Anterior` · `▸ Tocar / ❙❙ Pausar / ▸ Retomar` · `Próxima ▸▸` · timecode `mm:ss / mm:ss` alinhado à direita |
| **Voltar** | `right 34, bottom 26` | `◂ Voltar` (opacidade 0 na coleção) + código do contexto |

Hover dos controles: `color: #E8E4DC` (do estado `#8C867E`). Foco de teclado deve ser visível — sublinha de 2px na tinta (o protótipo não implementou; **implementar**).

Vínculo bidirecional obrigatório: régua ↔ anel. Apontar a linha destaca o setor; apontar o setor destaca a linha. É o que ensina o gesto espacial sem legenda.

### Gestos do mundo (caminho prazeroso, nunca o único)

| Gesto | Ação |
|---|---|
| Arrastar horizontal (coleção) | percorre o campo: `navT -= dx / (viewportW * 0.46)`, snap ao soltar |
| Roda (coleção) | `navT += deltaY*0.0016 + deltaX*0.0016` |
| Roda (álbum/faixa) | muda a seleção de faixa |
| Clique num corpo | entra no álbum |
| Clique num setor | toca a faixa |
| Clique no corpo (tocando) | pausa/retoma |
| Clique no vazio | sobe um nível |
| Espaço / Enter | ação primária da escala atual |
| ← → ↑ ↓ | percorre campo (coleção) ou faixas |
| Esc | sobe um nível |

Hit-test do anel: converter o ponteiro para o espaço do corpo, **desfazer o achatamento** (`dy / 0.62`), subtrair `ringRot`, e mapear o ângulo em `N` setores; banda válida entre `0.62R` e `1.34R`; abaixo de `0.55R` é o corpo.

---

## Responsividade

- **Desktop grande (≥1600px)**: como especificado.
- **Notebook (1200–1600)**: idem, `R` já é relativo a `min(W,H)`.
- **Tablet (768–1200)**: réguas de álbum e faixa colapsam numa única coluna à direita, com a régua de faixas empurrada para baixo; rótulos no anel só para a faixa selecionada.
- **Mobile**: **composição própria** — um corpo por tela, troca de álbum por swipe horizontal com snap, faixas como régua vertical ocupando o terço inferior (setores do anel continuam existindo mas não são o alvo de toque), transporte fixo no rodapé com alvos de **48px** mínimos, sem queda livre (o gesto de arraste vira paginação). Tipografia monumental mantém `0.185W` — no mobile ela sangra, e isso é desejado.

## Acessibilidade

- `prefers-reduced-motion`: curvatura a 25%, sem blur radial, sem paralaxe do cursor, colapso e fusão reduzidos a fade de 300 ms — as trocas de estado permanecem.
- Instrumentos são o caminho acessível: usar `<button>`/`<ul><li>` reais com `aria-current`, `aria-pressed` no play, `role="progressbar"` com `aria-valuenow` na régua, e `aria-live="polite"` anunciando faixa/álbum ao trocar.
- Contraste: texto ativo dos instrumentos ≥ 7:1 sobre o scrim; nunca abaixo de `#5A554F` para informação necessária.
- Nada depende de cor sozinha (marcador muda de tamanho, não só de cor).

## Performance

- 1 draw call por frame + 2 uploads de textura. Custo dominante: `texImage2D` dos canvases e o `drawImage` das fatias do anel.
- Assar os buffers de anel **uma vez por álbum** (e por seleção, no setorizado, quando mudar) — não redesenhar 300 fatias por frame no caminho da coleção.
- Alvo 60fps em notebook integrado com DPR 1.3 a 1440p. Se cair: reduzir amostras do blur de 4 para 3 e o canvas de composição para `min(W, 1440)`.
- `preserveDrawingBuffer: true` só se precisar capturar frames (custa); o protótipo liga para permitir screenshots.

## Acceptance checklist

1. Repouso: campo respirando, corpo à direita-do-centro, nome monumental atravessando e **entortando** ao encostar no corpo, anel elíptico de arte, fragmento esticado à direita.
2. Mover o mouse deforma o campo com inércia e rastro; parar relaxa em ~1.2 s.
3. Clicar numa linha da régua de álbuns anima o campo até aquele corpo; clicar no corpo entra no álbum.
4. No álbum, o anel mostra **um setor por faixa**; apontar a régua acende o setor e vice-versa.
5. Play executa o colapso com o vale de exposição de 180 ms e o jato; o título continua **na frente** do corpo.
6. Próxima faixa executa a fusão de 1.6 s com arcos cruzados e a onda atravessando o viewport.
7. Pausa perde energia visivelmente (órbita desacelera, mundo se desentorta, poeira cai) sem congelar.
8. Sem nenhuma legenda de instrução na tela, um usuário novo executa coleção → álbum → faixa → play → próxima → outro álbum.
9. Instrumentos caem a 32% em contemplação e voltam instantaneamente; faixa, progresso e estado permanecem legíveis no pico do colapso.

## Não fazer (anti-padrões vetados pelo cliente)

Vinil, agulha, toca-discos, pilha de capas, carrossel de capas, capa à esquerda + metadados à direita, barra de player convencional, três botões circulares, waveform decorativa sob o título, equalizador, HUD futurista, cards flutuantes, glassmorphism, gradiente roxo/azul, estrelas/nebulosas/sci-fi literal, esfera preta com glow como protagonista, fundo pintado com a cor da capa, sidebar, grid de cards, modal de tracklist.

## Assets

- Fontes: Google Fonts — Archivo (600/700), Bodoni Moda (italic 400), JetBrains Mono (400/500). Self-host via `next/font/google`.
- Capas: **placeholder gerado** no protótipo → substituir por arquivos reais (quadrados, ≥1024px, WebP/AVIF).
- Áudio: **simulado** → substituir por streams reais.
- Sem ícones de biblioteca: os controles são glifos tipográficos (`◂◂ ▸ ❙❙ ▸▸ ›`).

## Files

```
design_handoff_horizonte/
  README.md                                  ← este documento
  Horizonte - Navegacao.dc.html              ← referência principal (fluxo completo)
  Horizonte - Prototipo.dc.html              ← referência de motion (uma faixa)
  Direcao de Arte v2 - Quatro Direcoes.dc.html ← direção de arte e anti-padrões
  screenshots/                               ← estados-chave capturados do protótipo
    01-colecao-repouso.png
    02-colecao-cursor-com-massa.png
    03-album-anel-setorizado.png
    04-colapso-play.png
    05-faixa-em-curso.png
    06-volta-a-colecao.png
  shaders/field.frag.glsl
  shaders/field.vert.glsl
  data/albums.ts
```
