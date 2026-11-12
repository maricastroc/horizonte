# Ingestão local — o disco que o visitante traz

> **Dois produtores, um contrato.** O acervo curado tem a assinatura calculada
> uma vez, na curadoria. O disco local tem a assinatura calculada no navegador,
> durante a sessão. A partir de `AlbumSignature`, o motor não sabe de onde o disco
> veio.

```
catálogo curado    arquivo do visitante
      │                    │
 analyze-audio.py     ingest/worker
      │                    │
      └──── AlbumSignature ┘
                 │
     field.ts · morphology.ts · FieldEngine
```

`content/index.ts` publica um único `ALBUMS`. O curado entra no boot; o local
entra por `registerAlbum()`, que notifica quem precisa reagir (o `FieldEngine`
recalcula as constantes e apensa a capa).

## O que o navegador faz

```
File → decodeToMono (main thread)  → PCM 22050 Hz mono
     → worker: analyzeTrackPcm × N → composeAlbum
     → signatureOf → assembleAlbum → registerAlbum
```

| Módulo | Papel |
| --- | --- |
| `ingest/fft.ts` | FFT real de 1024 pontos |
| `ingest/dsp.ts` | O porte de `analyze-audio.py`: quadros, bandas, centróide, rolloff, envelope, pulso, percentis, âncoras |
| `ingest/decode.ts` | `decodeAudioData` num `OfflineAudioContext` a 22050 Hz; downmix equal-power |
| `ingest/worker.ts`, `workerCore.ts` | A análise fora da main thread; a lógica fica em `workerCore.ts`, testável fora do navegador |
| `ingest/measure.ts` | Orquestra decode ↔ worker, progresso e cancelamento |
| `ingest/metadata.ts` | ID3v2, átomos MP4, comentários Vorbis (FLAC e Ogg), capa embutida |
| `ingest/album.ts` | Agrupamento, ordenação, fallbacks, montagem do `Album` |
| `ingest/cover.ts` | Tintas da capa ou do espectro; capa de reserva desenhada a partir do envelope |
| `ingest/session.ts` | Ciclo de vida: fases, sondagens, erros, limpeza de URLs |

A análise pesada nunca toca a main thread. O decode fica nela porque
`OfflineAudioContext` só existe na janela, mas é assíncrono; o PCM vai para o
worker como transferable e é descartado assim que a faixa vira estatística.

## Paridade com o pipeline offline

**O DSP é idêntico.** Alimentados com o mesmo PCM (os WAV de `.cache/analysis`),
o porte e o Python produzem a mesma string base64 do envelope nos 14 discos do
acervo e os mesmos escalares, inclusive pulso e brilho por faixa.
`ingest-parity.corpus.test.ts` verifica isso com tolerância, e com
`PARITY_STRICT=1` exige o envelope byte a byte. Sem o corpus local, a fixture
versionada (`fixtures/parity/`: quatro trechos de 10 s de *All Systems Go*, CC BY
4.0, com a atribuição em `golden.json`) faz a mesma verificação em CI.

**O decode não é idêntico.** `afconvert -c 1` faz downmix equal-power
(`(L+R)/√2`); o Web Audio faz `0,5·(L+R)`, 2,88 dB abaixo. O navegador foi
alinhado ao produtor do acervo: `downmix()` usa a lei equal-power e corta em ±1,
como o `afconvert` grava em 16 bits. O resíduo que sobra é do reamostrador.
Medido de ponta a ponta nos dez primeiros discos do acervo (`/parity`): volume e
duração batem, dinâmica difere até 0,48%, brilho e rolloff entre 0,3% e 1,8%. As
constantes do campo derivadas das duas medições ficam dentro de 0,55% do range de
cada uma; o viés por faixa (P11), dentro de 0,072.

## O envelope do acervo

O `envelope` de 512 pontos é a curva de RMS de 200 ms decimada por amostragem
pontual, sem filtro anti-aliasing (44× em *e-world*). Quais amostras caem nos 512
pontos depende do alinhamento exato do PCM: deslocar o mesmo arquivo em **uma
amostra** (45 µs) muda o envelope de *e-world* para correlação 0,97 e desvio
máximo de 92 em 255, enquanto o envelope bruto, antes da decimação, mantém
correlação acima de 0,999. A medição é estável; a representação de 512 pontos
não é.

Não foi corrigido de propósito: filtrar antes de decimar mudaria a assinatura de
todos os discos curados, que são a referência calibrada do produto. Para um disco
local não existe envelope publicado com que divergir: o navegador é o produtor.
Registrado em `ingest-envelope.corpus.test.ts`.

## O que um disco local recebe

Tudo o que o curado recebe, pelos mesmos caminhos: constantes do álbum e da faixa
(P1–P17), morfologia (M1–M12), carga e coroa, reação ao vivo normalizada pelas
âncoras p10/p90 medidas do próprio disco, e as perguntas de *Why this shape?*
(com posição entre 15 e a mediana dos 14). A única exceção é a assinatura de
movimento: sem a análise offline, o disco local fica com a resposta neutra.

## Álbum, não arquivo

* **Agrupamento** — pela tag de álbum (`artista do álbum` + `álbum`); sem tag,
  pela pasta de origem; sem nada disso, tudo vira um disco só.
* **Ordem** — por `disco`/`faixa` quando **todas** as faixas têm número; senão,
  ordem natural do nome do arquivo (`2` antes de `10`). Os critérios nunca se
  misturam.
* **Títulos** — tag `title`; senão o nome do arquivo sem extensão e sem o número
  inicial (`01-hypnosis` → `hypnosis`), preservando nomes que são números.
* **Duração e spans** — da duração real do PCM decodificado, não da tag.
* **Capa** — a embutida passa pelo mesmo tratamento das curadas. Sem capa, a
  reserva é a medição do disco: o eixo horizontal é o tempo do álbum e cada
  coluna carrega luz proporcional ao envelope, nas tintas do próprio espectro.
  As tintas caem no mesmo corredor `oklch(L .50–.62, C .13–.18)` do acervo.
* **Fallbacks** — sem tag de artista, **Disco local**; sem álbum e sem pasta,
  **Untitled**; sem ano, o ano não aparece. O catálogo local numera `L—001`,
  `L—002`… contra o `H—` da curadoria.

A entrada *Bring a record* não se parece com um item do catálogo: fica fora da
lista de álbuns, com quadrado vazado no lugar do preenchido. Arrastar arquivos
sobre a janela troca o rótulo para *Drop to measure*; fora disso não há
dropzone. Apontar a entrada move o campo ao contrário de apontar um disco (ver
P14 em [`mapa-sensorial.md`](mapa-sensorial.md)).

## Formatos

A lista é medida em tempo de execução com `canPlayType`: a interface só oferece o
que aquele navegador lê, e recusa o resto nomeando o que aceita.

| Formato | Chrome | Firefox | Safari |
| --- | --- | --- | --- |
| MP3 · M4A/AAC · WAV · FLAC | ✅ | ✅ | ✅ |
| Ogg Vorbis · Opus | ✅ | ✅ | ❌ |
| WebM (Opus) | ✅ | ✅ | ⚠️ |
| AIFF | ❌ | ❌ | ✅ |

## Desempenho e privacidade

Do arquivo à assinatura, cerca de 450× o tempo real: *e-world* (75 min) leva
9,8 s, *All Systems Go* (16 min) 2,2 s. O decode é o gargalo; o DSP roda a
~1,2 ms por segundo de áudio e fica escondido atrás dele. Guardas: 320 MB por
arquivo, 45 min por faixa, 3 h por álbum (`decode.ts`).

O arquivo não sai do dispositivo: `URL.createObjectURL` sobre o `File`, decode e
worker locais, sem upload, backend nem analytics. Não há persistência entre
sessões; as URLs de objeto de um grupo cancelado ou com erro são revogadas na
hora.

## Limitações conhecidas

1. **Envelope não reprodutível byte a byte** entre decodificadores em discos
   longos ou de envelope rápido (ver acima), sem efeito sensorial relevante.
2. **Brilho e rolloff** divergem 0,3–1,8% do pipeline offline por causa do
   reamostrador, dentro da tolerância.
3. **Sem persistência** entre sessões.
4. **Ogg/Opus não abrem no Safari**; AIFF só no Safari.
5. **Masters acima de escala cheia** clipam de forma ligeiramente diferente do
   `afconvert`; é aí que a divergência de PCM se concentra.
6. **Grupos grandes** são medidos em sequência.
7. **Faixas curtas demais** (menos de ~4 s) ficam fora da média de pulso do
   álbum.

## Aferir

```bash
npm run test:corpus                       # paridade e envelope sobre .cache/analysis
PARITY_STRICT=1 npm run test:corpus       # envelope byte a byte
npm run dev                               # e abrir /parity: o caminho do navegador
```

`/parity` mede os álbuns curados pelo navegador e compara com
`signature.generated.ts`. A rota não existe em produção. A fixture versionada é
regenerada por `scripts/make-parity-fixture.py`.
