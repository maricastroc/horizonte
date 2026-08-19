# Ingestão local — o disco que o usuário traz

> **Dois produtores, um contrato.** O acervo curado tem a assinatura calculada
> uma vez, na curadoria. O disco local tem a assinatura calculada no navegador,
> durante a sessão. A partir de `AlbumSignature`, o motor não sabe — nem precisa
> saber — de onde o disco veio.

```
catálogo curado    arquivo do usuário
      │                    │
 analyze-audio.py     ingest/worker
      │                    │
      └──── AlbumSignature ┘
                 │
        field.ts · ring.ts · anticipation.ts · FieldEngine
```

`content/index.ts` publica um único `ALBUMS`. O curado entra no boot; o local
entra por `registerAlbum()`, que notifica quem precisa reagir (o `FieldEngine`
recalcula as constantes e apensa a capa). Nenhum caminho do motor pergunta
`provider`.

## O que o navegador faz

```
File → decodeToMono (main thread)  → PCM 22050 Hz mono
     → worker: analyzeTrackPcm × N → composeAlbum
     → signatureOf → assembleAlbum → registerAlbum
```

| Módulo | Papel |
| --- | --- |
| `ingest/fft.ts` | FFT real de 1024 pontos (complexa de 512 + desdobramento) |
| `ingest/dsp.ts` | O porte de `analyze-audio.py`: quadros, bandas, centróide, rolloff, envelope, percentis, âncoras |
| `ingest/decode.ts` | `decodeAudioData` num `OfflineAudioContext` a 22050 Hz; se o navegador ignorar a taxa, uma passada de render reamostra |
| `ingest/worker.ts` | Casca; toda a lógica está em `workerCore.ts`, que é testável fora do navegador |
| `ingest/measure.ts` | Orquestra decode ↔ worker, progresso, cancelamento, tempos |
| `ingest/metadata.ts` | ID3v2.3/2.4, átomos MP4, comentários Vorbis (FLAC e Ogg), capa embutida |
| `ingest/album.ts` | Agrupamento, ordenação, fallbacks, montagem do `Album` |
| `ingest/cover.ts` | Tintas da capa embutida ou do próprio espectro; capa de reserva desenhada a partir do envelope |
| `ingest/session.ts` | Ciclo de vida: fases, sondagens, erros, limpeza de URLs |

A análise pesada nunca toca a main thread. O decode fica nela porque
`OfflineAudioContext` só existe na janela — mas `decodeAudioData` é assíncrono e
não bloqueia; o PCM sai transferido (`postMessage` com transferable), não
copiado, e o worker o descarta assim que a faixa vira estatística.

## Paridade com o pipeline offline

### O DSP é idêntico

Alimentados com **o mesmo PCM** (os WAV de `.cache/analysis`, produzidos por
`afconvert`), o porte e o Python produzem o mesmo resultado — não "próximo":
**a mesma string base64 do envelope, nos dez álbuns**, e 0,0000% de diferença em
todos os escalares. É o que `__tests__/ingest-parity.test.ts` verifica
(`PARITY_STRICT=1` liga a comparação byte a byte).

### O decode não é idêntico — e por quê

Medindo os mesmos `.m4a` de ponta a ponta no navegador (`/aferir` em
desenvolvimento), a divergência inicial em volume era de **20,5%**. A causa não
era o DSP:

> `afconvert -c 1` faz downmix **equal-power** (`(L+R)/√2`, −3 dB).
> O Web Audio faz o downmix da especificação (`0,5·(L+R)`, −6 dB).

2,88 dB de diferença sistemática. Como o catálogo curado não pode mudar, o
navegador foi alinhado ao produtor do acervo: `downmix()` usa a lei equal-power e
corta em ±1, reproduzindo o que o `afconvert` grava em 16 bits. Verificado numa
faixa isolada: `(L+R)/√2` dá RMS 0,38679 contra 0,38724 da referência (0,12%),
enquanto a média dá 0,27779.

Depois do alinhamento, os dez álbuns medidos pelo navegador:

| Álbum | volume | dinâmica | brilho | rolloff | grave | duração |
| --- | --: | --: | --: | --: | --: | --: |
| Le Manoir | 0,00% | 0,00% | 1,05% | 1,25% | 0,07% | 0,01% |
| lebar | 0,00% | 0,06% | 1,02% | 1,24% | 0,10% | 0,01% |
| 0p | 0,00% | 0,06% | 0,75% | 1,14% | 0,23% | 0,00% |
| Dark Thoughts | 0,00% | 0,04% | 1,42% | 1,72% | 0,06% | 0,01% |
| Impromptu | 0,00% | 0,05% | 1,27% | 1,80% | 0,12% | 0,00% |
| e-world | 0,00% | 0,09% | 0,94% | 1,36% | 0,34% | 0,00% |
| Wry Way | 0,00% | 0,07% | 0,61% | 1,03% | 0,28% | 0,00% |
| All Systems Go | 0,07% | 0,48% | 0,80% | 1,45% | 0,50% | 0,00% |
| MKUltra | 0,00% | 0,00% | 0,59% | 0,30% | 0,00% | 0,00% |
| Jajce | 0,00% | 0,00% | 0,54% | 0,36% | 0,00% | 0,00% |

Volume e duração batem; dinâmica fica em 0,48% no pior caso; brilho e rolloff
ficam entre 0,3% e 1,8%, e essa é a assinatura do reamostrador — o do CoreAudio
e o do navegador cortam o topo da banda de formas ligeiramente diferentes.

O resíduo de PCM foi medido diretamente contra o WAV de referência: **−67,7 dB**
num disco que não clipa (MKUltra) e **−31,3 dB** no master mais quente do acervo
(*All Systems Go*, pico de 1,108 antes do corte), onde os dois caminhos clipam
percentuais diferentes de amostras (0,98% contra 1,75%).

### A consequência sensorial, que é o que importa

Comparando as **constantes do campo** derivadas das duas medições, para os dez
álbuns: o pior desvio é **0,55% do range** da constante (rim light de *Dark
Thoughts*). O viés por faixa (P11) fica abaixo de 0,004 em sete discos; sobe a
0,029 em *All Systems Go* e a 0,072 em *e-world*, ambos por causa do envelope.

Fim a fim, no navegador, com o álbum *All Systems Go* completo entregue como
arquivo local:

| Constante | Curado | Local | Δ |
| --- | --: | --: | --: |
| `artistWeight` | 748 | 747 | 0,36% do range |
| `massScale` | 1,0491 | 1,0490 | 0,04% |
| `horizonScale` | 1,0558 | 1,0558 | 0,00% |
| `reactionCap` | 0,0527 | 0,0531 | 0,27% |
| `envelopeDepth` | 0,1040 | 0,1046 | 0,27% |
| `flatten` | 0,6700 | 0,6697 | 0,30% |
| `rimHardness` | 5,0000 | 4,9926 | 0,31% |
| `navLerp` | 6,1744 | 6,1744 | 0,00% |

## Um achado sobre o envelope do acervo

Três dos dez discos não reproduzem o envelope publicado byte a byte. A
investigação mostrou que **isso não é do porte**: é uma propriedade do envelope
publicado.

O envelope é uma curva de RMS de 200 ms decimada para 512 pontos por amostragem
pontual, sem filtro anti-aliasing. Em *e-world* são 22 470 amostras viradas 512 —
decimação de 44×. Quais amostras caem nos 512 pontos depende do alinhamento
exato do PCM.

Medido, alimentando **o mesmo arquivo** com um deslocamento de **uma amostra**
(45 µs, abaixo de qualquer limiar perceptivo):

| Álbum | r | maior Δ (de 255) |
| --- | --: | --: |
| e-world | 0,9708 | 92 |
| All Systems Go | 1,0000 | 1 |
| MKUltra | 1,0000 | 1 |
| Le Manoir | 1,0000 | 1 |

Com 100 ms de deslocamento, *Le Manoir* chega a Δ 228. O envelope bruto, antes
da decimação, permanece com correlação > 0,999 sob o mesmo deslocamento — ou
seja, **a medição é estável; a representação de 512 pontos é que não é**.

Isto está registrado em `__tests__/ingest-envelope.test.ts`. **Não foi
corrigido**: corrigir a decimação mudaria a assinatura dos dez discos curados, e
o acervo atual é a referência calibrada do produto. Fica documentado como
limitação conhecida da representação, não como bug do caminho local — para um
disco local não existe "envelope publicado" com que divergir: o navegador é o
produtor.

## Contratos sensoriais preservados

Todos. Um disco local alimenta P1–P14 pelos mesmos caminhos do curado:

| Contrato | Origem no disco local |
| --- | --- |
| P1 peso do artista | volume medido |
| P2 força da lente | volume + duração medidos |
| P3 raio do horizonte | volume medido |
| P4 teto de perturbação | dinâmica medida |
| P5 envelope na espessura | envelope medido |
| P6 achatamento | brilho medido |
| P7 dureza do rim | brilho medido |
| P8 inércia da navegação | duração medida |
| P9 ângulo do setor | duração real de cada faixa decodificada |
| P10 envelope ao longo do setor | envelope medido |
| P11 identidade por faixa | fatias do envelope pelas fronteiras de P9 |
| P12 direção da luz | posição na faixa em reprodução |
| P13 rotação do anel | posição no álbum |
| P14 peso do disco apontado | constantes do próprio disco |
| Reação ao vivo | `AnalyserNode` sobre o `<audio>` do arquivo, normalizado pelas âncoras p10/p90 medidas do próprio disco |
| Antecipação | envelope medido, lido 6 s à frente |

Verificado em reprodução real de um disco local (4 faixas, medidas no
navegador), 150 quadros: desvio padrão de `energy` 0,159, `bass` 0,137, `mid`
0,173, `treb` 0,209, `flux` 0,132 — a mesma ordem de grandeza da tabela "sinal ao
vivo" de [`mapa-sensorial.md`](mapa-sensorial.md). O viés por faixa mudou de
`{+0,063; +0,068}` na faixa 2 para `{+0,030; −0,034}` na faixa 3, e o teto de
reação de 0,0998 para 0,0845: **faixas diferentes do mesmo disco local moldam
mundos diferentes.**

E dois discos locais diferentes ficam de fato distantes:

| | peso | teto de reação | achatamento | rim |
| --- | --: | --: | --: | --: |
| MKUltra local | 663 | 0,0897 | 0,584 | 2,94 |
| All Systems Go local | 747 | 0,0531 | 0,670 | 4,99 |

1,69× de diferença no teto de reação e os dois polos da luz — a mesma amplitude
que o acervo curado percorre.

## Álbum, não arquivo

Uma seleção vira um ou mais álbuns:

* **agrupamento** — pela tag de álbum (`artista do álbum` + `álbum`); sem tag,
  pela pasta de origem quando o arquivo veio de uma pasta; sem nada disso, tudo
  vira um disco só;
* **ordem** — por `disco`/`faixa` quando **todas** as faixas têm número; senão,
  ordem natural do nome do arquivo (numérica, então `2` vem antes de `10`);
  empate resolve pela ordem de seleção. Nunca se misturam os dois critérios;
* **títulos** — tag `title`; senão o nome do arquivo sem extensão e sem o número
  inicial (`01-hypnosis` → `hypnosis`), preservando nomes que *são* números
  (`2001` continua `2001`);
* **duração e spans** — da duração real do PCM decodificado, não da tag;
* **capa** — a embutida, quando existe, passa pelo mesmo tratamento das capas
  curadas (dessaturação, sobreimpressão das tintas, grão, equalização de
  exposição). Sem CORS envolvido: o arquivo é local.

Nada é inventado. Sem tag de artista, o disco se chama **Disco local**; sem tag
de álbum e sem pasta, **Sem título**; sem ano, o ano simplesmente não aparece na
composição. O catálogo local numera `L—001`, `L—002`… contra o `H—` da curadoria.

### Sem capa embutida

A capa de reserva **é a medição do disco**: o eixo horizontal é o tempo do álbum,
cada coluna carrega luz proporcional ao envelope naquele instante, nas tintas
derivadas do próprio espectro. Não é um marcador genérico — é a impressão digital
do disco, e o anel (que amostra a capa como textura) desenha a mesma informação
que a espessura dele já carrega.

As tintas, com ou sem capa, passam por `forceRange` e caem no mesmo corredor
`oklch(L .50–.62, C .13–.18)` do acervo. Um disco local nunca destoa da coleção
por cor.

## Formatos

A lista é **medida em tempo de execução** com `canPlayType`, não codificada: a
interface só oferece o que aquele navegador realmente lê, e recusa o resto
nomeando o que aceita.

| Formato | Chrome | Firefox | Safari |
| --- | --- | --- | --- |
| MP3 | ✅ | ✅ | ✅ |
| M4A / AAC | ✅ | ✅ | ✅ |
| WAV | ✅ | ✅ | ✅ |
| FLAC | ✅ | ✅ | ✅ |
| Ogg Vorbis · Opus | ✅ | ✅ | ❌ |
| WebM (Opus) | ✅ | ✅ | ⚠️ |
| AIFF | ❌ | ❌ | ✅ |

Metadata embutida: MP3 (ID3v2), M4A (átomos `ilst`), FLAC e Ogg (comentários
Vorbis, com capa em `PICTURE`/`METADATA_BLOCK_PICTURE`). WAV não carrega tags —
esses discos caem inteiros nos fallbacks.

## Desempenho

Medido no acervo real, do arquivo à assinatura:

| Álbum | áudio | decode | total |
| --- | --: | --: | --: |
| All Systems Go | 16 min | 1,86 s | 2,17 s |
| Le Manoir | 22 min | 2,33 s | 2,51 s |
| Jajce | 33 min | 4,02 s | 4,81 s |
| MKUltra | 66 min | 8,12 s | 8,96 s |
| e-world | 75 min | 9,34 s | 9,76 s |

Cerca de **450× o tempo real**: um disco de 45 minutos leva ~6 s. O DSP sozinho
roda a ~1,2 ms por segundo de áudio (800–970× tempo real) e fica inteiramente
escondido atrás do decode, que é o gargalo real — o único custo visível depois
da última faixa é a cauda de uma faixa. **Não há motivo para WASM**: a FFT em JS
não é o que segura o relógio.

Guardas: 320 MB por arquivo, 45 min por faixa, 3 h por álbum.

## Privacidade

O arquivo não sai do dispositivo. Não há upload, backend, Blob, analytics nem
API externa nesse caminho: `URL.createObjectURL` sobre o `File`, `decodeAudioData`
local, worker local. A cerimônia de medição diz isso na tela.

Não há persistência entre sessões nesta versão — recarregar a página perde o
disco local, por decisão de escopo. As URLs de objeto de um álbum registrado
vivem enquanto a página viver; as de um grupo cancelado ou com erro são revogadas
na hora.

## Limitações conhecidas

1. **Envelope não reprodutível byte a byte** entre decodificadores em discos
   longos ou de envelope rápido — ver acima. Sem efeito sensorial relevante
   (constantes dentro de 0,55% do range), mas é uma diferença real.
2. **Brilho e rolloff divergem 0,3–1,8%** do pipeline offline por causa do
   reamostrador do navegador. Ficam dentro da tolerância e não movem nenhuma
   constante para fora do guardrail.
3. **Sem persistência** entre sessões.
4. **Ogg/Opus não abrem no Safari**; AIFF só no Safari. A interface diz o que
   aceita em vez de prometer "qualquer áudio".
5. **Masters acima de escala cheia** clipam de formas ligeiramente diferentes do
   `afconvert`, e é aí que a divergência de PCM se concentra.
6. **Grupos grandes** (uma pasta com muitos álbuns) são medidos em sequência; o
   progresso é global, mas o tempo soma.

## Aferir

Em desenvolvimento, `/aferir` mede os álbuns curados pelo caminho do navegador e
compara com `signature.generated.ts`: escalares, envelope, spans, normalizados,
constantes do campo, viés por faixa e tempos. A rota não existe em produção.

```bash
npm run dev            # e abrir /aferir
npx vitest run src/components/horizonte/__tests__/ingest-parity.test.ts
PARITY_STRICT=1 npx vitest run src/components/horizonte/__tests__/ingest-parity.test.ts
```

Os testes de paridade e de envelope dependem de `.cache/analysis` (os WAV que o
`analyze-audio.py` deixa). Sem esse cache eles se pulam sozinhos.
