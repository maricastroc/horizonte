import type { Album } from "./types";

export interface CuratedAlbum extends Album {
  originalCat: string;
  label: string;
}

export const CURATION: CuratedAlbum[] = [
  {
    id: "tale-twist-wry-way",
    provider: "curadoria",
    artist: "Tale Twist",
    title: "Wry Way",
    year: "2016",
    cat: "H—001",
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
        dur: 281.0,
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
        dur: 244.0,
        source: {
          kind: "local",
          src: "/music/tale-twist-wry-way/08-shortcut-to-elijah.m4a",
          mime: "audio/mp4"
        }
      }
    ],
    license: {
      name: "CC BY 4.0",
      url: "http://creativecommons.org/licenses/by/4.0/",
      source: "https://archive.org/details/tranz060TaleTwist-WryWay",
      attribution: "Tale Twist — Wry Way (Tranzmitter Netlabel, 2016). Licenciado sob CC BY 4.0. Áudio recodificado para entrega web.",
      redistributable: true
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
    cat: "H—002",
    cover: "/music/meho-mkultra/cover.webp",
    inkA: [0.0, 0.62, 0.448],
    inkB: [0.501, 0.368, 0.742],
    tracks: [
      {
        id: "meho-mkultra/01-hypnosis",
        title: "Hypnosis",
        dur: 342.0,
        source: {
          kind: "local",
          src: "/music/meho-mkultra/01-hypnosis.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "meho-mkultra/02-lsd",
        title: "LSD",
        dur: 720.0,
        source: {
          kind: "local",
          src: "/music/meho-mkultra/02-lsd.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "meho-mkultra/03-mind-control",
        title: "Mind Control",
        dur: 960.0,
        source: {
          kind: "local",
          src: "/music/meho-mkultra/03-mind-control.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "meho-mkultra/04-subproject-119",
        title: "Subproject 119",
        dur: 600.0,
        source: {
          kind: "local",
          src: "/music/meho-mkultra/04-subproject-119.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "meho-mkultra/05-subproject-22",
        title: "Subproject 22",
        dur: 720.0,
        source: {
          kind: "local",
          src: "/music/meho-mkultra/05-subproject-22.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "meho-mkultra/06-subproject-57",
        title: "Subproject 57",
        dur: 600.0,
        source: {
          kind: "local",
          src: "/music/meho-mkultra/06-subproject-57.m4a",
          mime: "audio/mp4"
        }
      }
    ],
    license: {
      name: "CC BY 4.0",
      url: "http://creativecommons.org/licenses/by/4.0/",
      source: "https://archive.org/details/Meho-Mkultracz015",
      attribution: "Meho — MKUltra (Cezanne Records, 2015). Licenciado sob CC BY 4.0. Áudio recodificado para entrega web.",
      redistributable: true
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
    cat: "H—003",
    cover: "/music/mescaline-sessions-jajce/cover.webp",
    inkA: [0.562, 0.337, 0.721],
    inkB: [0.701, 0.474, 0.0],
    tracks: [
      {
        id: "mescaline-sessions-jajce/01-session-17",
        title: "Session 17",
        dur: 204.0,
        source: {
          kind: "local",
          src: "/music/mescaline-sessions-jajce/01-session-17.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "mescaline-sessions-jajce/02-session-18",
        title: "Session 18",
        dur: 720.0,
        source: {
          kind: "local",
          src: "/music/mescaline-sessions-jajce/02-session-18.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "mescaline-sessions-jajce/03-session-19",
        title: "Session 19",
        dur: 480.0,
        source: {
          kind: "local",
          src: "/music/mescaline-sessions-jajce/03-session-19.m4a",
          mime: "audio/mp4"
        }
      },
      {
        id: "mescaline-sessions-jajce/04-session-20",
        title: "Session 20",
        dur: 600.0,
        source: {
          kind: "local",
          src: "/music/mescaline-sessions-jajce/04-session-20.m4a",
          mime: "audio/mp4"
        }
      }
    ],
    license: {
      name: "CC BY 4.0",
      url: "http://creativecommons.org/licenses/by/4.0/",
      source: "https://archive.org/details/Session17-20jajceSessionscz012",
      attribution: "Mescaline Sessions — Jajce Sessions (Cezanne Records, 2014). Licenciado sob CC BY 4.0. Áudio recodificado para entrega web.",
      redistributable: true
    },
    originalCat: "cz012",
    label: "Cezanne Records"
  },
];
