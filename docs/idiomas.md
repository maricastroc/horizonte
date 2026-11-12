# Idiomas

O Horizonte existe inteiro em dois idiomas: inglês (`en`) e português do Brasil (`pt-BR`).
Instrumentos, cerimônia de medição, mensagens de erro, anúncios para leitores de tela, texto
desenhado no canvas, créditos de licença e as perguntas de "Por que esta forma?" mudam juntos,
na hora, sem recarregar a página e sem tocar na reprodução.

Não há biblioteca de internacionalização. O problema cabe em um módulo pequeno e tipado em
`src/components/horizonte/i18n/`.

## Como o idioma é escolhido

| Situação | Idioma |
| --- | --- |
| A pessoa já escolheu no seletor | o que ela escolheu (`localStorage`, chave `horizonte:locale`) |
| O navegador lista português antes de inglês (`pt`, `pt-BR`, `pt-PT`, …) | `pt-BR` |
| Qualquer outro caso | `en` |

A detecção percorre `navigator.languages` na ordem e para no primeiro idioma que o Horizonte
fala: `["es", "pt-BR"]` dá português, `["fr", "en-GB", "pt"]` dá inglês. A detecção sozinha não
grava nada; só o seletor grava, então quem nunca escolheu continua seguindo o navegador.

A regra mora em uma função só, `pickLocale` (`i18n/locale.ts`), usada em dois lugares:

- **no script de boot**, embutido no `<head>` por `app/layout.tsx`. Ele roda antes da primeira
  pintura, ajusta `document.documentElement.lang` e, se o idioma não for o inglês do HTML
  pré-renderizado, marca `<html data-locale-pending>`. Uma regra em `globals.css` esconde a
  camada de instrumentos enquanto a marca existir. O script é gerado a partir do próprio
  `pickLocale.toString()`, então não há uma segunda cópia da regra;
- **no store** (`i18n/store.ts`), lido pelos componentes com `useSyncExternalStore`. Quando a
  página já renderizou no idioma certo, `applyDocumentLocale` tira a marca e os instrumentos
  aparecem. Quem fala inglês nunca vê essa espera.

O HTML do servidor é sempre inglês (`getServerLocale`), e `<html>` leva
`suppressHydrationWarning` porque o script altera `lang` antes da hidratação.

## Arquitetura

```
i18n/
  locale.ts          Locale, pickLocale, BOOT_SCRIPT
  store.ts           idioma atual, detecção, persistência, lang do documento
  index.ts           COPY, useLocale, useCopy, useDocumentLocale, setLocale
  types.ts           Copy e AnatomyWriter: o contrato dos dois dicionários
  en.ts, pt-BR.ts    textos da interface
  anatomy.en.ts      redator da Anatomia em inglês
  anatomy.pt-BR.ts   redator da Anatomia em português
  canvas.ts          rótulos desenhados no canvas
```

- **`Copy`** é uma interface: os dois dicionários a implementam, então uma chave a mais ou a
  menos em um deles é erro de compilação. Textos com variação (plural, nomes de arquivo,
  posição na faixa) são funções, não modelos com marcadores.
- **Nenhum componente compara idiomas.** Eles pedem `useCopy()` e usam o que vem. Regras de
  plural, ordinal, separador decimal e gênero ficam nos dicionários e nos redatores.
- **O motor não fala.** O anúncio para leitores de tela saiu de `FieldEngine` e passou para
  `Instruments`, que o monta a partir de `playAlb`/`trk` do `Snapshot`. O único texto que o
  motor desenha (a contagem de faixas no canvas) chega por `engine.setLabels`.
- **Erros da ingestão são dados.** `IngestStatus.error` virou `IngestError`, uma união com o
  motivo (`unsupported`, `tooLarge`, `tooLong`…) e o nome do arquivo quando há um. Cada
  dicionário escreve a mensagem.
- **Álbuns locais sem nome** guardam quais campos vieram do fallback (`unnamed`) e são
  renomeados quando o idioma muda (`nameUnnamed`), inclusive no canvas.
- **Créditos.** Em inglês, a atribuição sai exatamente como a licença pede. Em português, ela é
  remontada a partir dos campos do álbum ("Licenciado sob CC BY 4.0"), e as notas de curadoria
  usam `notePt`, que `scripts/fetch-curation.py` emite ao lado de `note`.

## A Anatomia: interpretação e redação

`anatomy.ts` decide **o que** a forma diz e não contém nenhuma frase. Para cada parte da forma
ele produz um `Finding`: se o disco está perto da mediana, acima ou abaixo dela, se é um
extremo, se é o primeiro ou o último da coleção e, conforme a parte:

- **pequenos corpos:** quantos existem, quantos restam na Contraprova, a duração, a duração
  típica e a diferença entre as duas, e os minutos em que cada corpo nasce
  (`satelliteOnsets`, derivado das constantes de `MORPH`);
- **fendas:** se o anel está aberto;
- **camadas:** que tipo de ritmo o disco tem;
- **centro escuro:** o peso do nome.

A ordem das perguntas, o peso de cada uma e a existência do experimento também são decididos
ali, uma vez só.

Os redatores decidem **como** dizer. Cada um recebe a mesma `Question` e devolve pergunta,
resposta, experimento, rótulo do alternador e resultado, além do aprofundamento de "Em
números" (`details`, `depth`) e da frase sobre o nome (`nameFact`). Eles cuidam do que é próprio
de cada língua: concordância ("resta um pequeno corpo", "o 1 minuto a mais"), gênero
("Nenhum disco da coleção é tão escuro"), ordinais ("12th", "12º"), separador decimal
("−12.3 dB", "−12,3 dB") e o caso em que não há nada a contar ("this length makes none",
"nenhum aparece").

Para trocar uma frase, edite só o redator. Para mudar uma regra (quando um disco é extremo,
quando o anel está aberto), edite só `anatomy.ts`.

### Como as respostas explicam

Cada resposta liga o que existe na música, a maneira como o Horizonte o representa e o que
se vê na forma, sem virar uma fórmula de três frases.

- **Fato e escolha ficam separados.** O que é medido no áudio aparece como fato. O que é
  decisão de desenho aparece como do Horizonte ("o Horizonte representa o tempo…", "na forma,
  essa regularidade se traduz em…"), para nada soar como lei da música.
- **Os detalhes técnicos ficam em "Em números".** Lá ficam os limiares dos pequenos corpos,
  o peso do nome e o porquê de a duração aparecer fora do anel. A resposta principal se
  entende sem abrir essa camada.
- **A Contraprova diz o parâmetro exato e a direção** ("E se o volume médio fosse mais
  baixo?"). O resultado começa pela referência ("Com o volume de um disco típico,") e descreve
  só o que o motor muda. Quando ajuda, diz o que isso revela sobre o original: os recortes da
  borda ficam no mesmo lugar, e os pequenos corpos que somem "representavam os 41 minutos a
  mais deste disco".
- **"Típico"** é a mediana dos 14 discos curados, a mesma referência que a Contraprova usa
  (`medianOf`). O texto nunca a chama de média.

### Vocabulário

| Parte | Descritor | Português | Inglês |
| --- | --- | --- | --- |
| satellites | duração | pequenos corpos | small bodies |
| gaps | diferença de ritmo entre faixas | fendas; o anel "partido" ou "quase contínuo" | breaks; the ring "broken apart" or "almost unbroken" |
| strata | regularidade do ritmo | camadas, anéis paralelos | layers, parallel rings |
| contour | contraste (dinâmica) | borda, recortes | edge, cuts |
| posture | brilho (energia nos agudos) | inclinação: aberta, de frente, achatada | tilt: open, facing you, flat |
| core | volume médio | corpo e centro escuro | body and dark center |
| — | — | disco, coleção, setor = faixa, típico | record, collection, sector = track, typical |

Volume médio e contraste nunca se confundem: o primeiro é o quanto o disco soa alto do início
ao fim (centro escuro, nome); o segundo é a distância entre os trechos calmos e os intensos
(borda). Regularidade do ritmo não é força nem velocidade da batida: é se as notas caem numa
grade que se repete.

"Faixa" fica reservada às faixas do disco; por isso o português fala em "camadas" e "anéis
paralelos", nunca em "faixas" do anel.

### Relatório de revisão

`npm run anatomy:report` gera [`anatomia-pt-en.md`](anatomia-pt-en.md) com as seis perguntas
dos catorze álbuns nos dois idiomas, na ordem em que a interface as mostra, cada uma com os
fatos que a geraram. Ele é a forma de revisar a redação sem abrir cada combinação na
interface. Gere de novo depois de mudar um redator.

## Seletor

`LanguageSwitch.tsx` mostra `EN / PT` no estilo dos outros instrumentos: mono, maiúsculas, o
idioma ativo sublinhado com a tinta do álbum. Cada botão tem `lang` próprio e nome acessível
completo ("English", "Português (Brasil)"), `aria-pressed` indica o ativo, e o grupo se chama
"Language"/"Idioma". Trocar mantém o foco no botão e não chama nenhum método do motor.

- **Desktop e tablet:** canto superior direito, alinhado com o título.
- **Celular (retrato e paisagem):** na linha do tempo e do som, ao lado de "Som". A segunda
  linha do topo, onde ficariam naturalmente, não comporta o seletor junto de "Álbuns" a 320 px.

## Ajustes de layout

O português é mais longo; nenhum tamanho de fonte foi reduzido.

- O alternador da Contraprova ocupa a largura do painel, com as duas metades iguais, e o
  rótulo pode quebrar linha. Rótulos precisos como "Ritmos parecidos", "Alike in rhythm" e
  "Menos contraste" não cabiam ao lado de "Como é" no desktop e no tablet.

- O botão do experimento ("E se cada faixa seguisse seu próprio pulso? ▸") quebra linha em vez
  de estourar o painel, e a seta fica presa à última palavra. O inglês também estourava com
  "What if it swung more between quiet and loud?".
- A dica "Segure a imagem para comparar · Esc volta" quebra no separador, nunca deixando
  "volta" sozinha.
- No tablet, a barra de abas usa o espaçamento entre letras do celular (`.14em`): "Por que
  esta forma?" passava 10 px da largura do trilho.

Medido em 1440×900, 1280×720, 1024×768, 768×1024, 390×844, 320×640 e 844×390, nos dois
idiomas: nenhum texto sai da tela nem é cortado.

## Evolução futura

- **URLs e metadados por idioma.** O idioma não muda a rota. Por isso `<title>` e a descrição
  que buscadores e prévias de link leem continuam em inglês, e o HTML pré-renderizado também.
  Se o alcance em português importar, o caminho é um segmento `/[lang]` com `metadata` por
  idioma, `alternates.languages` (hreflang) e detecção no `proxy` para o primeiro acesso.
- **Títulos de faixa sem nome.** Uma faixa local cujo nome de arquivo não deixa nada
  aproveitável recebe "Untitled", sem tradução. É raro: o nome do arquivo quase sempre basta.
