# Curadoria Horizonte — procedência e licenças

Três obras, todas sob **Creative Commons Attribution 4.0 International (CC BY 4.0)**,
com áudio e capa hospedados pelo próprio projeto em `public/music/<slug>/`.

Regenerar tudo (idempotente, não precisa versionar os assets):

```bash
python3 scripts/fetch-curation.py
```

O script **aborta** se a licença declarada na origem não for exatamente CC BY 4.0.

---

## H—001 · Tale Twist — *Wry Way*

| | |
|---|---|
| Artista | Tale Twist |
| Álbum | Wry Way |
| Ano | 2016 |
| Selo / catálogo | Tranzmitter Netlabel · TRANZ060 |
| Faixas | 8 (31 min) |
| Origem | https://archive.org/details/tranz060TaleTwist-WryWay |
| Licença | CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/ |
| Atribuição | Tale Twist — Wry Way (Tranzmitter Netlabel, 2016). Licenciado sob CC BY 4.0. Áudio recodificado para entrega web. |
| Hospedar/redistribuir | **Sim** |

## H—002 · Meho — *MKUltra*

| | |
|---|---|
| Artista | Meho |
| Álbum | MKUltra |
| Ano | 2015 |
| Selo / catálogo | Cezanne Records · cz015 |
| Faixas | 6 (66 min) |
| Origem | https://archive.org/details/Meho-Mkultracz015 |
| Licença | CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/ |
| Atribuição | Meho — MKUltra (Cezanne Records, 2015). Licenciado sob CC BY 4.0. Áudio recodificado para entrega web. |
| Hospedar/redistribuir | **Sim** |

## H—003 · Mescaline Sessions — *Jajce Sessions*

| | |
|---|---|
| Artista | Mescaline Sessions |
| Álbum | Session 17 – 20 (Jajce Sessions) |
| Ano | 2014 |
| Selo / catálogo | Cezanne Records · cz012 |
| Faixas | 4 (33 min) |
| Origem | https://archive.org/details/Session17-20jajceSessionscz012 |
| Licença | CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/ |
| Atribuição | Mescaline Sessions — Jajce Sessions (Cezanne Records, 2014). Licenciado sob CC BY 4.0. Áudio recodificado para entrega web. |
| Hospedar/redistribuir | **Sim** |

---

## Onde a atribuição aparece

- **Na tela**: artista e álbum são a própria tipografia monumental; a linha
  inferior direita traz `CC BY 4.0` com link para a página de origem do álbum
  em foco, e o texto completo de atribuição no `title` do link.
- **No código**: `album.license` (`name`, `url`, `source`, `attribution`,
  `redistributable`) em `src/components/horizonte/content/curation.generated.ts`.

## O que foi alterado nas obras

CC BY permite adaptação. Foi feito:

- **Áudio**: recodificado de MP3 para AAC 96 kbps (`.m4a`) para entrega web.
  Sem edição de conteúdo, cortes ou remixagem.
- **Capa**: recorte central quadrado e reamostragem para 1024 px WebP. Em
  runtime recebe o tratamento de unificação da coleção (dessaturação de ~8%,
  overprint da tinta, grão comum, equalização de exposição) — o mesmo que
  qualquer capa recebe, sem alterar o arquivo em disco.

## Descartados por licença

- `tranz023Holocaos-MetamorfoseComputadorEp` — **CC BY-ND 2.5 BR**. NoDerivatives
  não permite a recodificação nem o tratamento da capa. Não usado.

## Não usado: Jamendo

A API do Jamendo exige um `client_id` obtido por registro de conta de
desenvolvedor. Sem essa credencial não há acesso programático ao catálogo nem
aos campos `license_ccurl` / `audiodownload`. Para incluir Jamendo, basta criar
a chave e somar um bloco em `CURATION` no script — o resto do pipeline não muda.
