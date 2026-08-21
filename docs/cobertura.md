# Cobertura do acervo — escolher o próximo disco

> **Gênero não é proxy de diversidade. A decisão sai dos descritores medidos.**

```
npm run curadoria                                        # relatório do acervo
npm run curadoria -- --candidato public/music/<slug>     # avalia um candidato real
npm run curadoria -- --ranquear ~/candidatos             # mede um lote e ordena
npm run curadoria -- --prospectar --limite 80            # busca, mede e ranqueia sozinho
npm run curadoria -- --vetor 0.20,0.90,0.20,0.70,0.80    # avalia um perfil hipotético
npm run curadoria -- --json                              # resumo legível por máquina
```

Isto **não é teste**. Cobertura de catálogo é decisão de curadoria, não condição
de correção do software: `scripts/curadoria.py` não entra na suíte e não trava CI.
O guardrail que trava é outro — o de distância perceptual, em
[`mapa-sensorial.md`](mapa-sensorial.md#guardrail--medir-em-espaço-de-imagem).

## O que a ferramenta reusa

Nada de descritor ou normalização é reescrito. `curadoria.py` importa
`analyze-audio.py` como módulo — o mesmo padrão que `analyze-audio.py` já usa
para importar `fetch-curation.py` — e toma dali `ANCHOR`, `norm` e
`analyze_album`. Um candidato é medido pelo pipeline idêntico ao do acervo curado.

A prova disso é reexecutável: medir um álbum que já está no catálogo devolve o
vetor publicado com distância **0,000** ao próprio registro.

Os cinco eixos e a fórmula de distância são os mesmos de `musicalDistance` em
`perception/measure.ts`: raiz da média dos quadrados das diferenças, sobre
volume, dinâmica, brilho, duração e pulso normalizados.

## Prospecção automática

Inverte o fluxo. Em vez de *"o nome parece promissor → baixar → descobrir que é
redundante"*, o caminho passa a ser:

```
fonte elegível → licença → medição acústica → ranking → curadoria humana
```

```
npm run curadoria -- --prospectar --limite 80 [--colecao netlabels] [--consulta "..."]
```

Gênero **não** entra como critério de diversidade. `--consulta` existe só para
ampliar a descoberta — o que decide é o vetor medido.

### O que é reusado

Nada de cliente HTTP ou portão de licença foi reescrito. `analyze-audio.py` já
importa `fetch-curation.py`, então `curadoria.py` alcança por ali o `http_get`
com retentativa, o `UA` e as constantes `CC_BY_4` / `CC_BY_4_ALT`. A validação é
a mesma linha de `build_archive`: `licenseurl` lido do JSON de metadados do
próprio item.

**O índice de busca é descoberta, não prova.** Todo item tem a licença
reconferida no seu `metadata` antes de qualquer download.

### O funil

| Etapa | O que corta |
| --- | --- |
| busca | `licenseurl` CC BY 4.0 · `mediatype:audio` · coleção |
| metadata | licença reconferida no item |
| forma | mínimo de 3 faixas e 8 minutos — single não mede dinâmica como disco |
| download | derivado MP3, item completo |
| medição | `analyze_album`, os mesmos cinco descritores |

Medir **o item inteiro** não é capricho. Aferi amostragem contra o acervo, onde
a resposta certa é conhecida: com 4 faixas o erro de dinâmica chega a **0,462**
num disco — mais que a própria distância que separa "baixa" de "alta". Dinâmica
é p95/p05 do álbum todo, e a amostra perde os extremos.

### Nada fica no repositório

O áudio vai para `.cache/prospeccao/audio/<id>/`, é medido e **apagado em
seguida**, junto do WAV descomprimido que o `decode()` deixa em
`.cache/analysis` — um álbum de 75 min gera ~170 MB ali, e sem essa limpeza uma
prospecção de algumas dezenas enche o disco.

Persiste só o que permite repetir o ranking sem rede: o JSON de metadados e
`.cache/prospeccao/vetores.json`, com os cinco descritores por item. Nada toca o
catálogo oficial nem sobe para o Blob.

## Avaliar um lote

`--ranquear` aponta para uma pasta que contém **várias pastas de álbum**:

```
~/candidatos/
  algum-disco/       faixa01.mp3  faixa02.mp3  …
  outro-disco/       …
```

Ele mede todos, ordena por utilidade e devolve duas leituras, porque respondem a
perguntas diferentes:

* **independente** — cada candidato contra o acervo de hoje. É o "qual destes é o
  melhor".
* **incremental** — se você fosse levar mais de um, qual sequência cobre mais
  espaço. Dois candidatos podem ser ótimos individualmente **pelo mesmo motivo**;
  aí o segundo quase não acrescenta depois do primeiro, e só a leitura
  incremental mostra isso.

Uma pasta que falha ao medir é reportada e pulada, não derruba o lote.

Medir é caro, e o lote costuma ser rodado várias vezes enquanto a busca anda:
`.cache/curadoria.json` guarda os vetores indexados pelo conteúdo da pasta —
nome, tamanho e mtime de cada arquivo. Trocar ou reencodar uma faixa invalida a
entrada sozinho. Na prática, 11 álbuns caem de 32 s para 1,7 s.

## Distância contínua, não contagem de células

Dividir o espaço em regiões e contar quantas estão ocupadas trataria dois discos
em cantos opostos da mesma célula como redundantes, e dois discos vizinhos em
lados diferentes de uma fronteira como distantes.

A métrica principal é o **raio de cobertura**: para cada ponto de uma grade de
11⁵ = 161.051 pontos, a distância até o álbum mais próximo.

| Métrica | Leitura |
| --- | --- |
| raio médio | quão bem coberto está o espaço inteiro |
| percentil 90 | quão grandes são os buracos típicos |
| maior vazio | o ponto do espaço mais distante de qualquer disco |

As regiões — os 32 octantes de "acima/abaixo de 0,5" em cada eixo — entram só
como leitura descritiva, para nomear onde um disco cai.

Os vazios são reportados em dois recortes, porque servem a perguntas diferentes:

* **no espaço inteiro**, que encontra os extremos geométricos — reais, mas raros
  em música gravada;
* **dentro do envelope já ocupado**, que encontra os buracos entre os discos que
  existem — mais fáceis de preencher com um disco de verdade.

## As faixas de utilidade saem dos dados

Nenhum limiar foi arbitrado. A referência é a própria distribuição das distâncias
ao vizinho mais próximo dentro do acervo, recalculada a cada execução:

| Classificação | Regra | Justificativa |
| --- | --- | --- |
| **baixa** | `d ≤ mediana` | Não é mais isolado que um disco típico do acervo: adensa território já povoado. |
| **média** | `mediana < d ≤ máximo` | Tão isolado quanto o disco mais isolado que existe hoje. |
| **alta** | `d > máximo` | Mais isolado que qualquer disco atual: amplia o espaço em vez de preenchê-lo. |

Com os dez álbuns de agosto de 2026 isso dá mediana **0,191** e máximo **0,256**.
Os números são impressos junto da classificação, então a regra é auditável na
própria saída — e se move sozinha conforme o acervo cresce.

A classificação sai do critério 1. Os critérios 2 e 3 aparecem como evidência de
apoio, não como pesos somados num escore único: um candidato "média" que ocupa
região nova e corta o maior vazio vale mais que um "média" que não faz nenhum dos
dois, e essa diferença deve ficar visível, não embutida.

## Ordem de prioridade

1. **Distância ao vizinho mais próximo.** É o que impede dois discos de
   produzirem mundos parecidos — a causa direta do problema.
2. **Redução dos maiores vazios contínuos.** Um disco pode estar longe do vizinho
   e ainda assim não atacar nenhum buraco grande.
3. **Ocupação de regiões ainda não representadas.** Leitura mais grosseira, útil
   para nomear o que falta.

## Por que cobrir é sempre ganho

As âncoras de normalização são **absolutas**, não relativas ao acervo — é a mesma
garantia de determinismo que `analyze-audio.py` documenta. Acrescentar um disco
nunca reescala nenhum outro. Portanto curar por cobertura só preenche espaço:
não distorce a identidade de nada que já está publicado.
