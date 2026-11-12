# Composição mobile — o mesmo mundo, outro espaço

> **A morfologia de cada álbum pode mudar radicalmente; a legibilidade e a
> estrutura da interface não podem mudar junto com ela.**

O mobile não é o desktop comprimido. É uma composição própria dentro do mesmo
sistema visual, com regiões declaradas em
[`composition/bands.ts`](../src/components/horizonte/composition/bands.ts) e
consumidas **pelo canvas e pelo DOM a partir da mesma fonte** — o `Snapshot`
publicado pelo motor. Canvas e interface não podem discordar sobre onde termina
o palco porque leem o mesmo número.

## Por que é uma composição própria

A lente do shader trabalha em `p = (uv − 0,5) · (aspecto, 1)`: com aspecto 0,46
no telefone, o mesmo desvio arrasta três vezes mais fração de largura que no
desktop. E a extensão de um disco (corpo, coroa e satélites) varia 2,2× entre o
mais compacto e o mais espalhado. Sem regiões declaradas, tipografia, lista e
transporte disputavam o mesmo espaço com a morfologia.

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

A identidade tem piso: `BAND.identityFloor` (0,125) é medido no **lado curto** da
tela, e o palco cede a ele na coleção. Em retrato o piso nunca alcança a banda
nominal e nada muda; em paisagem ele vale 0,125 · H nas duas escalas, em vez de a
coleção espremer a identidade (28 px em 844×390).

No `lockup()` a linha de metadados tem chão (`metaFloor`, legibilidade) e teto
(`metaCeil`, 0,9 do título), então a hierarquia nome › título › metadados vale em
qualquer proporção: sem o teto, em paisagem os metadados saíam com 25 px e o
título com 5. O encaixe na banda usa a mesma geometria que posiciona as linhas,
incluindo o piso de glifo (`GLYPH`).

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

`ringScale` no mobile é **1,15**, o mínimo de convergência entre as formas na
varredura de `perception` (feita com os dez primeiros discos do acervo): em 0,70
o mundo ocupava 24% do palco e os discos se pareciam sob o olhar de relance;
acima de 1,50 o corte do palco começa a nivelar as morfologias.

## Diferenças deliberadas em relação ao desktop

| | Desktop | Mobile |
| --- | --- | --- |
| Rótulo radial de faixa | todos, ao redor da coroa | **nenhum** — quem nomeia é a lista |
| Volume | botão + régua | só `Sound`/`Mute`; o volume é do sistema |
| `◂ Back` | botão dedicado | a escala `Collection › Album › Track` faz o papel |
| Régua de álbuns | sempre aberta, à direita | revelação `Albums`, ocupando palco + lista |
| Fade de ocioso | 32% após 2,6 s | desligado em ponteiro grosso |
| Calha do texto no canvas | `W · 0,028` | `BAND.gutter` — a mesma calha do DOM |
| Contraste base | `ink-mute` | `ink-text-2`, com `ink-mute` para o secundário |

## Guardrails

`__tests__/mobile.test.ts` roda todos os álbuns do acervo em 320×568, 375×667,
390×844 e 430×932, e em paisagem em 844×390 e 932×430, em 1× e em `DPR_MAX`, na
coleção e no álbum:

- as bandas se sucedem sem se sobrepor e nenhuma fica pequena demais para o toque;
- corpo, coroa e satélites de todo álbum ficam dentro do palco;
- o bloco de identidade cabe na própria banda, as linhas não se tocam e a linha
  de metadados nunca cai abaixo de 9,5 px nem passa do título;
- em paisagem, nome e título ficam em pelo menos 18 e 10,5 px, e a coleção não
  espreme a identidade;
- nome, título e metadados encolhem até caber — e param num piso;
- **o palco não nivela os discos**: o raio percorre mais de 1,35× e a ocupação
  mais de 2× entre o mais compacto e o mais extenso, e nenhum par de discos
  compartilha raio.

`__tests__/perception.test.ts` mede o mobile na moldura do palco de verdade
(390×844 recortado na banda) e aplica os mesmos guardrails de convergência do
desktop.

## Limitações conhecidas

- **Paisagem de telefone** (`h < 520`) continua usando esta composição, desenhada
  para retrato, e ela encolhe até o limite. Em 844×390 a identidade sai com nome
  de 20 px, título de 11,4 px e metadados de 10,2 px, e o palco fica com 92 px no
  álbum. A banda da lista tem 59 px, quase toda ocupada pelas abas *Tracks* e *Why
  this shape?*: nenhuma linha de faixa aparece inteira. Em 740×360 os metadados
  caem para 9,4 px.
- **Lista curta em tela alta**: um álbum de quatro faixas em 430×932 deixa ~130 px
  de campo vazio entre a última linha e o transporte. O palco não recupera essa
  sobra porque as bandas não conhecem a contagem de faixas.
- **Sem controle de volume no app** no mobile: só `Sound`/`Mute`. Quem ajusta nível é
  o sistema.
- As `env(safe-area-inset-*)` entram por `.instruments-safe`; foram exercitadas
  no navegador com inset zero. Em Safari com notch a abertura e o transporte
  ganham o inset por cima das bandas, o que reduz palco e lista na mesma medida.
