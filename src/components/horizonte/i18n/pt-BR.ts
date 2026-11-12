import type { Album } from "../content";
import { ANATOMY_PT } from "./anatomy.pt-BR";
import type { Copy } from "./types";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const LOCAL = {
  artist: "Álbum local",
  title: "Sem título",
  license: "Arquivo local",
  attribution: "Um arquivo do seu aparelho. Nada foi enviado a nenhum servidor.",
};

const SELF_RELEASED = /\s*\(self-released\)$/;

function attribution(album: Album): string {
  const label = (album.label ?? album.artist).replace(SELF_RELEASED, " (edição independente)");
  const year = album.year ? `, ${album.year}` : "";
  return `${album.artist} — ${album.title} (${label}${year}). Licenciado sob ${album.license.name}.`;
}

export const PT_BR: Copy = {
  locale: "pt-BR",
  language: {
    label: "Idioma",
    short: { en: "EN", "pt-BR": "PT" },
    name: { en: "English", "pt-BR": "Português (Brasil)" },
  },
  title: "Horizonte",
  scale: { collection: "Coleção", album: "Álbum", track: "Faixa" },
  scaleNav: "Escala",
  albumsNav: "Álbuns",
  albumsOpen: "Álbuns",
  albumsClose: "Fechar",
  albumCount: (n) => plural(n, "álbum", "álbuns"),
  trackCount: (n) => plural(n, "faixa", "faixas"),
  tracksOf: (title) => `Faixas de ${title}`,
  collectionAt: (at, of) => `Coleção · ${at}/${of}`,
  intake: { idle: "Trazer um disco", dragging: "Solte para medir" },
  transport: {
    previous: "◂◂ Anterior",
    play: "▸ Tocar",
    pause: "❙❙ Pausar",
    resume: "▸ Retomar",
    next: "Próxima ▸▸",
    back: "◂ Voltar",
  },
  sound: { on: "Som", muted: "Mudo", volume: "Volume" },
  seek: {
    label: "Posição na faixa",
    value: (position, duration) => `${position} de ${duration}`,
  },
  hint: { drag: "Arraste para explorar", swipe: "Deslize para explorar" },
  fault: {
    source: "Não foi possível carregar esta faixa.",
    blocked: "O navegador bloqueou o som — tente de novo.",
  },
  announce: {
    collection: (n) => `Coleção · ${plural(n, "corpo", "corpos")}`,
    track: (number, title, artist) => `${number} · ${title} — ${artist}`,
  },
  canvas: { tracks: (n) => plural(n, "FAIXA", "FAIXAS") },
  ceremony: {
    phase: {
      reading: "abrindo o disco",
      decoding: "medindo o disco",
      measuring: "medindo o disco",
      composing: "traçando o horizonte",
      done: "o disco chegou",
      failed: "não foi possível medi-lo",
      cancelled: "medição interrompida",
    },
    readings: {
      loudness: { label: "o peso", words: ["leve", "denso", "pesado"] },
      dynamics: { label: "a dinâmica", words: ["comprimida", "arejada", "aberta"] },
      brightness: { label: "a luz", words: ["escura", "quente", "cortante"] },
      duration: { label: "a travessia", words: ["curta", "longa", "vasta"] },
    },
    private: "Nada sai deste aparelho.",
    stop: "Parar",
    error: (e) => {
      switch (e.kind) {
        case "unsupported":
          return `Este navegador não lê esses arquivos. Ele lê: ${e.formats.join(", ")}.`;
        case "empty":
          return "Nenhum arquivo de áudio reconhecido.";
        case "unreadable":
          return `Não foi possível ler “${e.file}”.`;
        case "tooLarge":
          return `“${e.file}” é grande demais para medir (${e.mb} MB).`;
        case "tooLong":
          return `“${e.file}” é longo demais para medir (${e.minutes} min).`;
        case "recordTooLong":
          return "Este disco é longo demais para medir de uma vez só.";
        case "failed":
          return "Algo deu errado ao medir este disco.";
      }
    },
  },
  local: LOCAL,
  credit: (album) =>
    [
      album.provider === "local" ? LOCAL.attribution : attribution(album),
      album.notePt ?? album.note,
    ]
      .filter(Boolean)
      .join(" — "),
  anatomy: {
    views: "Vistas do álbum",
    tracks: "Faixas",
    shape: "Por que esta forma?",
    findOut: "Descobrir ›",
    inNumbers: "Em números",
    also: "Outras perguntas",
    more: "Mais sobre esta forma",
    nextQuestion: "Próxima pergunta ›",
    asItIs: "Como é",
    compare: "Comparar",
    hold: "Segure a imagem para comparar",
    keys: "Esc volta",
    settled: "Este disco já está onde a maioria da coleção está, então não há o que mudar.",
    rows: {
      measure: "Medida",
      record: "Este disco",
      usual: "Comum aqui",
      standing: "Posição",
      drawn: "Desenhado como",
    },
    usual: (shown, of) => `${shown} (mediana dos ${of})`,
    write: ANATOMY_PT,
  },
};
