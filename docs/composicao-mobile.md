# Composição mobile — o mesmo mundo, outro espaço

> **A morfologia de cada álbum pode mudar radicalmente; a legibilidade e a
> estrutura da interface não podem mudar junto com ela.**

O mobile não é o desktop comprimido. É uma composição própria dentro do mesmo
sistema visual, com regiões declaradas em
[`composition/bands.ts`](../src/components/horizonte/composition/bands.ts) e
consumidas **pelo canvas e pelo DOM a partir da mesma fonte** — o `Snapshot`
publicado pelo motor. Canvas e interface não podem discordar sobre onde termina
o palco porque leem o mesmo número.

## Por que a versão anterior quebrava

| Sintoma | Causa |
| --- | --- |
| Tipografia gigante, cortada, atravessando a lista | A lente do shader é cega ao aspecto. `field.frag.glsl` trabalha em `p = (uv − 0,5) · (aspect, 1)`, e `pullOf` devolvia um desvio em unidades de `p`. Com aspecto 1,6 no desktop e 0,46 no telefone, **o mesmo `m0k` arrastava três vezes mais fração de largura** num celular. |
| Nome do álbum no meio da lista de faixas | `lockup()` não recebia o `WorldLayout`. Escala, linha de base (`H · 0,555`), corpo do título e da linha de metadados eram constantes de desktop escaladas pela largura. Em 390 px a linha de metadados saía com ~4 px. |
| Título e metadados cortados na borda | `drawFront` recebia `_L` e não aplicava fit de largura nenhum — só o nome do artista, em `drawBack`, tinha `measureText`. |
| Arte cruzando a coluna de duração | O estilhaço de capa era posicionado em coordenadas de desktop (`W · 0,855`, altura `H · 0,62`): ao lado da régua no desktop, em cima dela no telefone. |
| Um álbum cabia, outro não | Nada limitava o alcance da morfologia. `dist + size` vai de 1,11 (Madison Kenny) a 2,47 (zero-project) raios — 2,2× de variação sem referência de palco. |
| Topo congestionado, controles espalhados | Marcação de desktop com remendos `compact:`: as duas réguas dividiam uma coluna absoluta, e o transporte quebrava em três linhas soltas a partir de 360 px. |
| Texto secundário apagado | `text-ink-mute` (#8C867E) a 10,5 px sobre campo, e o fade de ocioso (32%) disparava em telas de toque, onde não existe movimento de ponteiro. |

## As regiões

Frações da altura da viewport, elásticas por proporção de tela
(`tallness = (H/W − 1,5) / 0,7`). A abertura e o transporte são cromo de altura
quase fixa; palco e lista absorvem o resto.

```
0 ─────────────────────────  abertura   HORIZONTE · contexto · licença · escala
      b.top ──────────────
                             palco      o mundo: núcleo, coroa, satélites
      b.stage ────────────
                             identidade artista · faixa · metadados
      b.identity ─────────
                             índice     lista de faixas, rolável
      b.list ─────────────
                             transporte busca · tempo · som · anterior/tocar/próxima
1 ─────────────────────────
```

O palco respira com a escala: `share` interpola de 0,86 na coleção (o mundo é o
assunto) para 0,46 no álbum (a lista precisa do espaço). É a mesma ideia do zoom
do desktop, resolvida na vertical em vez da horizontal.

## O contrato de camadas

1. **Nunca obstruído** — escala, linhas da lista, transporte, tempo.
2. **Interferência leve** — a identidade tipográfica: vive no campo, aceita ser
   tocada pela deformação, mas com limites de escala, largura, posição e
   distância.
3. **Atmosférico livre** — lente, partículas, brilho radial, estilhaço de capa,
   faixa da capa ao pé.

O contrato é imposto **no próprio campo**, não separando as coisas: `uGuard`
(`GUARD.residual = 0,22`) faz o desvio da lente decair para um resíduo abaixo do
chão do palco. Acima dele o mundo é deformado como sempre; abaixo, identidade,
lista e transporte recebem só o suficiente para continuarem dentro do mundo. No
desktop `uGuard.z = 1` e a função é a identidade — nada muda.

## A transformação da morfologia

Não é `scale()`. `placeInStage()` recalcula a ocupação do espaço:

- **raio** — `R = min(raio natural, raio que faz a extensão caber no palco)`. O
  corte **só encolhe**: nenhum corpo cresce para preencher a moldura, senão a
  massa (M1) deixaria de ser legível.
- **envelope, coroa e satélites** — entram na extensão medida por `extentOf()`,
  então o sistema inteiro é enquadrado, não só o círculo do corpo.
- **posição do núcleo** — o *bounding box* é centrado na vertical do palco, e não
  o centro do corpo: um disco com satélites de um lado só fica equilibrado.
- **offsets** — a excentricidade (M7) sobrevive como deslocamento dentro da
  folga que sobra (`BAND.slack`), limitada pelo que o palco permite.
- **horizonte** — `horizonUnit()` passa a derivar do raio efetivamente
  desenhado, então o núcleo do shader acompanha o corpo enquadrado.
- **profundidade aparente** — `uWorld` mede distância e desvio da lente em
  unidades de mundo. No desktop vale 1 e o shader é bit a bit o de antes.

`ringScale` no mobile subiu de 0,70 para **1,15**. Não é ajuste de gosto: com
0,70 o mundo ocupava 24% do palco e, sob o borrão de relance, os dez discos
correlacionavam 0,70 entre si. A varredura em `perception` mostra o mínimo de
convergência em 1,15–1,20; acima de 1,50 o corte do palco começa a nivelar as
morfologias e a correlação volta a subir.

| `ringScale` | média de relance | pior par | segue a música | discos cortados |
| --: | --: | --: | --: | --: |
| 0,70 | 0,701 | 0,958 | 0,514 | 0 |
| 1,00 | 0,524 | 0,925 | 0,395 | 1 |
| **1,15** | **0,478** | **0,913** | **0,339** | **3** |
| 1,35 | 0,498 | 0,905 | 0,282 | 7 |
| 1,70 | 0,536 | 0,957 | 0,311 | 9 |

## Diferenças deliberadas em relação ao desktop

| | Desktop | Mobile |
| --- | --- | --- |
| Rótulo radial de faixa | todos, ao redor da coroa | **nenhum** — quem nomeia é a lista |
| Volume | botão + régua | só `Som/Mudo`; o volume é do sistema |
| `◂ Voltar` | botão dedicado | a escala `Coleção › Álbum › Faixa` faz o papel |
| Régua de álbuns | sempre aberta, à direita | revelação `Álbuns`, ocupando palco + lista |
| Fade de ocioso | 32% após 2,6 s | desligado em ponteiro grosso |
| Calha do texto no canvas | `W · 0,028` | `BAND.gutter` — a mesma calha do DOM |
| Contraste base | `ink-mute` | `ink-text-2`, com `ink-mute` para o secundário |

## Guardrails

`__tests__/mobile.test.ts` roda os dez álbuns em 320×568, 375×667, 390×844 e
430×932, em 1× e em `DPR_MAX`, na coleção e no álbum:

- as bandas se sucedem sem se sobrepor e nenhuma fica pequena demais para o toque;
- corpo, coroa e satélites de todo álbum ficam dentro do palco;
- o bloco de identidade cabe na própria banda e a linha de metadados nunca cai
  abaixo de 9,5 px;
- nome, título e metadados encolhem até caber — e param num piso;
- **o palco não nivela os discos**: o raio percorre mais de 1,35× e a ocupação
  mais de 2× entre o mais compacto e o mais extenso, e nenhum par de discos
  compartilha raio.

`__tests__/perception.test.ts` mede o mobile na moldura do palco de verdade
(390×844 recortado na banda) e aplica os mesmos guardrails de convergência do
desktop.

## Limitações conhecidas

- **Paisagem de telefone** (`h < 520`) continua usando esta composição, e ela
  encolhe até o limite: em 844×390 a lista mostra uma linha e meia e o palco fica
  com 100 px. Nada é cortado, mas a experiência é apertada — a composição foi
  desenhada para retrato.
- **Lista curta em tela alta**: um álbum de quatro faixas em 430×932 deixa ~130 px
  de campo vazio entre a última linha e o transporte. O palco não recupera essa
  sobra porque as bandas não conhecem a contagem de faixas.
- **Sem controle de volume no app** no mobile: só `Som/Mudo`. Quem ajusta nível é
  o sistema.
- As `env(safe-area-inset-*)` entram por `.instruments-safe`; foram exercitadas
  no navegador com inset zero. Em Safari com notch a abertura e o transporte
  ganham o inset por cima das bandas, o que reduz palco e lista na mesma medida.
