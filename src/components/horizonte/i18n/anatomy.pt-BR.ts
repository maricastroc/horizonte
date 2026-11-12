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
      "O quanto as faixas diferem no ritmo. Cada setor do anel é uma faixa, e as fendas se " +
      "alargam quando umas seguem uma batida regular e outras não; aqui a diferença é a típica " +
      "da coleção.",
  },
  strata: {
    ask: "O que dividiria o anel em camadas?",
    answer:
      "Um ritmo regular. Quando as notas caem numa grade que se repete, o anel se divide em " +
      "camadas, mais afastadas quanto mais constante é a grade; o ritmo deste disco é tão " +
      "regular quanto o de um disco típico.",
  },
  contour: {
    ask: "O que recorta a borda?",
    answer:
      "A distância entre os trechos calmos e os intensos. A borda acompanha a intensidade ao " +
      "longo do disco, avançando onde a música cresce; aqui essa distância é a típica da " +
      "coleção, e os recortes também.",
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
      "O quanto o disco soa alto. No Horizonte, volume é massa: discos mais altos ganham um " +
      "corpo maior e um centro que estreita o anel; os mais baixos, o contrário. Este fica no " +
      "meio da coleção.",
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
  const come = n === 1 ? "Ele vem da duração." : "Eles vêm da duração.";
  const each =
    "o Horizonte mostra o tempo com pequenos corpos em volta da forma, um a mais a cada trecho " +
    "de duração";
  const answer = f.near
    ? `${n === 0 ? "É uma questão de duração." : come} Com ${minutes(min)}, perto da duração ` +
      `típica da coleção, este disco ${n === 0 ? "não tem nenhum" : `tem ${count(n)}`}: ${each}.`
    : n === 0
      ? `Porque o disco é curto: ${minutes(min)}${when(f.bottom, ", o mais curto da coleção")}. ` +
        "O Horizonte mostra o tempo com pequenos corpos que vão surgindo em volta da forma à " +
        "medida que o disco se alonga, e este termina antes do primeiro."
      : high
        ? `${come} Este disco tem ${minutes(min)}, ` +
          `${f.top ? "mais que qualquer outro da coleção" : "mais que a maioria da coleção"}, e ` +
          "o Horizonte não mostra esse tempo aumentando a forma: cada trecho a mais vira um " +
          "pequeno corpo em volta dela."
        : `${come} Com ${minutes(min)}, mais curto que a maioria da coleção, este disco ganha só ` +
          `${n === 1 ? "um" : count(n)}: ${each}.`;
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
    ? "Algumas faixas deste disco seguem uma batida regular; outras fluem sem uma. " +
      "Cada setor do anel é uma faixa, e quanto mais as faixas diferem nesse ponto, mais as " +
      "fendas se abrem, todas por igual, em volta do anel inteiro" +
      `${when(top, ". Nenhum disco da coleção tem faixas tão diferentes")}.`
    : high
      ? "Algumas faixas deste disco têm um ritmo mais regular que outras. Cada setor do anel é " +
        "uma faixa, e essa diferença abre fendas entre todos eles; aqui, um pouco mais largas que " +
        "o típico, mas ainda estreitas."
      : "As faixas deste disco têm ritmos parecidos. Cada setor do anel é uma faixa, e as fendas " +
        "só se abrem quando as faixas diferem no ritmo; aqui, quase não há o que separar" +
        `${when(bottom, ". Nenhum disco da coleção tem faixas tão parecidas")}.`;
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
  const draw =
    "O Horizonte desenha essa regularidade como anéis paralelos: quanto mais regular o ritmo, " +
    "mais afastados eles ficam";
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
      ? "As notas deste disco caem numa grade constante, como um pulso que se repete do começo " +
        `ao fim. ${draw}${when(top, ". Nenhum disco da coleção é tão regular")}.`
      : f.beat === "none"
        ? "Os sons deste disco chegam sem uma batida que se repita, livres de qualquer grade. O " +
          "anel só se divide em camadas quando o ritmo é regular" +
          `${when(bottom, ". Nenhum disco da coleção tem um ritmo tão livre")}.`
        : high
          ? "As notas deste disco caem numa grade bastante regular, mais que na maioria da " +
            `coleção. ${draw}.`
          : "O ritmo deste disco tem alguma regularidade, mas pouca. As camadas estão lá, " +
            "coladas umas às outras; só se separam quando o ritmo fica mais constante.";
  return {
    ask,
    answer,
    what: high ? "E se o ritmo fosse menos regular?" : "E se o ritmo fosse mais regular?",
    label: high ? "Menos regular" : "Mais regular",
    result: high
      ? "Com um ritmo tão regular quanto o de um disco típico, as camadas se aproximam umas das " +
        "outras."
      : f.beat === "none"
        ? "Com um ritmo tão regular quanto o de um disco típico, o anel se divide em camadas, " +
          "ainda bem juntas."
        : "Com um ritmo tão regular quanto o de um disco típico, as camadas se afastam e ficam " +
          "mais nítidas.",
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
  const follow =
    "O anel percorre o disco do começo ao fim, e a borda acompanha esse vaivém: avança onde a " +
    "música cresce e recua onde ela se acalma.";
  const answer = high
    ? strong
      ? `Este disco vai de trechos muito calmos a trechos muito intensos. ${follow} Quanto maior ` +
        "a distância entre calma e intensidade, mais fundo o recorte" +
        `${when(top, ", e nenhum disco da coleção vai tão longe")}.`
      : `Este disco alterna trechos calmos e intensos mais que a maioria da coleção. ${follow}`
    : strong
      ? "A intensidade deste disco quase não muda: o trecho mais calmo e o mais intenso ficam " +
        "próximos. Como a borda acompanha essa intensidade ao longo do disco, ela quase não se " +
        `move${when(bottom, "; nenhum disco da coleção varia tão pouco")}.`
      : "A intensidade deste disco varia menos que a da maioria da coleção. Como a borda " +
        "acompanha essa intensidade ao longo do disco, os recortes ficam rasos.";
  return {
    ask,
    answer,
    what: high ? "E se o volume variasse menos?" : "E se o volume variasse mais?",
    label: high ? "Menos contraste" : "Mais contraste",
    result: high
      ? "Com trechos calmos e intensos tão próximos quanto num disco típico, os recortes ficam " +
        "mais rasos, mas não saem do lugar."
      : "Com trechos calmos e intensos tão distantes quanto num disco típico, os recortes se " +
        "aprofundam, nos mesmos lugares.",
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
      ? "Boa parte da energia desta música está nos sons agudos, e é isso que a faz soar " +
        "brilhante. O Horizonte vira a forma para quem olha conforme esse brilho: quanto mais " +
        `agudos, mais ela aparece de frente, quase redonda${when(top, ". Nenhum disco da coleção é tão brilhante")}.`
      : "Esta música tem mais agudos que a maioria da coleção, então soa um pouco mais " +
        "brilhante. O Horizonte vira a forma para quem olha conforme esse brilho, e ela mostra " +
        "uma face mais redonda."
    : strong
      ? "Quase toda a energia desta música está nos graves, com poucos agudos por cima: ela soa " +
        "escura. Para mostrar isso, o Horizonte deita a forma, achatada, como se a víssemos de " +
        `lado${when(bottom, ". Nenhum disco da coleção é tão escuro")}.`
      : "Esta música tem menos agudos que a maioria da coleção, então soa um pouco escura. Para " +
        "mostrar isso, o Horizonte inclina a forma para trás, e ela se achata.";
  return {
    ask,
    answer,
    what: high ? "E se o som tivesse menos agudos?" : "E se o som tivesse mais agudos?",
    label: high ? "Menos agudos" : "Mais agudos",
    result: high
      ? "Com os agudos de um disco típico, a forma se inclina para trás e se achata."
      : "Com os agudos de um disco típico, a forma se levanta e se arredonda.",
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
      ? "Este disco soa alto do começo ao fim. No Horizonte, volume é massa: quanto mais alto o " +
        "disco, maior o corpo e maior o centro escuro, que vai tomando o lugar do anel em volta" +
        `${when(top, ". Nenhum disco da coleção soa tão alto")}.`
      : "Este disco soa mais alto que a maioria da coleção. No Horizonte, volume é massa, então " +
        "o corpo cresce e o centro escuro avança sobre o anel."
    : strong
      ? "Este disco soa baixo do começo ao fim. No Horizonte, volume é massa: com pouca, o corpo " +
        "encolhe e o centro escuro deixa um anel largo à sua volta" +
        `${when(bottom, ". Nenhum disco da coleção soa tão baixo")}.`
      : "Este disco soa um pouco mais baixo que a maioria da coleção. No Horizonte, volume é " +
        "massa, então o corpo fica menor e o anel ganha espaço.";
  return {
    ask,
    answer,
    what: high ? "E se o volume médio fosse mais baixo?" : "E se o volume médio fosse mais alto?",
    label: high ? "Mais baixo" : "Mais alto",
    result: high
      ? "No volume de um disco típico, o corpo inteiro encolhe e o centro escuro devolve espaço " +
        "ao anel."
      : "No volume de um disco típico, o corpo inteiro cresce e o centro escuro avança sobre o " +
        "anel.",
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
