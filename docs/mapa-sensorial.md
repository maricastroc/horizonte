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

| Álbum | Volume dB | Dinâmica dB | Brilho Hz | Duração min | Pulso | L | D | B | T | P |
| --- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| Tristan Lohengrin · Le Manoir | −28,6 | 17,8 | 980 | 22,1 | 0,216 | 0,17 | 0,24 | 0,62 | 0,09 | 0,17 |
| Jono Terbakar · lebar | −23,9 | 33,8 | 713 | 27,3 | 0,122 | 0,41 | 0,91 | 0,50 | 0,16 | 0,05 |
| Le Morte d'Abby · 0p | −16,0 | 16,8 | 1278 | 45,2 | 0,695 | 0,80 | 0,20 | 0,72 | 0,40 | 0,77 |
| Mark Wilson X · Dark Thoughts | −19,4 | 23,6 | 788 | 30,0 | 0,368 | 0,63 | 0,48 | 0,53 | 0,20 | 0,36 |
| Darin Wilson · Impromptu | −19,4 | 21,6 | 1090 | 27,1 | 0,229 | 0,63 | 0,40 | 0,66 | 0,16 | 0,19 |
| zero-project · e-world | −17,5 | 21,4 | 1726 | 74,9 | 0,739 | 0,72 | 0,39 | 0,84 | 0,80 | 0,82 |
| Tale Twist · Wry Way | −17,0 | 14,6 | 1669 | 31,2 | 0,391 | 0,75 | 0,11 | 0,83 | 0,22 | 0,39 |
| Madison Kenny · All Systems Go | −14,4 | 12,4 | 2600 | 16,0 | 0,255 | 0,88 | 0,02 | 1,00 | 0,01 | 0,22 |
| Meho · MKUltra | −19,4 | 19,4 | 324 | 65,7 | 0,173 | 0,63 | 0,31 | 0,19 | 0,68 | 0,12 |
| Mescaline Sessions · Jajce | −20,5 | 18,2 | 424 | 33,4 | 0,190 | 0,57 | 0,26 | 0,29 | 0,25 | 0,14 |

Âncoras: volume −32…−12 dB · dinâmica 12…36 dB · brilho 200…2600 Hz (log2) ·
duração 15…90 min · pulso 0,08…0,88. Os normalizados cobrem 0,01–1,00, então os
ranges abaixo são percorridos de verdade pelo acervo — não são teóricos.

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
| P3 | Volume | Raio do horizonte `m0h` | — | **Substituído por M3.** O horizonte deixou de ser um multiplicador de ±7% sobre um raio fixo e passou a ser derivado de `coreRatio`, que é uma fração do circuito do álbum. | — |
| P4 | Dinâmica | **Teto de perturbação ao vivo** | 0,05 → 0,20 | A correção estrutural: a amplitude com que o mundo reage passa a ser propriedade do disco. Comprimido quase não respira; dinâmico incha visivelmente. | Teto duro 0,20 (o handoff fixa ±15% como referência). `prefers-reduced-motion` zera. |
| P5 | Dinâmica | Amplitude do envelope na espessura do anel | — | **Substituído por M4 e M5.** A dinâmica saiu da espessura e foi para o contorno: ela agora esculpe o relevo do corpo e abre as falhas entre setores. | — |
| P6 | Brilho | Achatamento do anel | — | **Substituído por M2**, com o intervalo alargado de [0,57; 0,67] para [0,46; 0,90] e aplicado ao corpo inteiro, não só ao anel. | — |
| P7 | Brilho | Dureza do rim light (expoente `uRim`) | 2,6 → 5,0 | Brilho de timbre = dureza de luz. Mesma direção que a direção de arte propôs para bordas de sombra. | **O brilho move só o expoente.** Lóbulo e direção continuam fora do alcance do timbre — a direção agora pertence ao tempo (P12), e nada mais escreve nela. |
| P8 | Duração | Inércia da navegação (lerp de `nav`) | 6,2 → 4,3 | Disco longo é mais pesado de atravessar. | Nunca abaixo de 4,2, senão o snap parece travamento. **A inércia é só do gesto no mundo** — réguas, teclado e clique continuam exatos. |
| P9 | Duração da faixa | Ângulo do setor no anel | proporcional | Ângulo = tempo. O setor que se aponta *é* quanto tempo se vai ouvir. | Setor mínimo de 1,4° para continuar clicável. |
| P10 | Envelope (RMS 200 ms) | Espessura radial ao longo do setor | ver P5 | Forma = dinâmica no tempo. É a impressão digital do disco. | Indexado pelas mesmas fronteiras de P9, para que geometria e intensidade falem do mesmo instante. |

## Identidade — a morfologia do mundo

> **A gramática do Horizonte é um conjunto de relações, não um desenho.**

P1–P17 eram todos do tipo `escalar × forma fixa`: multiplicavam propriedades de
uma composição já decidida. Medido em espaço de imagem, o resultado era que os
dez discos correlacionavam **0,988** entre si sob um olhar de relance, com
**45,9%** da tinta idêntica em qualquer disco. A identidade acabava sendo a cor.

A morfologia (`src/components/horizonte/morphology.ts`) é a correção: um módulo
puro que converte a assinatura do álbum na **anatomia** do mundo, e que é a fonte
única consumida pelo anel, pela composição, pelo hit-test, pelo motor e pelo
shader. Ela não substitui os canais de reação — características globais do álbum
definem o mundo, características temporais da faixa continuam perturbando-o.

### Os invariantes que definem a gramática

Nenhuma destas frases fixa tamanho, posição ou contagem. São elas — e não o
desenho — que fazem dez mundos diferentes continuarem sendo o mesmo produto:

1. Existe **uma massa escura** que entorta o campo à sua volta.
2. O tempo do álbum é **um circuito fechado**, legível e apontável.
3. **Ângulo é duração**: o setor que se aponta *é* quanto tempo se vai ouvir.
4. A luz é **rasante e de fonte única**, e varre com o playhead.
5. O nome é **tipografia monumental no campo**, e pesa o que o disco pesa.
6. O corpo e o circuito compartilham **um único ângulo de visada**.

### Descritor → transformação → razão

| # | Característica | Propriedade morfológica | Amplitude no acervo | Razão perceptiva | Guardrail |
| --- | --- | --- | --- | --- | --- |
| M1 | Volume | Escala do circuito | 0,585 → 0,910 (1,56×) | Massa maior ocupa mais campo. **Só o volume** move a escala: a duração foi retirada daqui porque empurrava o raio nos dois sentidos ao mesmo tempo, via peso e via dispersão, e os dois se cancelavam. | Teto 0,94 do raio base: acima disso a coroa invade a régua da direita. |
| M2 | Brilho | Achatamento do corpo | 0,543 → 0,900 (1,66×) | Discos escuros deitam; brilhantes abrem. Mesma direção de P6, com o intervalo alargado de ±13% para ±66% e aplicado ao corpo inteiro. | Nunca fora de [0,46; 0,90]: abaixo vira linha, acima perde a leitura de perfil. |
| M3 | Volume | Raio do núcleo / circuito | 0,250 → 0,465 (1,86×) | Disco alto tem núcleo que engole o próprio circuito; disco silencioso tem núcleo pequeno num campo aberto. A coroa é o resto: `(1 − núcleo) × 0,62`. | O alvo do corpo no hit-test nunca pode invadir a coroa — é limitado por `rMin`. |
| M4 | Dinâmica | Relevo do contorno | 0,055 → 0,313 (5,66×) | Disco dinâmico tem silhueta esculpida; comprimido tem contorno liso. É P5 promovido de espessura para forma. | Reconstrução de baixa ordem (harmônicos 2–7): morfologia, nunca serrilhado. |
| M5 | Dinâmica | Largura das falhas entre setores | 0,008 → 0,052 volta (6,34×) | Mesma dinâmica de M4, no mesmo gesto: o que esculpe o contorno também rasga a coroa. **Não são dois eixos independentes** — é um fato musical em dois registros. | Falha limitada a 42% do próprio setor, para que nenhum setor suma. |
| M6 | Espectro do envelope (harmônicos 2–7) | Distribuição dos lobos | curvas quase ortogonais entre discos (r = 0,007) | A macroforma do disco — como ele sobe e desce ao longo da duração inteira — vira a forma do corpo. É o sinal mais distintivo que o acervo tem, e antes era gasto num tremor de espessura. | Normalizado por álbum: a *distribuição* dos lobos é a identidade, a *amplitude* pertence a M4. Sem isso, o eixo correlacionaria −0,77 com o brilho. |
| M7 | Harmônico 1 do envelope | Excentricidade do corpo | 0,018 → 0,240 (13,2×) | Um disco que cresce ou decai ao longo da duração tem a massa deslocada para o lado onde a energia está. | Amortecida por `zoom`: na coleção o corpo volta à âncora, senão dez corpos deslocados viram ruído. |
| M8 | Pulso | Estratificação em camadas | 0,052 → 0,824 (15,9×) | Periodicidade é repetição; repetição no espaço são camadas. As conchas também **expandem** a coroa, senão a estratificação seria só alta frequência e sumiria de relance. | Mesmo fato musical de P15 (giro do campo) em outro registro — um é campo, o outro é forma. Máximo de três conchas. |
| M9 | Duração | Dispersão e satélites | 0 → 4 corpos | Um disco extenso é território: o mundo se espalha em corpos secundários em vez de crescer. Contagem contínua por peso, nunca discreta. | Arco permitido de −2,6 a +2,0 rad, para que nenhum satélite caia sobre o lockup. |
| M10 | Heterogeneidade de pulso entre faixas | Fragmentação da coroa | 0,175 → 0,879 (5,0×) | Um disco cujas faixas não compartilham grade se estilhaça; um disco coeso é banda contínua. **Eixo novo, e o mais independente do conjunto**: máximo \|r\| = 0,35 contra os cinco descritores de álbum. | Combina-se com M5, que responde à dinâmica. |
| M11 | Heterogeneidade de nível entre faixas | Desigualdade entre os corpos | 0,072 → 0,476 (6,6×) | Um disco de peças desiguais tem um corpo dominante e satélites pequenos; um disco parelho tem corpos comparáveis. Máximo \|r\| = 0,31 contra os cinco descritores. | Só a hierarquia; a contagem pertence a M9. |
| M12 | Nível médio da faixa | Espessura da placa do setor | 0,52 → 1,34 da banda | Cada faixa é uma placa de espessura própria. Constante dentro do setor: é o que separa morfologia de waveform. | Substitui a modulação contínua de P5, que produzia serrilhado na borda interna. |

### Descritores testados e recusados

| Candidato | Por quê não |
| --- | --- |
| `rolloffHz` | Correlaciona **0,995** com o brilho medido. É o mesmo eixo com outro nome. |
| `bassRatio` | Correlaciona **−0,980** com o brilho. Continua útil para a tinta de reserva, mas não é eixo morfológico. |
| Heterogeneidade de brilho entre faixas | Correlaciona −0,86 com o brilho do álbum. |
| Entropia da distribuição de faixas | Normalizada, fica entre 0,940 e 0,998 em todos os dez discos: não discrimina. |
| Concentração de faixas | Correlaciona 0,72 com a contagem de faixas, que já governa os setores. M11 ocupa o mesmo papel com metade da redundância. |

## Guardrail — medir em espaço de imagem

O mapa sensorial sempre validou **separação em espaço de parâmetros**. Foi a
lacuna que produziu a convergência: cada mapeamento, isolado, estava bem
justificado, e ninguém media a composição inteira.

`src/components/horizonte/perception/` fecha a lacuna. Ele rasteriza a silhueta
do mundo a partir das **mesmas funções de geometria que o renderer usa** — nunca
um modelo paralelo, que poderia divergir —, desfoca no equivalente a um olhar de
relance e correlaciona os dez discos par a par.

* **Sem cor e sem texto.** Só matéria: coroa iluminada (+0,82), massa escura
  (−0,45), campo (0). Massa escura entra como sinal negativo, não como ausência:
  um núcleo é uma coisa, não um buraco.
* **Desfoque por ângulo visual**, não por pixel de tela — 24 px na referência de
  1440×900, reescalado pela escala do mundo em cada variante. Sem isso o teste
  puniria o mobile por desenhar menor, e não por desenhar parecido.
* **Robusto a rasterização.** Entre grades de 216, 288 e 384 colunas, a média
  varia menos de 0,002. O teste afirma esse limite explicitamente.

| Guardrail | Limite | Medido | Anterior |
| --- | --: | --: | --: |
| Correlação média de relance | ≤ 0,72 | **0,532** | 0,988 |
| Pior par | ≤ 0,95 | **0,880** | 0,997 |
| Pior par musicalmente distante (≥ 0,28) | ≤ 0,90 | **0,856** | 0,997 |
| Fração de tinta comum a todos | ≤ 10% | **0,5%** | 45,9% |
| Correlação entre distância musical e visual | ≥ 0,25 | **0,434** | 0,431 |

**Por que estes limites.** Cada um fica entre o medido e o anterior, com folga
suficiente para um disco novo entrar sem quebrar o teste e apertada o bastante
para reprovar a composição anterior. O teste afirma isso diretamente: existe um
caso que roda a geometria antiga pelo mesmo rasterizador e **exige que ela
reprove nos quatro limites**. Um guardrail que a versão anterior passaria não
seria guardrail.

**O pior par não é uma falha.** Hoje é *0p* contra *Wry Way*, a 0,880 — e os dois
medem parecido de verdade: volume 0,80 contra 0,75, dinâmica 0,20 contra 0,11,
brilho 0,72 contra 0,83. Discos próximos musicalmente **devem** gerar morfologias
próximas. O limite que importa é o outro: nenhum par musicalmente *distante* pode
passar de 0,90.

**O que o desfoque de relance não vê.** A estratificação (M8) e as placas (M12)
são cues de média e alta frequência: sobrevivem à leitura atenta e somem sob o
desfoque. Estão certas assim — são detalhe legível de perto, não identidade de
relance. Por isso M8 também expande a coroa, que é o canal de baixa frequência.

## Identidade — a grade do tempo

| # | Característica | Propriedade física | Range | Justificativa perceptiva | Guardrail |
| --- | --- | --- | --- | --- | --- |
| P15 | **Pulso** — periodicidade do ataque | Componente tangencial da lente (`uSpin`) | ×0,62 → ×1,55 sobre a base de cada escala | Um disco com grade de tempo **torce** o espaço à volta do corpo; um disco sem pulso puxa em linha reta. Periodicidade é ciclo, e o único canal do campo que é literalmente um ciclo é o giro. | O giro é **forma, não movimento**: `uSpin` inclina o campo de deslocamento, não anima nada. Multiplica só as bases de repouso (0,06), de álbum (0,16) e de reprodução (0,42) — as cerimônias de colapso e fusão continuam com a coreografia escrita. |

**O que o pulso mede.** A autocorrelação do envelope de ataques entre 0,25 s e
2 s (240 a 30 BPM). Não é quantos ataques o disco tem, nem quão rápido ele é: é
se os ataques caem numa grade. O envelope vem do fluxo espectral com
**clareamento adaptativo por raia** — cada bin é dividido pelo próprio pico
recente antes da diferença.

**Por que o clareamento não é detalhe.** Sem ele, o descritor correlaciona
**0,825 com o brilho medido do acervo** — mede timbre disfarçado de ritmo. Com
ele, a redundância máxima com os quatro descritores antigos cai para 0,542
(duração), 0,500 (brilho), 0,491 (volume) e −0,230 (dinâmica).

**Estabilidade.** Comparando a primeira metade de cada álbum com a segunda:
r = 0,994 entre as duas leituras, erro relativo médio de 8,8%. É uma constante
de identidade, não uma medida que oscila.

**Por que este descritor e não densidade de ataques.** A primeira hipótese foi
contar ataques por segundo. Foi medida e **reprovada**: mesmo com o clareamento
adaptativo, a taxa correlaciona 0,825 com o brilho, e é instável — erro
metade-a-metade de 14,3%, com faixas do mesmo disco indo de 0,17 a 5,87
ataques/s. Contar ataques mede quão transiente é o timbre; a autocorrelação mede
se existe uma grade. Só a segunda é informação nova.

**O que o pulso resolve.** `dynamics` alimenta os dois canais mais expressivos
do sistema (teto de reação e envelope), e a compressão de bus destrói dynamics.
O pulso é **imune à masterização**: esmagar um sinal com limiter agressivo derruba
a dinâmica normalizada a 0,00 e move o pulso em 0,004. Compressão destrói
amplitude de ataque; não destrói *quando* o ataque acontece.

## Identidade — o que pertence à faixa

Até aqui, tudo o que um disco *é* parava no disco: as onze faixas de *Le Manoir*
viviam num mundo idêntico. P11 corrige isso sem medir nada de novo.

| # | Característica | Propriedade física | Range | Justificativa perceptiva | Guardrail |
| --- | --- | --- | --- | --- | --- |
| P11 | Nível e dinâmica **da faixa** | Desloca `m0k`/`m0h` (nível) e o teto de reação + envelope (dinâmica) | ±0,25 em espaço normalizado | Um disco heterogêneo é uma sequência de peças diferentes, e o mundo tinha de saber disso. A faixa muda **quanto o mundo pesa e quanto ele reage**. | O álbum continua sendo a âncora: o viés médio ponderado por duração é zero. O peso do artista (P1), a luz (P6, P7) e a inércia (P8) **não** se movem por faixa — são identidade do disco. Tudo passa pelos mesmos `RANGE` de P1–P8. |

| # | Característica | Propriedade física | Range | Justificativa perceptiva | Guardrail |
| --- | --- | --- | --- | --- | --- |
| P16 | Brilho **da faixa** | Dureza do rim light (`uRim`) | teto com joelho em 0,12 em espaço normalizado, com portão | P7 já diz que brilho é dureza de luz. P16 aplica a mesma relação numa escala de tempo mais fina: a luz do disco endurece nas faixas cortantes e amolece nas escuras. Nenhuma associação nova foi inventada. | **Só a luz.** O achatamento (P6) continua sendo do álbum: ele é a forma do anel *e entra no hit-test* — uma geometria que muda entre faixas move o alvo debaixo do cursor. Teto de ±0,12, metade do teto de P11, porque mexe num canal de identidade e não de reação. Média ponderada por duração ~zero. |

**O portão.** O espalhamento de brilho entre faixas de um mesmo álbum só vira
viés quando passa de 0,12 em espaço normalizado — acima da instabilidade medida
*dentro* de uma faixa, que é 0,071 (mediana, primeira metade contra segunda).
Abaixo disso o portão fecha e o disco fica parado. É o que separa diferença
medida de ruído de medição.

*All Systems Go* é exatamente esse caso: as quatro faixas medem 0,986 a 1,000 de
brilho, espalhamento 0,013 — abaixo do piso de ruído — e o portão fecha em zero.
Amplitude de rim **0,00**: o disco mais uniforme do acervo não ganha movimento
nenhum.

**Redundância com P11.** O desvio de brilho por faixa correlaciona 0,137 com o
viés de nível e 0,164 com o de dinâmica. É informação que P11 não carregava.

| # | Característica | Propriedade física | Range | Justificativa perceptiva | Guardrail |
| --- | --- | --- | --- | --- | --- |
| P17 | Pulso **da faixa** | Componente tangencial da lente (`uSpin`) | teto com joelho em 0,12 em espaço normalizado, com portão | Um disco tem uma grade média, mas as faixas não têm todas a mesma. Dentro de *Dark Thoughts* o pulso vai de 0,00 a 0,95 entre faixas. A faixa desloca o giro em torno da base do álbum — a mesma relação de P15, numa escala de tempo mais fina. | O giro não entra no hit-test (o alvo é decidido pelo achatamento), então mexê-lo por faixa não move nada sob o cursor. Mesmo teto de ±0,12 de P16 e mesma média ponderada ~zero. **Portão mais estreito que o do timbre**, porque o pulso por faixa é mais ruidoso. |

**O teto tem joelho.** P16 e P17 não cortam: abaixo de meio teto o desvio passa
**exato**, e acima ele é comprimido assintoticamente até 0,12. É um limitador de
joelho suave, a mesma forma que um compressor de masterização usa.

Com corte duro, 36% das faixas do acervo encostavam no teto do pulso — e
*Dark Thoughts* renderizava suas dez faixas em **três** valores distintos de giro,
nove delas fincadas no limite. Uma faixa que diverge 0,59 do álbum e outra que
diverge 0,20 recebiam exatamente o mesmo deslocamento: a ordem entre "diferente" e
"muito diferente" desaparecia.

| | amplitude mediana | *Dark Thoughts*, níveis distintos | *Impromptu*, que não saturava |
| --- | --: | --: | --: |
| Corte duro | 0,239 | **3** | 0,159 |
| `tanh` puro | 0,200 | 8 | 0,139 |
| **Joelho** | **0,223** | 7 | **0,157** |

A `tanh` pura resolveria a ordem, mas comprimiria também o meio da escala e
tiraria amplitude de discos que nem estavam saturando. O joelho preserva esses
discos intactos e comprime só o que encostava no limite. O limite continua sendo
0,12 — ele deixou de ser alcançável, não de existir.

O teto de P11 fica **duro**: só uma faixa em oitenta encosta nele, então ali o
corte é guardrail e não perda de ordem.

**O portão, em forma única.** P16 e P17 usam a mesma função: subtrai-se um **piso
de ruído medido** e ramp-se até abrir. O piso é a instabilidade do descritor
*dentro* de uma faixa — primeira metade contra segunda:

| Canal por faixa | Piso (instabilidade medida) | Rampa | Espalhamento típico entre faixas |
| --- | --: | --: | --: |
| Brilho (P16) | 0,071 | 0,12 | 0,317 (mediana) |
| Pulso (P17) | **0,118** | 0,28 | 0,418 (mediana) |

O pulso por faixa oscila 1,7× mais dentro de uma faixa do que o brilho, e por
isso precisa de mais espalhamento para o portão abrir. Vale registrar que esse
piso é **conservador de propósito**: a instabilidade foi medida comparando duas
análises de meia duração, cada uma mais ruidosa que a medição da faixa inteira.

**Redundância entre os dois canais por faixa.** O desvio de pulso e o desvio de
brilho, faixa a faixa no acervo inteiro, correlacionam **|r| = 0,054**. São dois
sinais independentes, não o mesmo com dois nomes.

**Resultado medido.** Dentro de um álbum, o giro varia 0,192 (mediana) contra
0,718 de amplitude entre todos os discos — cerca de 27%. E *lebar*, cujas nove
faixas têm quase a mesma grade (espalhamento 0,175), move apenas 0,041.

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
| P14 | Peso do disco **apontado** | Força da segunda massa (`uM1`) | ×0,88 → ×1,16 sobre 0,03, com ganho 1,9 ao apontar; o horizonte da segunda massa vem de `coreRatio` e `circuit` do disco apontado (M1, M3) | A coleção tinha dez corpos e uma massa só: `uM1` usava força fixa (0,03 / 0,052) para qualquer disco, e apontar um corpo mudava a opacidade de um texto. Agora o peso que se sente ao apontar é o peso medido daquele disco — você sente os discos antes de entrar em qualquer um. | Só na escala coleção. O ganho vale para `m0k`, **não** para o horizonte: apontar não deixa o disco maior, deixa você sentir o peso dele. `prefers-reduced-motion` tira o ganho e mantém o peso. Nenhum uniforme novo. |

**A entrada de ingestão é o avesso de P14.** Apontar um disco pesa o campo
(×1,97 na força). Apontar *Trazer um disco* faz o contrário: a segunda massa
perde força (×0,45) e abre o horizonte (×1,30), sem sair do lugar. Um corpo puxa;
um lugar vazio não puxa — tem boca. É o que separa, no campo, um disco que existe
de um disco que ainda não chegou.

Por que não deslocar a massa para o slot seguinte ao último disco, que seria o
literal: com dez discos, esse slot fica a dez corpos de distância e simplesmente
não aparece na tela. Um retorno que não se vê não é retorno. O lugar se abre onde
o olho está.

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

Constantes de campo derivadas de fato, lidas do motor em execução. Os ranges são
percorridos de verdade — a diferença entre discos é medida, não decorativa. As
propriedades **morfológicas** (escala, achatamento, núcleo, relevo, camadas,
excentricidade, falha, corpos) vivem na tabela de M1–M12 e são publicadas pelo
próprio teste de percepção a cada execução.

| Álbum | Peso | Lente | Teto reação | Rim | Nav | Giro | Rim por faixa | Setores (min–máx) |
| --- | --: | --: | --: | --: | --: | --: | --: | --- |
| Le Manoir | **551** | **0,92** | 0,086 | 4,09 | 6,02 | 0,779 | 3,80–4,37 | 11 · 14,5°–65,3° |
| lebar | 617 | 0,97 | **0,186** | 3,79 | 5,89 | **0,668** | 3,50–4,08 | 9 · 24,1°–57,7° |
| 0p | 725 | 1,07 | 0,080 | 4,34 | 5,44 | 1,334 | 4,05–4,62 | 7 · 37,6°–77,1° |
| Dark Thoughts | 679 | 1,02 | 0,123 | 3,88 | 5,82 | 0,955 | 3,60–4,17 | 10 · 22,6°–49,9° |
| Impromptu | 678 | 1,01 | 0,110 | 4,19 | 5,89 | 0,794 | 3,91–4,47 | 5 · 61,6°–81,9° |
| e-world | 704 | **1,09** | 0,109 | 4,62 | **4,68** | **1,386** | 4,33–4,85 | 16 · 11,0°–39,5° |
| Wry Way | 712 | 1,04 | 0,066 | 4,59 | 5,79 | 0,982 | 4,30–4,87 | 8 · 30,0°–63,4° |
| All Systems Go | **748** | 1,05 | **0,053** | **5,00** | **6,17** | 0,823 | **5,00–5,00** | 4 · 78,9°–98,4° |
| MKUltra | 678 | 1,06 | 0,096 | **3,05** | 4,92 | 0,729 | 2,81–3,34 | 6 · 31,2°–87,7° |
| Jajce | 663 | 1,01 | 0,089 | 3,30 | 5,73 | 0,748 | 3,02–3,59 | 4 · 36,7°–129,3° |

Leituras que valem registrar:

* **lebar reage 3,5× mais que All Systems Go** (teto 0,186 contra 0,053), porque é
  2,7× mais dinâmico. É a diferença que antes não existia: todos tinham o mesmo 0,15.
* **O anel de lebar tem borda esfarrapada; o de All Systems Go é liso.** Já não é
  a mesma geometria: o relevo de M4 vai de 0,313 a 0,055 entre os dois.
* **Jajce tem 4 setores, um deles de 129°**; e-world tem 16, o menor com 11°. Os
  dois anéis são irreconhecíveis um no outro.
* **MKUltra e All Systems Go são os dois polos da luz** (0,589/3,05 contra
  0,670/5,00) — o disco mais escuro do acervo, com centróide de 324 Hz, contra o
  mais brilhante, com 2600 Hz.
* **All Systems Go é extremo em quatro eixos ao mesmo tempo:** o mais alto, o mais
  brilhante, o mais comprimido e o mais curto. Não é um empate apertado com
  ninguém — o segundo mais brilhante fica 874 Hz atrás. O corte de 0,2 Hz na
  âncora é coincidência de medição, não compressão de informação.
* **O giro separa o par que estava mais perto de colidir.** Dark Thoughts e
  Impromptu eram os dois discos mais parecidos do acervo: distância mínima de
  0,1264 num espaço de oito canais normalizados. Com o pulso, 0,1738 — o par
  mais próximo ficou **1,37× mais separado**, e a separação vem inteira do giro
  (0,955 contra 0,794).
* **e-world torce o espaço 2,07× mais que lebar.** No nível de álbum, o giro vai
  de 0,107 a 0,222 — um disco sequenciado inclina o campo de deslocamento ao
  dobro do que um disco tocado por gente em tempo livre.
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

## Descoberta — o cursor sabe o que está sob ele

O cursor sempre foi um ponto de luz idêntico sobre o vazio e sobre um alvo. As
interações-assinatura do mundo — entrar num corpo, escolher um setor, sair de uma
escala — não tinham pista nenhuma, e quem usasse só as réguas nunca as encontrava.

`uReach` acrescenta um anel fino em volta do cursor, com **sinal**, não com
intensidade:

| Sob o cursor | Anel | Significado |
| --- | --- | --- |
| Um corpo ou um setor | fecha (raio 0,019) e acende | dá para entrar |
| O vazio, dentro de um álbum ou faixa | abre (raio 0,041) e enfraquece | dá para sair |
| O vazio, na coleção | não existe | clicar ali não faz nada |
| Um controle da camada mono | não existe | aquele clique não é do mundo |
| Durante colapso ou fusão | não existe | não é hora de apontar |

É a mesma gramática que a entrada de ingestão já tinha estabelecido — um corpo
puxa, um lugar vazio tem boca. Nenhuma palavra na tela, nenhum tooltip, e nada
que se mexa sozinho: o anel é estático e segue o cursor.

No toque não há anel: não existe ponteiro pairando, e um anel preso no último
ponto tocado seria ruído.

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
