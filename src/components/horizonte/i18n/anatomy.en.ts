import type { CompareAxis, Finding, Question } from "../anatomy";
import type { AnatomyWriter, Phrasing } from "./types";

type Of<P extends Finding["part"]> = Extract<Finding, { part: P }>;

const COUNT = ["no", "one", "two", "three", "four"];
const count = (n: number) => COUNT[n] ?? String(n);
const bodies = (n: number) => `${count(n)} small ${n === 1 ? "body" : "bodies"}`;
const when = (on: boolean, text: string) => (on ? text : "");
const mins = (n: number) => (n === 1 ? "1 minute" : `${n} minutes`);

const NEAR: Record<Exclude<Finding["part"], "satellites">, { ask: string; answer: string }> = {
  gaps: {
    ask: "What opens breaks in the ring?",
    answer:
      "Differences in rhythm between tracks. Each sector of the ring is a track, and the breaks " +
      "between them widen the more the tracks differ in regularity; here the difference is " +
      "typical of the collection.",
  },
  strata: {
    ask: "What would split the ring into layers?",
    answer:
      "A regular rhythm. When the notes land on a repeating grid, the ring splits into layers, " +
      "set further apart the more regular the rhythm; this record's regularity is typical of " +
      "the collection.",
  },
  contour: {
    ask: "What carves its edge?",
    answer:
      "The contrast between quiet and intense passages. The edge follows intensity across the " +
      "record, pushing out where the music swells; this record's contrast is typical of the " +
      "collection, and so are its cuts.",
  },
  posture: {
    ask: "What sets the shape's tilt?",
    answer:
      "Brightness: how much of the sound's energy sits in the treble. More treble turns the " +
      "shape toward you, round; less lays it down. This record's brightness is typical of the " +
      "collection, and so is its tilt.",
  },
  core: {
    ask: "What sets the size of its dark center?",
    answer:
      "Average loudness. In Horizonte, loudness is mass: louder records get a bigger body and a " +
      "center that narrows the ring; quieter ones, the reverse. This one sits in the middle of " +
      "the collection.",
  },
};

function satellites(f: Of<"satellites">): Phrasing {
  const { bodies: n, after, minutes: min, high } = f;
  const d = Math.abs(after - n);
  const ask =
    n === 0
      ? "Why is this shape alone?"
      : n === 1
        ? "Where does the small body beside it come from?"
        : `Where do the ${count(n)} small bodies come from?`;
  const rule = "Horizonte shows time as small bodies around the shape, more of them the longer it runs";
  const answer = f.near
    ? `From its length: ${min} minutes, close to the collection's typical length. ${rule}; ` +
      `this length makes ${n === 0 ? "none" : count(n)}.`
    : n === 0
      ? `Because the record is short: ${min} minutes${when(f.bottom, ", the shortest here")}. ` +
        "Horizonte shows length as small bodies gathering around the shape as a record runs " +
        "longer, and this one ends before the first appears."
      : high
        ? `From its length: ${min} minutes, ` +
          `${f.top ? "the longest record here" : "longer than most here"}. Rather ` +
          "than enlarge the main shape, Horizonte shows time as small bodies around it: the " +
          "longer the record, the more of them."
        : `From its length: ${min} minutes, shorter than most here. ${rule}; at this length ` +
          `there ${n === 1 ? "is just one" : `are only ${count(n)}`}.`;
  const extra = mins(Math.abs(f.extra));
  const change =
    after < n
      ? (d === n
          ? n === 1
            ? "the small body disappears."
            : "the small bodies disappear."
          : after === 1
            ? "one small body remains."
            : `${count(after)} small bodies remain.`) +
        ` ${d === 1 ? "The one that goes stood" : "The ones that go stood"} for this record's ` +
        `extra ${extra}.`
      : after > n
        ? (n === 0
            ? d === 1
              ? "a small body appears beside it."
              : `${bodies(d)} appear around it.`
            : d === 1
              ? "one more small body appears."
              : `${count(d)} more appear.`) +
          ` ${d === 1 ? "It stands" : "They stand"} for the ${extra} this record ` +
          "doesn't have."
        : n === 0
          ? "it stays alone."
          : n === 1
            ? `its small body stays, a little ${high ? "smaller" : "larger"}.`
            : `its ${bodies(n)} stay, a little ${high ? "smaller" : "larger"}.`;
  return {
    ask,
    answer,
    what: f.near ? null : high ? "What if the record were shorter?" : "What if the record were longer?",
    label: high ? "Shorter" : "Longer",
    result: `At ${f.usual} minutes, the collection's typical length, ${change}`,
  };
}

function gaps(f: Of<"gaps">): Phrasing {
  const { high, top, bottom } = f;
  const ask = f.open
    ? "Why is the ring broken apart?"
    : high
      ? "Why does the ring have breaks?"
      : "Why is the ring almost unbroken?";
  const answer = f.open
    ? "Because its tracks differ a lot in rhythm: some keep a regular beat, others drift free " +
      "of any grid. Each sector of the ring is a track, and the width of the breaks between " +
      "them measures that difference across the whole record" +
      `${when(top, ", here the largest in the collection")}.`
    : high
      ? "Because its tracks differ somewhat in rhythm: some are more regular than others. Each " +
        "sector of the ring is a track, and the breaks between them measure that difference " +
        "across the whole record; here it is larger than typical, though still small."
      : "Because its tracks are alike in rhythm, nearly equally regular. Each sector of the ring " +
        "is a track, and the breaks between them only widen when tracks differ in that way" +
        `${when(bottom, "; here they differ less than anywhere else in the collection")}.`;
  return {
    ask,
    answer,
    what: high
      ? "What if its tracks were alike in rhythm?"
      : "What if its tracks varied more in rhythm?",
    label: high ? "Alike in rhythm" : "More varied",
    result: high
      ? "With tracks as alike in rhythm as a typical record's, the breaks narrow all around the ring."
      : "With tracks as varied in rhythm as a typical record's, the breaks widen all around the ring.",
  };
}

function strata(f: Of<"strata">): Phrasing {
  const { high, top, bottom } = f;
  const shape =
    "In the shape, that regularity becomes parallel rings, set further apart the more regular " +
    "the rhythm";
  const ask =
    f.beat === "steady"
      ? "Why does the ring have layers?"
      : f.beat === "none"
        ? "Why does the ring have no layers?"
        : high
          ? "Why does the ring split into layers?"
          : "Why are the ring's layers so faint?";
  const answer =
    f.beat === "steady"
      ? "Because its rhythm is very regular: the notes land on a grid that repeats from start to " +
        `end. ${shape}${when(top, ". No record here is as regular")}.`
      : f.beat === "none"
        ? "Because the music follows no rhythmic grid: sounds arrive without a beat that repeats. " +
          "Layers only appear when a rhythm is regular" +
          `${when(bottom, ", and no record here is less so")}.`
        : high
          ? `Because its rhythm is fairly regular, more than most records here. ${shape}.`
          : "Because its rhythm is only loosely regular: there is a grid, but a weak one. The " +
            "layers are there, pressed close together; they separate as a rhythm grows more regular.";
  return {
    ask,
    answer,
    what: high ? "What if the rhythm were less regular?" : "What if the rhythm were more regular?",
    label: high ? "Less regular" : "More regular",
    result: high
      ? "With a typical record's regularity, the layers draw closer together."
      : f.beat === "none"
        ? "With a typical record's regularity, the ring splits into layers, still close together."
        : "With a typical record's regularity, the layers pull apart and sharpen.",
  };
}

function contour(f: Of<"contour">): Phrasing {
  const { high, strong, top, bottom } = f;
  const ask = high
    ? strong
      ? "Why is its edge so jagged?"
      : "Why is its edge carved?"
    : strong
      ? "Why is its edge so smooth?"
      : "Why is its edge nearly smooth?";
  const answer = high
    ? (strong
        ? "Because of the strong contrast between its quiet and intense passages."
        : "Because of the contrast between its quiet and intense passages, greater than in most " +
          "records here.") +
      " The ring runs through the record from start to end, so the edge pushes out where the " +
      "music swells and pulls in where it settles; the stronger the contrast, the deeper the cut." +
      (top
        ? " No record here has more. Playing, it also pulses with the sound more than any other."
        : strong
          ? " Playing, the shape also pulses strongly with the sound."
          : "")
    : (strong
        ? "Because its volume barely changes: from its quietest passage to its most intense, the " +
          "difference is small."
        : "Because its volume varies less than in most records here.") +
      " The edge follows intensity across the record, and with little contrast it barely moves" +
      `${when(bottom, "; no record here varies less")}.` +
      when(strong, " Playing, the shape pulses only a little.");
  return {
    ask,
    answer,
    what: high ? "What if its volume varied less?" : "What if its volume varied more?",
    label: high ? "Less contrast" : "More contrast",
    result: high
      ? "With a typical record's contrast, the cuts grow shallower but stay in place, following " +
        "the same passages."
      : "With a typical record's contrast, the cuts deepen, right where the music already rose " +
        "and settled.",
  };
}

function posture(f: Of<"posture">): Phrasing {
  const { high, strong, top, bottom } = f;
  const ask = high
    ? strong
      ? "Why does the shape look so open?"
      : "Why does the shape look open?"
    : strong
      ? "Why is the shape so flat?"
      : "Why is the shape flattened?";
  const answer = high
    ? strong
      ? "This music carries a lot of its energy in the treble: it sounds bright. To show that " +
        "brightness, Horizonte turns the shape toward you; the more treble, the more it faces " +
        `you, almost round.${when(top, " No record here is brighter.")}`
      : "This music carries more treble than most records here, so it sounds brighter. In the " +
        "shape, brightness becomes tilt: the more treble, the more it faces you, rounded."
    : strong
      ? "Nearly all of this music's energy sits in the low end, with little treble on top: it " +
        "sounds dark. To show that, Horizonte lays the shape down, flattened, as if seen from " +
        `the side.${when(bottom, " No record here is darker.")}`
      : "This music carries less treble than most records here, so it sounds a little dark. In " +
        "the shape, that becomes tilt: with less treble, it lies down and flattens.";
  return {
    ask,
    answer,
    what: high ? "What if it had less treble?" : "What if it had more treble?",
    label: high ? "Less treble" : "More treble",
    result: high
      ? "With a typical record's brightness, the shape tips back and flattens."
      : "With a typical record's brightness, the shape lifts and rounds out.",
  };
}

function core(f: Of<"core">): Phrasing {
  const { high, strong, top, bottom } = f;
  const ask = high
    ? strong
      ? "Why is its dark center so large?"
      : "Why is its dark center large?"
    : strong
      ? "Why is its dark center so small?"
      : "Why is its dark center small?";
  const answer = high
    ? strong
      ? "Because it plays loud, on average, from start to end. In Horizonte, " +
        "loudness is mass: the louder the record, the bigger the body and its dark center, which " +
        `takes over the ring around it.${when(top, " This is the loudest record here.")}`
      : "It plays louder than most records here, start to end. In Horizonte, loudness is mass: " +
        "the body grows and the dark center presses into the ring."
    : strong
      ? "Because it plays quietly from start to end. In Horizonte, loudness is mass: with little " +
        "of it, the body shrinks and the dark center leaves a wide ring around it." +
        when(bottom, " No record here is quieter.")
      : "It plays a little quieter than most records here. Since loudness is mass in Horizonte, " +
        "the body stays smaller and the dark center leaves the ring more room.";
  return {
    ask,
    answer,
    what: high ? "What if it were quieter overall?" : "What if it were louder overall?",
    label: high ? "Quieter" : "Louder",
    result: high
      ? "At a typical record's loudness, the whole body shrinks and the dark center gives room " +
        "back to the ring."
      : "At a typical record's loudness, the whole body grows and the dark center presses into " +
        "the ring.",
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
  duration: ["longest", "shortest"],
  spread: ["most uneven", "most even"],
  pulse: ["most regular", "least regular"],
  dynamics: ["highest contrast", "lowest contrast"],
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
    spread: "Rhythm difference between tracks",
    pulse: "Rhythmic regularity",
    dynamics: "Contrast",
    brightness: "Brightness",
    loudness: "Average loudness",
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
    contour: "relief of the edge",
    posture: "tilt of the shape",
    core: "size of the body and its dark center",
  },
  details(q) {
    const f = q.finding;
    if (f.part === "satellites") {
      return [["Bodies appear at", `${f.onsets.map(Math.round).join(" · ")} min`]];
    }
    if (f.part === "core") return [["Name weight", String(f.nameWeight)]];
    return [];
  },
  depth(q) {
    if (q.part !== "satellites") return null;
    return (
      "The ring always makes one full turn, each track taking a slice in proportion to its " +
      "time, so the total length has to show outside it."
    );
  },
  nameFact(f) {
    const rel = f.near
      ? "This one has the typical weight."
      : f.top
        ? "This one is the heaviest here."
        : f.bottom
          ? "This one is the lightest here."
          : f.high
            ? f.strong
              ? "This one is among the heaviest."
              : "This one is set a little heavier than most."
            : f.strong
              ? "This one is among the lightest."
              : "This one is set a little lighter than most.";
    return (
      "The name follows average loudness too: the louder the record, the thicker its letters. " +
      rel
    );
  },
  colourNote: "The colours come from the cover, not from the music.",
};

