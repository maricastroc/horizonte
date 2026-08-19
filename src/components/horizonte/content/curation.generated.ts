import type { Album } from "./types";

export interface CuratedAlbum extends Album {
  originalCat?: string;
  label?: string;
  note?: string;
}

export interface BlockedAlbum {
  cat: string;
  artist: string;
  title: string;
  source: string;
  reason: string;
  verifiedAt: string;
}

export const CURATION: CuratedAlbum[] = [
  {
    id: "tristan-lohengrin-le-manoir",
    provider: "curadoria",
    artist: "Tristan Lohengrin",
    title: "Le Manoir",
    year: "2019",
    cat: "H—001",
    cover: "/music/tristan-lohengrin-le-manoir/cover.webp",
    inkA: [0.008, 0.534, 0.761],
    inkB: [0.772, 0.382, 0.494],
    tracks: [
      {
        id: "tristan-lohengrin-le-manoir/01-le-manoir",
        title: "Le Manoir",
        dur: 96.05,
        source: {
          kind: "local",
          src: "/music/tristan-lohengrin-le-manoir/01-le-manoir.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "tristan-lohengrin-le-manoir/02-dans-le-jardin",
        title: "Dans le Jardin",
        dur: 240.17,
        source: {
          kind: "local",
          src: "/music/tristan-lohengrin-le-manoir/02-dans-le-jardin.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "tristan-lohengrin-le-manoir/03-le-hall",
        title: "Le Hall",
        dur: 53.37,
        source: {
          kind: "local",
          src: "/music/tristan-lohengrin-le-manoir/03-le-hall.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "tristan-lohengrin-le-manoir/04-a-travers-les-couloirs",
        title: "A travers les couloirs",
        dur: 73.01,
        source: {
          kind: "local",
          src: "/music/tristan-lohengrin-le-manoir/04-a-travers-les-couloirs.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "tristan-lohengrin-le-manoir/05-la-salle-de-bal",
        title: "La Salle de Bal",
        dur: 119.99,
        source: {
          kind: "local",
          src: "/music/tristan-lohengrin-le-manoir/05-la-salle-de-bal.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "tristan-lohengrin-le-manoir/06-la-chambre",
        title: "La Chambre",
        dur: 138.58,
        source: {
          kind: "local",
          src: "/music/tristan-lohengrin-le-manoir/06-la-chambre.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "tristan-lohengrin-le-manoir/07-le-couloir-secret",
        title: "Le Couloir Secret",
        dur: 123.98,
        source: {
          kind: "local",
          src: "/music/tristan-lohengrin-le-manoir/07-le-couloir-secret.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "tristan-lohengrin-le-manoir/08-la-salle-de-torture",
        title: "La Salle de Torture",
        dur: 194.03,
        source: {
          kind: "local",
          src: "/music/tristan-lohengrin-le-manoir/08-la-salle-de-torture.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "tristan-lohengrin-le-manoir/09-poursuivi",
        title: "Poursuivi",
        dur: 90.01,
        source: {
          kind: "local",
          src: "/music/tristan-lohengrin-le-manoir/09-poursuivi.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "tristan-lohengrin-le-manoir/10-le-dernier-couloir",
        title: "Le Dernier Couloir",
        dur: 85.15,
        source: {
          kind: "local",
          src: "/music/tristan-lohengrin-le-manoir/10-le-dernier-couloir.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "tristan-lohengrin-le-manoir/11-le-fantome",
        title: "Le Fantôme",
        dur: 110.06,
        source: {
          kind: "local",
          src: "/music/tristan-lohengrin-le-manoir/11-le-fantome.m4a",
          mime: "audio/mp4"
        }
      }
    ],
    license: {
      name: "CC BY 4.0",
      url: "https://creativecommons.org/licenses/by/4.0/",
      source: "https://tristanlohengrin.bandcamp.com/album/le-manoir-album-cc-by-40",
      attribution: "Tristan Lohengrin — Le Manoir (Tristan Lohengrin (auto-publicado), 2019). Licenciado sob CC BY 4.0.",
      redistributable: true,
      cover: {
        license: "Não declarada pelo autor",
        credit: "Arte de David Harrington",
        source: "https://tristanlohengrin.bandcamp.com/album/le-manoir-album-cc-by-40"
      },
      verifiedAt: "2026-08-18",
      changes: [
        "Áudio recodificado para AAC 96 kbps (.m4a) para entrega web; sem edição de conteúdo.",
        "Capa recortada em quadrado central e reamostrada para 1024 px WebP."
      ]
    },
    label: "Tristan Lohengrin (auto-publicado)",
    note: "O autor acrescenta um termo extra: proibido registrar em Content ID."
  },
  {
    id: "jono-terbakar-lebar",
    provider: "curadoria",
    artist: "Jono Terbakar",
    title: "lebar",
    year: "2023",
    cat: "H—002",
    cover: "/music/jono-terbakar-lebar/cover.webp",
    inkA: [0.437, 0.582, 0.21],
    inkB: [0.162, 0.389, 0.672],
    tracks: [
      {
        id: "jono-terbakar-lebar/01-nirlaba",
        title: "nirlaba",
        dur: 263.0,
        source: {
          kind: "local",
          src: "/music/jono-terbakar-lebar/01-nirlaba.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "jono-terbakar-lebar/02-tetes-embun-yang-merasa-samudera",
        title: "tetes embun yang merasa samudera",
        dur: 113.0,
        source: {
          kind: "local",
          src: "/music/jono-terbakar-lebar/02-tetes-embun-yang-merasa-samudera.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "jono-terbakar-lebar/03-balada-seni-dari-ujung-bumi",
        title: "balada seni dari ujung bumi",
        dur: 147.0,
        source: {
          kind: "local",
          src: "/music/jono-terbakar-lebar/03-balada-seni-dari-ujung-bumi.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "jono-terbakar-lebar/04-bajigurik-radio-edit",
        title: "bajigurik - radio edit",
        dur: 145.0,
        source: {
          kind: "local",
          src: "/music/jono-terbakar-lebar/04-bajigurik-radio-edit.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "jono-terbakar-lebar/05-liat-tanah-tanah-liat",
        title: "liat tanah, tanah liat",
        dur: 257.0,
        source: {
          kind: "local",
          src: "/music/jono-terbakar-lebar/05-liat-tanah-tanah-liat.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "jono-terbakar-lebar/06-jika-dan-hanya-jika",
        title: "jika dan hanya jika",
        dur: 169.0,
        source: {
          kind: "local",
          src: "/music/jono-terbakar-lebar/06-jika-dan-hanya-jika.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "jono-terbakar-lebar/07-mungkin-hanya-cinta-yang-akan-mencintai",
        title: "mungkin hanya cinta yang akan mencintai",
        dur: 249.0,
        source: {
          kind: "local",
          src: "/music/jono-terbakar-lebar/07-mungkin-hanya-cinta-yang-akan-mencintai.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "jono-terbakar-lebar/08-pergantian-siang-ke-malam",
        title: "pergantian siang ke malam",
        dur: 110.0,
        source: {
          kind: "local",
          src: "/music/jono-terbakar-lebar/08-pergantian-siang-ke-malam.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "jono-terbakar-lebar/09-kebun-bunga-matahari",
        title: "kebun bunga matahari",
        dur: 187.0,
        source: {
          kind: "local",
          src: "/music/jono-terbakar-lebar/09-kebun-bunga-matahari.m4a",
          mime: "audio/mp4"
        }
      }
    ],
    license: {
      name: "CC BY 4.0",
      url: "https://creativecommons.org/licenses/by/4.0/",
      source: "https://jonoterbakar.bandcamp.com/album/lebar",
      attribution: "Jono Terbakar — lebar (Sangat Records, 2023). Licenciado sob CC BY 4.0.",
      redistributable: true,
      cover: {
        license: "Não declarada",
        source: "https://jonoterbakar.bandcamp.com/album/lebar"
      },
      verifiedAt: "2026-08-18",
      changes: [
        "Áudio recodificado para AAC 96 kbps (.m4a) para entrega web; sem edição de conteúdo.",
        "Capa recortada em quadrado central e reamostrada para 1024 px WebP."
      ]
    },
    label: "Sangat Records"
  },
  {
    id: "le-morte-dabby-0p",
    provider: "curadoria",
    artist: "Le Morte d'Abby",
    title: "0p",
    year: "2022",
    cat: "H—003",
    cover: "/music/le-morte-dabby-0p/cover.webp",
    inkA: [0.231, 0.443, 0.807],
    inkB: [0.731, 0.296, 0.268],
    tracks: [
      {
        id: "le-morte-dabby-0p/01-0pvi",
        title: "0pVI",
        dur: 283.24,
        source: {
          kind: "local",
          src: "/music/le-morte-dabby-0p/01-0pvi.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "le-morte-dabby-0p/02-0pvii",
        title: "0pVII",
        dur: 304.0,
        source: {
          kind: "local",
          src: "/music/le-morte-dabby-0p/02-0pvii.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "le-morte-dabby-0p/03-0pviii",
        title: "0pVIII",
        dur: 420.0,
        source: {
          kind: "local",
          src: "/music/le-morte-dabby-0p/03-0pviii.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "le-morte-dabby-0p/04-0pix",
        title: "0pIX",
        dur: 384.0,
        source: {
          kind: "local",
          src: "/music/le-morte-dabby-0p/04-0pix.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "le-morte-dabby-0p/05-0px",
        title: "0pX",
        dur: 395.29,
        source: {
          kind: "local",
          src: "/music/le-morte-dabby-0p/05-0px.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "le-morte-dabby-0p/06-0pxi",
        title: "0pXI",
        dur: 580.59,
        source: {
          kind: "local",
          src: "/music/le-morte-dabby-0p/06-0pxi.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "le-morte-dabby-0p/07-0pxii",
        title: "0pXII",
        dur: 344.0,
        source: {
          kind: "local",
          src: "/music/le-morte-dabby-0p/07-0pxii.m4a",
          mime: "audio/mp4"
        }
      }
    ],
    license: {
      name: "CC BY 4.0",
      url: "https://creativecommons.org/licenses/by/4.0/",
      source: "https://lemortedabby.bandcamp.com/album/0p",
      attribution: "Le Morte d'Abby — 0p (Le Morte d'Abby (auto-publicado), 2022). Licenciado sob CC BY 4.0.",
      redistributable: true,
      cover: {
        license: "Não declarada",
        source: "https://lemortedabby.bandcamp.com/album/0p"
      },
      verifiedAt: "2026-08-18",
      changes: [
        "Áudio recodificado para AAC 96 kbps (.m4a) para entrega web; sem edição de conteúdo.",
        "Capa recortada em quadrado central e reamostrada para 1024 px WebP."
      ]
    },
    label: "Le Morte d'Abby (auto-publicado)"
  },
  {
    id: "mark-wilson-x-dark-thoughts",
    provider: "curadoria",
    artist: "Mark Wilson X",
    title: "Dark Thoughts",
    year: "2023",
    cat: "H—004",
    cover: "/music/mark-wilson-x-dark-thoughts/cover.webp",
    inkA: [0.627, 0.252, 0.207],
    inkB: [0.011, 0.465, 0.709],
    tracks: [
      {
        id: "mark-wilson-x-dark-thoughts/01-ritual",
        title: "Ritual",
        dur: 216.96,
        source: {
          kind: "local",
          src: "/music/mark-wilson-x-dark-thoughts/01-ritual.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "mark-wilson-x-dark-thoughts/02-the-stranger",
        title: "The Stranger",
        dur: 208.89,
        source: {
          kind: "local",
          src: "/music/mark-wilson-x-dark-thoughts/02-the-stranger.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "mark-wilson-x-dark-thoughts/03-the-killer-awoke",
        title: "The Killer Awoke",
        dur: 183.96,
        source: {
          kind: "local",
          src: "/music/mark-wilson-x-dark-thoughts/03-the-killer-awoke.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "mark-wilson-x-dark-thoughts/04-terror-drome",
        title: "Terror Drome",
        dur: 173.45,
        source: {
          kind: "local",
          src: "/music/mark-wilson-x-dark-thoughts/04-terror-drome.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "mark-wilson-x-dark-thoughts/05-something-not-right-part-one",
        title: "Something Not Right Part One",
        dur: 131.96,
        source: {
          kind: "local",
          src: "/music/mark-wilson-x-dark-thoughts/05-something-not-right-part-one.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "mark-wilson-x-dark-thoughts/06-something-not-right-part-two",
        title: "Something Not Right Part Two",
        dur: 127.0,
        source: {
          kind: "local",
          src: "/music/mark-wilson-x-dark-thoughts/06-something-not-right-part-two.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "mark-wilson-x-dark-thoughts/07-a-killer-in-me",
        title: "A Killer In Me",
        dur: 249.6,
        source: {
          kind: "local",
          src: "/music/mark-wilson-x-dark-thoughts/07-a-killer-in-me.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "mark-wilson-x-dark-thoughts/08-alienscape",
        title: "Alienscape",
        dur: 214.8,
        source: {
          kind: "local",
          src: "/music/mark-wilson-x-dark-thoughts/08-alienscape.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "mark-wilson-x-dark-thoughts/09-doppler-piano",
        title: "Doppler Piano",
        dur: 113.14,
        source: {
          kind: "local",
          src: "/music/mark-wilson-x-dark-thoughts/09-doppler-piano.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "mark-wilson-x-dark-thoughts/10-ruminations",
        title: "Ruminations",
        dur: 180.0,
        source: {
          kind: "local",
          src: "/music/mark-wilson-x-dark-thoughts/10-ruminations.m4a",
          mime: "audio/mp4"
        }
      }
    ],
    license: {
      name: "CC BY 4.0",
      url: "https://creativecommons.org/licenses/by/4.0/",
      source: "https://freemusicarchive.org/music/mark-wilson-x/dark-thoughts/",
      attribution: "Mark Wilson X — Dark Thoughts (Mark Wilson X (auto-publicado), 2023). Licenciado sob CC BY 4.0.",
      redistributable: true,
      cover: {
        license: "Unsplash License",
        credit: "Foto de Riccardo Pelati (Unsplash)",
        source: "https://markwilsonx.bandcamp.com/album/dark-thoughts-cc-by"
      },
      verifiedAt: "2026-08-18",
      changes: [
        "Áudio recodificado para AAC 96 kbps (.m4a) para entrega web; sem edição de conteúdo.",
        "Capa recortada em quadrado central e reamostrada para 1024 px WebP."
      ]
    },
    label: "Mark Wilson X (auto-publicado)",
    note: "Crédito exigido pelo autor: “[TÍTULO] © 2023 by Mark Wilson X is licensed under CC BY 4.0”."
  },
  {
    id: "darin-wilson-impromptu",
    provider: "curadoria",
    artist: "Darin Wilson",
    title: "Impromptu",
    year: "2012",
    cat: "H—011",
    cover: "/music/darin-wilson-impromptu/cover.webp",
    inkA: [0.667, 0.205, 0.156],
    inkB: [0.098, 0.619, 0.43],
    tracks: [
      {
        id: "darin-wilson-impromptu/01-one-for-bill",
        title: "One For Bill",
        dur: 282.65,
        source: {
          kind: "local",
          src: "/music/darin-wilson-impromptu/01-one-for-bill.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "darin-wilson-impromptu/02-blue-monk",
        title: "Blue Monk",
        dur: 364.07,
        source: {
          kind: "local",
          src: "/music/darin-wilson-impromptu/02-blue-monk.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "darin-wilson-impromptu/03-spring-is-here",
        title: "Spring Is Here",
        dur: 370.04,
        source: {
          kind: "local",
          src: "/music/darin-wilson-impromptu/03-spring-is-here.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "darin-wilson-impromptu/04-solar",
        title: "Solar",
        dur: 278.51,
        source: {
          kind: "local",
          src: "/music/darin-wilson-impromptu/04-solar.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "darin-wilson-impromptu/05-blue-in-green",
        title: "Blue In Green",
        dur: 331.27,
        source: {
          kind: "local",
          src: "/music/darin-wilson-impromptu/05-blue-in-green.m4a",
          mime: "audio/mp4"
        }
      }
    ],
    license: {
      name: "CC BY-SA 4.0",
      url: "https://creativecommons.org/licenses/by-sa/4.0/",
      source: "https://darinwilson.bandcamp.com/album/impromptu",
      attribution: "Darin Wilson — Impromptu (Darin Wilson (auto-publicado), 2012). Licenciado sob CC BY-SA 4.0.",
      redistributable: true,
      cover: {
        license: "Não declarada",
        source: "https://darinwilson.bandcamp.com/album/impromptu"
      },
      verifiedAt: "2026-08-18",
      changes: [
        "Áudio recodificado para AAC 96 kbps (.m4a) para entrega web; sem edição de conteúdo.",
        "Capa recortada em quadrado central e reamostrada para 1024 px WebP."
      ]
    },
    label: "Darin Wilson (auto-publicado)",
    note: "Não é o álbum originalmente aguardado (Meanderings, H—007, ainda pendente): os arquivos fornecidos correspondem a Impromptu, cinco standards de jazz em piano solo. Licença é CC BY-SA 4.0 (Attribution-ShareAlike), não CC BY 4.0 — a obrigação extra de compartilhar a adaptação (o áudio recodificado) sob a mesma BY-SA se aplica a este álbum e é diferente do resto da coleção."
  },
  {
    id: "zero-project-e-world",
    provider: "curadoria",
    artist: "zero-project",
    title: "e-world",
    year: "2011",
    cat: "H—009",
    cover: "/music/zero-project-e-world/cover.webp",
    inkA: [0.079, 0.394, 0.684],
    inkB: [0.459, 0.576, 0.188],
    tracks: [
      {
        id: "zero-project-e-world/01-intro",
        title: "Intro",
        dur: 222.99,
        source: {
          kind: "local",
          src: "/music/zero-project-e-world/01-intro.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "zero-project-e-world/02-echoes",
        title: "Echoes",
        dur: 264.0,
        source: {
          kind: "local",
          src: "/music/zero-project-e-world/02-echoes.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "zero-project-e-world/03-in-the-beginning",
        title: "In the beginning",
        dur: 327.58,
        source: {
          kind: "local",
          src: "/music/zero-project-e-world/03-in-the-beginning.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "zero-project-e-world/04-e-world",
        title: "e-world",
        dur: 238.0,
        source: {
          kind: "local",
          src: "/music/zero-project-e-world/04-e-world.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "zero-project-e-world/05-labyrinth",
        title: "Labyrinth",
        dur: 258.69,
        source: {
          kind: "local",
          src: "/music/zero-project-e-world/05-labyrinth.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "zero-project-e-world/06-psychodrama",
        title: "Psychodrama",
        dur: 137.05,
        source: {
          kind: "local",
          src: "/music/zero-project-e-world/06-psychodrama.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "zero-project-e-world/07-lost-signal",
        title: "Lost signal",
        dur: 309.36,
        source: {
          kind: "local",
          src: "/music/zero-project-e-world/07-lost-signal.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "zero-project-e-world/08-silence",
        title: "Silence",
        dur: 246.03,
        source: {
          kind: "local",
          src: "/music/zero-project-e-world/08-silence.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "zero-project-e-world/09-behind-the-mind",
        title: "Behind the mind",
        dur: 204.03,
        source: {
          kind: "local",
          src: "/music/zero-project-e-world/09-behind-the-mind.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "zero-project-e-world/10-moon-flight",
        title: "Moon flight",
        dur: 341.67,
        source: {
          kind: "local",
          src: "/music/zero-project-e-world/10-moon-flight.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "zero-project-e-world/11-distant-thoughts",
        title: "Distant thoughts",
        dur: 300.03,
        source: {
          kind: "local",
          src: "/music/zero-project-e-world/11-distant-thoughts.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "zero-project-e-world/12-ocean-trip",
        title: "Ocean trip",
        dur: 272.0,
        source: {
          kind: "local",
          src: "/music/zero-project-e-world/12-ocean-trip.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "zero-project-e-world/13-beyond-earth",
        title: "Beyond earth",
        dur: 325.33,
        source: {
          kind: "local",
          src: "/music/zero-project-e-world/13-beyond-earth.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "zero-project-e-world/14-the-journey",
        title: "The journey",
        dur: 493.33,
        source: {
          kind: "local",
          src: "/music/zero-project-e-world/14-the-journey.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "zero-project-e-world/15-inner-voices",
        title: "Inner voices",
        dur: 328.0,
        source: {
          kind: "local",
          src: "/music/zero-project-e-world/15-inner-voices.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "zero-project-e-world/16-a-new-world",
        title: "A new world",
        dur: 226.09,
        source: {
          kind: "local",
          src: "/music/zero-project-e-world/16-a-new-world.m4a",
          mime: "audio/mp4"
        }
      }
    ],
    license: {
      name: "CC BY 4.0",
      url: "https://creativecommons.org/licenses/by/4.0/",
      source: "https://www.zero-project.gr/music/albums/e-world/",
      attribution: "zero-project — e-world (zero-project, 2011). Licenciado sob CC BY 4.0.",
      redistributable: true,
      cover: {
        license: "CC BY 4.0 (mesma da obra)",
        source: "https://www.zero-project.gr/music/albums/e-world/"
      },
      verifiedAt: "2026-08-18",
      changes: [
        "Áudio recodificado para AAC 96 kbps (.m4a) para entrega web; sem edição de conteúdo.",
        "Capa recortada em quadrado central e reamostrada para 1024 px WebP."
      ]
    },
    label: "zero-project"
  },
  {
    id: "tale-twist-wry-way",
    provider: "curadoria",
    artist: "Tale Twist",
    title: "Wry Way",
    year: "2016",
    cat: "H—R01",
    cover: "/music/tale-twist-wry-way/cover.webp",
    inkA: [0.267, 0.365, 0.677],
    inkB: [0.64, 0.231, 0.252],
    tracks: [
      {
        id: "tale-twist-wry-way/01-birds-migration",
        title: "Birds Migration",
        dur: 330.0,
        source: {
          kind: "local",
          src: "/music/tale-twist-wry-way/01-birds-migration.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "tale-twist-wry-way/02-come-on-out",
        title: "Come On Out",
        dur: 281.64,
        source: {
          kind: "local",
          src: "/music/tale-twist-wry-way/02-come-on-out.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "tale-twist-wry-way/03-km-001",
        title: "Km 001",
        dur: 160.0,
        source: {
          kind: "local",
          src: "/music/tale-twist-wry-way/03-km-001.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "tale-twist-wry-way/04-pack-your-bags",
        title: "Pack Your Bags",
        dur: 246.0,
        source: {
          kind: "local",
          src: "/music/tale-twist-wry-way/04-pack-your-bags.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "tale-twist-wry-way/05-pluck-line",
        title: "Pluck Line",
        dur: 272.0,
        source: {
          kind: "local",
          src: "/music/tale-twist-wry-way/05-pluck-line.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "tale-twist-wry-way/06-power-tripless",
        title: "Power tripless",
        dur: 184.0,
        source: {
          kind: "local",
          src: "/music/tale-twist-wry-way/06-power-tripless.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "tale-twist-wry-way/07-road-to-marrocos",
        title: "Road To Marrocos",
        dur: 156.0,
        source: {
          kind: "local",
          src: "/music/tale-twist-wry-way/07-road-to-marrocos.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "tale-twist-wry-way/08-shortcut-to-elijah",
        title: "Shortcut To Elijah",
        dur: 244.67,
        source: {
          kind: "local",
          src: "/music/tale-twist-wry-way/08-shortcut-to-elijah.m4a",
          mime: "audio/mp4"
        }
      }
    ],
    license: {
      name: "CC BY 4.0",
      url: "https://creativecommons.org/licenses/by/4.0/",
      source: "https://archive.org/details/tranz060TaleTwist-WryWay",
      attribution: "Tale Twist — Wry Way (Tranzmitter Netlabel, 2016). Licenciado sob CC BY 4.0.",
      redistributable: true,
      cover: {
        license: "CC BY 4.0 (mesma do item no Internet Archive)",
        source: "https://archive.org/details/tranz060TaleTwist-WryWay"
      },
      verifiedAt: "2026-08-18",
      changes: [
        "Áudio recodificado para AAC 96 kbps (.m4a) para entrega web; sem edição de conteúdo.",
        "Capa recortada em quadrado central e reamostrada para 1024 px WebP."
      ]
    },
    originalCat: "TRANZ060",
    label: "Tranzmitter Netlabel"
  },
  {
    id: "madison-kenny-all-systems-go",
    provider: "curadoria",
    artist: "Madison Kenny",
    title: "All Systems Go",
    year: "2006",
    cat: "H—016",
    cover: "/music/madison-kenny-all-systems-go/cover.webp",
    inkA: [0.745, 0.34, 0.733],
    inkB: [0.529, 0.524, 0.0],
    tracks: [
      {
        id: "madison-kenny-all-systems-go/01-nancy-holiday",
        title: "Nancy Holiday",
        dur: 248.05,
        source: {
          kind: "local",
          src: "/music/madison-kenny-all-systems-go/01-nancy-holiday.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "madison-kenny-all-systems-go/02-the-let-out",
        title: "The Let Out",
        dur: 239.73,
        source: {
          kind: "local",
          src: "/music/madison-kenny-all-systems-go/02-the-let-out.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "madison-kenny-all-systems-go/03-false-disguise-we-re-not-that-bad",
        title: "False Disguise (We're not That Bad)",
        dur: 262.52,
        source: {
          kind: "local",
          src: "/music/madison-kenny-all-systems-go/03-false-disguise-we-re-not-that-bad.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "madison-kenny-all-systems-go/04-all-systems-go",
        title: "All Systems Go",
        dur: 210.59,
        source: {
          kind: "local",
          src: "/music/madison-kenny-all-systems-go/04-all-systems-go.m4a",
          mime: "audio/mp4"
        }
      }
    ],
    license: {
      name: "CC BY 4.0",
      url: "https://creativecommons.org/licenses/by/4.0/",
      source: "https://archive.org/details/MadKen001A",
      attribution: "Madison Kenny — All Systems Go (Madison Kenny (auto-publicado), 2006). Licenciado sob CC BY 4.0.",
      redistributable: true,
      cover: {
        license: "CC BY 4.0 (mesma do item no Internet Archive)",
        source: "https://archive.org/details/MadKen001A"
      },
      verifiedAt: "2026-08-18",
      changes: [
        "Áudio recodificado para AAC 96 kbps (.m4a) para entrega web; sem edição de conteúdo.",
        "Capa recortada em quadrado central e reamostrada para 1024 px WebP."
      ]
    },
    originalCat: "MadKen001A",
    label: "Madison Kenny (auto-publicado)"
  },
  {
    id: "meho-mkultra",
    provider: "curadoria",
    artist: "Meho",
    title: "MKUltra",
    year: "2015",
    cat: "H—R02",
    cover: "/music/meho-mkultra/cover.webp",
    inkA: [0.0, 0.545, 0.316],
    inkB: [0.411, 0.401, 0.777],
    tracks: [
      {
        id: "meho-mkultra/01-hypnosis",
        title: "Hypnosis",
        dur: 342.19,
        source: {
          kind: "local",
          src: "/music/meho-mkultra/01-hypnosis.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "meho-mkultra/02-lsd",
        title: "LSD",
        dur: 720.19,
        source: {
          kind: "local",
          src: "/music/meho-mkultra/02-lsd.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "meho-mkultra/03-mind-control",
        title: "Mind Control",
        dur: 960.19,
        source: {
          kind: "local",
          src: "/music/meho-mkultra/03-mind-control.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "meho-mkultra/04-subproject-119",
        title: "Subproject 119",
        dur: 600.19,
        source: {
          kind: "local",
          src: "/music/meho-mkultra/04-subproject-119.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "meho-mkultra/05-subproject-22",
        title: "Subproject 22",
        dur: 720.19,
        source: {
          kind: "local",
          src: "/music/meho-mkultra/05-subproject-22.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "meho-mkultra/06-subproject-57",
        title: "Subproject 57",
        dur: 600.19,
        source: {
          kind: "local",
          src: "/music/meho-mkultra/06-subproject-57.m4a",
          mime: "audio/mp4"
        }
      }
    ],
    license: {
      name: "CC BY 4.0",
      url: "https://creativecommons.org/licenses/by/4.0/",
      source: "https://archive.org/details/Meho-Mkultracz015",
      attribution: "Meho — MKUltra (Cezanne Records, 2015). Licenciado sob CC BY 4.0.",
      redistributable: true,
      cover: {
        license: "CC BY 4.0 (mesma do item no Internet Archive)",
        source: "https://archive.org/details/Meho-Mkultracz015"
      },
      verifiedAt: "2026-08-18",
      changes: [
        "Áudio recodificado para AAC 96 kbps (.m4a) para entrega web; sem edição de conteúdo.",
        "Capa recortada em quadrado central e reamostrada para 1024 px WebP."
      ]
    },
    originalCat: "cz015",
    label: "Cezanne Records"
  },
  {
    id: "mescaline-sessions-jajce",
    provider: "curadoria",
    artist: "Mescaline Sessions",
    title: "Jajce Sessions",
    year: "2014",
    cat: "H—R03",
    cover: "/music/mescaline-sessions-jajce/cover.webp",
    inkA: [0.738, 0.302, 0.11],
    inkB: [0.0, 0.569, 0.375],
    tracks: [
      {
        id: "mescaline-sessions-jajce/01-session-17",
        title: "Session 17",
        dur: 204.19,
        source: {
          kind: "local",
          src: "/music/mescaline-sessions-jajce/01-session-17.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "mescaline-sessions-jajce/02-session-18",
        title: "Session 18",
        dur: 720.19,
        source: {
          kind: "local",
          src: "/music/mescaline-sessions-jajce/02-session-18.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "mescaline-sessions-jajce/03-session-19",
        title: "Session 19",
        dur: 480.19,
        source: {
          kind: "local",
          src: "/music/mescaline-sessions-jajce/03-session-19.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "mescaline-sessions-jajce/04-session-20",
        title: "Session 20",
        dur: 600.19,
        source: {
          kind: "local",
          src: "/music/mescaline-sessions-jajce/04-session-20.m4a",
          mime: "audio/mp4"
        }
      }
    ],
    license: {
      name: "CC BY 4.0",
      url: "https://creativecommons.org/licenses/by/4.0/",
      source: "https://archive.org/details/Session17-20jajceSessionscz012",
      attribution: "Mescaline Sessions — Jajce Sessions (Cezanne Records, 2014). Licenciado sob CC BY 4.0.",
      redistributable: true,
      cover: {
        license: "CC BY 4.0 (mesma do item no Internet Archive)",
        source: "https://archive.org/details/Session17-20jajceSessionscz012"
      },
      verifiedAt: "2026-08-18",
      changes: [
        "Áudio recodificado para AAC 96 kbps (.m4a) para entrega web; sem edição de conteúdo.",
        "Capa recortada em quadrado central e reamostrada para 1024 px WebP."
      ]
    },
    originalCat: "cz012",
    label: "Cezanne Records"
  },
];

export const BLOCKED: BlockedAlbum[] = [
  {
    cat: "H—005",
    artist: "WIDDER",
    title: "shadows of WIDDER",
    source: "https://widder-music.bandcamp.com/album/shadows-of-widder",
    reason: "Licença contraditória na própria página: o selo Creative Commons aponta para by-sa/4.0 enquanto o texto afirma “Attribution 4.0 International”. BY-SA e BY impõem obrigações diferentes; escolher uma seria presumir. Precisa de confirmação do artista.",
    verifiedAt: "2026-08-18"
  },
  {
    cat: "H—006",
    artist: "Noctilia Grah",
    title: "Background Music For Video Essays About Video Games",
    source: "https://noctiliagrah.bandcamp.com/",
    reason: "Sem licença Creative Commons verificável. O subdomínio noctiliagrah.bandcamp.com não existe (o Bandcamp o oferece para cadastro). A única declaração encontrada é um termo próprio, “free to use in noncommercial works, with credit”, que não é CC e é incompatível com hospedar o arquivo num projeto potencialmente comercial.",
    verifiedAt: "2026-08-18"
  },
  {
    cat: "H—014",
    artist: "ApophysiA",
    title: "From The Universe To The Past",
    source: "https://apophysia.bandcamp.com/album/from-the-universe-to-the-past",
    reason: "Licença contraditória na própria página, mesmo padrão que já excluiu WIDDER: o selo estruturado do Bandcamp aponta para creativecommons.org/licenses/by-nc-nd/4.0 (NonCommercial-NoDerivatives) enquanto o texto do artista afirma “is licensed under a Creative Commons Attribution 4.0 International License” (CC BY puro, sem NC nem ND). Duas licenças incompatíveis declaradas no mesmo lançamento; escolher uma seria presumir. Verificado a pedido do usuário como possível substituto; rejeitado antes de qualquer download.",
    verifiedAt: "2026-08-18"
  },
  {
    cat: "H—015",
    artist: "ApophysiA",
    title: "Compilations and other Stories",
    source: "https://apophysia.bandcamp.com/album/compilations-and-other-stories",
    reason: "CC BY-NC-ND 4.0 — selo estruturado do Bandcamp, sem nenhuma declaração textual do artista que a contradiga ou abrande (ao contrário de From The Universe To The Past, H—014, que ao menos tinha um texto conflitante). NoDerivatives proíbe a recodificação que este projeto sempre faz; NonCommercial é uma segunda restrição incompatível. Verificado a pedido do usuário como possível substituto; rejeitado antes de qualquer download.",
    verifiedAt: "2026-08-18"
  },
  {
    cat: "H—013",
    artist: "Stellardrone",
    title: "On A Beam Of Light",
    source: "https://archive.org/details/OnABeamOfLight",
    reason: "Licença confirmada em archive.org (mirror com metadados estruturados do lançamento original no Jamendo): CC BY-NC-ND 3.0. A cláusula NoDerivatives proíbe a adaptação que este projeto sempre faz (recodificar para AAC) — mesmo motivo que já havia excluído tranz023Holocaos. NonCommercial adiciona uma segunda restrição incompatível com um projeto que pode vir a ser comercial. Verificado a pedido do usuário como possível substituto; rejeitado pela mesma regra aplicada a todo o resto da curadoria.",
    verifiedAt: "2026-08-18"
  },
  {
    cat: "H—008",
    artist: "Ivan Duch",
    title: "Sand",
    source: "https://ivanduch.com/albums/sand/",
    reason: "Não é CC BY. É um pack comercial de US$ 4,00 sob “licença não-exclusiva que exige atribuição” — termo proprietário do autor, sem permissão de redistribuição. A biblioteca CC BY 4.0 do Ivan Duch existe, mas Sand não faz parte dela.",
    verifiedAt: "2026-08-18"
  },
];
