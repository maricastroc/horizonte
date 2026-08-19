# Mapa sensorial — característica musical → propriedade física

> **A música define as constantes do mundo; a reprodução só as perturba.**

Este é o contrato entre a análise offline e o motor. A implementação está em
`src/components/horizonte/field.ts` (constantes), `audio/analysis.ts`
(perturbação) e `composition/ring.ts` (geometria).

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
| P7 | Brilho | Dureza do rim light (expoente) | 2,6 → 5,0 | Brilho de timbre = dureza de luz. Mesma direção que a direção de arte propôs para bordas de sombra. | Só o expoente muda; lóbulo e direção da luz continuam iguais. |
| P8 | Duração | Inércia da navegação (lerp de `nav`) | 6,2 → 4,3 | Disco longo é mais pesado de atravessar. | Nunca abaixo de 4,2, senão o snap parece travamento. **A inércia é só do gesto no mundo** — réguas, teclado e clique continuam exatos. |
| P9 | Duração da faixa | Ângulo do setor no anel | proporcional | Ângulo = tempo. O setor que se aponta *é* quanto tempo se vai ouvir. | Setor mínimo de 1,4° para continuar clicável. |
| P10 | Envelope (RMS 200 ms) | Espessura radial ao longo do setor | ver P5 | Forma = dinâmica no tempo. É a impressão digital do disco. | Indexado pelas mesmas fronteiras de P9, para que geometria e intensidade falem do mesmo instante. |

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

## O que não muda

Colapso, fusão, cursor com massa, pausa e a camada de instrumentos ficam como
estão. A camada mono nunca reage: é o contraste entre um mundo que responde e
uma régua que não responde que impede o produto de virar visualizer.

## Regenerar

```bash
python3 scripts/analyze-audio.py --report
```
