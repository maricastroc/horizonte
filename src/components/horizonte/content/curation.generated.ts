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
    inkA: [0.562, 0.337, 0.721],
    inkB: [0.701, 0.474, 0.0],
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
    id: "meho-mkultra",
    provider: "curadoria",
    artist: "Meho",
    title: "MKUltra",
    year: "2015",
    cat: "H—R02",
    cover: "/music/meho-mkultra/cover.webp",
    inkA: [0.552, 0.531, 0.0],
    inkB: [0.0, 0.5, 0.736],
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
    inkA: [0.0, 0.48, 0.751],
    inkB: [0.724, 0.287, 0.376],
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
    cat: "H—008",
    artist: "Ivan Duch",
    title: "Sand",
    source: "https://ivanduch.com/albums/sand/",
    reason: "Não é CC BY. É um pack comercial de US$ 4,00 sob “licença não-exclusiva que exige atribuição” — termo proprietário do autor, sem permissão de redistribuição. A biblioteca CC BY 4.0 do Ivan Duch existe, mas Sand não faz parte dela.",
    verifiedAt: "2026-08-18"
  },
];
