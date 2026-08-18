/* eslint-disable @typescript-eslint/no-explicit-any */
export type Track = { title: string; dur: number };
export type Album = {
  artist: string; title: string; year: string; cat: string; bpm: number; seed: number;
  inkA: [number, number, number]; inkB: [number, number, number]; tracks: Track[];
};

export const ALBUMS_RAW = [
  { artist: "OROVA", title: "Densidade", year: "2026", cat: "A—001", bpm: 88, seed: 7,
    inkA: [0.96, 0.53, 0.25], inkB: [0.29, 0.55, 0.72],
    tracks: [["Peso Morto", 214], ["Densidade", 252], ["Colapso Suave", 188], ["Anel", 301], ["Fuga de Massa", 176]] },
  { artist: "MIRA SELVA", title: "Queda Livre", year: "2025", cat: "B—014", bpm: 104, seed: 31,
    inkA: [0.55, 0.78, 0.60], inkB: [0.86, 0.36, 0.42],
    tracks: [["Queda Livre", 197], ["Vento de Cauda", 233], ["Cinza Clara", 165], ["Órbita Baixa", 288]] },
  { artist: "TERRA NULA", title: "Marés Internas", year: "2024", cat: "C—028", bpm: 76, seed: 91,
    inkA: [0.92, 0.72, 0.30], inkB: [0.36, 0.40, 0.66],
    tracks: [["Maré de Sizígia", 268], ["Baixa-mar", 199], ["Sal", 154], ["Interior", 322], ["Corrente Fria", 205]] },
  { artist: "NÚCLEO 9", title: "Silêncio Sólido", year: "2026", cat: "D—037", bpm: 122, seed: 53,
    inkA: [0.88, 0.42, 0.62], inkB: [0.30, 0.62, 0.64],
    tracks: [["Bloco", 181], ["Silêncio Sólido", 244], ["Prensa", 167], ["Vazio Cheio", 276]] },
  { artist: "ALMA CRUA", title: "Ferro Doce", year: "2023", cat: "E—052", bpm: 68, seed: 17,
    inkA: [0.82, 0.50, 0.34], inkB: [0.52, 0.58, 0.44],
    tracks: [["Ferro Doce", 289], ["Rebite", 172], ["Solda Fria", 231], ["Bigorna", 198], ["Lima", 143]] }
];

export const ALBUMS: Album[] = ALBUMS_RAW.map((a: any) => ({
  ...a,
  tracks: a.tracks.map(([title, dur]: [string, number]) => ({ title, dur }))
}));
