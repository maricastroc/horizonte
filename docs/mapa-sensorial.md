# Mapa sensorial — característica musical → propriedade física

> **A música define as constantes do mundo; a reprodução só as perturba.**

Este é o contrato entre a análise e o motor. A implementação está em
`src/components/horizonte/field.ts` (constantes), `audio/analysis.ts`
(perturbação) e `composition/ring.ts` (geometria).

**Dois produtores, um contrato.** A `AlbumSignature` que alimenta tudo abaixo tem
duas origens possíveis: `scripts/analyze-audio.py`, que mede o acervo curado uma
vez na curadoria, e `src/components/horizonte/ingest/`, que mede no navegador o
disco que o usuário traz. Os dois medem a mesma coisa do mesmo jeito — o segundo
é um porte do primeiro, verificado byte a byte — e o motor não pergunta de onde
veio. Ver [`ingestao-local.md`](ingestao-local.md).

## Como os números foram calibrados

Todos os ranges vêm das medições reais dos dez álbuns, feitas por
`scripts/analyze-audio.py`. Os descritores chegam normalizados 0..1 contra
**âncoras fixas e absolutas** — nunca contra os outros álbuns da coleção, para
que acrescentar um disco não mude a assinatura de nenhum outro.

| Álbum | Volume dB | Dinâmica dB | Brilho Hz | Duração min | L | D | B | T |
| --- | --: | --: | --: | --: | --: | --: | --: | --: |
| Tristan Lohengrin · Le Manoir | −28,6 | 17,8 | 980 | 22,1 | 0,17 | 0,24 | 0,62 | 0,09 |
| Jono Terbakar · lebar | −23,9 | 33,8 | 713 | 27,3 | 0,41 | 0,91 | 0,50 | 0,16 |
| Le Morte d'Abby · 0p | −16,0 | 16,8 | 1278 | 45,2 | 0,80 | 0,20 | 0,72 | 0,40 |
| Mark Wilson X · Dark Thoughts | −19,4 | 23,6 | 788 | 30,0 | 0,63 | 0,48 | 0,53 | 0,20 |
| Darin Wilson · Impromptu | −19,4 | 21,6 | 1090 | 27,1 | 0,63 | 0,40 | 0,66 | 0,16 |
| zero-project · e-world | −17,5 | 21,4 | 1726 | 74,9 | 0,72 | 0,39 | 0,84 | 0,80 |
| Tale Twist · Wry Way | −17,0 | 14,6 | 1669 | 31,2 | 0,75 | 0,11 | 0,83 | 0,22 |
| Madison Kenny · All Systems Go | −14,4 | 12,4 | 2600 | 16,0 | 0,88 | 0,02 | 1,00 | 0,01 |
| Meho · MKUltra | −19,4 | 19,4 | 324 | 65,7 | 0,63 | 0,31 | 0,19 | 0,68 |
| Mescaline Sessions · Jajce | −20,5 | 18,2 | 424 | 33,4 | 0,57 | 0,26 | 0,29 | 0,25 |

Âncoras: volume −32…−12 dB · dinâmica 12…36 dB · brilho 200…2600 Hz (log2) ·
duração 15…90 min. Os normalizados cobrem 0,01–1,00, então os ranges abaixo são
percorridos de verdade pelo acervo — não são teóricos.

Uma única medição encosta numa âncora: o centróide de *All Systems Go* é 2600,2 Hz
contra um teto de 2600 Hz. O corte descarta 0,2 Hz — o normalizado seria 1,00003
sem ele. As outras 39 medições caem dentro com folga. **As âncoras ficam como
estão:** alargar o teto de brilho para acomodar esses 0,2 Hz encolheria os outros
nove discos, porque a normalização é absoluta. Um teto de 3200 Hz derrubaria a
cobertura de achatamento e de rim light de 81% para 75% do range — perder-se-ia
diferenciação real em nove álbuns para ganhar 0,00003 num.

## Identidade — constantes do álbum

| # | Característica | Propriedade física | Range | Justificativa perceptiva | Guardrail |
| --- | --- | --- | --- | --- | --- |
| P1 | Volume | Peso do nome do artista (`wght` do Archivo) | 505 → 780 | Disco alto e denso pesa. É o canal mais legível porque a tipografia é o maior objeto da tela — e massa é a tese do produto. | Piso 500: abaixo disso o nome perde presença em corpo monumental. Teto 790: acima, o fit horizontal briga. O fit é recalculado **depois** do peso. |
| P2 | Volume + duração (peso) | Força da lente `m0k` | ×0,88 → ×1,16 | Massa maior entorta mais espaço. Um disco "pesado" é denso *e* extenso, daí a combinação 0,68/0,32. | ±16%: acima disso a tipografia monumental se dobra sobre si mesma e o lockup quebra. |
| P3 | Volume | Raio do horizonte `m0h` | ×0,95 → ×1,07 | Corpo mais denso engole mais luz antes de deixá-la passar. | ±7%: o núcleo negro não pode avançar sobre a linha do título. |
| P4 | Dinâmica | **Teto de perturbação ao vivo** | 0,05 → 0,20 | A correção estrutural: a amplitude com que o mundo reage passa a ser propriedade do disco. Comprimido quase não respira; dinâmico incha visivelmente. | Teto duro 0,20 (o handoff fixa ±15% como referência). `prefers-reduced-motion` zera. |
| P5 | Dinâmica | Amplitude do envelope na espessura do anel | ±0,10 → ±0,32 da banda | Disco dinâmico tem silhueta recortada; comprimido tem anel liso. | Espessura sempre em [0,55; 1,20] da banda base — se passar disso, lê como gráfico, não como matéria. |
| P6 | Brilho | Achatamento do anel | 0,57 → 0,67 | Discos escuros deitam; brilhantes abrem. Valor menor = mais achatado = mais visto de perfil, mais baixo, mais pesado. | Nunca fora de [0,55; 0,68]: a elipse viraria linha ou círculo. |
| P7 | Brilho | Dureza do rim light (expoente `uRim`) | 2,6 → 5,0 | Brilho de timbre = dureza de luz. Mesma direção que a direção de arte propôs para bordas de sombra. | **O brilho move só o expoente.** Lóbulo e direção continuam fora do alcance do timbre — a direção agora pertence ao tempo (P12), e nada mais escreve nela. |
| P8 | Duração | Inércia da navegação (lerp de `nav`) | 6,2 → 4,3 | Disco longo é mais pesado de atravessar. | Nunca abaixo de 4,2, senão o snap parece travamento. **A inércia é só do gesto no mundo** — réguas, teclado e clique continuam exatos. |
| P9 | Duração da faixa | Ângulo do setor no anel | proporcional | Ângulo = tempo. O setor que se aponta *é* quanto tempo se vai ouvir. | Setor mínimo de 1,4° para continuar clicável. |
| P10 | Envelope (RMS 200 ms) | Espessura radial ao longo do setor | ver P5 | Forma = dinâmica no tempo. É a impressão digital do disco. | Indexado pelas mesmas fronteiras de P9, para que geometria e intensidade falem do mesmo instante. |

## Identidade — o que pertence à faixa

Até aqui, tudo o que um disco *é* parava no disco: as onze faixas de *Le Manoir*
viviam num mundo idêntico. P11 corrige isso sem medir nada de novo.

| # | Característica | Propriedade física | Range | Justificativa perceptiva | Guardrail |
| --- | --- | --- | --- | --- | --- |
| P11 | Nível e dinâmica **da faixa** | Desloca `m0k`/`m0h` (nível) e o teto de reação + envelope (dinâmica) | ±0,25 em espaço normalizado | Um disco heterogêneo é uma sequência de peças diferentes, e o mundo tinha de saber disso. A faixa muda **quanto o mundo pesa e quanto ele reage**. | O álbum continua sendo a âncora: o viés médio ponderado por duração é zero. O peso do artista (P1), a luz (P6, P7) e a inércia (P8) **não** se movem por faixa — são identidade do disco. Tudo passa pelos mesmos `RANGE` de P1–P8. |

**De onde vêm os números.** Não houve nova passada de DSP: o `envelope` de 512
amostras já publicado é fatiado pelas fronteiras de `spans` (as mesmas de P9), e
cada faixa recebe o nível médio e o espalhamento p95−p05 da sua fatia. Resolução
real: de 16 amostras por faixa (*e-world*) a 117 (*Impromptu*).

O sistema se auto-modula. *Le Manoir* vai de 0,088 (*La Chambre*) a 0,764
(*Poursuivi*) — 8,7× de espalhamento. *Impromptu* vai de 0,53 a 0,63 — 1,2×. Um
disco coeso quase não se move entre faixas, e isso é a medição funcionando, não
falhando.

Lido do motor em execução, dentro de *Le Manoir*:

| | Lente `m0k` | Teto de reação | Envelope |
| --- | --: | --: | --: |
| Álbum (antes de P11) | — | 0,086 | 0,153 |
| 06 La Chambre | 0,0666 | 0,0573 | 0,111 |
| 09 Poursuivi | 0,0716 | 0,0973 | 0,169 |

Dentro de um mesmo disco, o teto de reação varia **1,70×** e a profundidade do
envelope **1,53×**. A lente varia só 7,5%, porque o range de P2 é estreito de
propósito — a diferença entre faixas se sente sobretudo na reação e na silhueta
do anel, não na força da lente.

## Identidade — o tempo

| # | Característica | Propriedade física | Range | Justificativa perceptiva | Guardrail |
| --- | --- | --- | --- | --- | --- |
| P12 | Posição na faixa | **Direção** da luz rasante (`uLight`) | arco de 1,0 rad (~57°) | O sol rasante atravessa o corpo enquanto a faixa passa. E a duração vira velocidade: "Le Hall" (53 s) tem a luz correndo, "Dans le Jardin" (240 s) tem a luz arrastando. | Uma fonte de luz só — a mesma direção alimenta `uM0` e `uM1`. No meio da faixa a direção é exatamente a histórica do handoff, `(−0,70; 0,71)`. Módulo constante. Fora de reprodução, volta à base. |
| P13 | Posição no **álbum** | Rotação do anel (`ringRot`) | uma volta por disco | O anel já era a linha do tempo do álbum (P9). Passa a girar como ela: o ponto que toca fica sempre na âncora, e o disco atravessa a emenda entre faixas sem salto. Parado, o anel não se mexe — silêncio é imobilidade. | Orientação canônica por álbum (`RING.anchor`): o mesmo disco mostra sempre o mesmo anel. Uma forma que muda a cada visita não é uma forma. |

**P12, medido.** Ao longo de *Dans le Jardin* (240 s), a direção varre de 107,7°
a 162,1° com módulo constante em 0,997. É da ordem de 0,004 rad/s — mais lento
que qualquer ponteiro de relógio. Por isso `prefers-reduced-motion` mantém a
varredura: ela carrega informação e não é reação.

**P13, medido.** A rotação antiga era `dt · (0,05 + energy·0,14) · 1,6` →
0,174–0,304 rad/s, ou **7 a 12 voltas completas por faixa**. O anel era o mapa do
disco e o mapa não parava quieto o bastante para ser aprendido; os rótulos
entravam e saíam o tempo todo. A taxa nova é 0,0014 rad/s (*e-world*, 75 min) a
0,0065 rad/s (*All Systems Go*, 16 min) — redução de 27× a 130×, e agora é
propriedade medida: um disco longo gira mais devagar.

Com a orientação fixa, 50–69% dos rótulos ficam visíveis (pior caso 2 de 4, em
*Jajce*). O rótulo selecionado ou em curso ignora as regras de ocultação e
aparece sempre, e a régua da direita lista tudo — tocando, todos dão a volta
dentro de um álbum.

Não amarramos a rotação ao andamento: exigiria DSP novo, falharia nos discos
ambient do acervo, e P12 já é dono do canal "tempo" — dois relógios embaralham.

## Identidade — o gesto

| # | Característica | Propriedade física | Range | Justificativa perceptiva | Guardrail |
| --- | --- | --- | --- | --- | --- |
| P14 | Peso do disco **apontado** | Força da segunda massa (`uM1`) | ×0,88 → ×1,16 sobre 0,03, com ganho 1,9 ao apontar | A coleção tinha dez corpos e uma massa só: `uM1` usava força fixa (0,03 / 0,052) para qualquer disco, e apontar um corpo mudava a opacidade de um texto. Agora o peso que se sente ao apontar é o peso medido daquele disco — você sente os discos antes de entrar em qualquer um. | Só na escala coleção. O ganho vale para `m0k`, **não** para o horizonte: apontar não deixa o disco maior, deixa você sentir o peso dele. `prefers-reduced-motion` tira o ganho e mantém o peso. Nenhum uniforme novo. |

**A regra.** Quando você não aponta nada, `uM1` é o vizinho na direção da
navegação, como sempre foi — mas agora com o `massScale` e o `horizonScale` dele.
Quando você aponta um corpo, `uM1` **passa a ser esse corpo**. Atenção move o
campo, e o orçamento de massas continua em três (corpo, segunda massa, cursor).

A chegada tem inércia (`lerp` 3,5), coerente com o cursor com massa: a segunda
massa se desloca, não teleporta.

Isso também sobe o vínculo bidirecional que o handoff exige — apontar a régua
acende o corpo no mundo — de opacidade para física.

## Continuidade — emenda contra cerimônia

O fim natural de uma faixa disparava a **mesma** cerimônia de 1,6 s que pular de
disco: corpo espiralando de raio 1,5 e onda atravessando o viewport. Ouvir
*e-world* inteiro eram 15 cerimônias, e a fusão — a interação-assinatura —
estava gasta pelo uso automático.

Agora o fim natural é uma **emenda**: 0,6 s, um único canal (o horizonte contrai
4,5% e volta), sem segundo corpo, sem onda, sem blur. `mode` continua `playing`;
a queda natural de energia enquanto o arquivo novo carrega faz metade do
trabalho. A fusão fica reservada ao salto **escolhido** — pular, mudar a seleção,
clicar noutro setor.

Verificado em reprodução real: durante a emenda, `mix` fica em 0, `waveR` em −1 e
`m1k` em 0. Nenhuma cerimônia acontece.

Efeito colateral: o fim de faixa deixou de mexer em `scale` e `alb`, o que
eliminou do caminho automático uma classe inteira de colisão — `endFusion`
promovia `alb` sem checar se o usuário tinha navegado para outro disco no meio da
fusão, e devolvia você ao álbum que tocava.

## Reação — perturbação temporária

Tudo abaixo é limitado por **P4** e sempre volta ao valor de identidade. Nenhum
destes canais define nada; todos apenas oscilam em volta de uma constante.

| Sinal | Perturba | Amplitude |
| --- | --- | --- |
| `accent.bass` | curvatura da lente | ±cap |
| `accent.mid` | velocidade de rotação | ±cap |
| `accent.treb` | dispersão cromática | ±cap × 0,6 |
| `flux` | intensidade do jato | base + cap |
| `centroid` ao vivo | dureza do rim (em torno de P7) | ±cap × 0,5 |

O nível de cada banda é normalizado contra as âncoras p10/p90 **do próprio
álbum**, medidas offline. Era aqui que estava o defeito: o runtime perseguia o
próprio pico a cada quadro e as bandas grudavam em 1,000 — `bass` variava entre
0,996 e 1,000, com desvio padrão de 0,001.

## Validação — os dez álbuns comparados

Constantes derivadas de fato, lidas do motor em execução. Os ranges são
percorridos de verdade — a diferença entre discos é medida, não decorativa.
*All Systems Go* toca o teto de achatamento e o de rim light; os demais guardrails
seguem sem ninguém encostado.

| Álbum | Peso | Lente | Horiz. | Teto reação | Envelope | Achat. | Rim | Nav | Setores (min–máx) |
| --- | --: | --: | --: | --: | --: | --: | --: | --: | --- |
| Le Manoir | **551** | **0,92** | 0,97 | 0,086 | 0,153 | 0,632 | 4,09 | 6,02 | 11 · 14,5°–65,3° |
| lebar | 617 | 0,97 | 1,00 | **0,186** | **0,300** | 0,620 | 3,79 | 5,89 | 9 · 24,1°–57,7° |
| 0p | 725 | 1,07 | 1,05 | 0,080 | 0,144 | 0,642 | 4,34 | 5,44 | 7 · 37,6°–77,1° |
| Dark Thoughts | 679 | 1,02 | 1,03 | 0,123 | 0,207 | 0,623 | 3,88 | 5,82 | 10 · 22,6°–49,9° |
| Impromptu | 678 | 1,01 | 1,03 | 0,110 | 0,188 | 0,636 | 4,19 | 5,89 | 5 · 61,6°–81,9° |
| e-world | 704 | **1,09** | 1,04 | 0,109 | 0,187 | 0,654 | 4,62 | **4,68** | 16 · 11,0°–39,5° |
| Wry Way | 712 | 1,04 | 1,04 | 0,066 | 0,124 | 0,653 | 4,59 | 5,79 | 8 · 30,0°–63,4° |
| All Systems Go | **748** | 1,05 | **1,06** | **0,053** | **0,104** | **0,670** | **5,00** | **6,17** | 4 · 78,9°–98,4° |
| MKUltra | 678 | 1,06 | 1,03 | 0,096 | 0,168 | **0,589** | **3,05** | 4,92 | 6 · 31,2°–87,7° |
| Jajce | 663 | 1,01 | **1,02** | 0,089 | 0,157 | 0,599 | 3,30 | 5,73 | 4 · 36,7°–129,3° |

Leituras que valem registrar:

* **lebar reage 3,5× mais que All Systems Go** (teto 0,186 contra 0,053), porque é
  2,7× mais dinâmico. É a diferença que antes não existia: todos tinham o mesmo 0,15.
* **O anel de lebar tem borda esfarrapada; o de All Systems Go é liso.** Mesma
  geometria, envelope diferente.
* **Jajce tem 4 setores, um deles de 129°**; e-world tem 16, o menor com 11°. Os
  dois anéis são irreconhecíveis um no outro.
* **MKUltra e All Systems Go são os dois polos da luz** (0,589/3,05 contra
  0,670/5,00) — o disco mais escuro do acervo, com centróide de 324 Hz, contra o
  mais brilhante, com 2600 Hz.
* **All Systems Go é extremo em quatro eixos ao mesmo tempo:** o mais alto, o mais
  brilhante, o mais comprimido e o mais curto. Não é um empate apertado com
  ninguém — o segundo mais brilhante fica 874 Hz atrás. O corte de 0,2 Hz na
  âncora é coincidência de medição, não compressão de informação.
* **Três discos empatam no peso do artista.** Dark Thoughts, Impromptu e MKUltra
  medem −19,4 dB e derivam 679, 678 e 678. P1 não os separa, e isso está correto:
  eles têm de fato o mesmo volume médio. Quem os distingue são os outros canais —
  o teto de reação (0,123 · 0,110 · 0,096) e sobretudo o brilho (0,53 · 0,66 ·
  0,19), que afasta MKUltra dos outros dois na luz e no achatamento. Empate num
  canal absoluto é informação, não falha.

### Sinal ao vivo, antes e depois

Medido em 4 s de reprodução real, mesma faixa, mesmo trecho:

| Sinal | Desvio padrão antes | Depois |
| --- | --: | --: |
| `bass` | 0,001 | **0,148** |
| `mid` | 0,000 | **0,142** |
| `treb` | 0,017 | **0,197** |
| `energy` | 0,019 | **0,191** |
| `flux` | 0,005 | **0,128** |

## Experimento aberto — o campo antecipa

**Entra desligado.** Ligue com `?x=anticipate` na URL ou
`__horizonte.experiments.anticipation = true` no console; a amplitude se varre
com `experiments.anticipationGain`.

A ideia: o `envelope` já publicado é lido **à frente** do playhead (6 s), e a
diferença entre o que vem e o que soa agora enviesa o raio do horizonte e a
exposição. Alguns segundos antes de um trecho abrir, o núcleo contrai e a
exposição abre; antes de cair para o silêncio, o núcleo dilata. O mundo fica
sempre um pouco à frente do ouvido.

Por que só faz sentido aqui: um analisador ao vivo só sabe o que já soou — por
definição ele reage. Antecipar exige que o disco tenha sido medido antes de ser
tocado, e é isso que este acervo é.

Força do sinal, medida sobre o `envelope` publicado (p90 de |lead|, 6 s de
horizonte): 0,19 a 0,39 conforme o disco. A resolução do envelope varia 4,6×
entre os discos — 1,9 s por amostra em *All Systems Go*, 8,8 s em *e-world* — e o
sinal é mais fraco justamente nos discos longos. Um horizonte de 2 s cai a 0,074
no pior disco; 6 s é o joelho da curva.

Efeito no mundo, medido em *Poursuivi* com a flag ligada, respeitando o teto de
P4 (ganho 1):

| Ganho | Desvio do horizonte (p90) | Máximo |
| --- | --: | --: |
| 1 (= teto de P4) | 2,8% | 4,6% |
| 1,5 | 4,3% | 6,9% |
| 2 | 5,7% | 9,2% |
| 3 | 8,5% | 13,7% |

**A questão em aberto é a calibração, não a implementação.** Com ganho 1 o
horizonte se move tipicamente 1–3% — pode ficar abaixo do limiar de percepção.
Passar disso exige romper o teto de P4 conscientemente, e essa decisão não foi
tomada. Desligado, o sinal é exatamente zero e o mundo é idêntico ao de antes.

## O que não muda

Colapso, cursor com massa, pausa e a camada de instrumentos ficam como estão. A
fusão continua exatamente como era — o que mudou foi **quando** ela acontece
(ver "emenda contra cerimônia"), não como. A camada mono nunca reage: é o
contraste entre um mundo que responde e uma régua que não responde que impede o
produto de virar visualizer.

## O envelope publicado não é reprodutível byte a byte

Descoberto ao portar a análise para o navegador. O `envelope` de 512 pontos é uma
decimação por amostragem pontual da curva de RMS de 200 ms — 44× em *e-world* —
**sem filtro anti-aliasing**. Quais amostras caem nos 512 pontos depende do
alinhamento exato do PCM.

Alimentando o mesmo arquivo deslocado de **uma amostra** (45 µs), o envelope de
*e-world* muda com correlação 0,9708 e desvio máximo de 92 de 255. O envelope
bruto, antes da decimação, mantém correlação acima de 0,999 sob o mesmo
deslocamento: a medição é estável, a representação não.

Não foi corrigido de propósito — filtrar antes de decimar mudaria a assinatura
dos dez discos e o acervo atual é a referência calibrada do produto. A
consequência sensorial é pequena: entre dois decodificadores, as constantes do
campo ficam dentro de 0,55% do range, e o viés por faixa (P11) dentro de 0,072
no pior disco. Registrado em `__tests__/ingest-envelope.test.ts`.

## Regenerar

```bash
python3 scripts/analyze-audio.py --report
```
