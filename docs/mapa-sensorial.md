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

## O relevo — a forma recebe luz

No álbum e na faixa, as placas deixam de ser só capa somada em `lighter`: viram
volume iluminado pela mesma `uLight` de P12, que agora varre sobre faces e não
só sobre a borda do núcleo. Na coleção a mesma luz vem por trás (ver "A coleção
em contraluz", abaixo).

* **De onde vem a forma.** `composition/relief.ts` amostra a morfologia em 1024
  ângulos e grava numa textura `RGBA16F` de 1024×2 (`uShape`): interior e
  exterior de até três cascas, e a distância angular à fenda de setor mais
  próxima. É a mesma geometria que o anel pinta (`shellsAt`, `gapOf`, `RING.lift`
  e a deformação da coroa), nunca um modelo paralelo. Cascas que se tocam ou
  quase se tocam (folga < `RELIEF.merge` = 0,012 do raio) são fundidas antes de
  gravar: o levantamento do setor selecionado sobrepõe as cascas, e sem a fusão o
  shader cavaria um sulco dentro da placa. Pela mesma regra, estratos de 1–2 px
  não viram canaletas profundas.
* **Quando é regravada.** Só quando muda álbum, forma comparada, seleção, faixa
  ativa ou versão do strain. Custa ~0,3 ms de CPU por regravação.
* **Como é iluminada.** O shader avalia a placa no ponto já deslocado pela lente
  (`p + off`), então a luz acompanha a curvatura. Chanfro parabólico de até 5% do
  raio, normal por diferença finita, um domo largo que inclina a forma inteira
  para fora (o lado voltado para a luz acende, o oposto cai na sombra), difusa
  normalizada para que o topo plano fique com a cor de antes, e especular estreita
  sem o véu sobre o topo. Fora das placas: oclusão de contato e sombra curta
  projetada para longe da luz, que também cai sobre a tipografia do plano de trás.
* **O que não muda.** O deslocamento da lente é o mesmo de antes, bit a bit. Onde
  a dispersão e o borrão espalham a cor por mais que um chanfro, o relevo recua
  (`smear`), para não desenhar luz nítida sobre imagem borrada.
* **Custo.** ~0,06–0,10 ms por quadro a 1440×900 (de ~1,1 para ~1,2 ms medidos
  com upload dos planos), com saída antecipada fora da faixa radial da coroa.

## O lockup no plano da frente

Nome do artista, título e metadados vivem no plano da frente e dobram juntos.
Antes, o nome ficava no plano de trás e recebia a lente inteira, enquanto o
título recebia cerca de um terço: onde o nome atravessava o corpo, era puxado
três vezes mais e caía sobre o título ("Wry Way" sobre "Twist"). Além disso, o
relevo sombreia por geometria, não por camada, e o nome desenhado sobre a coroa
ganhava a borda acesa, o chanfro e a sombra projetada.

O plano da frente usa `d / (1 + 4·|d|) · 0,85` do deslocamento `d` (era 18 no
denominador): cerca de 80% longe do corpo e 60% perto dele, contra 62% e 29%
antes. O nome volta a curvar com a lente, sem colidir, porque as três linhas
compartilham o mesmo perfil. O degradê radial atrás do lockup cobre agora a
altura do nome. O destaque do nome na anatomia amostra a máscara com o mesmo
deslocamento da frente (`uFocusFront`).

## A coleção em contraluz

A coleção mostra a forma de cada disco, mas não a estrutura dela. Cada corpo é a
**coroa inteira**: o contorno externo da última casca e o interno da primeira,
sem fendas de setor nem estratos, suavizados por uma média móvel circular dupla
de 3,5% de volta (`wholeCrownAt`, 2048 amostras). Sem a suavização, a espessura
da placa, que muda de faixa para faixa (M12), vira degraus na silhueta.

* **A leitura de identidade.** Medido com a silhueta monocromática no relance
  do guardrail, a distinção da coroa vinha quase toda do tamanho (sem ele, a
  correlação média sobe de 0,58 para 0,82) e do achatamento; os lobos, que são o
  contorno, não contribuíam (0,584 → 0,580 sem eles), porque `relief` fica entre
  0,06 e 0,19 no acervo e a borda interna acompanhava a externa com espessura
  constante. A coroa da coleção (`identityOf`, `IDENTITY`) lê a mesma morfologia
  de mais longe: lobos com ganho 2,2 e teto suave 0,45 (`tanh`), contraste de
  espessura entre faixas ×1,6, e a borda interna segue só 30% dos lobos, de modo
  que a massa se acumula onde o envelope tem energia; a banda nunca afina abaixo
  de 45% da espessura. Resultado (média / pior par): 0,584 / 0,958 → 0,544 /
  0,881; *Le Manoir* × *The Sheltering Sky* deixam de ser gêmeos. Caricatura em
  torno da média e excentricidade (M7) como deslocamento do furo foram medidas e
  descartadas (não mexem no pior par). A visão do álbum continua com a geometria
  medida; a aproximação interpola de uma para a outra.
  `__tests__/identity.test.ts` falha se a coleção voltar a convergir.
* **Luz.** A borda voltada para `LIGHT.base` acende: na borda externa do lado
  da luz e na borda do furo do lado oposto. A face não é preta: é a capa
  desfocada em 7 px sob `COLOR.body`, e o que sobra dela são veios, as costuras
  entre faixas e os estratos (contagem de faixas e pulso legíveis sem abrir o
  disco). Sobre a face, um gradiente de preenchimento ao longo da luz (sombra
  0,30 do lado oposto) modela o volume. A borda é assada uma vez por disco
  (`RingBakery.silhouette`: face 1000², borda 500², versão desfocada 320²;
  1–3 ms por disco). No foco, o relevo do shader entra em modo contraluz
  (`uReliefBand.z = 1 − luz`), soma a borda analítica e modela a face pela
  normal do domo (preenchimento de 0,45× a 1,45×). Ao abrir o álbum, o modo
  volta para luz frontal e a coroa dá lugar às placas.
* **Material.** O brilho espectral do disco é a refletância da superfície:
  quanto da face escurece (84% a 60%) e quanto o lado da luz devolve (0,04 a
  0,20). Discos de timbre escuro ficam foscos e fundos; os brilhantes, acetinados.
  Sem isso, uma luz e um material iguais para todos aproximavam as silhuetas.
* **Satélites.** A coleção mostra os satélites (M9) no lugar definitivo, no
  foco e em cada vizinho, com o material da coroa: face com a tinta do disco,
  gradiente para a luz e borda fina do lado iluminado. Antes o corpo era
  `COLOR.body`, da cor do vazio, e só sobrava um arco grosso que parecia um
  glifo solto. Na coleção a órbita escala com a coroa de identidade
  (`wholeReachOf / rMax`), para manter a mesma relação física com o corpo.
* **Orientação.** Na coleção o anel repousa em `RING.anchor`, mesmo com o disco
  tocando: é a orientação em que as bordas foram assadas.
* **Profundidade.** Desktop e tablet usam uma fileira que recua: cada passo
  multiplica o tamanho por `DEPTH.recede` = 0,52 e o espaçamento soma uma série
  geométrica, então cabem mais discos no quadro. A fileira sobe à esquerda e
  desce à direita (`DEPTH.tilt` = 0,22), longe do lockup e do índice. Foco e
  vizinhos usam a mesma fórmula de corpo (`collectionBody`): o raio é
  `ringR × circuit × profundidade`, então nenhum corpo salta de tamanho quando
  passa o foco adiante. Os corpos são desenhados do mais distante para o mais
  próximo, e o mais próximo encobre o de trás.
* **Atmosfera.** A opacidade cai até 0,30 entre |d| = 0,5 e 3 (`atmosphereOf`),
  e entre |d| = 0,6 e 1,9 a versão nítida dá lugar à desfocada (`defocusOf`):
  profundidade de campo sem filtro por quadro. O núcleo e o rótulo de cada
  vizinho só aparecem depois de |d| = 0,5, onde o núcleo do shader deixa de ser
  dele.
* **Nomes dos vizinhos.** Menos nomes, bem compostos. Só o vizinho mais próximo
  de cada lado tem nome (some entre |d| = 1 e 1,3); um mais distante só ganha
  nome enquanto o cursor aponta para ele. O nome é legenda abaixo do corpo, a
  uma distância proporcional ao tamanho do nome (0,45 da altura do nome), medida
  a partir do ponto mais baixo da coroa desenhada sob a largura da legenda,
  satélites incluídos (`bottomUnder`); antes era o maior raio da coroa em
  qualquer ângulo, e a folga variava por disco. Se a legenda cobriria o lockup
  principal, o vizinho fica sem nome,
  em vez de subir para perto da navegação, onde a segunda massa dele ainda o
  empurrava para cima. A linha mono (catálogo · faixas) é proporcional ao nome
  (40%, piso de 9 px, teto de 0,92% da largura) e fica a 32% do nome mais 1,25
  da própria altura abaixo dele; antes ela tinha tamanho fixo e, nos vizinhos
  distantes, ficava maior que o nome e o atravessava. Os vizinhos ao lado do
  foco carregam a segunda massa; só o vizinho que de fato a carrega, e com a
  massa real do momento, fica fora do raio em que essa lente satura. Antes a
  folga supunha o ganho de apontar (×1,9) para os dois vizinhos: 0,23 H, cerca
  de 70 px abaixo da base do corpo. A posição é verificada na tela pela lente do foco (`lens`, o mesmo
  `pullOf` do shader): fora da moldura ou na faixa de controles, é corrigida
  onde aparece; se a correção cairia na zona em que a lente do foco satura, o
  nome esmaece. Segunda passada, sobre uma poça de sombra; larguras medidas uma
  vez.
* **Legendas no plano da frente, resolvidas na tela.** Medido com a lente exata
  do shader: a distância entre corpo e legenda era uniforme no canvas, mas não
  na tela. Perto do vizinho que carrega a segunda massa, a lente comprimia o
  vão para 0,33–0,36 da altura do nome (0,46–0,48 nos outros) e achatava as
  letras (altura ×0,76, largura ×1,17 em *Tristan Lohengrin*). Além disso, a
  base contava satélites: uma lua sob o corpo jogava a legenda para baixo dela.
  Agora o motor publica a lente inteira (foco, segunda massa e cursor);
  `back.ts` acha onde a base da coroa aparece na tela e põe a legenda a 0,45
  da altura do nome abaixo dela, no espaço da tela, a cada quadro. A legenda é
  desenhada no plano da frente (`drawCaptions`), como o lockup (altura ×0,85,
  largura ×1,12). A base é só a coroa; se uma lua ocupa o lugar, a legenda
  desliza para o lado, e só desce abaixo da lua quando deslizar não basta.
* **Distinção, medida.** Correlação par a par das silhuetas da coleção: no
  relance do guardrail (24 px) a forma só vai de 0,614 / 0,961 (média / pior par)
  a 0,608 / 0,955 com os satélites, porque os pares quase gêmeos (*Le Manoir* ×
  *The Sheltering Sky*) diferem justamente no que é fino (11 × 3 faixas, 0 × 3
  satélites). De perto, a cor separa mais (correlação de croma 0,39 → 0,31) e o
  pior par em luminância fica em 0,70 (0,67 antes). A média de luminância sobe
  (0,36 → 0,43): com a face visível, a massa de todos conta, e todos estão sob a
  mesma luz.
* **Mobile.** O palco por bandas não muda: um corpo por tela, mesma fórmula de
  antes, só que com a silhueta no lugar do arco.

## A aproximação — da coleção ao álbum

Entrar num álbum é uma aproximação com duração, não um decaimento exponencial:
`fadeSel` anda em linha reta em 0,95 s na ida e 0,6 s na volta (`APPROACH`), e
cada etapa é uma janela suavizada desse progresso (`stagesOf`):

| Etapa | Janela | O que acontece |
| --- | --- | --- |
| Luz | 0,05–0,60 | O relevo passa de contraluz a luz frontal e as placas ganham a capa. A direção da luz gira até 0,55 rad no meio do caminho e volta. |
| Abertura | 0,30–0,85 | O perfil sai da coroa inteira: as cascas partem de posições contíguas dentro da coroa suavizada e deslizam até as reais, e as fendas de setor se abrem a partir do meio de cada fenda. A silhueta da coleção some junto. |
| Satélites | 0,55–1 | Os satélites já estão no lugar desde a coleção; a segunda massa do shader cresce com eles, em massa e horizonte. |
| Rótulos | 0,72–1 | Nomes e marcas das faixas. |

No meio da ida o raio cresce até 10% (`push`), um avanço de câmera que se
desfaz na chegada. Os vizinhos se abrem para fora e crescem com o `zoom`, como
se a câmera passasse por eles. Na volta tudo se desfaz na ordem inversa, sem o
avanço. Com movimento reduzido o álbum aparece de uma vez.

**Na coleção, o nome acompanha a prateleira.** Entre dois discos, os dois
lockups dividem o lugar: cada um entra pelo lado de onde o disco vem, e a
opacidade é complementar. O título em Bodoni e a linha mono andam 70% e 49% do
nome, uma paralaxe dentro do próprio lockup.

**A segunda massa da coleção** tem o horizonte do núcleo que o vizinho
desenha (`R × coreRatio × 0,9 × flatten`), some enquanto viaja de um vizinho
para outro (zona morta de 2% da altura) e some quando o vizinho está atrás do
foco, o que acontece em telas 4:3. A atração continua: um corpo escondido ainda
curva o da frente (P14).

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
roteamento 1:1). `motionStep` desliza para a resposta da faixa nova em cerca de
um segundo. Em repouso, a mesma assinatura vira respiração (abaixo).

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

### Parado: a respiração

Sem música, cada disco respira com o temperamento que teria tocando. A âncora
do disco (média das faixas ponderada pela duração, a mesma das qualidades por
faixa) é posta contra a amplitude do acervo, para que os quatorze discos ocupem
a faixa inteira (`breath.ts`):

| Qualidade | Respiração | No acervo |
| --- | --- | --- |
| Nitidez | Subida: 3% a 42% do período | um tique em *Чайка* e *e-world*, um inchaço em *The Sheltering Sky* |
| Sustentação | Período sem grade (3,6 a 6,8 s) e queda (7% a 55% do período) | 4,0 s (*All Systems Go*, *Sounds to Ascension*) a 6,8 s (*lebar*) |
| Grade | Com pulso em ≥ 50% da duração, o período é um número inteiro de batidas (4, 8 ou 16; mediana ponderada das batidas), nunca abaixo de 3,2 s | *Le Morte d'Abby* e *e-world*: 8 × 0,67 s = 5,4 s; *Чайка*: 4 × 0,93 s = 3,7 s |
| Microdinâmica | Profundidade 0,6 a 1 | |
| Peso do grave | Divide entre massa (lente +14%, horizonte +6%) e luz (borda e especular até +80%) | |

Cada pulso é uma subida exponencial seguida de queda exponencial, somado
periodicamente com as caudas dos ciclos anteriores: o ciclo nunca salta.
O foco respira em massa e luz; durante a navegação, a respiração é a mistura dos
dois discos vizinhos pela fração de `nav`. Cada vizinho respira na própria fase
(razão áurea × índice): escala até 1,4% e borda até +60%.

Tocando, colapsando ou fundindo, o ganho cai a zero em cerca de um segundo e a
música assume. Com movimento reduzido, ou num disco sem análise de movimento,
não há respiração. Medido em 1440×900: o brilho da região do foco varia 3–4%.

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
* **Postura.** Inclinação é uma relação, então nenhuma região a mostra. Com a
  postura em foco, o plano de trás desenha uma silhueta tracejada da mesma forma
  vista de frente (mesmo centro e raio, achatamento 1). O espaço entre ela e o
  contorno real é a inclinação. A máscara mantém essa linha acesa, e na
  Contraprova ela fica parada enquanto a forma sobe ou se deita.
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
