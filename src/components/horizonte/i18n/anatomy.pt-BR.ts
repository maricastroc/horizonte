import type { AxisReading, CompareAxis, Finding, Question } from "../anatomy";
import type { AnatomyWriter, Phrasing } from "./types";

const COUNT = ["nenhum", "um", "dois", "três", "quatro"];
const count = (n: number) => COUNT[n] ?? String(n);
const bodies = (n: number) => (n === 1 ? "um pequeno corpo" : `${count(n)} pequenos corpos`);
const minutes = (n: number) => (n === 1 ? "1 minuto" : `${n} minutos`);
const when = (on: boolean, text: string) => (on ? text : "");

const decimal = (digits: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const ONE = decimal(1);
const TWO = decimal(2);
const WHOLE = decimal(0);

const NEAR: Record<Exclude<Finding["part"], "satellites">, { ask: string; answer: string }> = {
  gaps: {
    ask: "O que abre fendas no anel?",
    answer:
      "Faixas com pulsos diferentes. As faixas deste disco variam mais ou menos como as da " +
      "maioria da coleção, então as fendas têm uma largura comum.",
  },
  strata: {
    ask: "O que dividiria o anel em camadas?",
    answer:
      "Uma batida firme. A batida deste disco é mais ou menos tão regular quanto a da maioria " +
      "da coleção.",
  },
  contour: {
    ask: "O que recorta a borda?",
    answer:
      "A oscilação entre o suave e o forte. A deste disco fica perto do comum na coleção, " +
      "então a borda é recortada na medida.",
  },
  posture: {
    ask: "O que define o quanto a forma se ergue?",
    answer:
      "O brilho. Este disco soa mais ou menos tão brilhante quanto a maioria da coleção, " +
      "então a forma se ergue num ângulo comum.",
  },
  core: {
    ask: "O que define o tamanho do centro escuro?",
    answer:
      "O volume. Este disco tem um volume parecido com o da maioria da coleção, então o " +
      "centro tem um tamanho comum, assim como o peso do nome.",
  },
};

function satellites(f: Extract<Finding, { part: "satellites" }>): Phrasing {
  const { bodies: n, after, minutes: min, usual, high } = f;
  const d = Math.abs(after - n);
  const lead = `Com ${minutes(usual)}, uma duração comum na coleção,`;
  const ask =
    n === 0
      ? "Por que a forma é um corpo só?"
      : n === 1
        ? "Por que há um pequeno corpo ao lado?"
        : `Por que há ${bodies(n)} em volta?`;
  const appear = n === 0 ? "nenhum aparece" : n === 1 ? "aparece um" : `aparecem ${count(n)}`;
  const rule =
    "Os discos se espalham em pequenos corpos conforme ficam mais longos; " +
    `com essa duração, ${appear}.`;
  const answer = f.near
    ? `Por causa da duração: ${minutes(min)}, perto do comum na coleção. ${rule}`
    : n === 0
      ? `Porque o disco é curto: ${minutes(min)}${when(f.bottom, ", o mais curto da coleção")}. ` +
        "Só os discos mais longos se espalham em pequenos corpos."
      : high
        ? `Porque o disco é longo: ${minutes(min)}${when(f.top, ", o mais longo da coleção")}. ` +
          "Um disco longo vira território: em vez de crescer, ele se espalha em pequenos corpos."
        : `Por causa da duração: ${minutes(min)}, mais curto que a maioria da coleção. ${rule}`;
  const change =
    after < n
      ? d === n
        ? n === 1
          ? "seu pequeno corpo se dissolve"
          : `seus ${bodies(n)} se dissolvem`
        : d === 1
          ? `um dos seus ${bodies(n)} se dissolve`
          : `${count(d)} dos seus ${bodies(n)} se dissolvem`
      : after > n
        ? n === 0
          ? d === 1
            ? "surge um pequeno corpo ao lado"
            : `surgem ${bodies(d)} em volta`
          : d === 1
            ? "surge mais um pequeno corpo em volta"
            : `surgem mais ${bodies(d)} em volta`
        : n === 0
          ? "a forma continua sendo um corpo só"
          : n === 1
            ? `seu pequeno corpo ${high ? "encolhe" : "cresce"}`
            : `seus pequenos corpos ${high ? "encolhem" : "crescem"}`;
  return {
    ask,
    answer,
    what: f.near ? null : high ? "E se fosse mais curto?" : "E se fosse mais longo?",
    label: high ? "Mais curto" : "Mais longo",
    result: `${lead} ${change}.`,
  };
}

function phrase(q: Question): Phrasing {
  const f = q.finding;
  if (f.part === "satellites") return satellites(f);
  if (f.near) return { ...NEAR[f.part], what: null, label: "", result: "" };
  const { high, strong, top, bottom } = f;
  if (f.part === "gaps") {
    return {
      ask: f.open
        ? "Por que o anel está partido em pedaços?"
        : "Por que o anel está quase inteiro?",
      answer: f.open
        ? "Porque suas faixas não seguem o mesmo pulso: algumas se apoiam num pulso firme, " +
          "outras bem menos. Cada mudança de pulso abre uma fenda entre as faixas."
        : "Porque suas faixas mantêm o mesmo tipo de pulso. " +
          "Quando as faixas diferem no pulso, o anel se parte entre elas.",
      what: high
        ? "E se as faixas seguissem o mesmo pulso?"
        : "E se cada faixa seguisse seu próprio pulso?",
      label: high ? "Mesmo pulso" : "À deriva",
      result: high
        ? "Com pulsos tão próximos quanto os de um disco comum da coleção, " +
          "as fendas entre as faixas se estreitam."
        : "Com pulsos tão variados quanto os de um disco comum da coleção, abrem-se fendas " +
          "entre as faixas.",
    };
  }
  if (f.part === "strata") {
    return {
      ask:
        f.beat === "steady"
          ? "Por que o anel é feito de camadas?"
          : f.beat === "none"
            ? "Por que o anel é uma camada só?"
            : "Por que o anel mostra camadas tênues?",
      answer:
        f.beat === "steady"
          ? `Porque o disco se apoia numa batida firme${when(top, ", a mais firme da coleção")}. ` +
            "A repetição no tempo vira camadas no espaço."
          : f.beat === "none"
            ? "Porque o disco flutua livre de qualquer batida" +
              `${when(bottom, "; é o mais solto da coleção")}. ` +
              "Só a música presa a uma grade regular divide o anel em camadas."
            : "Porque a batida do disco é regular só em parte. " +
              "Quanto mais firme a grade, mais o anel se divide em camadas.",
      what: high ? "E se a batida fosse mais solta?" : "E se a batida fosse mais firme?",
      label: high ? "Mais solta" : "Mais firme",
      result: high
        ? "Com uma batida tão solta quanto a de um disco comum da coleção, " +
          "as camadas se fundem e rareiam."
        : "Com uma batida tão firme quanto a de um disco comum da coleção, " +
          "o anel se divide em camadas.",
    };
  }
  if (f.part === "contour") {
    return {
      ask: high
        ? strong
          ? "Por que a borda é tão recortada?"
          : "Por que a borda é recortada?"
        : strong
          ? "Por que a borda é tão lisa?"
          : "Por que a borda é quase lisa?",
      answer: high
        ? (strong
            ? "Porque o disco vai do muito suave ao muito forte" +
              `${when(top, ", mais que qualquer outro da coleção")}. `
            : "Porque o disco transita entre o suave e o forte mais que a maioria da coleção. ") +
          "Quanto maior essa oscilação, mais fundo o contorno, e mais ele respira enquanto toca."
        : (strong
            ? "Porque o volume do disco quase não muda" +
              `${when(bottom, ", menos que o de qualquer outro da coleção")}. `
            : "Porque o volume do disco varia menos que o da maioria da coleção. ") +
          "Uma música sem grandes saltos deixa um contorno mais liso, " +
          "que respira menos enquanto toca.",
      what: high ? "E se fosse mais uniforme?" : "E se oscilasse mais entre o suave e o forte?",
      label: high ? "Mais uniforme" : "Mais contraste",
      result: high
        ? "Com uma variação de volume comum, a borda se alisa."
        : "Com uma variação de volume comum, a borda se recorta.",
    };
  }
  if (f.part === "posture") {
    return {
      ask: high
        ? strong
          ? "Por que a forma se ergue tão aberta?"
          : "Por que a forma se ergue aberta?"
        : strong
          ? "Por que a forma se deita tão rente ao chão?"
          : "Por que a forma se inclina para baixo?",
      answer: high
        ? (strong
            ? `Porque o disco soa brilhante${when(top, ", o mais brilhante da coleção")}. `
            : "Porque o disco soa mais brilhante que a maioria da coleção. ") +
          "Discos brilhantes se erguem abertos; os escuros se deitam."
        : (strong
            ? `Porque o disco soa escuro${when(bottom, ", o mais escuro da coleção")}: ` +
              "quase toda a sua energia fica nos graves. "
            : "Porque o disco soa um pouco mais escuro que a maioria da coleção. ") +
          "Discos escuros se deitam; os brilhantes se erguem abertos.",
      what: high ? "E se soasse mais escuro?" : "E se soasse mais brilhante?",
      label: high ? "Mais escuro" : "Mais brilhante",
      result: high
        ? "Com um brilho comum na coleção, a forma assenta e se inclina para baixo."
        : "Com um brilho comum na coleção, a forma se ergue e se abre.",
    };
  }
  return {
    ask: high
      ? strong
        ? "Por que o centro escuro é tão grande?"
        : "Por que o centro escuro é grande?"
      : strong
        ? "Por que o centro escuro é tão pequeno?"
        : "Por que o centro escuro é pequeno?",
    answer: high
      ? (strong
          ? `Porque o volume do disco é alto${when(top, ", o mais alto da coleção")}. `
          : "Porque o volume do disco é mais alto que o da maioria da coleção. ") +
        "Discos de volume alto ganham um centro pesado que engole o anel, e o nome ganha um traço " +
        "mais pesado também."
      : (strong
          ? `Porque o volume do disco é baixo${when(bottom, ", o mais baixo da coleção")}. `
          : "Porque o volume do disco é um pouco mais baixo que o da maioria da coleção. ") +
        "Discos de volume baixo guardam um centro pequeno e muito espaço aberto, e o nome ganha " +
        "um traço mais leve também.",
    what: high ? "E se o volume fosse mais baixo?" : "E se o volume fosse mais alto?",
    label: high ? "Mais baixo" : "Mais alto",
    result: high
      ? "Com um volume comum na coleção, o centro encolhe."
      : "Com um volume comum na coleção, o centro se expande.",
  };
}

const EXTREMES: Record<CompareAxis, [string, string]> = {
  duration: ["mais longo", "mais curto"],
  spread: ["mais irregular", "mais regular"],
  pulse: ["mais firme", "mais solto"],
  dynamics: ["mais dinâmico", "mais comprimido"],
  brightness: ["mais brilhante", "mais escuro"],
  loudness: ["mais alto", "mais baixo"],
};

export const ANATOMY_PT: AnatomyWriter = {
  phrase,
  measure: {
    duration: "Duração",
    spread: "Variação de pulso",
    pulse: "Pulso",
    dynamics: "Dinâmica",
    brightness: "Brilho",
    loudness: "Volume",
  },
  shown(axis, v) {
    if (axis === "duration") return `${Math.round(v / 60)} min`;
    if (axis === "dynamics") return `${ONE.format(v)} dB de variação`;
    if (axis === "brightness") return `${WHOLE.format(Math.round(v))} Hz`;
    if (axis === "loudness") return `${v < 0 ? "−" : ""}${ONE.format(Math.abs(v))} dB`;
    return TWO.format(v);
  },
  standing({ axis, rank, of }: AxisReading) {
    const [high, low] = EXTREMES[axis];
    if (rank === 1) return `o ${high} de ${of}`;
    if (rank === of) return `o ${low} de ${of}`;
    return `${rank}º ${high} de ${of}`;
  },
  drawn: {
    satellites: "pequenos corpos em volta do anel",
    gaps: "fendas entre os setores",
    strata: "camadas no anel",
    contour: "relevo do contorno",
    posture: "o quanto a forma se deita",
    core: "o centro escuro",
  },
  nameFact: (weight) =>
    `O nome é composto no peso ${weight}: quanto mais alto o volume do disco, mais pesada a letra.`,
  colourNote: "A cor vem da capa, não do som.",
};
