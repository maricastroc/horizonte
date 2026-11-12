import type { AxisReading, CompareAxis, Finding, Question } from "../anatomy";
import type { AnatomyWriter, Phrasing } from "./types";

type Of<P extends Finding["part"]> = Extract<Finding, { part: P }>;

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
      "A diferença de ritmo entre as faixas. Cada setor do anel é uma faixa, e as fendas entre " +
      "eles se alargam quanto mais as faixas diferem em regularidade; neste disco, a diferença " +
      "é a típica da coleção.",
  },
  strata: {
    ask: "O que dividiria o anel em camadas?",
    answer:
      "Um ritmo regular. Quando as notas caem numa grade que se repete, o anel se divide em " +
      "camadas, mais afastadas quanto mais regular é o ritmo; a regularidade deste disco é a " +
      "típica da coleção.",
  },
  contour: {
    ask: "O que recorta a borda?",
    answer:
      "O contraste entre os trechos calmos e os intensos. A borda acompanha a intensidade ao " +
      "longo do disco, avançando onde a música cresce; aqui o contraste é o típico da coleção, " +
      "e os recortes também.",
  },
  posture: {
    ask: "O que define a inclinação da forma?",
    answer:
      "O brilho do som, isto é, o peso dos agudos. Quanto mais agudos, mais a forma se mostra " +
      "de frente, redonda; quanto menos, mais ela se deita. O brilho deste disco é o típico da " +
      "coleção, e a inclinação também.",
  },
  core: {
    ask: "O que define o tamanho do centro escuro?",
    answer:
      "O volume médio. No Horizonte, volume é massa: discos mais altos ganham um corpo maior e " +
      "um centro que estreita o anel; os mais baixos, o contrário. Este fica no meio da coleção.",
  },
};

function satellites(f: Of<"satellites">): Phrasing {
  const { bodies: n, after, minutes: min, high } = f;
  const d = Math.abs(after - n);
  const ask =
    n === 0
      ? "Por que esta forma está sozinha?"
      : n === 1
        ? "De onde vem o pequeno corpo ao lado?"
        : `De onde vêm os ${count(n)} pequenos corpos?`;
  const rule =
    "O Horizonte representa o tempo com pequenos corpos ao redor da forma, mais numerosos " +
    "quanto mais longo é o disco";
  const answer = f.near
    ? `Da duração: ${minutes(min)}, perto da duração típica da coleção. ${rule}; com esta ` +
      `duração, ${n === 0 ? "nenhum aparece" : n === 1 ? "aparece um" : `aparecem ${count(n)}`}.`
    : n === 0
      ? `Porque o disco é curto: ${minutes(min)}${when(f.bottom, ", o mais curto da coleção")}. ` +
        "A duração ganha forma em pequenos corpos que vão surgindo à medida que o disco se " +
        "alonga, e este termina antes de ganhar o primeiro."
      : high
        ? `Da duração: ${minutes(min)}, ` +
          `${f.top ? "o disco mais longo da coleção" : "mais longo que a maioria da coleção"}. Em vez ` +
          "de aumentar a forma principal, o Horizonte representa o tempo com pequenos corpos ao " +
          "redor dela: quanto mais longo o disco, mais corpos."
        : `Da duração: ${minutes(min)}, mais curto que a maioria da coleção. ${rule}; com ` +
          `esta duração, há só ${count(n)}.`;
  const extra = Math.abs(f.extra) === 1 ? "o 1 minuto" : `os ${minutes(Math.abs(f.extra))}`;
  const change =
    after < n
      ? (d === n
          ? n === 1
            ? "o pequeno corpo desaparece."
            : "os pequenos corpos desaparecem."
          : after === 1
            ? "resta um pequeno corpo."
            : `restam ${count(after)} pequenos corpos.`) +
        ` ${d === 1 ? "O que some representava" : "Os que somem representavam"} ${extra} a ` +
        "mais deste disco."
      : after > n
        ? (n === 0
            ? d === 1
              ? "surge um pequeno corpo ao lado."
              : `surgem ${bodies(d)} em volta.`
            : d === 1
              ? "surge mais um pequeno corpo."
              : `surgem mais ${count(d)}.`) +
          ` ${d === 1 ? "Ele representa" : "Eles representam"} ${extra} que ` +
          `${Math.abs(f.extra) === 1 ? "falta" : "faltam"} a este disco.`
        : n === 0
          ? "a forma continua sozinha."
          : n === 1
            ? `o pequeno corpo continua lá, um pouco ${high ? "menor" : "maior"}.`
            : `os ${count(n)} pequenos corpos continuam lá, um pouco ${high ? "menores" : "maiores"}.`;
  return {
    ask,
    answer,
    what: f.near ? null : high ? "E se o disco fosse mais curto?" : "E se o disco fosse mais longo?",
    label: high ? "Mais curto" : "Mais longo",
    result: `Com ${minutes(f.usual)}, a duração típica da coleção, ${change}`,
  };
}

function gaps(f: Of<"gaps">): Phrasing {
  const { high, top, bottom } = f;
  const ask = f.open
    ? "Por que o anel está partido?"
    : high
      ? "Por que o anel tem fendas?"
      : "Por que o anel é quase contínuo?";
  const answer = f.open
    ? "Porque as faixas diferem muito no ritmo: umas seguem uma batida regular, outras fluem " +
      "sem grade. Cada setor do anel é uma faixa, e a largura das fendas entre eles mede essa " +
      `diferença no disco como um todo${when(top, "; aqui, a maior da coleção")}.`
    : high
      ? "Porque as faixas diferem um pouco no ritmo: algumas são mais regulares que outras. Cada " +
        "setor do anel é uma faixa, e as fendas entre eles medem essa diferença no disco como um " +
        "todo; aqui ela passa da típica, mas ainda é pequena."
      : "Porque as faixas se parecem no ritmo, quase igualmente regulares. Cada setor do anel é " +
        "uma faixa, e as fendas entre eles só se alargam quando as faixas diferem nesse ponto" +
        `${when(bottom, "; em nenhum disco da coleção elas diferem tão pouco")}.`;
  return {
    ask,
    answer,
    what: high
      ? "E se as faixas tivessem ritmos parecidos?"
      : "E se as faixas variassem mais no ritmo?",
    label: high ? "Ritmos parecidos" : "Ritmos variados",
    result: high
      ? "Com faixas tão parecidas no ritmo quanto as de um disco típico, as fendas se estreitam " +
        "em todo o anel."
      : "Com faixas tão diferentes no ritmo quanto as de um disco típico, as fendas se alargam " +
        "em todo o anel.",
  };
}

function strata(f: Of<"strata">): Phrasing {
  const { high, top, bottom } = f;
  const shape =
    "Na forma, essa regularidade se traduz em anéis paralelos, mais afastados quanto mais " +
    "regular é o ritmo";
  const ask =
    f.beat === "steady"
      ? "Por que o anel tem camadas?"
      : f.beat === "none"
        ? "Por que o anel não tem camadas?"
        : high
          ? "Por que o anel se divide em camadas?"
          : "Por que as camadas do anel mal aparecem?";
  const answer =
    f.beat === "steady"
      ? "Porque o ritmo é muito regular: as notas caem numa grade que se repete do começo ao " +
        `fim. ${shape}${when(top, ". Nenhum disco da coleção é tão regular")}.`
      : f.beat === "none"
        ? "Porque a música não segue uma grade rítmica: os sons chegam sem uma batida que se " +
          "repita. As camadas só aparecem quando o ritmo tem regularidade" +
          `${when(bottom, ", e nenhum disco da coleção tem menos")}.`
        : high
          ? `Porque o ritmo é bastante regular, mais que o da maioria da coleção. ${shape}.`
          : "Porque o ritmo é pouco regular: há uma grade, mas fraca. As camadas existem, coladas " +
            "umas às outras, e só se separam quando o ritmo fica mais regular.";
  return {
    ask,
    answer,
    what: high ? "E se o ritmo fosse menos regular?" : "E se o ritmo fosse mais regular?",
    label: high ? "Menos regular" : "Mais regular",
    result: high
      ? "Com a regularidade de um disco típico, as camadas se aproximam umas das outras."
      : f.beat === "none"
        ? "Com a regularidade de um disco típico, o anel se divide em camadas, ainda bem juntas."
        : "Com a regularidade de um disco típico, as camadas se afastam e ficam mais nítidas.",
  };
}

function contour(f: Of<"contour">): Phrasing {
  const { high, strong, top, bottom } = f;
  const ask = high
    ? strong
      ? "Por que a borda é tão recortada?"
      : "Por que a borda é recortada?"
    : strong
      ? "Por que a borda é tão lisa?"
      : "Por que a borda é quase lisa?";
  const answer = high
    ? (strong
        ? "Por causa do forte contraste entre os trechos calmos e os intensos."
        : "Por causa do contraste entre os trechos calmos e os intensos, maior que o da maioria " +
          "da coleção.") +
      " Como o anel percorre o disco do começo ao fim, a borda avança onde a música cresce e " +
      "recua onde ela se acalma; quanto maior o contraste, mais fundo o recorte." +
      (top
        ? " Nenhum disco da coleção tem tanto. Ao tocar, é também o que mais pulsa com o som."
        : strong
          ? " Ao tocar, a forma também pulsa bastante com o som."
          : "")
    : (strong
        ? "Porque o volume quase não varia: do trecho mais calmo ao mais intenso, a diferença é " +
          "pequena."
        : "Porque o volume varia menos que na maioria da coleção.") +
      " A borda acompanha a intensidade ao longo do disco e, com pouco contraste, quase não se " +
      `move${when(bottom, "; nenhum disco da coleção varia tão pouco")}.` +
      when(strong, " Ao tocar, a forma também pulsa pouco.");
  return {
    ask,
    answer,
    what: high ? "E se o volume variasse menos?" : "E se o volume variasse mais?",
    label: high ? "Menos contraste" : "Mais contraste",
    result: high
      ? "Com o contraste de um disco típico, os recortes ficam mais rasos, mas continuam nos " +
        "mesmos lugares: acompanham os mesmos trechos do disco."
      : "Com o contraste de um disco típico, os recortes se aprofundam, justo onde a música já " +
        "crescia e se acalmava.",
  };
}

function posture(f: Of<"posture">): Phrasing {
  const { high, strong, top, bottom } = f;
  const ask = high
    ? strong
      ? "Por que a forma parece tão aberta?"
      : "Por que a forma parece aberta?"
    : strong
      ? "Por que a forma está tão achatada?"
      : "Por que a forma está achatada?";
  const answer = high
    ? strong
      ? "Esta música concentra muita energia nos sons agudos: ela soa brilhante. Para " +
        "representar esse brilho, o Horizonte inclina a forma na direção de quem olha; quanto " +
        "mais agudos, mais ela aparece de frente, quase redonda." +
        when(top, " Nenhum disco da coleção é tão brilhante.")
      : "Esta música tem mais energia nos agudos que a maioria da coleção, então soa mais " +
        "brilhante. Na forma, esse brilho vira inclinação: quanto mais agudos, mais ela se " +
        "mostra de frente, arredondada."
    : strong
      ? "Quase toda a energia desta música está nos graves, com poucos agudos por cima: ela soa " +
        "escura. Para representar isso, o Horizonte deita a forma, achatada, como se a víssemos " +
        `de lado.${when(bottom, " Nenhum disco da coleção é tão escuro.")}`
      : "Esta música tem menos energia nos agudos que a maioria da coleção, então soa um pouco " +
        "escura. Na forma, isso vira inclinação: com menos agudos, ela se deita e se achata.";
  return {
    ask,
    answer,
    what: high ? "E se o som tivesse menos agudos?" : "E se o som tivesse mais agudos?",
    label: high ? "Menos agudos" : "Mais agudos",
    result: high
      ? "Com o brilho de um disco típico, a forma se inclina para trás e fica mais achatada."
      : "Com o brilho de um disco típico, a forma se levanta e se arredonda.",
  };
}

function core(f: Of<"core">): Phrasing {
  const { high, strong, top, bottom } = f;
  const ask = high
    ? strong
      ? "Por que o centro escuro é tão grande?"
      : "Por que o centro escuro é grande?"
    : strong
      ? "Por que o centro escuro é tão pequeno?"
      : "Por que o centro escuro é pequeno?";
  const answer = high
    ? strong
      ? "Porque o disco soa alto, em média, do início ao fim. No Horizonte, " +
        "volume é massa: quanto mais alto o disco, maior o corpo e maior o centro escuro, que vai " +
        `tomando o lugar do anel em volta.${when(top, " Este é o disco mais alto da coleção.")}`
      : "O disco soa mais alto que a maioria da coleção, do início ao fim. No Horizonte, volume " +
        "é massa: o corpo cresce e o centro escuro avança sobre o anel."
    : strong
      ? "Porque o disco soa baixo do início ao fim. No Horizonte, volume é massa: com pouca " +
        "massa, o corpo encolhe e o centro escuro deixa um anel largo à sua volta." +
        when(bottom, " Nenhum disco da coleção soa tão baixo.")
      : "O disco soa um pouco mais baixo que a maioria da coleção. Como volume é massa no " +
        "Horizonte, o corpo fica menor e o centro escuro deixa mais espaço ao anel.";
  return {
    ask,
    answer,
    what: high ? "E se o volume médio fosse mais baixo?" : "E se o volume médio fosse mais alto?",
    label: high ? "Mais baixo" : "Mais alto",
    result: high
      ? "Com o volume de um disco típico, o corpo inteiro encolhe e o centro escuro devolve " +
        "espaço ao anel."
      : "Com o volume de um disco típico, o corpo inteiro cresce e o centro escuro avança sobre " +
        "o anel.",
  };
}

function phrase(q: Question): Phrasing {
  const f = q.finding;
  if (f.part === "satellites") return satellites(f);
  if (f.near) return { ...NEAR[f.part], what: null, label: "", result: "" };
  if (f.part === "gaps") return gaps(f);
  if (f.part === "strata") return strata(f);
  if (f.part === "contour") return contour(f);
  if (f.part === "posture") return posture(f);
  return core(f);
}

const EXTREMES: Record<CompareAxis, [string, string]> = {
  duration: ["mais longo", "mais curto"],
  spread: ["mais desigual", "mais homogêneo"],
  pulse: ["mais regular", "menos regular"],
  dynamics: ["de maior contraste", "de menor contraste"],
  brightness: ["mais brilhante", "mais escuro"],
  loudness: ["mais alto", "mais baixo"],
};

export const ANATOMY_PT: AnatomyWriter = {
  phrase,
  measure: {
    duration: "Duração",
    spread: "Diferença de ritmo entre faixas",
    pulse: "Regularidade do ritmo",
    dynamics: "Contraste",
    brightness: "Brilho",
    loudness: "Volume médio",
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
    contour: "relevo da borda",
    posture: "inclinação da forma",
    core: "tamanho do corpo e do centro escuro",
  },
  details(q) {
    const f = q.finding;
    if (f.part === "satellites") {
      return [["Corpos surgem em", `${f.onsets.map(Math.round).join(" · ")} min`]];
    }
    if (f.part === "core") return [["Peso do nome", String(f.nameWeight)]];
    return [];
  },
  depth(q) {
    if (q.part !== "satellites") return null;
    return (
      "O anel sempre dá uma volta completa, e cada faixa ocupa uma fatia proporcional ao seu " +
      "tempo; por isso a duração total precisa aparecer fora dele."
    );
  },
  nameFact(f) {
    const rel = f.near
      ? "O deste disco tem o peso típico."
      : f.top
        ? "O deste disco é o mais pesado da coleção."
        : f.bottom
          ? "O deste disco é o mais leve da coleção."
          : f.high
            ? f.strong
              ? "O deste disco está entre os mais pesados."
              : "O deste disco é um pouco mais pesado que o típico."
            : f.strong
              ? "O deste disco está entre os mais leves."
              : "O deste disco é um pouco mais leve que o típico.";
    return (
      "O nome também vem do volume médio: quanto mais alto o disco, mais grosso o traço das " +
      `letras. ${rel}`
    );
  },
  colourNote: "As cores vêm da capa, não da música.",
};
