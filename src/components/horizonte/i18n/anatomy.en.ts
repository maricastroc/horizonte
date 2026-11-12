import type { CompareAxis, Finding, Question } from "../anatomy";
import type { AnatomyWriter, Phrasing } from "./types";

const COUNT = ["no", "one", "two", "three", "four"];
const count = (n: number) => COUNT[n] ?? String(n);
const bodies = (n: number) => `${count(n)} small ${n === 1 ? "body" : "bodies"}`;

const NEAR: Record<Exclude<Finding["part"], "satellites">, { ask: string; answer: string }> = {
  gaps: {
    ask: "What opens breaks in the ring?",
    answer:
      "Tracks with different pulses. This record's tracks vary about as much as most here, " +
      "so its breaks are of a usual width.",
  },
  strata: {
    ask: "What would split the ring into layers?",
    answer: "A steady beat. This record's beat is about as regular as most here.",
  },
  contour: {
    ask: "What carves its edge?",
    answer:
      "The swing between quiet and loud. This record's swing is close to the usual here, " +
      "so its edge is moderately carved.",
  },
  posture: {
    ask: "What sets how upright it stands?",
    answer:
      "Brightness. This record sounds about as bright as most here, " +
      "so it stands at a usual angle.",
  },
  core: {
    ask: "What sets the size of its dark center?",
    answer:
      "Loudness. This record is about as loud as most here, " +
      "so its center is of a usual size, and so is the weight of its name.",
  },
};

function satellites(f: Extract<Finding, { part: "satellites" }>): Phrasing {
  const { bodies: n, after, minutes: min, usual, high } = f;
  const d = Math.abs(after - n);
  const lead = `At ${usual} minutes, a usual length here,`;
  const ask =
    n === 0
      ? "Why is it a single body?"
      : n === 1
        ? "Why is there a small body beside it?"
        : `Why are there ${bodies(n)} around it?`;
  const atThisLength = `Records spread into small bodies as they get longer; at this length, ${
    n === 0 ? "none" : count(n)
  }.`;
  const answer = f.near
    ? `Because of its length: ${min} minutes, close to the usual here. ${atThisLength}`
    : n === 0
      ? `Because it is short: ${min} minutes${f.bottom ? ", the shortest record here" : ""}. ` +
        "Only longer records spread out into small bodies."
      : high
        ? `Because it is long: ${min} minutes${f.top ? ", the longest record here" : ""}. ` +
          "A long record becomes territory: it spreads into small bodies instead of growing."
        : `Because of its length: ${min} minutes, shorter than most here. ${atThisLength}`;
  const change =
    after < n
      ? d === n
        ? n === 1
          ? "its small body dissolves"
          : `its ${bodies(n)} dissolve`
        : `${count(d)} of its ${bodies(n)} ${d === 1 ? "dissolves" : "dissolve"}`
      : after > n
        ? n === 0
          ? d === 1
            ? "a small body appears beside it"
            : `${bodies(d)} appear around it`
          : d === 1
            ? "one more small body appears around it"
            : `${bodies(d)} appear around it`
        : n === 0
          ? "it stays a single body"
          : `its small ${n === 1 ? "body" : "bodies"} ${high ? "shrink" : "grow"}${n === 1 ? "s" : ""}`;
  return {
    ask,
    answer,
    what: f.near ? null : high ? "What if it were shorter?" : "What if it were longer?",
    label: high ? "Shorter" : "Longer",
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
      ask: f.open ? "Why is the ring broken into pieces?" : "Why is the ring almost whole?",
      answer: f.open
        ? "Because its tracks don't share one beat: some sit on a steady pulse, others much less. " +
          "Each change of pulse opens a break between tracks."
        : "Because its tracks keep the same kind of pulse. " +
          "When tracks differ in beat, the ring breaks between them.",
      what: high ? "What if its tracks shared one beat?" : "What if its tracks drifted apart?",
      label: high ? "One beat" : "Drifting",
      result: high
        ? "With pulses as close as a usual record here, the breaks between tracks narrow."
        : "With pulses as varied as a usual record here, breaks open between its tracks.",
    };
  }
  if (f.part === "strata") {
    return {
      ask:
        f.beat === "steady"
          ? "Why is the ring made of layers?"
          : f.beat === "none"
            ? "Why is the ring a single band?"
            : "Why does the ring show faint layers?",
      answer:
        f.beat === "steady"
          ? `Because it sits on a steady beat${top ? ", the steadiest here" : ""}. ` +
            "Repetition in time becomes layers in space."
          : f.beat === "none"
            ? `Because it floats free of any beat${bottom ? ", the loosest here" : ""}. ` +
              "Only music on a steady grid splits the ring into layers."
            : "Because its beat is only partly regular. " +
              "The steadier the grid, the more the ring splits into layers.",
      what: high ? "What if its beat were looser?" : "What if it had a steadier beat?",
      label: high ? "Looser" : "Steadier",
      result: high
        ? "With a beat as loose as a usual record here, the layers melt into fewer bands."
        : "With a beat as steady as a usual record here, the band splits into layers.",
    };
  }
  if (f.part === "contour") {
    return {
      ask: high
        ? strong
          ? "Why is its edge so jagged?"
          : "Why is its edge carved?"
        : strong
          ? "Why is its edge so smooth?"
          : "Why is its edge fairly smooth?",
      answer: high
        ? (strong
            ? "Because it swings between very quiet and very loud" +
              `${top ? ", more than any record here" : ""}. `
            : "Because it moves between quiet and loud more than most here. ") +
          "The wider that swing, the deeper the outline, and the more it breathes when it plays."
        : (strong
            ? `Because it barely changes in volume${bottom ? ", less than any record here" : ""}. `
            : "Because it stays within a narrower range of volume than most here. ") +
          "Even music leaves a smoother outline, and it breathes less when it plays.",
      what: high ? "What if it were more even?" : "What if it swung more between quiet and loud?",
      label: high ? "More even" : "More contrast",
      result: high
        ? "With a usual range of volume, the edge smooths out."
        : "With a usual range of volume, the edge gets carved.",
    };
  }
  if (f.part === "posture") {
    return {
      ask: high
        ? strong
          ? "Why does it stand so open?"
          : "Why does it stand open?"
        : strong
          ? "Why does it lie so flat?"
          : "Why does it tilt down?",
      answer: high
        ? (strong
            ? `Because it sounds bright${top ? ", the brightest record here" : ""}. `
            : "Because it sounds brighter than most here. ") +
          "Bright records stand open; dark ones lie down."
        : (strong
            ? `Because it sounds dark${bottom ? ", the darkest record here" : ""}: ` +
              "most of its energy sits low. "
            : "Because it sounds a little darker than most here. ") +
          "Dark records lie down; bright ones stand open.",
      what: high ? "What if it sounded darker?" : "What if it sounded brighter?",
      label: high ? "Darker" : "Brighter",
      result: high
        ? "As bright as a usual record here, it settles and tilts down."
        : "As bright as a usual record here, it rises and opens.",
    };
  }
  return {
    ask: high
      ? strong
        ? "Why is its dark center so large?"
        : "Why is its dark center fairly large?"
      : strong
        ? "Why is its dark center so small?"
        : "Why is its dark center fairly small?",
    answer: high
      ? (strong
          ? `Because it is loud${top ? ", the loudest record here" : ""}. `
          : "Because it is louder than most here. ") +
        "Loud records grow a heavy center that swallows the ring, and the name is set heavier too."
      : (strong
          ? `Because it is quiet${bottom ? ", the quietest record here" : ""}. `
          : "Because it is a little quieter than most here. ") +
        "Quiet records keep a small center and open space, and the name is set lighter too.",
    what: high ? "What if it were quieter?" : "What if it were louder?",
    label: high ? "Quieter" : "Louder",
    result: high
      ? "As loud as a usual record here, the center shrinks."
      : "As loud as a usual record here, the center swells.",
  };
}

const EXTREMES: Record<CompareAxis, [string, string]> = {
  duration: ["longest", "shortest"],
  spread: ["most uneven", "most even"],
  pulse: ["steadiest", "loosest"],
  dynamics: ["most dynamic", "most compressed"],
  brightness: ["brightest", "darkest"],
  loudness: ["loudest", "quietest"],
};

const ordinal = (n: number) => {
  const tens = n % 100;
  const unit = n % 10;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${unit === 1 ? "st" : unit === 2 ? "nd" : unit === 3 ? "rd" : "th"}`;
};

export const ANATOMY_EN: AnatomyWriter = {
  phrase,
  measure: {
    duration: "Length",
    spread: "Pulse spread",
    pulse: "Pulse",
    dynamics: "Dynamics",
    brightness: "Brightness",
    loudness: "Loudness",
  },
  shown(axis, v) {
    if (axis === "duration") return `${Math.round(v / 60)} min`;
    if (axis === "dynamics") return `${v.toFixed(1)} dB range`;
    if (axis === "brightness") return `${Math.round(v)} Hz`;
    if (axis === "loudness") return `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)} dB`;
    return v.toFixed(2);
  },
  standing({ axis, rank, of }) {
    const [high, low] = EXTREMES[axis];
    if (rank === 1) return `${high} of ${of}`;
    if (rank === of) return `${low} of ${of}`;
    return `${ordinal(rank)} ${high} of ${of}`;
  },
  drawn: {
    satellites: "small bodies around the ring",
    gaps: "breaks between the sectors",
    strata: "layers in the ring",
    contour: "relief of the outline",
    posture: "how flat the body lies",
    core: "the dark center",
  },
  nameFact: (weight) =>
    `The name is set at weight ${weight}: the louder the record, the heavier the type.`,
  colourNote: "Colour comes from the cover, not from the sound.",
};
