export interface FormatProbe {
  ext: string;
  mimes: string[];
  label: string;
}

export const FORMATS: FormatProbe[] = [
  { ext: "mp3", mimes: ["audio/mpeg"], label: "MP3" },
  { ext: "m4a", mimes: ["audio/mp4", 'audio/mp4; codecs="mp4a.40.2"'], label: "M4A/AAC" },
  { ext: "mp4", mimes: ["audio/mp4"], label: "M4A/AAC" },
  { ext: "aac", mimes: ["audio/aac", "audio/mp4"], label: "AAC" },
  { ext: "wav", mimes: ["audio/wav", "audio/wave"], label: "WAV" },
  { ext: "flac", mimes: ["audio/flac", "audio/x-flac"], label: "FLAC" },
  { ext: "ogg", mimes: ['audio/ogg; codecs="vorbis"', "audio/ogg"], label: "Ogg Vorbis" },
  { ext: "oga", mimes: ["audio/ogg"], label: "Ogg" },
  { ext: "opus", mimes: ['audio/ogg; codecs="opus"'], label: "Opus" },
  { ext: "webm", mimes: ['audio/webm; codecs="opus"', "audio/webm"], label: "WebM" },
  { ext: "aif", mimes: ["audio/aiff", "audio/x-aiff"], label: "AIFF" },
  { ext: "aiff", mimes: ["audio/aiff", "audio/x-aiff"], label: "AIFF" },
];

export const extensionOf = (name: string) => {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
};

let supportCache: Map<string, boolean> | null = null;

function probe(): Map<string, boolean> {
  if (supportCache) return supportCache;
  const map = new Map<string, boolean>();
  let el: HTMLAudioElement | null = null;
  try {
    el = document.createElement("audio");
  } catch {
    el = null;
  }
  for (const f of FORMATS) {
    const ok = el
      ? f.mimes.some((m) => {
          const answer = el!.canPlayType(m);
          return answer === "probably" || answer === "maybe";
        })
      : false;
    map.set(f.ext, ok);
  }
  supportCache = map;
  return map;
}

export function isSupported(name: string): boolean {
  return probe().get(extensionOf(name)) === true;
}

export function supportedLabels(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of FORMATS) {
    if (probe().get(f.ext) && !seen.has(f.label)) {
      seen.add(f.label);
      out.push(f.label);
    }
  }
  return out;
}

export function resetFormatProbe() {
  supportCache = null;
}

export const ACCEPT = `audio/*,${FORMATS.map((f) => `.${f.ext}`).join(",")}`;
