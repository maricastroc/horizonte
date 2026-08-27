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
    id: "dust-time-gravity",
    provider: "curated",
    artist: "The Ghost of an Alien",
    title: "Dust. Time.. Gravity",
    year: "2016",
    cat: "H—017",
    cover: "/music/dust-time-gravity/cover.webp",
    inkA: [0.321, 0.471, 0.082],
    inkB: [0.3, 0.532, 0.826],
    tracks: [
      {
        id: "dust-time-gravity/01-deep-within-the-shadows",
        title: "Deep Within The Shadows",
        dur: 351.15,
        source: {
          kind: "local",
          src: "/music/dust-time-gravity/01-deep-within-the-shadows.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "dust-time-gravity/02-thy-kingdom-of-au",
        title: "Thy Kingdom Of Au",
        dur: 440.0,
        source: {
          kind: "local",
          src: "/music/dust-time-gravity/02-thy-kingdom-of-au.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "dust-time-gravity/03-dust-time-gravity",
        title: "Dust Time Gravity",
        dur: 323.35,
        source: {
          kind: "local",
          src: "/music/dust-time-gravity/03-dust-time-gravity.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "dust-time-gravity/04-polar-distance-displaced",
        title: "Polar Distance Displaced",
        dur: 518.83,
        source: {
          kind: "local",
          src: "/music/dust-time-gravity/04-polar-distance-displaced.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "dust-time-gravity/05-space-junk-in-the-trunk",
        title: "Space Junk In The Trunk",
        dur: 840.0,
        source: {
          kind: "local",
          src: "/music/dust-time-gravity/05-space-junk-in-the-trunk.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "dust-time-gravity/06-always-looking-up",
        title: "Always Looking Up",
        dur: 554.67,
        source: {
          kind: "local",
          src: "/music/dust-time-gravity/06-always-looking-up.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "dust-time-gravity/07-drifting-further-and-further",
        title: "Drifting Further And Further",
        dur: 609.98,
        source: {
          kind: "local",
          src: "/music/dust-time-gravity/07-drifting-further-and-further.m4a",
          mime: "audio/mp4"
        }
      }
    ],
    license: {
      name: "CC BY 4.0",
      url: "https://creativecommons.org/licenses/by/4.0/",
      source: "https://archive.org/details/Dust-Time-Gravity",
      attribution: "The Ghost of an Alien — Dust. Time.. Gravity (The Ghost of an Alien (self-released), 2016). Licensed under CC BY 4.0.",
      redistributable: true,
      cover: {
        license: "CC BY 4.0 (same as the Internet Archive item)",
        source: "https://archive.org/details/Dust-Time-Gravity"
      },
      verifiedAt: "2026-08-27",
      changes: [
        "Audio re-encoded to AAC 96 kbps (.m4a) for web delivery; no content editing.",
        "Cover cropped to a centre square and resampled to 1024 px WebP."
      ]
    },
    label: "The Ghost of an Alien (self-released)"
  },
  {
    id: "tristan-lohengrin-le-manoir",
    provider: "curated",
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
      attribution: "Tristan Lohengrin — Le Manoir (Tristan Lohengrin (self-released), 2019). Licensed under CC BY 4.0.",
      redistributable: true,
      cover: {
        license: "Not declared by the author",
        credit: "Art by David Harrington",
        source: "https://tristanlohengrin.bandcamp.com/album/le-manoir-album-cc-by-40"
      },
      verifiedAt: "2026-08-18",
      changes: [
        "Audio re-encoded to AAC 96 kbps (.m4a) for web delivery; no content editing.",
        "Cover cropped to a centre square and resampled to 1024 px WebP."
      ]
    },
    label: "Tristan Lohengrin (self-released)",
    note: "The author adds an extra term: registering in Content ID is forbidden."
  },
  {
    id: "jono-terbakar-lebar",
    provider: "curated",
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
      attribution: "Jono Terbakar — lebar (Sangat Records, 2023). Licensed under CC BY 4.0.",
      redistributable: true,
      cover: {
        license: "Not declared",
        source: "https://jonoterbakar.bandcamp.com/album/lebar"
      },
      verifiedAt: "2026-08-18",
      changes: [
        "Audio re-encoded to AAC 96 kbps (.m4a) for web delivery; no content editing.",
        "Cover cropped to a centre square and resampled to 1024 px WebP."
      ]
    },
    label: "Sangat Records"
  },
  {
    id: "le-morte-dabby-0p",
    provider: "curated",
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
      attribution: "Le Morte d'Abby — 0p (Le Morte d'Abby (self-released), 2022). Licensed under CC BY 4.0.",
      redistributable: true,
      cover: {
        license: "Not declared",
        source: "https://lemortedabby.bandcamp.com/album/0p"
      },
      verifiedAt: "2026-08-18",
      changes: [
        "Audio re-encoded to AAC 96 kbps (.m4a) for web delivery; no content editing.",
        "Cover cropped to a centre square and resampled to 1024 px WebP."
      ]
    },
    label: "Le Morte d'Abby (self-released)"
  },
  {
    id: "mark-wilson-x-dark-thoughts",
    provider: "curated",
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
      attribution: "Mark Wilson X — Dark Thoughts (Mark Wilson X (self-released), 2023). Licensed under CC BY 4.0.",
      redistributable: true,
      cover: {
        license: "Unsplash License",
        credit: "Photo by Riccardo Pelati (Unsplash)",
        source: "https://markwilsonx.bandcamp.com/album/dark-thoughts-cc-by"
      },
      verifiedAt: "2026-08-18",
      changes: [
        "Audio re-encoded to AAC 96 kbps (.m4a) for web delivery; no content editing.",
        "Cover cropped to a centre square and resampled to 1024 px WebP."
      ]
    },
    label: "Mark Wilson X (self-released)",
    note: "Credit required by the author: “[TITLE] © 2023 by Mark Wilson X is licensed under CC BY 4.0”."
  },
  {
    id: "darin-wilson-impromptu",
    provider: "curated",
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
      attribution: "Darin Wilson — Impromptu (Darin Wilson (self-released), 2012). Licensed under CC BY-SA 4.0.",
      redistributable: true,
      cover: {
        license: "Not declared",
        source: "https://darinwilson.bandcamp.com/album/impromptu"
      },
      verifiedAt: "2026-08-18",
      changes: [
        "Audio re-encoded to AAC 96 kbps (.m4a) for web delivery; no content editing.",
        "Cover cropped to a centre square and resampled to 1024 px WebP."
      ]
    },
    label: "Darin Wilson (self-released)",
    note: "Not the album originally expected (Meanderings, H—007, still pending): the files provided correspond to Impromptu, five jazz standards on solo piano. The licence is CC BY-SA 4.0 (Attribution-ShareAlike), not CC BY 4.0 — the extra obligation to share the adaptation (the re-encoded audio) under the same BY-SA applies to this album and differs from the rest of the collection."
  },
  {
    id: "zero-project-e-world",
    provider: "curated",
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
      attribution: "zero-project — e-world (zero-project, 2011). Licensed under CC BY 4.0.",
      redistributable: true,
      cover: {
        license: "CC BY 4.0 (mesma da obra)",
        source: "https://www.zero-project.gr/music/albums/e-world/"
      },
      verifiedAt: "2026-08-18",
      changes: [
        "Audio re-encoded to AAC 96 kbps (.m4a) for web delivery; no content editing.",
        "Cover cropped to a centre square and resampled to 1024 px WebP."
      ]
    },
    label: "zero-project"
  },
  {
    id: "tale-twist-wry-way",
    provider: "curated",
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
      attribution: "Tale Twist — Wry Way (Tranzmitter Netlabel, 2016). Licensed under CC BY 4.0.",
      redistributable: true,
      cover: {
        license: "CC BY 4.0 (mesma do item no Internet Archive)",
        source: "https://archive.org/details/tranz060TaleTwist-WryWay"
      },
      verifiedAt: "2026-08-18",
      changes: [
        "Audio re-encoded to AAC 96 kbps (.m4a) for web delivery; no content editing.",
        "Cover cropped to a centre square and resampled to 1024 px WebP."
      ]
    },
    originalCat: "TRANZ060",
    label: "Tranzmitter Netlabel"
  },
  {
    id: "madison-kenny-all-systems-go",
    provider: "curated",
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
      attribution: "Madison Kenny — All Systems Go (Madison Kenny (self-released), 2006). Licensed under CC BY 4.0.",
      redistributable: true,
      cover: {
        license: "CC BY 4.0 (mesma do item no Internet Archive)",
        source: "https://archive.org/details/MadKen001A"
      },
      verifiedAt: "2026-08-18",
      changes: [
        "Audio re-encoded to AAC 96 kbps (.m4a) for web delivery; no content editing.",
        "Cover cropped to a centre square and resampled to 1024 px WebP."
      ]
    },
    originalCat: "MadKen001A",
    label: "Madison Kenny (self-released)"
  },
  {
    id: "meho-mkultra",
    provider: "curated",
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
      attribution: "Meho — MKUltra (Cezanne Records, 2015). Licensed under CC BY 4.0.",
      redistributable: true,
      cover: {
        license: "CC BY 4.0 (mesma do item no Internet Archive)",
        source: "https://archive.org/details/Meho-Mkultracz015"
      },
      verifiedAt: "2026-08-18",
      changes: [
        "Audio re-encoded to AAC 96 kbps (.m4a) for web delivery; no content editing.",
        "Cover cropped to a centre square and resampled to 1024 px WebP."
      ]
    },
    originalCat: "cz015",
    label: "Cezanne Records"
  },
  {
    id: "mescaline-sessions-jajce",
    provider: "curated",
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
      attribution: "Mescaline Sessions — Jajce Sessions (Cezanne Records, 2014). Licensed under CC BY 4.0.",
      redistributable: true,
      cover: {
        license: "CC BY 4.0 (mesma do item no Internet Archive)",
        source: "https://archive.org/details/Session17-20jajceSessionscz012"
      },
      verifiedAt: "2026-08-18",
      changes: [
        "Audio re-encoded to AAC 96 kbps (.m4a) for web delivery; no content editing.",
        "Cover cropped to a centre square and resampled to 1024 px WebP."
      ]
    },
    originalCat: "cz012",
    label: "Cezanne Records"
  },
  {
    id: "smert-v-letnjuju-polnoch-chajka",
    provider: "curated",
    artist: "смерть в летнюю полночь",
    title: "где же твои крылья, Чайка",
    year: "2015",
    cat: "H—018",
    cover: "/music/smert-v-letnjuju-polnoch-chajka/cover.webp",
    inkA: [0.289, 0.529, 0.069],
    inkB: [0.25, 0.446, 0.785],
    tracks: [
      {
        id: "smert-v-letnjuju-polnoch-chajka/01-kogda-zhe-eto-bylo-chajka",
        title: "когда же это было, Чайка",
        dur: 432.7,
        source: {
          kind: "local",
          src: "/music/smert-v-letnjuju-polnoch-chajka/01-kogda-zhe-eto-bylo-chajka.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "smert-v-letnjuju-polnoch-chajka/02-po-kom-stuchit-tvoe-serdce-chajka",
        title: "по ком стучит твоё сердце, Чайка",
        dur: 293.14,
        source: {
          kind: "local",
          src: "/music/smert-v-letnjuju-polnoch-chajka/02-po-kom-stuchit-tvoe-serdce-chajka.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "smert-v-letnjuju-polnoch-chajka/03-gde-zhe-tvoi-krylja-chajka",
        title: "где же твои крылья, Чайка",
        dur: 316.3,
        source: {
          kind: "local",
          src: "/music/smert-v-letnjuju-polnoch-chajka/03-gde-zhe-tvoi-krylja-chajka.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "smert-v-letnjuju-polnoch-chajka/04-chto-v-temnote-tvoih-glaz-chajka",
        title: "что в темноте твоих глаз, Чайка",
        dur: 392.26,
        source: {
          kind: "local",
          src: "/music/smert-v-letnjuju-polnoch-chajka/04-chto-v-temnote-tvoih-glaz-chajka.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "smert-v-letnjuju-polnoch-chajka/05-otchego-tvoja-dusha-bolit-chajka",
        title: "отчего твоя душа болит, Чайка",
        dur: 284.41,
        source: {
          kind: "local",
          src: "/music/smert-v-letnjuju-polnoch-chajka/05-otchego-tvoja-dusha-bolit-chajka.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "smert-v-letnjuju-polnoch-chajka/06-pochemu-nashi-puti-razoshlis-chajka",
        title: "почему наши пути разошлись, Чайка",
        dur: 374.01,
        source: {
          kind: "local",
          src: "/music/smert-v-letnjuju-polnoch-chajka/06-pochemu-nashi-puti-razoshlis-chajka.m4a",
          mime: "audio/mp4"
        }
      }
    ],
    license: {
      name: "CC BY 4.0",
      url: "https://creativecommons.org/licenses/by/4.0/",
      source: "https://archive.org/details/SCL174",
      attribution: "смерть в летнюю полночь — где же твои крылья, Чайка (Southern City's Lab, 2015). Licensed under CC BY 4.0.",
      redistributable: true,
      cover: {
        license: "CC BY 4.0 (same as the Internet Archive item)",
        source: "https://archive.org/details/SCL174"
      },
      verifiedAt: "2026-08-27",
      changes: [
        "Audio re-encoded to AAC 96 kbps (.m4a) for web delivery; no content editing.",
        "Cover cropped to a centre square and resampled to 1024 px WebP."
      ]
    },
    originalCat: "SCL174",
    label: "Southern City's Lab",
    note: "Six tracks, all from the verified CC BY 4.0 item. A seventh bonus track circulating elsewhere was deliberately left out: it is not part of that item and its licence could not be confirmed at the source."
  },
  {
    id: "grove-of-whispers-the-sheltering-sky",
    provider: "curated",
    artist: "Grove of Whispers",
    title: "The Sheltering Sky",
    year: "2014",
    cat: "H—019",
    cover: "/music/grove-of-whispers-the-sheltering-sky/cover.webp",
    inkA: [0.697, 0.446, 0.009],
    inkB: [0.012, 0.527, 0.756],
    tracks: [
      {
        id: "grove-of-whispers-the-sheltering-sky/01-light-and-shadow",
        title: "Light and Shadow",
        dur: 505.87,
        source: {
          kind: "local",
          src: "/music/grove-of-whispers-the-sheltering-sky/01-light-and-shadow.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "grove-of-whispers-the-sheltering-sky/02-black-star",
        title: "Black Star",
        dur: 730.62,
        source: {
          kind: "local",
          src: "/music/grove-of-whispers-the-sheltering-sky/02-black-star.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "grove-of-whispers-the-sheltering-sky/03-mimouna",
        title: "Mimouna",
        dur: 1901.36,
        source: {
          kind: "local",
          src: "/music/grove-of-whispers-the-sheltering-sky/03-mimouna.m4a",
          mime: "audio/mp4"
        }
      }
    ],
    license: {
      name: "CC BY 4.0",
      url: "https://creativecommons.org/licenses/by/4.0/",
      source: "https://archive.org/details/bof060",
      attribution: "Grove of Whispers — The Sheltering Sky (Buddhist On Fire, 2014). Licensed under CC BY 4.0.",
      redistributable: true,
      cover: {
        license: "CC BY 4.0 (same as the Internet Archive item)",
        source: "https://archive.org/details/bof060"
      },
      verifiedAt: "2026-08-27",
      changes: [
        "Audio re-encoded to AAC 96 kbps (.m4a) for web delivery; no content editing.",
        "Cover cropped to a centre square and resampled to 1024 px WebP."
      ]
    },
    originalCat: "bof060",
    label: "Buddhist On Fire"
  },
  {
    id: "awake-in-the-dew-sounds-to-ascension",
    provider: "curated",
    artist: "Awake In The Dew",
    title: "Sounds To Ascension",
    year: "2018",
    cat: "H—020",
    cover: "/music/awake-in-the-dew-sounds-to-ascension/cover.webp",
    inkA: [0.344, 0.333, 0.695],
    inkB: [0.707, 0.47, 0.028],
    tracks: [
      {
        id: "awake-in-the-dew-sounds-to-ascension/01-fractal",
        title: "Fractal",
        dur: 292.82,
        source: {
          kind: "local",
          src: "/music/awake-in-the-dew-sounds-to-ascension/01-fractal.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "awake-in-the-dew-sounds-to-ascension/02-waves-of-cosmic-fire",
        title: "Waves Of Cosmic Fire",
        dur: 295.68,
        source: {
          kind: "local",
          src: "/music/awake-in-the-dew-sounds-to-ascension/02-waves-of-cosmic-fire.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "awake-in-the-dew-sounds-to-ascension/03-the-light-hope",
        title: "The Light Hope",
        dur: 375.51,
        source: {
          kind: "local",
          src: "/music/awake-in-the-dew-sounds-to-ascension/03-the-light-hope.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "awake-in-the-dew-sounds-to-ascension/04-infinite-ways-to-fly",
        title: "Infinite Ways To Fly",
        dur: 236.14,
        source: {
          kind: "local",
          src: "/music/awake-in-the-dew-sounds-to-ascension/04-infinite-ways-to-fly.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "awake-in-the-dew-sounds-to-ascension/05-burning-the-violet-flame",
        title: "Burning The Violet Flame",
        dur: 342.48,
        source: {
          kind: "local",
          src: "/music/awake-in-the-dew-sounds-to-ascension/05-burning-the-violet-flame.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "awake-in-the-dew-sounds-to-ascension/06-light-in-the-shadows",
        title: "Light In The Shadows",
        dur: 328.02,
        source: {
          kind: "local",
          src: "/music/awake-in-the-dew-sounds-to-ascension/06-light-in-the-shadows.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "awake-in-the-dew-sounds-to-ascension/07-children-of-the-sun",
        title: "Children Of The Sun",
        dur: 324.01,
        source: {
          kind: "local",
          src: "/music/awake-in-the-dew-sounds-to-ascension/07-children-of-the-sun.m4a",
          mime: "audio/mp4"
        }
      }
    ],
    license: {
      name: "CC BY-SA 4.0",
      url: "https://creativecommons.org/licenses/by-sa/4.0/",
      source: "https://archive.org/details/tranz068AwakeInTheDew-SoundsToAscension",
      attribution: "Awake In The Dew — Sounds To Ascension (Tranzmitter Netlabel, 2018). Licensed under CC BY-SA 4.0.",
      redistributable: true,
      cover: {
        license: "CC BY-SA 4.0 (same as the Internet Archive item)",
        source: "https://archive.org/details/tranz068AwakeInTheDew-SoundsToAscension"
      },
      verifiedAt: "2026-08-27",
      changes: [
        "Audio re-encoded to AAC 96 kbps (.m4a) for web delivery; no content editing.",
        "Cover cropped to a centre square and resampled to 1024 px WebP."
      ]
    },
    originalCat: "TRANZ068",
    label: "Tranzmitter Netlabel",
    note: "The licence is CC BY-SA 4.0 (Attribution-ShareAlike), not CC BY 4.0 — the extra obligation to share the adaptation (the re-encoded audio) under the same BY-SA applies to this album, as it does to Darin Wilson's Impromptu."
  },
];

export const BLOCKED: BlockedAlbum[] = [
  {
    cat: "H—005",
    artist: "WIDDER",
    title: "shadows of WIDDER",
    source: "https://widder-music.bandcamp.com/album/shadows-of-widder",
    reason: "Contradictory licence on the page itself: the Creative Commons badge points to by-sa/4.0 while the text states “Attribution 4.0 International”. BY-SA and BY impose different obligations; picking one would be presuming. Needs confirmation from the artist.",
    verifiedAt: "2026-08-18"
  },
  {
    cat: "H—006",
    artist: "Noctilia Grah",
    title: "Background Music For Video Essays About Video Games",
    source: "https://noctiliagrah.bandcamp.com/",
    reason: "No verifiable Creative Commons licence. The subdomain noctiliagrah.bandcamp.com does not exist (Bandcamp offers it for registration). The only statement found is a bespoke term, “free to use in noncommercial works, with credit”, which is not CC and is incompatible with hosting the file in a potentially commercial project.",
    verifiedAt: "2026-08-18"
  },
  {
    cat: "H—014",
    artist: "ApophysiA",
    title: "From The Universe To The Past",
    source: "https://apophysia.bandcamp.com/album/from-the-universe-to-the-past",
    reason: "Contradictory licence on the page itself, the same pattern that already excluded WIDDER: Bandcamp's structured badge points to creativecommons.org/licenses/by-nc-nd/4.0 (NonCommercial-NoDerivatives) while the artist's text states “is licensed under a Creative Commons Attribution 4.0 International License” (plain CC BY, no NC, no ND). Two incompatible licences declared on the same release; picking one would be presuming. Checked at the user's request as a possible replacement; rejected before any download.",
    verifiedAt: "2026-08-18"
  },
  {
    cat: "H—015",
    artist: "ApophysiA",
    title: "Compilations and other Stories",
    source: "https://apophysia.bandcamp.com/album/compilations-and-other-stories",
    reason: "CC BY-NC-ND 4.0 — Bandcamp's structured badge, with no textual statement from the artist contradicting or softening it (unlike From The Universe To The Past, H—014, which at least had conflicting text). NoDerivatives forbids the re-encoding this project always performs; NonCommercial is a second incompatible restriction. Checked at the user's request as a possible replacement; rejected before any download.",
    verifiedAt: "2026-08-18"
  },
  {
    cat: "H—013",
    artist: "Stellardrone",
    title: "On A Beam Of Light",
    source: "https://archive.org/details/OnABeamOfLight",
    reason: "Licence confirmed on archive.org (a mirror carrying structured metadata from the original Jamendo release): CC BY-NC-ND 3.0. The NoDerivatives clause forbids the adaptation this project always performs (re-encoding to AAC) — the same reason that already excluded tranz023Holocaos. NonCommercial adds a second restriction incompatible with a project that may become commercial. Checked at the user's request as a possible replacement; rejected under the same rule applied to the rest of the curation.",
    verifiedAt: "2026-08-18"
  },
  {
    cat: "H—008",
    artist: "Ivan Duch",
    title: "Sand",
    source: "https://ivanduch.com/albums/sand/",
    reason: "Not CC BY. It is a commercial US$ 4.00 pack under a “non-exclusive licence requiring attribution” — the author's own proprietary term, with no redistribution permission. Ivan Duch's CC BY 4.0 library does exist, but Sand is not part of it.",
    verifiedAt: "2026-08-18"
  },
];
