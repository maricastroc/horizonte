# Mapa sensorial — característica musical → propriedade física

> **A música define as constantes do mundo; a reprodução só as perturba.**

Este é o contrato entre a análise e o motor: o que cada descritor do disco vira
no mundo, dentro de que limites, e por quê. A implementação está em
`src/components/horizonte/`: `field.ts` (constantes), `morphology.ts` e
`composition/layout.ts` (geometria), `audio/analysis.ts` (reação ao vivo),
`composition/strain.ts` (a coroa), `motion.ts` (assinatura de movimento) e
`anatomy.ts` (a leitura da forma).

**Dois produtores, um contrato.** A `AlbumSignature` tem duas origens:
`scripts/analyze-audio.py`, que mede o acervo curado uma vez, e
`src/components/horizonte/ingest/`, que mede no navegador o disco que o visitante
traz. O segundo é um porte do primeiro, e o motor não pergunta de onde a
assinatura veio. Ver [`ingestao-local.md`](ingestao-local.md).

As faixas "no acervo" abaixo são os valores dos 14 discos curados, calculados
pelo código a partir de `content/signature.generated.ts` (novembro de 2026).

## As âncoras

Cada descritor chega normalizado 0..1 contra **âncoras fixas e absolutas**, nunca
contra os outros discos: acrescentar um disco não muda a assinatura de nenhum
outro.

| Descritor | Âncoras | No acervo |
| --- | --- | --- |
| Volume | −32 … −12 dB | −28,7 (*Le Manoir*) … −12,2 dB (*Sounds To Ascension*) |
| Dinâmica | 12 … 36 dB | 12,4 (*All Systems Go*) … 33,8 dB (*lebar*) |
| Brilho (log2) | 200 … 2600 Hz | 324 (*MKUltra*) … 2600 Hz (*All Systems Go*) |
| Duração | 15 … 90 min | 16,0 (*All Systems Go*) … 74,9 min (*e-world*) |
| Pulso | 0,08 … 0,88 | 0,037 (*Dust. Time.. Gravity*) … 0,739 (*e-world*) |

Duas medições encostam numa âncora e são cortadas: o centróide de *All Systems
Go* (2600,2 Hz, normalizado 1,00) e o pulso de *Dust. Time.. Gravity* (abaixo do
piso, normalizado 0,00). As âncoras ficam como estão: alargá-las encolheria a
diferença entre todos os outros discos, porque a normalização é absoluta. Os
valores medidos de cada disco estão no campo `measured` da assinatura gerada.

## Constantes do álbum

| # | Característica | Propriedade | Range | No acervo | Por quê · limite |
| --- | --- | --- | --- | --- | --- |
| P1 | Volume | Peso do nome (`wght` do Archivo) | 505 → 780 | 551 → 777 | Disco alto pesa. O fit horizontal é recalculado depois do peso. |
| P2 | Volume + duração (0,68/0,32) | Força da lente `m0k` | ×0,88 → ×1,16 | ×0,92 → ×1,09 | Massa maior entorta mais espaço. Acima de ±16% a tipografia monumental dobra sobre si. |
| P4 | Dinâmica | **Teto da reação ao vivo** (`reactionCap`) | 0,05 → 0,20 | 0,053 → 0,186 | Quanto o mundo reage é propriedade do disco: comprimido quase não respira, dinâmico incha. `prefers-reduced-motion` zera. |
| P7 | Brilho | Dureza do rim (expoente `uRim`) | 2,6 → 5,0 | 3,05 → 5,00 | Brilho de timbre = dureza de luz. O brilho move só o expoente; a direção da luz é do tempo (P12). |
| P8 | Duração | Inércia da navegação | 6,2 → 4,3 | 6,17 → 4,68 | Disco longo é mais pesado de atravessar. Só o gesto no mundo tem inércia; réguas, teclado e clique são exatos. |
| P9 | Duração de cada faixa | Ângulo do setor | proporcional | 3 a 16 setores, 11° a 218° | Ângulo é tempo. Setor mínimo de 1,4° para continuar clicável. |
| P15 | Pulso | Giro da lente (`uSpin`) | ×0,62 → ×1,55 | ×0,62 → ×1,39 | Um disco com grade torce o espaço; sem grade, puxa em linha reta. Multiplica só as bases de repouso, álbum e reprodução; colapso e fusão seguem a coreografia escrita. |

P3, P5, P6 e P10 foram substituídos pela morfologia (M3, M4, M2 e M12).

**O pulso** é a autocorrelação do envelope de ataques entre 0,25 s e 2 s, com
clareamento adaptativo por raia (sem ele o descritor mediria brilho). Mede se os
ataques caem numa grade, não quantos são; é estável entre metades do disco e
imune à masterização, ao contrário da dinâmica.

### O que pertence à faixa

| # | Característica da faixa | Propriedade | Limite |
| --- | --- | --- | --- |
| P11 | Nível e dinâmica | Desloca a força da lente (P2) e o teto de reação (P4) | ±0,25 em espaço normalizado, mistura 0,55; média ponderada por duração zero |
| P16 | Brilho | Dureza do rim (P7) | ±0,12 com joelho em meio teto; portão com piso 0,071 |
| P17 | Pulso | Giro da lente (P15) | ±0,12 com joelho; portão com piso 0,118 |

O disco continua sendo a âncora: o peso do nome, o achatamento e a inércia não
mudam por faixa, e nada que entra no hit-test se move entre faixas. Os vieses vêm
do `envelope` já publicado, fatiado pelas fronteiras de P9, e dos vetores
`trackPulse` e `trackBrightness`. O **portão** só deixa passar espalhamento acima
da instabilidade medida do descritor dentro de uma faixa; o **joelho** comprime
assintoticamente o que passaria de 0,12, preservando a ordem entre faixas.

### O tempo e o gesto

| # | Característica | Propriedade | Regra |
| --- | --- | --- | --- |
| P12 | Posição na faixa | Direção da luz rasante (`uLight`) | Arco de 1,0 rad; no meio da faixa, a direção de referência (−0,70; 0,71). Fora de reprodução volta à base. |
| P13 | Posição no álbum | Rotação do anel | Uma volta por disco: o ponto que toca fica na âncora (`RING.anchor`). Parado, o anel não gira. |
| P14 | Peso do disco apontado | Força da segunda massa (`uM1`) | ×0,88 → ×1,16 sobre 0,03, ganho 1,9 ao apontar; só na coleção. |

Apontar *Bring a record* faz o avesso de P14: a segunda massa perde força (×0,45)
e abre o horizonte (×1,30). Um corpo puxa; um lugar vazio tem boca.

O fim natural de uma faixa é uma **emenda** de 0,6 s (o horizonte contrai 4,5% e
volta), não uma fusão. A fusão fica para o salto escolhido: pular, mudar a
seleção ou clicar noutro setor.

## A morfologia do mundo

> **A gramática do Horizonte é um conjunto de relações, não um desenho.**

`morphology.ts` converte a assinatura na anatomia do mundo e é a fonte única do
anel, da composição, do hit-test, do motor e do shader. Estes invariantes, e não
um desenho fixo, fazem os discos diferentes continuarem sendo o mesmo produto:

1. Existe **uma massa escura** que entorta o campo à sua volta.
2. O tempo do álbum é **um circuito fechado**, legível e apontável.
3. **Ângulo é duração.**
4. A luz é **rasante e de fonte única**, e varre com o playhead.
5. O nome é **tipografia monumental no campo**, e pesa o que o disco pesa.
6. O corpo e o circuito compartilham **um único ângulo de visada**.

| # | Característica | Propriedade | No acervo | Por quê · limite |
| --- | --- | --- | --- | --- |
| M1 | Volume | Escala do circuito | 0,582 → 0,910 | Massa maior ocupa mais campo. Teto 0,94 do raio base, para a coroa não invadir a régua. |
| M2 | Brilho | Achatamento do corpo | 0,543 → 0,900 | Discos escuros deitam; brilhantes abrem. Sempre em [0,46; 0,90]. |
| M3 | Volume | Núcleo / circuito | 0,250 → 0,497 | Disco alto tem núcleo que engole o circuito. A coroa é o resto, `(1 − núcleo) × 0,62`; o alvo do corpo no hit-test nunca a invade. |
| M4 | Dinâmica | Relevo do contorno | 0,055 → 0,313 | Disco dinâmico tem silhueta esculpida. Harmônicos 2–7 do envelope: morfologia, nunca serrilhado. |
| M6 | Harmônicos 2–7 do envelope | Distribuição dos lobos | quase ortogonais entre discos | A macroforma do disco vira a forma do corpo. Normalizada por álbum: a amplitude é de M4. |
| M7 | Harmônico 1 do envelope | Excentricidade | 0,018 → 0,260 | A massa se desloca para o lado onde a energia está. Amortecida na coleção. |
| M8 | Pulso | Estratos (até três conchas) | 0,000 → 0,824 | Repetição no tempo vira camadas no espaço. As conchas também expandem a coroa, para sobreviver ao relance. |
| M9 | Duração | Satélites | 0 → 4 corpos | Disco extenso vira território. Arco de −2,6 a +2,0 rad, para não cair sobre o lockup; nenhum satélite passa de 0,68 do núcleo. |
| M10 | Espalhamento do pulso entre faixas | Falhas entre setores | 0,004 → 0,052 volta | Faixas que não dividem grade estilhaçam a coroa. Único canal das falhas; limitado a 42% do setor (`gapOf`). |
| M11 | Espalhamento do nível entre faixas | Desigualdade entre os corpos | 0,072 → 0,476 | Peças desiguais dão um corpo dominante e satélites pequenos. Só a hierarquia; a contagem é de M9. |
| M12 | Nível médio da faixa | Espessura da placa do setor | 0,52 → 1,34 da banda | Cada faixa é uma placa constante: morfologia, não waveform. |

M5 nunca existiu no código: a dinâmica fica inteira no relevo (M4), e as falhas
vêm só de M10. Foram medidos e recusados como eixos: `rolloffHz` (r 0,995 com o
brilho), `bassRatio` (−0,980 com o brilho; continua servindo à tinta de reserva),
heterogeneidade de brilho entre faixas (−0,86 com o brilho do álbum), entropia da
distribuição de faixas (não discrimina) e concentração de faixas (redundante com
a contagem).

## Guardrail — medir em espaço de imagem

`perception/` rasteriza a silhueta do mundo com as mesmas funções de geometria do
renderer, sem cor e sem texto (coroa +0,82, núcleo −0,45, campo 0), desfoca no
equivalente a um olhar de relance (24 px a 1440×900, reescalado por variante) e
correlaciona os discos par a par. `perception.test.ts` impõe os limites e publica
a medição a cada execução.

| Guardrail | Limite | Acervo atual (desktop) |
| --- | --: | --: |
| Correlação média de relance | ≤ 0,72 | 0,539 |
| Pior par | ≤ 0,95 | 0,905 (*lebar* / *Dust. Time.. Gravity*) |
| Pior par musicalmente distante | ≤ 0,90 | 0,867 (*lebar* / *Jajce*) |
| Tinta comum a todos | ≤ 10% | 0,1% |
| Distância visual acompanha a musical | ≥ 0,25 | 0,512 |

Tablet e mobile passam pelos mesmos limites. Um caso roda a geometria anterior à
morfologia (`perception/legacy.ts`) pelo mesmo rasterizador e exige que ela
reprove: um guardrail que a versão antiga passaria não seria guardrail. Discos
próximos musicalmente devem gerar formas próximas; o limite que importa é que
nenhum par distante passe de 0,90. Estratos e placas não sobrevivem ao desfoque
de relance, e estão certos assim: são detalhe de perto.

## Reação ao vivo

Tudo aqui é limitado por P4 e volta sempre ao valor de identidade.

| Sinal | Perturba | Amplitude |
| --- | --- | --- |
| `accent.bass` | Curvatura da lente | ±teto |
| `accent.mid` + `flux` | Giro | ±teto |
| `accent.treb` | Dispersão cromática | ±teto × 0,6 |
| `flux` + `bass` | Intensidade do jato | `0,06 + flux·0,22 + bass·0,06`, fora do teto |
| `bass` | Blur radial | `bass·0,12`, fora do teto |
| `centroid` | Dureza do rim, em torno de P7 | ±teto × 0,5 |

Cada banda é normalizada contra as âncoras p10/p90 medidas offline **do próprio
disco**; o acento é a banda menos o próprio hábito recente (τ 0,12 s e 1,2 s).

## A carga e a coroa

**A carga** é o mesmo operador do acento uma escala acima: τ de 20 s e 200 s,
calculado sobre o `envelope` publicado (`chargeAt`, em `content/signature.ts`).
Mede se este trecho está acima do hábito recente do disco. É função da posição no
álbum, sem estado e sem dado novo, normalizada pelo p90 do próprio disco com o
mesmo joelho de P16/P17. Entre os mecanismos medidos, foi o único que não se
confunde com o relógio (|r| 0,51 contra 0,78–1,00).

A carga começou deslocando a escala do anel em ±5% e foi reprovada em teste
perceptual: uma dilatação uniforme não deixa nada parado ao lado para servir de
régua. Daí a regra que vale para qualquer camada temporal: **uma mudança só é
legível num olhar frio se criar uma descontinuidade local contra um vizinho que
não mudou.**

**A coroa como material** é o que a carga pressiona, sempre que um disco toca.
Um campo de 512 posições no contorno externo cede de forma reversível e, onde o
escoamento é excedido, guarda parte como cicatriz.

| Constante (`STRAIN`) | Valor | Papel |
| --- | --- | --- |
| `dead` | 0,20 | Abaixo disso a música não pressiona |
| `ampRadius` / `ampBand` | 0,22 R / 0,36 da banda | Quanto o material pode ceder |
| `compliance` | 0,55 → 1,00 pela dinâmica | Disco comprimido cede menos |
| `hop` | 20 posições (14°) | Distância do playhead antes de mudar de sítio |
| `rise` / `relax` | 6 s / 26 s | A resposta atrasa e a recuperação é visível |
| `yield` / `harden` | 0,030 R / 0,55 | Quais eventos deixam marca, e quanto fica |
| `creep` | 12 min de reprodução | Por quanto tempo a cicatriz dura |

* A carga **fixa um sítio** quando sai da zona morta e o mantém enquanto dura o
  evento: o mesmo lugar sobe, para e desce. Aplicada em volta do playhead, ela
  transladava e lia como cursor.
* **Tração e compressão escoam igual**: o disco abaixo do próprio hábito deixa
  reentrância, acima deixa saliência.
* **A cicatriz é escuta recente**: decai com τ de 12 min contados só tocando.
  Sobrevive à faixa seguinte e está indo embora duas faixas depois.
* **Semântica de escuta**: pausa não apaga, pular deixa lacuna, voltar não
  duplica, reouvir restaura sem aprofundar, sair do disco limpa. Testado em
  `strain.test.ts` e `engine.test.ts`.

## O cursor sabe o que está sob ele

`uReach` desenha um anel fino em volta do cursor com sinal, não intensidade.

| Sob o cursor | Anel | Significado |
| --- | --- | --- |
| Corpo ou setor | Fecha (raio 0,019) e acende | Dá para entrar |
| Vazio dentro de álbum ou faixa | Abre (raio 0,041) e enfraquece | Dá para sair |
| Vazio na coleção, controle mono, colapso ou fusão | Não existe | Não é do mundo |

No toque não há anel.

## Assinatura de movimento

**Comportamento padrão.** Enquanto um disco toca, a reação ao vivo ganha o
temperamento dele: quão rápido sobe, quanto sustenta, quanto do teto P4 o evento
típico alcança e se vai para a massa ou para a luz. Parado, e para discos sem essa
análise (os trazidos pelo visitante, ou um disco novo antes de rodar o script), a
análise recebe a resposta neutra (τ 0,12 s e 1,2 s, acento relativo ao hábito,
roteamento 1:1), e o mundo em repouso não muda. `motionStep` desliza para a
resposta da faixa nova em cerca de um segundo.

`scripts/analyze-motion.py` mede cada faixa no cache de WAV e gera
`content/motion.generated.ts`. A qualidade da faixa é a âncora do disco
(média ponderada por duração) mais o desvio da faixa, com portão e joelho como
P16/P17 e teto de 0,2.

| Qualidade | Comportamento | No acervo |
| --- | --- | --- |
| Nitidez de ataque | Subida da reação (τ 240 → 40 ms) | 71 ms (*e-world*, *Чайка*) a 212 ms (*The Sheltering Sky*) |
| Sustentação | Relaxamento (τ 140 ms → 1,2 s) e hábito do acento (5× o relaxamento, 1,2 a 6 s) | 200 ms (*Чайка*) a 868 ms (*lebar*) |
| Grade | Relaxamento limitado a 0,45 do período do pulso | só faixas com pulso ≥ 0,5 |
| Microdinâmica | Profundidade 0,825 → 1,5: quanto do teto P4 o evento típico alcança | 0,90 (*The Sheltering Sky*) a 1,29 (*Impromptu*) |
| Peso do grave | Divide a reação entre massa (lente, blur) e luz (jato, dispersão, rim); ganhos nunca acima de 1 | massa 0,65 a 1; luz 0,49 a 1 |

A profundidade foi recalibrada de 0,55–1 para 0,825–1,5 depois da primeira
escuta. Medido numa bancada headless com o motor real (14 discos × 3 faixas ×
30 s): subida da reação de 117 a 1633 ms entre discos (200–483 ms com a resposta
neutra), lente variando 1,9% a 6,2% durante a reprodução (0,2–3,4% com a neutra),
teto alcançado em
0,6% a 12,8% dos quadros, e o disco reconhecível só pelo movimento em 26% dos
casos (acaso 7%).

## A leitura — "Why this shape?"

**Comportamento padrão.** Sem nada aberto, o quadro é o mesmo: o shader só lê a
máscara de foco quando há uma parte em foco. O mundo continua sem palavras; elas
entram só na régua, na aba **Why this shape?**, ao lado de **Tracks**.

`questionsOf` (`anatomy.ts`) faz seis perguntas por disco, uma por parte, e as
ordena pelo quanto o disco foge do meio do acervo naquele eixo, ponderado pela
visibilidade da parte (satélites e falhas 1; postura 0,95; estratos 0,85; contorno
0,7; núcleo 0,6). A primeira abre a aba, duas ficam em *Also* e o resto em *More
about this shape*. O único número nas respostas é a duração em minutos; os
valores medidos ficam em *In numbers*. Perto da mediana (menos de 0,03), a
pergunta é neutra e não há experimento.

| Parte | Descritor | Assada na coroa |
| --- | --- | --- |
| Satélites | Duração (M9), tamanhos por M11 | não |
| Falhas | Espalhamento do pulso entre faixas (M10) | sim |
| Estratos | Pulso (M8) | sim |
| Contorno | Dinâmica (M4), lobos por M6 | sim |
| Postura | Brilho (M2) | não |
| Núcleo | Volume (M1, M3); também o peso do nome (P1) | sim |

* **Isolamento.** A parte é desenhada numa máscara de ¼ da composição com a mesma
  geometria do plano de trás e lida no shader na coordenada já deslocada pela
  lente. Fora da parte a exposição cai 55% na pergunta e 35% no experimento;
  partes escuras ganham contraluz na tinta do disco. As três partes da coroa
  acendem cada uma o que a resposta nomeia, sobre a coroa a meia-luz: as fendas
  ganham uma fresta de luz no meio de cada vão, as camadas, linhas de luz entre
  as conchas, e a borda, uma faixa ao longo do contorno com um halo que segue o
  relevo. Traços finos têm largura mínima em pixels da máscara, para não sumirem
  no celular. Uma coroa de camada única volta a acender a coroa inteira. Na
  Contraprova, a máscara usa o mesmo passo assado que a coroa mostra, e a luz
  acompanha a mudança.
* **"What if…?"** recalcula a morfologia com um descritor na mediana dos 14
  (`compareMorphology`), só para a forma: a reação segue a do disco. Partes
  desenhadas mudam de forma contínua em 1,1 s; as assadas na coroa passam por
  três assados incrementais com dissolução de 0,45 s.
* **Fantasma, espiar e voltar.** O contorno do original fica como linha fina
  enquanto a forma está mudada; apertar o mundo mostra o original sem navegar; Esc
  devolve o disco antes de sair do álbum. A volta é exata.
* **Convite.** Uma vez por navegador (`horizonte:anatomy`), depois de 9 s num
  disco, a régua de faixas mostra a pergunta que abre aquele disco.
* **Tipografia.** Pergunta em Bodoni itálico e resposta em Archivo: a única
  exceção à régua toda mono, só para o que se lê.

## Limitações conhecidas

* **Jato e blur fora do teto.** `uJet` e `uBlur` não passam por P4: no jato, o
  disco mais comprimido oscila 4,53× e o mais dinâmico 4,41×, invertendo a ordem
  que o teto existe para garantir. Prendê-los a P4 reduziria a excursão do jato
  de 4,4× para 1,19× e apagaria a pista viva mais visível da reprodução. Decisão
  em aberto.
* **Cicatriz em setores curtos.** A marca ocupa de 16% a 54% do setor; em discos
  de setores curtos (*e-world*, *Le Manoir*, *Dark Thoughts*) ela deixa de ser um
  evento dentro de um arco intacto.
* **Assinatura de movimento.** Perto do núcleo a lente satura e quase não muda; a
  personalidade aparece mais no jato e na tipografia. Discos trazidos pelo
  visitante não têm essa análise e ficam com a resposta neutra.
* **Leitura.** Apontar uma parte no mundo ainda não abre a pergunta dela; a ordem
  das perguntas é calculada, não curada.
* **Envelope publicado.** Não é reprodutível byte a byte entre decodificadores
  (ver [`ingestao-local.md`](ingestao-local.md#o-envelope-do-acervo)).

## Regenerar

```bash
python3 scripts/fetch-curation.py            # licenças, download, transcodificação
python3 scripts/analyze-audio.py --report    # assinatura sensorial
python3 scripts/analyze-motion.py --report   # assinatura de movimento (a cada disco novo)
npm run test:corpus                          # paridade com o acervo (.cache/analysis)
```
